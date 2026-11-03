// Sonde Y du labo (contrats 2.6 point 9, 5.2 points 3 et 4, 5.4 point 8) : une app minimale qui fait ce que fera Publipostage+ avec son extension « Lecture de PDF ». Elle demande `contexte`,
// reçoit l'`ouverture` (`lecture: { id, fichier }`) au démarrage ou l'appel `ouvrir` quand elle est déjà ouverte, charge pdf.js par la source que GFS donne (`bibliotheques.pdfjs` :
// `<script type="module" src integrity crossorigin>`, jamais `import()`), lit le PDF, dessine la page et sa couche de texte. Ce qu'elle a reçu, chargé et vu est écrit dans
// `document.body.dataset.sonde`, que le labo lit : le fichier est-il un vrai `File` dans ce cadre isolé, la bibliothèque s'est-elle chargée sous la politique de l'app, combien de pages,
// quel texte, quelle encre, quelles violations de politique ou erreurs.
(function () {
  'use strict';
  const received = { contexte: false, extensions: [], bibliotheque: null, ouverture: null, appels: [], lectures: [], pdf: null, violations: [], erreurs: [] };
  const publish = () => { document.body.dataset.sonde = JSON.stringify(received); };
  const post = message => window.parent.postMessage(message, '*');
  const $ = id => document.getElementById(id);
  const say = text => { $('state').textContent = text; };
  let context = null;
  let library = null;
  let doc = null;
  let task = null;
  let current = 0;
  let queue = Promise.resolve();

  document.addEventListener('securitypolicyviolation', event => { received.violations.push(`${event.violatedDirective} ${String(event.blockedURI).slice(0, 120)}`); publish(); });

  // Le fichier tel que l'app le voit, lu en entier : un vrai `File` ? son nom, sa taille, son type, ses premiers octets, son empreinte.
  async function describe(file) {
    const info = { estFichier: file instanceof File, nom: file && file.name, taille: file && file.size, type: file && file.type };
    try {
      const buffer = await file.arrayBuffer();
      info.lus = buffer.byteLength;
      info.entete = new TextDecoder('latin1').decode(new Uint8Array(buffer, 0, 8));
      info.empreinte = crypto.subtle ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(byte => byte.toString(16).padStart(2, '0')).join('') : null;
      return { info, buffer };
    } catch (error) {
      info.erreur = String((error && error.message) || error);
      return { info, buffer: null };
    }
  }

  // pdf.js par la source que GFS donne : un script module avec son empreinte, puis `GfsPaquets.pdfjs` (contrats 2.6, point 9). Rend les modules, ou dit pourquoi pas.
  function loadLibrary() {
    if (library) return Promise.resolve(library);
    const source = context && context.bibliotheques && context.bibliotheques.pdfjs;
    if (!source) return Promise.reject(new Error('GFS ne donne pas pdf.js : l\'extension « Lecture de PDF » n\'est pas active.'));
    received.bibliotheque = { src: source.src, integrite: source.integrite, forme: source.forme, chargee: false };
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = source.src;
      script.integrity = source.integrite;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        const set = globalThis.GfsPaquets && globalThis.GfsPaquets.pdfjs;
        if (!set) { reject(new Error('Le fichier est chargé mais ne pose pas GfsPaquets.pdfjs.')); return; }
        library = set.modules['pdfjs-dist/build/pdf.min.mjs'];
        received.bibliotheque.chargee = true;
        received.bibliotheque.version = set.version;
        received.bibliotheque.pdfjs = library.version;
        resolve(library);
      };
      script.onerror = () => reject(new Error('Le navigateur a refusé le script (politique de sécurité, réseau ou empreinte).'));
      document.head.append(script);
    });
  }

  // Une page : dessinée sur le canevas à la taille de la scène, puis sa couche de texte (la sélection à la souris), et ce qu'on y a vu.
  async function showPage(number) {
    const started = performance.now();
    const page = await doc.getPage(number);
    const stage = $('stage');
    const natural = page.getViewport({ scale: 1 });
    const scale = Math.min((stage.clientWidth - 14) / natural.width, (stage.clientHeight - 14) / natural.height);
    const viewport = page.getViewport({ scale });
    const ratio = window.devicePixelRatio || 1;
    const canvas = $('canvas');
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const layer = $('text');
    layer.replaceChildren();
    layer.style.setProperty('--total-scale-factor', String(viewport.scale));
    const transform = ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0];
    try { await page.render({ canvas, viewport, transform }).promise; } catch (error) { await page.render({ canvasContext: canvas.getContext('2d'), viewport, transform }).promise; }
    const content = await page.getTextContent();
    await new library.TextLayer({ textContentSource: content, container: layer, viewport }).render();
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0;
    let dark = 0;
    for (let at = 0; at < pixels.length; at += 4 * 7) {
      if (pixels[at] < 250 || pixels[at + 1] < 250 || pixels[at + 2] < 250) ink += 1;
      if (pixels[at] < 110 && pixels[at + 1] < 110 && pixels[at + 2] < 110) dark += 1;
    }
    current = number;
    $('where').textContent = `${number} / ${doc.numPages}`;
    $('prev').disabled = number <= 1;
    $('next').disabled = number >= doc.numPages;
    received.pdf = {
      pages: doc.numPages, page: number, texte: content.items.map(item => item.str).filter(Boolean), encre: ink, sombre: dark, echelle: Math.round(viewport.scale * 1000) / 1000,
      couche: { spans: layer.querySelectorAll('span').length, texte: layer.textContent }, canevas: [canvas.width, canvas.height], ms: Math.round(performance.now() - started),
    };
    publish();
  }

  // Une ouverture avec `lecture` : décrire le fichier, charger la bibliothèque, ouvrir le PDF, montrer la première page.
  async function open(opening) {
    const lecture = opening && opening.lecture;
    if (!lecture) { received.ouverture = opening || null; publish(); return false; }
    received.ouverture = { raison: opening.raison, type: opening.type, fichier: opening.fichier, dossier: opening.dossier, id: lecture.id };
    const { info, buffer } = await describe(lecture.fichier);
    received.lectures.push({ id: lecture.id, ...info });
    publish();
    $('name').textContent = info.nom || '';
    if (!buffer) { say('Fichier illisible'); return false; }
    try {
      say('Ouverture…');
      const pdfjs = await loadLibrary();
      // Le document précédent se ferme par sa tâche de chargement (`PDFDocumentProxy` n'a plus de `destroy()`), puis le suivant s'ouvre.
      if (task) { await task.destroy(); task = null; doc = null; }
      task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, verbosity: 0 });
      doc = await task.promise;
      $('page').hidden = false;
      await showPage(1);
      say(`${doc.numPages} page${doc.numPages > 1 ? 's' : ''}`);
      return true;
    } catch (error) {
      received.erreurs.push(String((error && error.message) || error).slice(0, 300));
      say('Lecture impossible');
      publish();
      return false;
    }
  }

  const go = number => { if (doc && number >= 1 && number <= doc.numPages && number !== current) queue = queue.then(() => showPage(number)).catch(error => { received.erreurs.push(String(error && error.message)); publish(); }); };
  $('prev').addEventListener('click', () => go(current - 1));
  $('next').addEventListener('click', () => go(current + 1));
  document.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'PageDown') go(current + 1);
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') go(current - 1);
  });

  // Le routeur de GFS livre ici les messages du parent ; on ne lit que lui, et que les enveloppes (sans `mtype`).
  window.addEventListener('message', event => {
    const msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type === 'reponse' && msg.id === 1) {
      context = msg.data;
      received.contexte = true;
      received.extensions = context.extensions || [];
      publish();
      if (context.ouverture) open(context.ouverture).then(publish);
      return;
    }
    if (msg.type === 'evenement' && msg.nom === 'extensions' && context) {
      context.extensions = msg.data.extensions;
      context.bibliotheques = msg.data.bibliotheques;
      received.extensions = msg.data.extensions || [];
      publish();
      return;
    }
    if (msg.type !== 'appel') return;
    if (msg.nom !== 'ouvrir') {
      post({ gfs: 0, type: 'erreur', id: msg.id, code: 'GFS_INCONNU', message: 'L\'appel « ' + msg.nom + ' » est inconnu de cette app.' });
      return;
    }
    received.appels.push({ raison: msg.args && msg.args.raison, type: msg.args && msg.args.type, lecture: Boolean(msg.args && msg.args.lecture) });
    if (document.body.dataset.reponse === 'non') { post({ gfs: 0, type: 'reponse', id: msg.id, data: { ouvert: false } }); return; }
    open(msg.args).then(opened => post({ gfs: 0, type: 'reponse', id: msg.id, data: { ouvert: opened } }));
  });
  // Ce que fait le script d'API de Grist au démarrage d'une app : `ready`, puis le thème (c'est alors que GFS montre le cadre).
  post({ mtype: 5 });
  post({ mtype: 4, data: { message: 'themeInitialized' } });
  post({ gfs: 0, type: 'appel', id: 1, nom: 'contexte', args: {} });
  publish();
}());
