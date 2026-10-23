// Page d'essai du navigateur de la personne (LISEZ-MOI.md du dossier). Trois rôles dans un seul script, selon `data-role` du corps :
//   `haut`   la page qu'on ouvre : elle pose les cadres, reçoit leurs rapports et fait celui qu'on copie ;
//   `milieu` un cadre qui en pose un autre, comme GFS dans Grist ;
//   `cadre`  là où l'on essaie : des fautes à corriger (LanguageTool) et six façons de télécharger un fichier.
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

function poserCadre(conteneur, { id, titre, page, sandbox, isole, tests }) {
  const frame = dom('iframe', { src: `${page}?c=${id}&t=${tests}${isole ? '&i=1' : ''}`, title: titre, className: page === 'milieu.html' ? 'milieu' : '' });
  if (sandbox) frame.setAttribute('sandbox', sandbox);
  frame.setAttribute('allow', ALLOW);
  conteneur.append(dom('p', { className: 'cadre-titre' }, titre), frame);
}

function haut() {
  const etats = {};
  const rapport = document.getElementById('rapport');
  const lignes = (cadre, e) => (e
    ? [`Cadre ${cadre.titre}`, ...e.faits.map(l => `  ${l}`), ...Object.values(e.tests).map(([nom, etat]) => `  ${nom} : ${etat}`), `  LanguageTool corrige ici : ${e.lt}`]
    : [`Cadre ${cadre.titre}`, '  (aucun rapport : le cadre ne s\'est pas chargé ou a été bloqué)']);
  const refaire = () => {
    const quand = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    rapport.value = [`Essai du navigateur, version 2 (la page laisse passer blob: et data:), ${quand} (heure de Paris)`, navigator.userAgent, '', ...CADRES.flatMap(c => lignes(c, etats[c.id]))].join('\n');
  };
  ecouter(e => { etats[e.cadre] = e; refaire(); });
  for (const cadre of CADRES) poserCadre(document.getElementById('cadres'), cadre);
  refaire();
  document.getElementById('copier').addEventListener('click', async () => {
    rapport.select();
    const dit = texte => { document.getElementById('copie').textContent = texte; };
    try { await navigator.clipboard.writeText(rapport.value); dit('Copié.'); } catch { dit('Copie refusée : le texte est sélectionné, copie-le à la main (Ctrl+C).'); }
  });
}

function milieu() {
  const params = new URLSearchParams(location.search);
  ecouter(d => parent.postMessage(d, '*'));
  const frame = dom('iframe', { src: `cadre.html?c=${params.get('c')}&t=${params.get('t')}`, title: 'cadre intérieur' });
  if (params.get('i') === '1') frame.setAttribute('sandbox', SANDBOX);
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
  const faits = () => {
    etat.faits = [`origine du cadre : ${self.origin} ; niveau d'imbrication : ${profondeur()} ; stockage du navigateur : ${stockage()}`, traces(champs)];
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
