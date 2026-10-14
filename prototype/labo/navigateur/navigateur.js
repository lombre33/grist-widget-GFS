// La page de mesures du navigateur (contrats 9, point 4, et cahier 9, points 3 et 5) : ce que le navigateur de la personne fait de l'ordre des écouteurs et d'un
// sous-cadre isolé comme celui de GFS (mêmes drapeaux `sandbox`, même `allow`, même politique `frame-src`). La sonde G s'y exécute sans GFS ; ses réponses arrivent
// par message (`?hote`), et la personne dit ce que seul son œil voit (un fichier arrivé, une fenêtre ouverte). Le résultat se copie en un texte à coller.
import { SANDBOX } from '../../js/frames.js';

const PROBE = '../sondes/g-capacites/index.html?hote=1';
const ALLOW = 'clipboard-write';

// Ce que la page de la sonde ne peut pas voir d'elle-même.
const QUESTIONS = [
  { id: 'telechargementBlob', texte: 'Après « Téléchargement (blob) » : un fichier « essai-blob.txt » est arrivé dans tes téléchargements.' },
  { id: 'telechargementData', texte: 'Après « Téléchargement (data) » : un fichier « essai-data.txt » est arrivé dans tes téléchargements.' },
  { id: 'fenetre', texte: 'Après « Fenêtre » : un nouvel onglet ou une nouvelle fenêtre s\'est ouvert.' },
  { id: 'lien', texte: 'Après « Lien » : un nouvel onglet ou une nouvelle fenêtre s\'est ouvert.' },
  { id: 'impression', texte: 'Après « Impression directe » : la boîte d\'impression s\'est ouverte.' },
  { id: 'mailto', texte: 'Après « Mailto (nouvelle fenêtre) » : ton logiciel de messagerie s\'est ouvert avec un message prêt.' },
  { id: 'remarque', texte: 'Autre chose à signaler (un message du navigateur, un essai qui n\'a rien fait) :', libre: true },
];

const $ = id => document.getElementById(id);
const state = { ordre: null, sonde: {}, vu: {}, colle: '', libre: '' };

const json = value => JSON.stringify(value);
const cell = (text, className) => { const td = document.createElement('td'); td.textContent = text; if (className) td.className = className; return td; };
const row = (...cells) => { const tr = document.createElement('tr'); tr.append(...cells); return tr; };

function renderOrder() {
  const { ordre } = state;
  const verdict = $('ordre-verdict');
  verdict.textContent = '';
  const holds = document.createElement('span');
  holds.className = ordre.routeurPremierSuffit ? 'ok' : 'bad';
  holds.textContent = ordre.routeurPremierSuffit ? 'Le routeur de GFS tient dans ce navigateur.' : 'Le routeur de GFS ne tient pas dans ce navigateur.';
  verdict.append(holds, ` ${ordre.captureAvant ? 'La phase de capture passe avant les autres écouteurs de la fenêtre.' : 'La phase de capture ne passe pas avant les autres : c\'est l\'ordre d\'enregistrement qui décide (GFS en tient compte : son routeur est le premier script).'}`);
  const body = $('ordre-table').tBodies[0];
  body.textContent = '';
  for (const [name, order] of Object.entries(ordre.ordres)) body.append(row(cell(name), cell(json(order), 'mono')));
}

function renderAnswers() {
  const body = $('reponses').tBodies[0];
  body.textContent = '';
  for (const [name, value] of Object.entries(state.sonde)) body.append(row(cell(name), cell(json(value), 'mono')));
  if (!body.children.length) body.append(row(cell('(rien encore)'), cell('')));
}

function renderQuestions() {
  const box = $('questions');
  for (const question of QUESTIONS) {
    const set = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = question.texte;
    set.append(legend);
    if (question.libre) {
      const input = document.createElement('textarea');
      input.className = 'colle';
      input.setAttribute('aria-label', question.texte);
      input.addEventListener('input', () => { state.libre = input.value; renderReport(); });
      set.append(input);
    } else {
      for (const [value, label] of [['oui', 'Oui'], ['non', 'Non'], ['', 'Pas essayé']]) {
        const wrap = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = question.id;
        radio.value = value;
        radio.checked = value === '';
        radio.addEventListener('change', () => { state.vu[question.id] = value; renderReport(); });
        wrap.append(radio, ` ${label}`);
        set.append(wrap);
      }
    }
    box.append(set);
  }
}

function report() {
  const lines = [
    `Mesures du navigateur pour GFS : ${new Date().toISOString().slice(0, 16).replace('T', ' ')} (UTC)`,
    `Navigateur : ${navigator.userAgent}`,
    `Page : ${location.href}`,
    '',
    `1. Ordre des écouteurs : le routeur de GFS tient = ${state.ordre ? (state.ordre.routeurPremierSuffit ? 'oui' : 'NON') : '?'} ; la phase de capture passe avant les autres = ${state.ordre ? (state.ordre.captureAvant ? 'oui' : 'non') : '?'}`,
    ...(state.ordre ? Object.entries(state.ordre.ordres).map(([name, order]) => `   ${name} : ${json(order)}`) : []),
    '',
    `2. Cadre isolé : sandbox="${SANDBOX}" allow="${ALLOW}"`,
    ...Object.entries(state.sonde).map(([name, value]) => `   ${name} : ${json(value)}`),
    ...(Object.keys(state.sonde).length ? [] : ['   (aucun essai fait)']),
    '',
    '3. Ce que la personne a vu',
    ...QUESTIONS.filter(question => !question.libre).map(question => `   ${question.id} : ${state.vu[question.id] || 'pas essayé'}`),
    `   collage après « Presse-papiers » : ${state.colle ? `« ${state.colle.slice(0, 60)} »` : 'rien collé'}`,
    `   remarque : ${state.libre.trim() || 'aucune'}`,
  ];
  return lines.join('\n');
}

function renderReport() { $('rapport').value = report(); }

async function copy() {
  const text = report();
  const status = $('copie-etat');
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copié.';
  } catch (error) {
    $('rapport').select();
    status.textContent = document.execCommand('copy') ? 'Copié.' : 'Copie refusée : sélectionne le texte ci-dessous et copie-le.';
  }
}

function startProbe() {
  const frame = $('sonde');
  frame.setAttribute('sandbox', SANDBOX);
  frame.setAttribute('allow', ALLOW);
  $('attributs').textContent = `Le cadre a les mêmes attributs que celui d'une app sous GFS : sandbox="${SANDBOX}" allow="${ALLOW}".`;
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || !event.data || !event.data.sondeG) return;
    state.sonde = event.data.sondeG;
    renderAnswers();
    renderReport();
  });
  frame.src = PROBE;
}

$('ua').textContent = navigator.userAgent;
renderQuestions();
renderAnswers();
$('colle').addEventListener('paste', event => {
  state.colle = (event.clipboardData && event.clipboardData.getData('text')) || '';
  renderReport();
});
$('copier').addEventListener('click', copy);
startProbe();
renderReport();
window.GFSOrdre.playAll().then(result => { state.ordre = result; renderOrder(); renderReport(); });
