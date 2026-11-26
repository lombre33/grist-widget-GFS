// Page d'essai de la relance de LanguageTool (relance.html et relance-cadre.html ; LISEZ-MOI.md du labo). Deux rôles dans un seul script, selon `data-role` du corps :
//   `haut`   la page qu'on ouvre : elle pose le cadre isolé, reçoit son rapport et fait celui qu'on copie ;
//   `cadre`  là où l'on essaie : un témoin, quatre zones cachées au départ (partie A), quatre zones gelées au départ (partie B).
// Contexte (retour du 26/11) : sous GFS, l'éditeur de Publipostage+ est caché (`display: none`) quand le document s'ouvre en Lecture et les champs d'un e-mail y sont gelés (`contenteditable="false"`) ;
// l'Édition les montre et les rend modifiables, sans qu'aucune marque n'ait été posée, et LanguageTool « ne se lance pas toujours ». Question : prend-il en charge une zone qui naît cachée ou gelée, et
// une relance (la marque `data-lt-active="false"` posée puis retirée, que LanguageTool relit à chaud : mesuré le 12/11) le réveille-t-elle ? Trois façons de relancer, une par zone : la marque
// retirée à l'image suivante, dans le même instant, 0,4 s plus tard. La réponse qui compte est celle de la personne, dans son Firefox avec l'extension ; les traces `lt-*` ne sont qu'un indice.
'use strict';

const SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads';
const TITRE = 'cadre isolé comme celui d\'une app dans GFS (origine vide)';
const TEXTE = 'Les enfant mange des pomme et nous avons manger ensemble. Il y a plusieur erreure ici.';
const MARQUE = 'data-lt-active';
const OUI_NON = [['oui', 'oui, LanguageTool corrige'], ['non', 'non, seul Firefox souligne']];
// Les zones et leur relance : `rien` (témoin), `image` (retirée à l'image suivante), `instant` (posée et retirée dans le même instant), `retard` (retirée 0,4 s plus tard).
const RELANCES = { 0: 'rien', 1: 'image', 2: 'instant', 3: 'retard' };
const NOMS = { rien: 'sans relance', image: 'relance à l\'image suivante', instant: 'relance dans le même instant', retard: 'relance 0,4 s plus tard' };
const QUESTIONS = [
  { cle: 't0', rapport: 'zone 0 (témoin, visible et modifiable dès le départ) : LanguageTool corrige ici' },
  ...[0, 1, 2, 3].map(i => ({ cle: `a${i}`, rapport: `zone A${i} (cachée au départ, ${NOMS[RELANCES[i]]}) : LanguageTool corrige ici` })),
  { cle: 'a0bis', rapport: 'zone A0, après « Cacher de nouveau » puis « Montrer les zones » : LanguageTool corrige encore ici' },
  ...[0, 1, 2, 3].map(i => ({ cle: `b${i}`, rapport: `zone B${i} (gelée au départ, ${NOMS[RELANCES[i]]}) : LanguageTool corrige ici` })),
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
  let etat = null;
  const rapport = document.getElementById('rapport');
  const lignes = e => (e
    ? [`Cadre ${TITRE}`, `  ${e.faits}`, ...QUESTIONS.map(q => `  ${q.rapport} : ${e.reponses[q.cle] || 'pas répondu'}`), ...e.apres.map(l => `  ${l}`)]
    : [`Cadre ${TITRE}`, '  (aucun rapport : le cadre ne s\'est pas chargé ou a été bloqué)']);
  const refaire = () => {
    const quand = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    rapport.value = [`Essai de la relance de LanguageTool, ${quand} (heure de Paris)`, navigator.userAgent, `page qui porte le cadre : ${location.protocol}//${location.host}`, '', ...lignes(etat)].join('\n');
  };
  addEventListener('message', event => {
    const d = event.data;
    if (d && d.essai === 'relance' && deCe(event.source)) { etat = d; refaire(); }
  });
  document.getElementById('cadres').append(dom('p', { className: 'cadre-titre' }, TITRE), dom('iframe', { src: 'relance-cadre.html', title: TITRE, sandbox: SANDBOX }));
  refaire();
  document.getElementById('copier').addEventListener('click', async () => {
    rapport.select();
    const dit = texte => { document.getElementById('copie').textContent = texte; };
    try { await navigator.clipboard.writeText(rapport.value); dit('Copié.'); } catch { dit('Copie refusée : le texte est sélectionné, copie-le à la main (Ctrl+C).'); }
  });
}

// Ce que LanguageTool laisse dans la page quand il y travaille : un indice seulement.
function traces(zones) {
  const noms = new Set([...document.querySelectorAll('*')].map(e => e.localName).filter(n => /^(lt-|grammarly-)/.test(n)));
  const attrs = new Set(zones.flatMap(z => [...z.attributes].filter(a => /^(data-lt-(?!active)|data-gramm)/.test(a.name)).map(a => `${a.name}=${a.value}`)));
  const liste = s => ([...s].join(', ') || 'aucun');
  return `data-lt-installed : ${document.documentElement.hasAttribute('data-lt-installed') ? 'oui' : 'non'} ; éléments lt-* : ${liste(noms)} ; attributs de LanguageTool sur les zones : ${liste(attrs)}`;
}

const profondeur = () => { let n = 0; for (let w = window; w !== w.parent; w = w.parent) n += 1; return n; };
const stockage = () => { try { return `oui (${localStorage.length} clés)`; } catch (e) { return `non (${e.name})`; } };

// La relance d'une zone : la marque que LanguageTool relit à chaud, posée puis retirée. `note` garde l'heure de chaque pas pour le rapport.
function relancer(zone, facon, note) {
  if (facon === 'rien') return;
  const depart = performance.now();
  const pas = quoi => note(`${zone.id} : marque ${quoi} à +${Math.round(performance.now() - depart)} ms`);
  zone.setAttribute(MARQUE, 'false');
  pas('posée');
  const retirer = () => { zone.removeAttribute(MARQUE); pas('retirée'); };
  if (facon === 'instant') retirer();
  else if (facon === 'image') requestAnimationFrame(() => requestAnimationFrame(retirer));
  else setTimeout(retirer, 400);
}

function cadre() {
  const zones = [...document.querySelectorAll('.editable')];
  const etat = { essai: 'relance', faits: '', reponses: {}, apres: [] };
  const envoyer = () => parent.postMessage(etat, '*');
  const vue = z => (z.getClientRects().length > 0 ? 'montrée' : 'cachée');
  const faits = () => {
    const zonesEtat = zones.map(z => `${z.id} ${vue(z)}/${z.getAttribute('contenteditable')}/${z.getAttribute(MARQUE) ?? 'sans marque'}`).join(' ');
    etat.faits = `origine du cadre : ${self.origin} ; niveau d'imbrication : ${profondeur()} ; stockage du navigateur : ${stockage()} ; ${traces(zones)} ; zones (vue/contenteditable/marque) : ${zonesEtat}`;
    envoyer();
  };
  const note = texte => { etat.apres.push(texte); faits(); };
  for (const zone of zones) zone.textContent = TEXTE;
  for (const q of QUESTIONS) {
    document.getElementById(`q-${q.cle}`).append(choix(`r-${q.cle}`, OUI_NON, v => { etat.reponses[q.cle] = v; envoyer(); }));
  }
  // Un bouton ne prend pas le focus (mousedown refusé), comme une barre d'outils.
  const bouton = (id, agir, quoi) => {
    const noeud = document.getElementById(id);
    noeud.addEventListener('mousedown', e => e.preventDefault());
    noeud.addEventListener('click', () => { agir(); note(`« ${quoi} » cliqué`); setTimeout(faits, 1500); });
  };
  const boiteA = document.getElementById('boite-a');
  bouton('montrer', () => {
    boiteA.dataset.etat = 'montree';
    [0, 1, 2, 3].forEach(i => relancer(document.getElementById(`a${i}`), RELANCES[i], note));
  }, 'Montrer les zones');
  bouton('cacher', () => { boiteA.dataset.etat = 'cachee'; }, 'Cacher de nouveau');
  bouton('degeler', () => {
    [0, 1, 2, 3].forEach(i => {
      const zone = document.getElementById(`b${i}`);
      zone.setAttribute('contenteditable', 'true');
      relancer(zone, RELANCES[i], note);
    });
  }, 'Rendre modifiables');
  addEventListener('focusin', () => setTimeout(faits, 1500));
  faits();
  setTimeout(faits, 2000); setTimeout(faits, 5000);
}

({ haut, cadre })[document.body.dataset.role]();
