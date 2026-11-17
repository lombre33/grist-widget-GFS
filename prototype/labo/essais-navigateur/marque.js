// Page d'essai de la marque `data-lt-active="false"` (marque.html et marque-cadre.html ; LISEZ-MOI.md du labo). Deux rôles dans un seul script, selon `data-role` du corps :
//   `haut`   la page qu'on ouvre : elle pose deux cadres, reçoit leurs rapports et fait celui qu'on copie ;
//   `cadre`  là où l'on essaie : quatre zones de texte avec des fautes, dont une où la marque est posée puis retirée en cours de route.
// Question : LanguageTool laisse-t-il tranquille une zone qui porte la marque, la reprend-il quand on la retire, et le fait-il sans recharger la page ? La réponse qui compte est celle de la
// personne, dans son Firefox avec l'extension ; les traces `lt-*` ne sont qu'un indice.
'use strict';

// Les attributs du cadre d'une app dans GFS (prototype/js/frames.js : SANDBOX et `allow`).
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads';
const CADRES = [
  { id: 'G', titre: 'G · cadre isolé comme celui d\'une app dans GFS (origine vide)', sandbox: SANDBOX },
  { id: 'H', titre: 'H · cadre simple, sans isolement (témoin)' },
];
const TEXTE = 'Les enfant mange des pomme et nous avons manger ensemble. Il y a plusieur erreure ici.';
const OUI_NON = [['oui', 'oui, LanguageTool corrige'], ['non', 'non, seul Firefox souligne']];
const TAIT_OU_NON = [['se tait', 'LanguageTool se tait'], ['continue', 'il continue']];
const REVIENT_OU_NON = [['revient', 'LanguageTool revient'], ['rien', 'rien']];
// Les questions : `cle` nomme la réponse, `rapport` la ligne du rapport, `options` les deux choix.
const QUESTIONS = [
  { cle: 'z1', rapport: 'zone 1 (aucune marque) : LanguageTool corrige ici', options: OUI_NON },
  { cle: 'z2', rapport: 'zone 2 (marque dès le départ) : LanguageTool corrige ici', options: OUI_NON },
  { cle: 'z3a', rapport: 'zone 3, après « Poser la marque », sans cliquer', options: TAIT_OU_NON },
  { cle: 'z3b', rapport: 'zone 3, marque posée, après un clic ailleurs puis dans la zone', options: TAIT_OU_NON },
  { cle: 'z3c', rapport: 'zone 3, après « Retirer la marque », sans cliquer', options: REVIENT_OU_NON },
  { cle: 'z3d', rapport: 'zone 3, marque retirée, après un clic ailleurs puis dans la zone', options: REVIENT_OU_NON },
  { cle: 'z4', rapport: 'zone 4 (marque sur l\'élément qui entoure) : LanguageTool corrige ici', options: OUI_NON },
];

const dom = (tag, props = {}, ...enfants) => {
  const noeud = Object.assign(document.createElement(tag), props);
  noeud.append(...enfants);
  return noeud;
};

function choix(nom, options, surChoix) {
  const bloc = dom('span', { className: 'choix' });
  for (const [valeur, libelle] of options) {
    const radio = dom('input', { type: 'radio', name: nom, value: valeur });
    radio.addEventListener('change', () => surChoix(valeur));
    bloc.append(dom('label', {}, radio, ` ${libelle}`));
  }
  return bloc;
}

const deCe = source => [...document.querySelectorAll('iframe')].some(f => f.contentWindow === source);

function haut() {
  const etats = {};
  const rapport = document.getElementById('rapport');
  const lignes = (cadre, e) => (e
    ? [`Cadre ${cadre.titre}`, `  ${e.faits}`, ...QUESTIONS.map(q => `  ${q.rapport} : ${e.reponses[q.cle] || 'pas répondu'}`), ...e.apres.map(l => `  ${l}`)]
    : [`Cadre ${cadre.titre}`, '  (aucun rapport : le cadre ne s\'est pas chargé ou a été bloqué)']);
  const refaire = () => {
    const quand = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    rapport.value = [`Essai de la marque data-lt-active, ${quand} (heure de Paris)`, navigator.userAgent, `page qui porte les cadres : ${location.protocol}//${location.host}`, '',
      ...CADRES.flatMap(c => lignes(c, etats[c.id]))].join('\n');
  };
  addEventListener('message', event => {
    const d = event.data;
    if (d && d.essai === 'marque' && deCe(event.source)) { etats[d.cadre] = d; refaire(); }
  });
  const conteneur = document.getElementById('cadres');
  for (const { id, titre, sandbox } of CADRES) {
    const frame = dom('iframe', { src: `marque-cadre.html?c=${id}`, title: titre });
    if (sandbox) frame.setAttribute('sandbox', sandbox);
    conteneur.append(dom('div', {}, dom('p', { className: 'cadre-titre' }, titre), frame));
  }
  refaire();
  document.getElementById('copier').addEventListener('click', async () => {
    rapport.select();
    const dit = texte => { document.getElementById('copie').textContent = texte; };
    try { await navigator.clipboard.writeText(rapport.value); dit('Copié.'); } catch { dit('Copie refusée : le texte est sélectionné, copie-le à la main (Ctrl+C).'); }
  });
}

// La marque que voit chaque zone (la sienne ou celle d'un élément qui l'entoure).
const marqueVue = zones => zones.map(z => `${z.id} ${(z.closest('[data-lt-active]') || z).getAttribute('data-lt-active') ?? 'absente'}`).join(' / ');

// Ce que LanguageTool laisse dans la page quand il y travaille : un indice seulement.
function traces(zones) {
  const noms = new Set([...document.querySelectorAll('*')].map(e => e.localName).filter(n => /^(lt-|grammarly-)/.test(n)));
  const attrs = new Set(zones.flatMap(z => [...z.attributes].filter(a => /^(data-lt-(?!active)|data-gramm)/.test(a.name)).map(a => `${a.name}=${a.value}`)));
  const liste = s => ([...s].join(', ') || 'aucun');
  const installe = document.documentElement.hasAttribute('data-lt-installed') ? 'oui' : 'non';
  return `data-lt-installed : ${installe} ; éléments lt-* : ${liste(noms)} ; attributs de LanguageTool sur les zones : ${liste(attrs)}`;
}

const profondeur = () => { let n = 0; for (let w = window; w !== w.parent; w = w.parent) n += 1; return n; };
const stockage = () => { try { return `oui (${localStorage.length} clés)`; } catch (e) { return `non (${e.name})`; } };

function cadre() {
  const id = new URLSearchParams(location.search).get('c');
  const zones = ['e1', 'e2', 'e3', 'e4'].map(z => document.getElementById(z));
  const etat = { essai: 'marque', cadre: id, faits: '', reponses: {}, apres: [] };
  const envoyer = () => parent.postMessage(etat, '*');
  const faits = () => {
    etat.faits = `origine du cadre : ${self.origin} ; niveau d'imbrication : ${profondeur()} ; stockage du navigateur : ${stockage()} ; ${traces(zones)} ; marque vue par chaque zone : ${marqueVue(zones)}`;
    envoyer();
  };
  document.getElementById('titre').textContent = `Cadre ${id}`;
  for (const zone of zones) zone.textContent = TEXTE;
  for (const q of QUESTIONS) {
    document.getElementById(`q-${q.cle}`).append(choix(`r-${q.cle}`, q.options, v => { etat.reponses[q.cle] = v; envoyer(); }));
  }
  // Un bouton ne prend pas le focus (mousedown refusé) : la zone 3 le garde, comme quand la personne clique dans une barre d'outils.
  const marquer = (bouton, pose, nom) => {
    bouton.addEventListener('mousedown', e => e.preventDefault());
    bouton.addEventListener('click', () => {
      if (pose) zones[2].setAttribute('data-lt-active', 'false'); else zones[2].removeAttribute('data-lt-active');
      const auClic = `${marqueVue(zones)} ; focus encore dans la zone 3 : ${document.activeElement === zones[2] ? 'oui' : 'non'}`;
      setTimeout(() => { etat.apres.push(`après « ${nom} », 1,5 s plus tard : ${traces(zones)} ; marque vue au clic : ${auClic}`); envoyer(); }, 1500);
      faits();
    });
  };
  marquer(document.getElementById('poser'), true, 'Poser la marque');
  marquer(document.getElementById('retirer'), false, 'Retirer la marque');
  addEventListener('focusin', () => setTimeout(faits, 1500));
  faits();
  setTimeout(faits, 2000); setTimeout(faits, 5000);
}

({ haut, cadre })[document.body.dataset.role]();
