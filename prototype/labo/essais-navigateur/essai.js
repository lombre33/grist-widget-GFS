// Page d'essai du navigateur de la personne (LISEZ-MOI.md du dossier). Trois rôles dans un seul script, selon `data-role` du corps :
//   `haut`   la page qu'on ouvre : elle pose les cadres, reçoit leurs rapports et fait celui qu'on copie ;
//   `milieu` un cadre qui en pose un autre, comme GFS dans Grist ;
//   `cadre`  là où l'on essaie : des fautes à corriger (LanguageTool) et six façons de télécharger un fichier.
// Deux jeux de cadres pour `haut`, selon `data-jeu` du corps : `complet` (index.html, cadres A à E) et `profond` (profond.html, cadres P1 à P5).
'use strict';

// Les attributs du cadre d'une app dans GFS (prototype/js/frames.js : SANDBOX et `allow`).
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads';
const ALLOW = 'clipboard-write';
const TOUS = 't1,t2,t3,t4,t5,t6';
const CADRES = [
  { id: 'A', titre: 'A · cadre simple, comme Publipostage+ seule dans Grist', page: 'cadre.html', tests: 't1,t2' },
  { id: 'B', titre: 'B · cadre isolé comme celui de GFS, au premier niveau', page: 'cadre.html', sandbox: SANDBOX, tests: TOUS },
  { id: 'C', titre: 'C · cadre isolé avec la même origine (essai de contrôle)', page: 'cadre.html', sandbox: `${SANDBOX} allow-same-origin`, tests: 't1' },
  { id: 'D', titre: 'D · deux niveaux, sans isolement', page: 'milieu.html', tests: 't1,t2' },
  { id: 'E', titre: 'E · deux niveaux, le dernier isolé : comme GFS dans Grist', page: 'milieu.html', isole: true, tests: TOUS },
];
// Le jeu `profond` : « LanguageTool travaille-t-il dans le cadre d'une app posé comme GFS le pose dans Grist ? », sans téléchargement. `point` : l'app vient du même site écrit avec un point à la fin du nom
// (https://lombre33.github.io./…), que le navigateur compte comme une autre origine ; `garde` : le cadre de l'app, isolé, garde sa vraie origine (allow-same-origin).
const PROFOND = [
  { id: 'P1', titre: "P1 · comme GFS aujourd'hui : trois pages l'une dans l'autre, l'app isolée, au nom du site", page: 'milieu.html', isole: true, tests: '' },
  { id: 'P2', titre: "P2 · trois pages l'une dans l'autre, l'app isolée, au nom du site écrit avec un point à la fin", page: 'milieu.html', isole: true, point: true, tests: '' },
  { id: 'P3', titre: "P3 · trois pages l'une dans l'autre, l'app isolée mais gardant sa vraie origine (allow-same-origin), au nom avec le point", page: 'milieu.html', isole: true, garde: true, point: true, tests: '' },
  { id: 'P4', titre: "P4 · deux pages l'une dans l'autre, l'app isolée, au nom du site (comme B de la première page d'essai)", page: 'cadre.html', sandbox: SANDBOX, tests: '' },
  { id: 'P5', titre: "P5 · deux pages l'une dans l'autre, l'app isolée, au nom avec le point (comme Z de l'essai de tout à l'heure)", page: 'cadre.html', sandbox: SANDBOX, point: true, tests: '' },
];
const JEUX = {
  complet: { cadres: CADRES, titre: 'Essai du navigateur, version 2 (la page laisse passer blob: et data:)' },
  profond: { cadres: PROFOND, titre: 'Essai à trois pages l\'une dans l\'autre (nom du site avec ou sans point à la fin)' },
};
const ETATS = { t0: 'pas essayé', ok: 'arrivé', ko: 'rien' };

const dom = (tag, props = {}, ...enfants) => {
  const noeud = Object.assign(document.createElement(tag), props);
  noeud.append(...enfants);
  return noeud;
};
const deCe = source => [...document.querySelectorAll('iframe')].some(f => f.contentWindow === source);

// Le geste de Publipostage+ (ExportCommon.downloadBlob) : une adresse d'objet, une ancre `download`, un clic, et l'adresse libérée aussitôt (délai 0) ou plus tard.
function ancre(href, nom) {
  const a = dom('a', { href, download: nom });
  document.body.appendChild(a); a.click(); a.remove();
}
function enregistrer(blob, nom, delai) {
  const url = URL.createObjectURL(blob);
  ancre(url, nom);
  if (delai === 0) URL.revokeObjectURL(url); else setTimeout(() => URL.revokeObjectURL(url), delai);
}

// Ce qu'une page reçoit de ses cadres : un fichier à enregistrer (c'est elle qui télécharge, pas le cadre isolé) ou un état à faire remonter.
function ecouter(surEtat) {
  addEventListener('message', event => {
    const d = event.data;
    if (!d || !deCe(event.source)) return;
    if (d.essai === 'telecharger') enregistrer(d.blob || new Blob([d.octets], { type: d.type }), String(d.nom), 10000);
    else if (d.essai === 'etat') surEtat(d);
  });
}

function choix(nom, options, surChoix) {
  const bloc = dom('span', { className: 'choix' });
  for (const [valeur, libelle] of options) {
    const radio = dom('input', { type: 'radio', name: nom, value: valeur });
    radio.addEventListener('change', () => surChoix(valeur));
    bloc.append(dom('label', {}, radio, ` ${libelle}`));
  }
  return bloc;
}

// L'adresse d'une page du dossier ; avec `point`, le nom du site est écrit avec un point à la fin (https://lombre33.github.io./…).
const adresse = (page, point, recherche) => {
  const url = new URL(page, location.href);
  if (point) url.hostname += '.';
  url.search = recherche;
  return url.href;
};

function poserCadre(conteneur, { id, titre, page, sandbox, isole, garde, point, tests }) {
  // milieu.html pose lui-même le cadre intérieur : isolé (i=1), qui garde sa vraie origine (s=garde), au nom avec le point (b=point) ; il reçoit j=profond pour des cadres plus bas.
  const imbrique = page === 'milieu.html';
  const recherche = `?c=${id}&t=${tests}${isole ? '&i=1' : ''}${garde ? '&s=garde' : ''}${imbrique && point ? '&b=point' : ''}${imbrique && document.body.dataset.jeu === 'profond' ? '&j=profond' : ''}`;
  const frame = dom('iframe', { src: adresse(page, point && !imbrique, recherche), title: titre, className: imbrique ? 'milieu' : '' });
  if (sandbox) frame.setAttribute('sandbox', sandbox);
  frame.setAttribute('allow', ALLOW);
  conteneur.append(dom('p', { className: 'cadre-titre' }, titre), frame);
}

function haut() {
  const jeu = JEUX[document.body.dataset.jeu || 'complet'];
  const etats = {};
  const rapport = document.getElementById('rapport');
  const avertissement = document.getElementById('avertissement');
  if (avertissement) avertissement.hidden = !location.hostname.endsWith('.');
  const lignes = (cadre, e) => (e
    ? [`Cadre ${cadre.titre}`, ...e.faits.map(l => `  ${l}`), ...Object.values(e.tests).map(([nom, etat]) => `  ${nom} : ${etat}`), `  LanguageTool corrige ici : ${e.lt}`]
    : [`Cadre ${cadre.titre}`, '  (aucun rapport : le cadre ne s\'est pas chargé ou a été bloqué)']);
  const refaire = () => {
    const quand = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    rapport.value = [`${jeu.titre}, ${quand} (heure de Paris)`, navigator.userAgent, `page qui porte les cadres : ${location.protocol}//${location.host}`, '', ...jeu.cadres.flatMap(c => lignes(c, etats[c.id]))].join('\n');
  };
  ecouter(e => { etats[e.cadre] = e; refaire(); });
  for (const cadre of jeu.cadres) poserCadre(document.getElementById('cadres'), cadre);
  refaire();
  document.getElementById('copier').addEventListener('click', async () => {
    rapport.select();
    const dit = texte => { document.getElementById('copie').textContent = texte; };
    try { await navigator.clipboard.writeText(rapport.value); dit('Copié.'); } catch { dit('Copie refusée : le texte est sélectionné, copie-le à la main (Ctrl+C).'); }
  });
}

function milieu() {
  const params = new URLSearchParams(location.search);
  if (params.get('j')) document.body.dataset.jeu = params.get('j');
  ecouter(d => parent.postMessage(d, '*'));
  const frame = dom('iframe', { src: adresse('cadre.html', params.get('b') === 'point', `?c=${params.get('c')}&t=${params.get('t')}`), title: 'cadre intérieur' });
  if (params.get('i') === '1') frame.setAttribute('sandbox', params.get('s') === 'garde' ? `${SANDBOX} allow-same-origin` : SANDBOX);
  frame.setAttribute('allow', ALLOW);
  document.body.append(dom('p', { className: 'faits' }, 'Cette page joue GFS : elle n\'est pas isolée et pose le cadre ci-dessous.'), frame);
}

const TEXTE = 'Les enfant mange des pomme et nous avons manger ensemble. Il y a plusieur erreure ici.';
const TESTS = {
  t1: ['Comme Publipostage+ (adresse libérée aussitôt)', (blob, nom) => enregistrer(blob, nom, 0)],
  t2: ['Adresse libérée au bout de 10 s', (blob, nom) => enregistrer(blob, nom, 10000)],
  t3: ['Adresse data:', (blob, nom, texte) => ancre(`data:text/plain;charset=utf-8,${encodeURIComponent(texte)}`, nom)],
  t4: ['Par la page du dessus (le fichier)', (blob, nom) => parent.postMessage({ essai: 'telecharger', nom, blob }, '*')],
  t5: ['Par la page du dessus (les octets)', async (blob, nom) => { const octets = await blob.arrayBuffer(); parent.postMessage({ essai: 'telecharger', nom, octets, type: blob.type }, '*', [octets]); }],
  t6: ['Comme Publipostage+, 7 secondes après le clic', (blob, nom) => setTimeout(() => enregistrer(blob, nom, 0), 7000)],
};

// Ce que LanguageTool laisse dans la page quand il y travaille : un indice seulement, la réponse de la personne fait foi.
function traces(champs) {
  const noms = new Set([...document.querySelectorAll('*')].map(e => e.localName).filter(n => /^(lt-|grammarly-)/.test(n)));
  const attrs = new Set(champs.flatMap(c => [...c.attributes].filter(a => /^(data-lt|data-gramm)/.test(a.name)).map(a => `${a.name}=${a.value}`)));
  const liste = s => ([...s].join(', ') || 'aucun');
  const installe = document.documentElement.hasAttribute('data-lt-installed') ? 'oui' : 'non';
  const spell = champs.map(c => c.getAttribute('spellcheck') ?? 'absent').join(' / ');
  return `balise html data-lt-installed : ${installe} ; éléments lt-* : ${liste(noms)} ; attributs posés sur les zones : ${liste(attrs)} ; spellcheck des zones : ${spell}`;
}

function cadre() {
  const params = new URLSearchParams(location.search);
  const id = params.get('c');
  const champs = [document.getElementById('zone'), document.getElementById('edition')];
  const etat = { essai: 'etat', cadre: id, faits: [], tests: {}, lt: 'pas répondu' };
  const envoyer = () => parent.postMessage(etat, '*');
  const profondeur = () => { let n = 0; for (let w = window; w !== w.parent; w = w.parent) n += 1; return n; };
  const stockage = () => { try { return `oui (${localStorage.length} clés)`; } catch (e) { return `non (${e.name})`; } };
  const lecture = () => { try { void parent.document.title; return 'oui'; } catch (e) { return `non (${e.name})`; } };
  const faits = () => {
    etat.origine = self.origin;
    etat.faits = [`origine du cadre : ${self.origin} ; niveau d'imbrication : ${profondeur()} ; stockage du navigateur : ${stockage()} ; lit la page qui le porte : ${lecture()}`, traces(champs)];
    envoyer();
  };
  document.getElementById('titre').textContent = `Cadre ${id}`;
  champs[0].value = TEXTE; champs[1].textContent = TEXTE;
  for (const t of (params.get('t') || '').split(',').filter(Boolean)) {
    const [nom, lancer] = TESTS[t];
    etat.tests[t] = [nom, ETATS.t0];
    const bouton = dom('button', { type: 'button', textContent: `Télécharger : ${nom}` });
    bouton.addEventListener('click', async () => {
      const texte = `Essai de téléchargement, cadre ${id}, variante ${t}.\né è à ç œ\n`;
      try { await lancer(new Blob([texte], { type: 'text/plain' }), `essai-${id}-${t}.txt`, texte); } catch (e) { etat.tests[t][1] = `erreur au lancement : ${e.name} ${e.message}`; envoyer(); }
    });
    const reponse = choix(`dl-${t}`, [['ok', 'le fichier est arrivé'], ['ko', 'rien n\'est arrivé']], v => { etat.tests[t][1] = ETATS[v]; envoyer(); });
    document.getElementById('tests').append(dom('div', { className: 'essai' }, bouton, reponse, dom('span', { className: 'faits' }, `(fichier essai-${id}-${t}.txt)`)));
  }
  document.getElementById('lt').append(choix('lt', [['oui', 'oui'], ['non', 'non, seul Firefox souligne']], v => { etat.lt = v; envoyer(); }));
  addEventListener('focusin', () => setTimeout(faits, 1500));
  faits();
  setTimeout(faits, 2000); setTimeout(faits, 5000);
}

({ haut, milieu, cadre })[document.body.dataset.role]();
