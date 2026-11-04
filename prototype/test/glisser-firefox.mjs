// Le glisser-déposer de l'explorateur sous Firefox (demande du porteur, 04/11 : « drag & drop des fichiers dans des dossiers, en amont, en aval » ; règle du 03/11 : toute nouvelle interface ajoute ses mesures
// à test/interfaces-firefox.test.mjs). La page d'essai (test/pages/explorateur.js) joue le vrai explorateur sur un rangement de doublure. Ce que Firefox sans écran permet : les lignes se tiennent (`draggable`),
// le glissement part (`dragstart`), le dossier qui accepterait la ligne s'éclaire et annule le survol (`dragover`, effet « move »), celui qui ne la prendrait pas reste éteint. **Le dépôt lui-même n'aboutit
// pas au banc** (voir `Page.drag` de test/firefox.mjs : ni `drop` ni `dragend`) : il se mesure sous Chromium, à la vraie souris, dans un vrai Grist (labo/run-glisser-explorateur.mjs) ; ce que `moveTo`
// fait d'un dépôt est dans test/explorer-clipboard.test.mjs et test/explorer-drag.test.mjs. Le glissement reste en cours après le lâcher : cet essai s'exécute seul, sur une page rechargée.
import { Run, centerOfName, centerOfSelector, delay } from './corbeille-firefox.mjs';

// Ce que la page garde du glissement : ce qui part, et chaque survol (la cible, le dépôt permis ou non, l'effet).
function spy() {
  window.__dnd = { starts: [], overs: [] };
  document.addEventListener('dragstart', event => window.__dnd.starts.push(String(event.target.className)));
  document.addEventListener('dragover', event => {
    const host = event.target.closest && event.target.closest('.tr-row[data-path], .crumbs [data-path], [data-key^="dir:"]');
    window.__dnd.overs.push({ on: host ? (host.dataset.path !== undefined ? host.dataset.path : host.dataset.key) : null, prevented: event.defaultPrevented, effect: event.dataTransfer.dropEffect });
  });
}

const state = () => ({
  dnd: window.__dnd,
  lit: [...document.querySelectorAll('.is-drop')].map(node => (node.dataset.path !== undefined ? node.dataset.path : node.dataset.key)),
  dim: [...document.querySelectorAll('.is-dragging')].map(node => (node.querySelector('.t, .tn') || {}).textContent),
});

// Les lignes de la liste se tiennent ; à la corbeille, aucune.
const draggables = () => [...document.querySelectorAll('.ls-row[data-key], .th[data-key]')].map(node => node.draggable);

async function holdable(run) {
  await run.reset();
  const rows = await run.page.run(draggables);
  if (!rows.length || rows.some(value => value !== true)) run.note('lignes', `chaque ligne devait se tenir (draggable), à la racine (${rows.length} lignes : ${rows.join(',')})`);
  await run.clickSelector('.tr-row[data-view="trash"]');
  await delay(150);
  const inTrash = await run.page.run(draggables);
  if (inTrash.some(value => value === true)) run.note('corbeille', `rien ne devait se tenir à la corbeille (${inTrash.join(',')})`);
}

async function drag(run, name, selector) {
  const from = await run.page.run(centerOfName, name);
  const to = await run.page.run(centerOfSelector, selector);
  if (!from || !to) { run.note('glissement', `« ${name} » ou ${selector} est introuvable`); return null; }
  await run.page.run(spy);
  await run.page.drag(from, to);
  await delay(250);
  return run.page.run(state);
}

// Un fichier de la racine tiré sur un dossier du volet : le glissement part, la ligne s'efface, le dossier s'éclaire et accepte (effet « move »).
async function accepted(run) {
  await run.reset();
  const seen = await drag(run, 'Convocation', '.tr-row[data-path="Formation"]');
  if (!seen) return;
  if (!seen.dnd.starts.some(name => name.split(' ').includes('ls-row'))) run.note('départ', `le glissement devait partir de la ligne (dragstart : ${JSON.stringify(seen.dnd.starts)})`);
  const over = seen.dnd.overs.filter(each => each.on === 'Formation');
  if (!over.length || !over.every(each => each.prevented && each.effect === 'move')) run.note('dossier accueillant', `le dossier « Formation » devait accepter le survol, effet « move » (${JSON.stringify(seen.dnd.overs).slice(0, 300)})`);
  if (!seen.lit.includes('Formation')) run.note('dossier éclairé', `le dossier « Formation » devait être éclairé (${JSON.stringify(seen.lit)})`);
  if (!seen.dim.includes('Convocation')) run.note('ligne tenue', `la ligne tenue devait s'effacer (${JSON.stringify(seen.dim)})`);
}

// Le fichier d'un dossier tiré sur ce même dossier : le survol de ce dossier n'est pas accepté et rien ne s'éclaire (la ligne traverse d'autres dossiers qui, eux, l'accepteraient).
async function refused(run) {
  await run.reset();
  await run.clickSelector('.tr-row[data-path="Formation"]');
  await delay(150);
  const seen = await drag(run, 'Contrat de prestation', '.tr-row[data-path="Formation"]');
  if (!seen) return;
  if (!seen.dnd.starts.length) run.note('départ', 'le glissement devait partir de la ligne');
  const over = seen.dnd.overs.filter(each => each.on === 'Formation');
  if (!over.length) run.note('dossier refusé', `le survol de « Formation » devait arriver (${JSON.stringify(seen.dnd.overs.slice(0, 6))})`);
  if (over.some(each => each.prevented) || seen.lit.includes('Formation')) run.note('dossier refusé', `le dossier de la ligne ne devait rien accepter ni s'éclairer (${JSON.stringify({ over: over.slice(0, 3), lit: seen.lit })})`);
}

export async function glisserProblems(page, language, tag) {
  const found = [];
  const run = new Run(page, tag, found, 'glisser-déposer');
  for (const step of [holdable, accepted, refused]) {
    try {
      await step(run);
    } catch (error) {
      run.note('geste impossible', `${step.name} : ${String(error.message).slice(0, 200)}`);
    }
  }
  return found;
}
