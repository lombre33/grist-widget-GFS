// Les phrases d'état de GFS (« GFS a relié ce widget à la grille… », « Rien n'a été installé… », « … ne répond pas ») sous Firefox (audit des parcours du 10/11, carte « Laisser passer ton clic à travers la bulle d'état »).
// Elles se posent au-dessus des fenêtres (`--z-toast`, 400) et sont du texte seul : la souris doit les traverser. Avant, la bulle « relié à la grille » recouvrait « Annuler » et « Créer la table » de la première
// installation pendant 3 s, et le clic tombait sur elle sans rien faire. L'essai pose un bouton au niveau des fenêtres sous chaque phrase (la phrase ordinaire et la phrase d'erreur) et demande à Firefox ce qui reçoit
// la souris au centre du bouton. Les feuilles de style sont celles de index.html.

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

// Rend les écarts { kind, text }.
export async function bulleProblems(page, tag) {
  const found = [];
  for (const sentence of SENTENCES) {
    const result = await page.run(hitUnder, sentence.className);
    if (!result.onButton) found.push({ kind: 'phrase d\'état : recouvre un bouton', text: `${tag} : ${sentence.name}, posée sur un bouton, devait laisser passer la souris (le bouton la reçoit), et la phrase la reçoit (pointer-events : ${result.pointerEvents})` });
  }
  return found;
}
