// Le choix d'une colonne du réglage de l'annuaire sous Firefox (règle du 03/11 ; module Annuaire, retours du porteur du 25/11 : revenir en arrière, suivre une référence et
// chercher d'un coup dans les tables liées, des exemples en direct, créer une colonne), à la vraie souris et au vrai clavier, sur le vrai contrôle et un faux Grist en mémoire
// (test/pages/annuaire.js). Suite de test/annuaire-setup-firefox.mjs, appelée avec le réglage ouvert (onglet « Hiérarchie »). À mesurer : la liste (la première ligne propose
// de créer, des exemples à droite, d'où ils viennent sous la recherche, le bouton qui suit une référence), le fil et ses pastilles, « Retour », Retour arrière dans une
// recherche vide ; la recherche qui trouve « Structure › Pole » d'un coup ; la fenêtre « Créer une colonne » (nom pris, nom vide, Entrée, Échap, l'action écrite).
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';
import { tools, press } from './annuaire-setup-firefox.mjs';

const PROBES = { sample: ['.mod.pk .wk-sample', '.mod.pk'], example: ['.wk-example', '.mod.pk'], crumbLink: ['.wk-crumb.is-link', '.mod.pk'], reason: ['.mod.pk .wk-reason', '.mod.pk'] };

// ---------- ce qui s'exécute dans la page ----------

function pickerSnap() {
  const modal = document.querySelector('.mod.pk');
  if (!modal) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const example = modal.querySelector('.wk-example');
  return {
    box: box(modal), view: [document.documentElement.clientWidth, document.documentElement.clientHeight], title: text(modal.querySelector('h2')),
    crumbs: [...modal.querySelectorAll('.wk-crumb')].map(crumb => ({ text: text(crumb), button: crumb.tagName === 'BUTTON' })), example: example && !example.hidden ? text(example) : '',
    back: Boolean(modal.querySelector('[data-fk="pick-back"]')),
    rows: [...modal.querySelectorAll('.wk-row')].map(row => {
      const main = row.querySelector('.wk-item');
      const sample = row.querySelector('.wk-sample');
      const alt = row.querySelector('.wk-alt');
      return { fk: main.dataset.fk, name: text(row.querySelector('.wk-name')), hint: row.querySelector('.wk-reason') ? text(row.querySelector('.wk-reason')) : '', sample: sample ? text(sample) : '',
        alt: alt ? text(alt) : null, box: box(row), sampleBox: sample ? box(sample) : null, itemBox: box(main), altBox: alt ? box(alt) : null };
    }),
    focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || '' : '',
  };
}

function levelCards() {
  return [...document.querySelectorAll('.mod.an-set .an-lvrow:not(.an-relrow)')].map(card => ({ name: card.querySelector('.an-lv-name').value, path: card.querySelector('.an-lv-src').textContent.replace(/\s+/g, ' ').trim(),
    todo: card.classList.contains('is-todo') }));
}

function creationSnap() {
  const modal = document.querySelector('.mod.an-nl');
  if (!modal) return null;
  const ok = modal.querySelector('[data-fk="nc-ok"]');
  return { title: modal.querySelector('h2').textContent.trim(), ok: ok.getAttribute('aria-disabled'), note: modal.querySelector('.mod-note').textContent.trim(), types: [...modal.querySelectorAll('[data-type]')].map(node => `${node.dataset.type}:${node.getAttribute('aria-pressed')}`) };
}

const inside = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;
const insideX = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack; // la liste défile : seul le sens horizontal se mesure

// ---------- les mesures ----------

// La liste d'un premier étage : la création en tête, les exemples à droite et leur origine, le bouton qui suit une référence ; tout dans la fenêtre.
async function listProblems(page, t, note, where) {
  const first = await page.run(pickerSnap);
  if (!first) { note('réglage', `${where} : la liste des colonnes ne s'ouvre pas`); return null; }
  const view = { left: 0, top: 0, right: first.view[0], bottom: first.view[1] };
  if (!inside(first.box, view)) note('hors de la page', `${where} : la liste sort de la page`);
  if (first.rows[0] && first.rows[0].fk !== 'pick-new:') note('réglage', `${where} : la première ligne n'est pas « ${t('an.new.item', { table: 'Personnes' })} » (« ${first.rows[0].name} »)`);
  if (first.rows[0] && first.rows[0].name !== t('an.new.item', { table: 'Personnes' })) note('réglage', `${where} : la création dit « ${first.rows[0].name} » (« ${t('an.new.item', { table: 'Personnes' })} » attendu)`);
  const prefix = t('an.sample.from', { name: '@' }).split('@')[0];
  if (!first.example.startsWith(prefix.trimEnd())) note('exemples', `${where} : la ligne d'où viennent les exemples dit « ${first.example} » (« ${prefix}… » attendu)`);
  const withSample = first.rows.filter(row => row.sample);
  if (withSample.length < 3) note('exemples', `${where} : seulement ${withSample.length} colonnes montrent un exemple (3 au moins attendues)`);
  for (const row of first.rows) {
    if (!insideX(row.box, first.box)) note('réglage', `${where} : la ligne « ${row.name} » sort de la liste`);
    if (row.sampleBox && !insideX(row.sampleBox, row.itemBox)) note('exemples', `${where} : l'exemple de « ${row.name} » sort de sa ligne`);
    if (row.altBox && !insideX(row.altBox, row.box)) note('réglage', `${where} : le bouton qui suit « ${row.name} » sort de sa ligne`);
  }
  const structure = first.rows.find(row => row.fk === 'pick-use:Structure');
  if (!structure || !structure.alt || !structure.alt.includes('Structures')) note('réglage', `${where} : « Structure » n'a pas son bouton « Structures › » (${structure ? structure.alt : 'pas de ligne'})`);
  if (first.rows.some(row => row.fk === 'pick-use:Nom' && row.alt)) note('réglage', `${where} : une colonne de texte a un bouton pour la suivre`);
  if (first.back) note('réglage', `${where} : « ${t('pick.back')} » est là au premier étage, où il n'y a nulle part où revenir`);
  return first;
}

// Suivre une référence, puis revenir : « Retour », la pastille du premier étage, Retour arrière dans la recherche vide. Chaque fois, le fil dit où l'on est.
async function backProblems(page, t, note, { click }, where) {
  const crumbs = async () => (await page.run(pickerSnap)).crumbs.map(crumb => crumb.text).join(' › ');
  await click('[data-fk="pick-alt-use:Structure"]');
  const followed = await page.run(pickerSnap);
  if (followed.crumbs.map(crumb => crumb.text).join() !== 'Personnes,Structure') note('réglage', `${where} : après avoir suivi « Structure », le fil dit « ${await crumbs()} » (« Personnes › Structure » attendu)`);
  if (!followed.crumbs[0].button || followed.crumbs[1].button) note('réglage', `${where} : seule l'étape déjà parcourue doit être un bouton (${followed.crumbs.map(crumb => crumb.button).join()})`);
  if (!followed.back) note('réglage', `${where} : « ${t('pick.back')} » manque après avoir suivi une référence`);
  if (!followed.rows.some(row => row.fk === 'pick-use:Pole')) note('réglage', `${where} : les colonnes de « Structures » ne sont pas là (${followed.rows.map(row => row.name).join(' | ')})`);
  if (!followed.rows.some(row => row.sample)) note('exemples', `${where} : les colonnes de « Structures » n'ont aucun exemple`);
  await page.run(contrasts, PROBES).then(values => { for (const [what, value] of Object.entries(values)) if (value < 4.5) note('contraste', `${where} : « ${what} » trop pâle (${value.toFixed(2)})`); });
  await click('[data-fk="pick-back"]');
  if ((await crumbs()) !== 'Personnes') note('réglage', `${where} : « ${t('pick.back')} » ne revient pas à « Personnes » (« ${await crumbs()} »)`);
  await click('[data-fk="pick-alt-use:Structure"]');
  await click('[data-fk="pick-crumb:0"]');
  if ((await crumbs()) !== 'Personnes') note('réglage', `${where} : la pastille « Personnes » ne revient pas au premier étage (« ${await crumbs()} »)`);
  await click('[data-fk="pick-alt-use:Structure"]');
  await page.run(() => document.querySelector('[data-fk="pick-search"]').focus());
  await page.press('Backspace');
  await delay(150);
  if ((await crumbs()) !== 'Personnes') note('clavier', `${where} : Retour arrière dans la recherche vide ne revient pas (« ${await crumbs()} »)`);
  await click('[data-fk="pick-alt-use:Structure"]');
  await press(page, 'x');
  await page.press('Backspace');
  await delay(150);
  if ((await crumbs()) !== 'Personnes › Structure') note('clavier', `${where} : Retour arrière efface une lettre : il ne doit pas revenir d'un cran quand la recherche n'est pas vide (« ${await crumbs()} »)`);
  await click('[data-fk="pick-back"]');
}

// La recherche regarde dans les tables liées : « pole » trouve « Structure › Pole », et un clic le choisit d'un coup.
async function deepProblems(page, t, note, { click }, where) {
  await press(page, 'pole');
  const found = await page.run(pickerSnap);
  const deep = found.rows.find(row => row.fk === 'pick-deep:Structure\u001fPole');
  if (!deep) { note('réglage', `${where} : « pole » ne trouve pas « Structure › Pole » (${found.rows.map(row => row.name).join(' | ')})`); return; }
  if (deep.name !== 'Structure › Pole') note('réglage', `${where} : la colonne d'une table liée dit « ${deep.name} » (« Structure › Pole » attendu)`);
  if (deep.hint !== t('an.set.inTable', { table: 'Structures' })) note('réglage', `${where} : la colonne d'une table liée dit « ${deep.hint} » (« ${t('an.set.inTable', { table: 'Structures' })} » attendu)`);
  if (!deep.sample) note('exemples', `${where} : « Structure › Pole » n'a pas d'exemple`);
  if (deep.alt) note('réglage', `${where} : une colonne trouvée d'un coup a un bouton pour la suivre`);
  await page.run(() => { const input = document.querySelector('[data-fk="pick-search"]'); input.value = ''; input.dispatchEvent(new Event('input')); });
  const cleared = await page.run(pickerSnap);
  if (cleared.rows.some(row => row.fk.startsWith('pick-deep:'))) note('réglage', `${where} : les colonnes des tables liées s'affichent sans recherche (la liste serait trop longue)`);
  await press(page, 'pole');
  await click('[data-fk="pick-deep:Structure\u001fPole"]');
  await delay(200);
  const card = (await page.run(levelCards)).find(each => each.name === 'Essai chemin');
  if (!card || !card.path.includes('Structure') || !card.path.includes('Pole') || card.todo) note('réglage', `${where} : le niveau n'a pas pris « Structure › Pole » (« ${card ? card.path : 'absent'} »)`);
}

// Créer une colonne : la fenêtre (nom, type), ce qui empêche (nom vide, nom pris), Échap qui revient à la liste, Entrée qui crée, l'action que Grist reçoit.
async function creationProblems(page, t, note, { click }, where) {
  await click('[data-fk="pick-new:"]');
  const open = await page.run(creationSnap);
  if (!open) { note('réglage', `${where} : « ${t('an.new.item', { table: 'Personnes' })} » n'ouvre pas la fenêtre`); return; }
  if (open.ok !== 'true') note('réglage', `${where} : « ${t('an.new.ok')} » est ouvert avant qu'on ait donné un nom`);
  if (open.types.join() !== 'Text:true,Choice:false') note('réglage', `${where} : les types proposés sont « ${open.types.join(' | ')} » (« Text:true,Choice:false » attendu)`);
  await press(page, 'Poste');
  const taken = await page.run(creationSnap);
  if (taken.ok !== 'true' || taken.note !== t('an.new.taken')) note('réglage', `${where} : un nom pris ne bloque pas la création (« ${taken.note} », ${taken.ok})`);
  await page.press('Enter');
  await delay(150);
  if ((await page.run(creationSnap)) === null) note('réglage', `${where} : Entrée sur un nom pris crée quand même la colonne`);
  await page.press('Escape');
  await delay(200);
  if (!await page.run(pickerSnap)) note('clavier', `${where} : Échap dans « Créer une colonne » ferme aussi la liste (on devait y revenir)`);
  await click('[data-fk="pick-new:"]');
  await press(page, 'Matricule');
  const typed = await page.run(creationSnap);
  if (typed.ok !== 'false' || typed.note) note('réglage', `${where} : un nom libre ne s'accepte pas (« ${typed.note} », ${typed.ok})`);
  await click('[data-fk="nc-type:Choice"]');
  if ((await page.run(creationSnap)).types.join() !== 'Text:false,Choice:true') note('réglage', `${where} : le type choisi à la souris ne se marque pas`);
  await click('[data-fk="nc-type:Text"]');
  await page.run(() => document.querySelector('[data-fk="nc-name"]').focus());
  await page.press('Enter');
  await delay(400);
  if (await page.run(creationSnap)) { note('réglage', `${where} : Entrée sur un nom libre ne crée pas la colonne`); return; }
  const card = (await page.run(levelCards)).find(each => each.name === 'Essai création');
  if (!card || !card.path.includes('Matricule')) note('réglage', `${where} : le niveau n'a pas pris la colonne créée (« ${card ? card.path : 'absent'} »)`);
  const batches = await page.run(() => window.__annuaireBatches());
  const made = batches.flat().filter(action => action[0] === 'AddColumn');
  if (made.length !== 1 || made[0][1] !== 'Personnes' || made[0][2] !== 'Matricule' || made[0][3].type !== 'Text' || made[0][3].isFormula !== false) note('création', `${where} : Grist a reçu ${JSON.stringify(made)} (une seule action « AddColumn » de « Matricule » en texte attendue)`);
}

async function addLevel(page, tool, name) {
  await tool.click('[data-fk="level-add"]');
  await press(page, name);
  await tool.click('[data-fk="nl-ok"]');
  await delay(450); // le choix de la colonne s'ouvre ; les exemples arrivent
}

async function removeLevel(page, tool, name) {
  const at = (await page.run(levelCards)).findIndex(card => card.name === name);
  if (at >= 0) await tool.click(`[data-fk="lr:${at}"]`);
}

export async function pathPickerProblems(page, t, note, { wide }) {
  if (!wide) return;
  const tool = tools(page, note);
  const where = 'le choix d\'une colonne';
  await tool.click('[data-fk="tab:hier"]');
  await delay(300);
  if (!(await page.run(levelCards)).length) { note('réglage', `${where} : l'onglet « Hiérarchie » n'a pas de niveau`); return; }
  await addLevel(page, tool, 'Essai chemin');
  if (await listProblems(page, t, note, where)) {
    await backProblems(page, t, note, tool, where);
    await deepProblems(page, t, note, tool, where);
  }
  if (await page.run(pickerSnap)) await page.press('Escape');
  await delay(150);
  await removeLevel(page, tool, 'Essai chemin');
  await addLevel(page, tool, 'Essai création');
  if (await page.run(pickerSnap)) await creationProblems(page, t, note, tool, where);
  else note('réglage', `${where} : la liste des colonnes ne s'ouvre pas pour créer`);
  if (await page.run(pickerSnap)) await page.press('Escape');
  await delay(150);
  await removeLevel(page, tool, 'Essai création');
}
