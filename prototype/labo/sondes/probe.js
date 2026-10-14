// Sonde du labo (étape 2, contrats 9.11) : une app minimale, SANS le script d'API de Grist, qui fait ce que fera une extension d'app : demander
// `contexte` à GFS, charger chaque bibliothèque par l'adresse et l'empreinte que GFS donne, et recommencer quand l'événement `extensions` arrive.
// Chaque variante (a-self, b-host, …) porte sa propre politique de sécurité du contenu (balise meta de son index.html) et sa stratégie de
// chargement (`data-strategy` du corps) : c'est la différence qu'on mesure. Le résultat est écrit dans `document.body.dataset.probe`, que le labo lit.
(function () {
  'use strict';
  const results = { strategie: document.body.dataset.strategy || 'script', contexte: null, evenements: [], chargements: [], erreurs: [] };
  const publish = () => { document.body.dataset.probe = JSON.stringify(results); };
  const post = message => window.parent.postMessage(message, '*');
  const waiting = new Map();
  let nextId = 1;
  const loaded = new Set();

  function call(nom, args) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      post({ gfs: 0, type: 'appel', id, nom, args: args || {} });
      setTimeout(() => { if (waiting.delete(id)) reject(new Error(`pas de réponse à ${nom}`)); }, 5000);
    });
  }

  // Les trois façons de charger ce que GFS a donné (l'adresse et l'empreinte, rien d'autre) :
  //  - script : un élément <script src integrity crossorigin> ;
  //  - texte  : fetch avec `integrity`, puis eval indirect du texte (demande 'unsafe-eval' à la politique de l'app) ;
  //  - blob   : fetch avec `integrity`, puis un <script> sur une adresse blob: (demande blob: à la politique de l'app).
  function scriptElement(src, integrity) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      if (integrity) el.integrity = integrity;
      el.crossOrigin = 'anonymous';
      el.onload = resolve;
      el.onerror = () => reject(new Error('le script ne se charge pas'));
      document.head.append(el);
    });
  }
  const fetchText = async (src, integrity) => {
    const response = await fetch(src, { integrity, mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(`réponse ${response.status}`);
    return response.text();
  };
  const strategies = {
    script: (src, integrity) => scriptElement(src, integrity),
    texte: async (src, integrity) => { (0, eval)(await fetchText(src, integrity)); },
    blob: async (src, integrity) => scriptElement(URL.createObjectURL(new Blob([await fetchText(src, integrity)], { type: 'text/javascript' })), ''),
  };

  // Mesure un chargement : le résultat, les violations de la politique (l'événement du navigateur dit laquelle), la durée.
  async function measure(id, src, integrity, label) {
    const record = { id, label, src: src.replace(/^https?:\/\/[^/]+/, m => m), strategie: results.strategie, resultat: null, violations: [], message: null };
    const onViolation = event => record.violations.push({ directive: event.effectiveDirective || event.violatedDirective, bloque: String(event.blockedURI).slice(0, 100) });
    document.addEventListener('securitypolicyviolation', onViolation);
    const started = performance.now();
    try {
      await strategies[results.strategie](src, integrity);
      record.resultat = 'charge';
    } catch (error) {
      record.resultat = 'refuse';
      record.message = String(error && error.message).slice(0, 120);
    }
    await new Promise(resolve => setTimeout(resolve, 80)); // l'événement de politique arrive un instant après l'erreur
    document.removeEventListener('securitypolicyviolation', onViolation);
    record.ms = Math.round(performance.now() - started);
    if (record.resultat === 'refuse' && record.violations.length) record.resultat = 'refuse par la politique de securite';
    return record;
  }

  // Le moteur tourne-t-il ? Un graphique réel, rendu en SVG (Plotly.toImage), comme le fera l'extension.
  async function exercise(record) {
    if (record.resultat !== 'charge') return;
    try {
      const holder = document.createElement('div');
      document.body.append(holder);
      await window.Plotly.newPlot(holder, [{ x: [1, 2, 3], y: [2, 1, 3], type: 'bar' }], { width: 320, height: 200 });
      const image = await window.Plotly.toImage(holder, { format: 'svg', width: 320, height: 200 });
      record.moteur = { version: window.Plotly.version, svg: image.length };
      holder.remove();
    } catch (error) { record.moteur = { erreur: String(error && error.message).slice(0, 120) }; }
  }

  async function loadAll(libraries, why) {
    for (const [id, { src, integrite }] of Object.entries(libraries || {})) {
      const key = `${id}|${src}`;
      if (loaded.has(key)) continue;
      loaded.add(key);
      const record = await measure(id, src, integrite, why);
      await exercise(record);
      if (record.resultat === 'charge' && !results.controle) {
        // Contrôle négatif : la même adresse avec une empreinte fausse doit être refusée par le navigateur (sans violation de politique).
        const wrong = `sha384-${'A'.repeat(64)}`;
        results.controle = await measure(id, src, wrong, 'empreinte fausse');
      }
      results.chargements.push(record);
      publish();
    }
  }

  window.addEventListener('message', event => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || typeof message !== 'object' || message.gfs !== 0) return;
    if ((message.type === 'reponse' || message.type === 'erreur') && waiting.has(message.id)) {
      const entry = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.type === 'reponse') entry.resolve(message.data); else entry.reject(Object.assign(new Error(message.message), { code: message.code }));
    } else if (message.type === 'evenement' && message.nom === 'extensions') {
      results.evenements.push({ extensions: message.data.extensions, bibliotheques: Object.keys(message.data.bibliotheques || {}) });
      publish();
      void loadAll(message.data.bibliotheques, 'evenement extensions');
    }
  });

  // Ce que fait le script d'API de Grist au démarrage d'une app : `ready`, puis le thème (l'app se montre).
  post({ mtype: 5 });
  post({ mtype: 4, data: { message: 'themeInitialized' } });
  call('contexte').then(context => {
    results.contexte = { contrat: context.contrat, hote: context.hote, acces: context.acces, extensions: context.extensions, bibliotheques: Object.keys(context.bibliotheques || {}), champs: Object.keys(context).length };
    publish();
    return loadAll(context.bibliotheques, 'contexte');
  }).catch(error => { results.erreurs.push(String(error && error.message)); publish(); });
  publish();
}());
