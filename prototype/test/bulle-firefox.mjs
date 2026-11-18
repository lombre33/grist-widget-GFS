// Les phrases d'état de GFS (« GFS a relié ce widget à la grille… », « Rien n'a été installé… », « … ne répond pas ») sous Firefox (audit des parcours du 10/11, carte « Laisser passer ton clic à travers la bulle d'état »).
// Elles se posent au-dessus des fenêtres (`--z-toast`, 400) et sont du texte seul : la souris doit les traverser. Avant, la bulle « relié à la grille » recouvrait « Annuler » et « Créer la table » de la première
// installation pendant 3 s, et le clic tombait sur elle sans rien faire. L'essai pose un bouton au niveau des fenêtres sous chaque phrase (la phrase ordinaire et la phrase d'erreur) et demande à Firefox ce qui reçoit
// la souris au centre du bouton. Les feuilles de style sont celles de index.html.

import { STRING_TABLES } from '../js/i18n/i18n.js';

// Et la phrase d'un document qu'une version plus récente de GFS a préparé (contrats 6.4, point 14) : la plus longue des phrases d'état. Posée comme le fait le contrôleur
// (`#toast`, classe `status toast`), elle doit tenir dans la page de 700 × 400, sans passer sous le bord ni être coupée.
const SENTENCES = [
  { name: 'la phrase d\'état (« GFS a relié ce widget à la grille »)', className: 'status toast' },
  { name: 'la phrase d\'erreur (« … ne répond pas »)', className: 'status status--bad' },
];

function hitUnder(className) {
  const button = document.createElement('button');
  button.textContent = 'Créer la table';
  Object.assign(button.style, { position: 'fixed', left: '120px', top: '120px', width: '160px', height: '32px', zIndex: '250' });
  const sentence = document.createElement('p');
  sentence.className = className;
  sentence.textContent = 'GFS a relié ce widget à la grille de « Clients » : la ligne suit votre clic.';
  Object.assign(sentence.style, { left: '200px', top: '124px', bottom: 'auto' });
  document.body.append(button, sentence);
  const box = button.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  const result = { onButton: hit === button, onSentence: Boolean(hit && sentence.contains(hit)), pointerEvents: getComputedStyle(sentence).pointerEvents };
  button.remove();
  sentence.remove();
  return result;
}

// Où la phrase tombe : sa boîte dans la page (px) et si son texte est coupé (`scrollWidth` plus large que la boîte).
function placeOf(text) {
  const sentence = document.createElement('p');
  sentence.className = 'status toast';
  sentence.textContent = text;
  document.body.append(sentence);
  const box = sentence.getBoundingClientRect();
  const result = { box: [box.left, box.top, box.right, box.bottom], view: [innerWidth, innerHeight], cut: sentence.scrollWidth > sentence.clientWidth + 1, lines: Math.round(box.height / parseFloat(getComputedStyle(sentence).lineHeight)) };
  sentence.remove();
  return result;
}

// Rend les écarts { kind, text }.
export async function bulleProblems(page, tag, language = 'fr') {
  const found = [];
  const newer = await page.run(placeOf, STRING_TABLES[language]['doc.newer']);
  const [left, top, right, bottom] = newer.box;
  if (left < -0.5 || top < -0.5 || right > newer.view[0] + 0.5 || bottom > newer.view[1] + 0.5) found.push({ kind: 'phrase « document plus récent » : hors de la page',
    text: `${tag} : la phrase (${newer.box.map(Math.round).join(', ')}) sort de la page de ${newer.view.join(' × ')} px` });
  if (newer.cut) found.push({ kind: 'phrase « document plus récent » : coupée', text: `${tag} : le texte de la phrase est coupé` });
  if (newer.lines > 6) found.push({ kind: 'phrase « document plus récent » : trop haute', text: `${tag} : la phrase prend ${newer.lines} lignes (6 au plus)` });
  for (const sentence of SENTENCES) {
    const result = await page.run(hitUnder, sentence.className);
    if (!result.onButton) found.push({ kind: 'phrase d\'état : recouvre un bouton', text: `${tag} : ${sentence.name}, posée sur un bouton, devait laisser passer la souris (le bouton la reçoit), et la phrase la reçoit (pointer-events : ${result.pointerEvents})` });
  }
  return found;
}
