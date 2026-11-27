// La fenêtre « Modifier le champ » de l'annuaire sous Firefox (règle du 03/11 ; module Annuaire, choix du porteur, 27/11 : « le nom du champ, la colonne, ses valeurs et son type »), à la vraie
// souris et au vrai clavier, sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js) : ce que Grist fait d'un changement de type se mesure dans un vrai Grist
// (labo/run-annuaire-champ-ui.mjs). Suite de test/annuaire-firefox.mjs ; l'essai écrit dans le faux Grist. À mesurer :
// - le crayon de chaque ligne de « Champs de la fiche », qui tient dans la ligne ;
// - la fenêtre à 700, 520 et 400 px : dans la page, sans défiler de côté, le nom (vide : le nom de la colonne en repère), la colonne, les six types, les valeurs d'un choix ;
// - le nom : enregistré, il remplace celui de la colonne dans la ligne (avec la colonne en repère), sans rien écrire dans Grist ;
// - les valeurs : ajouter (Entrée) et retirer, un résumé de ce qui s'écrira, un bouton qui dit « Écrire dans Grist », une seule `ModifyColumn` qui garde les autres options ;
// - un type qui change : le choix devient choix multiple, le texte est découpé en listes, en un seul lot ; une colonne qui a des valeurs ne devient pas un type que Grist abîmerait
//   (grisé avec sa raison, jamais masqué) ;
// - une autre colonne : la liste avec recherche, les valeurs de la nouvelle colonne relues ; deux champs ne portent pas le même nom ; un refus de Grist dit tel quel ;
// - Échap n'écrit rien ; une colonne créée avec ses valeurs les écrit dans ses options.
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';
import { tools } from './annuaire-setup-firefox.mjs';
import { typeInto } from './annuaire-edit-firefox.mjs';
import { reload } from './annuaire-ajout-firefox.mjs';

const PROBES = { 'une valeur': ['.mod.an-fw .an-val-t', '.mod.an-fw .an-val'], 'une aide': ['.mod.an-fw .an-set-hint', '.mod.an-fw'],
  'le nom de la colonne': ['.an-ftable .an-f-col', '.mod'] };
const PREVIEW_PROBES = { 'le résumé': ['.an-fw-preview p', '.an-fw-preview'], 'un type grisé': ['.mod.an-fw .an-seg-b[aria-disabled="true"]', '.mod.an-fw .an-seg'] };

// ---------- ce qui s'exécute dans la page ----------

function fieldSnap() {
  const win = document.querySelector('.mod.an-fw');
  if (!win) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const body = win.querySelector('.an-set-body');
  const name = win.querySelector('[data-fk="fw-name"]');
  const preview = win.querySelector('.an-fw-preview');
  const ok = win.querySelector('[data-fk="fw-ok"]');
  const note = win.querySelector('.mod-note');
  return { box: box(win), view: [innerWidth, innerHeight], title: text(win.querySelector('h2')), sideways: body.scrollWidth - body.clientWidth, body: box(body),
    foot: box(win.querySelector('.mod-foot')), name: { value: name.value, placeholder: name.placeholder, box: box(name) }, column: text(win.querySelector('[data-fk="fw-col"]')),
    inGrist: text(win.querySelector('.an-fw-head')), types: [...win.querySelectorAll('[data-type]')].map(node => ({ genre: node.dataset.type, text: text(node), box: box(node),
      pressed: node.getAttribute('aria-pressed') === 'true', disabled: node.getAttribute('aria-disabled') === 'true', title: node.title })),
    hints: [...win.querySelectorAll('.an-set-hint')].map(text), values: win.querySelector('.an-vals') ? [...win.querySelectorAll('.an-val-t')].map(text) : null,
    valuesInput: win.querySelector('[data-fk="fw-val-in"]') ? { disabled: win.querySelector('[data-fk="fw-val-in"]').disabled } : null, preview: preview ? [...preview.querySelectorAll('p')].map(text) : null,
    note: text(note), warn: note.classList.contains('is-warn'), stray: /\b(null|undefined)\b/.test(win.textContent), ok: { text: text(ok), box: box(ok) }, focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null };
}

const batchesIn = () => JSON.parse(JSON.stringify(window.__annuaireBatches()));
const modifies = batches => batches.flat().filter(action => action[0] === 'ModifyColumn' || action[0] === 'BulkUpdateRecord' || action[0] === 'AddColumn');
const inside = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;

async function readable(page, note, where, probes) {
  for (const [what, value] of Object.entries(await page.run(contrasts, probes))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
}

// ---------- ce que la fenêtre montre ----------

// La fenêtre telle qu'elle s'ouvre sur « Contrat » : dans la page, le nom vide (le nom de la colonne en repère), la colonne, les six types, les valeurs de Grist.
function startProblems(snap, t, note, where) {
  if (!snap) { note('champ', `${where} : le crayon n'ouvre pas la fenêtre`); return false; }
  if (!inside(snap.box, { left: 0, top: 0, right: snap.view[0], bottom: snap.view[1] })) note('hors de la page', `${where} : la fenêtre sort de la page`);
  if (snap.sideways > 1) note('défile de côté', `${where} : la fenêtre défile de côté (${snap.sideways} px)`);
  if (snap.foot.bottom > snap.view[1] + 1) note('champ', `${where} : le pied de la fenêtre sort de la page`);
  if (snap.title !== t('an.fld.win.title', { name: 'Contrat' })) note('champ', `${where} : le titre dit « ${snap.title} »`);
  if (snap.name.value !== '' || snap.name.placeholder !== 'Contrat') note('champ', `${where} : le nom dit « ${snap.name.value} » (repère « ${snap.name.placeholder} » ; vide, avec « Contrat » en repère, attendu)`);
  if (snap.column !== 'Contrat') note('champ', `${where} : la colonne dit « ${snap.column} » (« Contrat » attendu)`);
  if (snap.inGrist !== t('an.fld.win.inGrist', { col: 'Contrat', table: 'Personnes' })) note('champ', `${where} : la partie Grist dit « ${snap.inGrist} »`);
  if (snap.types.map(type => type.genre).join() !== 'text,choice,choicelist,bool,date,number') note('champ', `${where} : les types sont « ${snap.types.map(type => type.genre).join()} »`);
  const pressed = snap.types.filter(type => type.pressed).map(type => type.genre);
  if (pressed.join() !== 'choice') note('champ', `${where} : le type en cours est « ${pressed.join()} » (« choice » attendu)`);
  // Le corps défile (à 400 px les types passent à la ligne sous le pli) : seul le sens horizontal se mesure.
  for (const type of snap.types) if (type.box.height < 24 || type.box.left < snap.body.left - 2 || type.box.right > snap.body.right + 2) note('hors de la page', `${where} : le type « ${type.text} » est trop petit ou sort de la fenêtre`);
  if (snap.values === null || snap.values.join() !== 'Titulaire,Contractuelle,Stagiaire') note('champ', `${where} : les valeurs sont « ${snap.values} » (celles de Grist attendues)`);
  if (snap.preview !== null) note('champ', `${where} : un résumé s'affiche alors que rien n'a changé`);
  if (snap.ok.text !== t('an.fld.win.save')) note('champ', `${where} : le bouton dit « ${snap.ok.text} » (« ${t('an.fld.win.save')} » attendu : rien à écrire dans Grist)`);
  if (snap.focused !== 'fw-name') note('clavier', `${where} : le clavier est sur « ${snap.focused} » (« fw-name » attendu)`);
  if (snap.stray) note('champ', `${where} : la fenêtre écrit « null » ou « undefined »`);
  return true;
}

// ---------- les gestes ----------

const openField = async (click, at) => { await click(`[data-fk="fe:${at}"]`); await delay(350); };

// Le nom : enregistré, il remplace celui de la colonne dans la ligne ; rien ne s'écrit dans Grist.
async function nameProblems(page, t, note, tool, click, where) {
  const before = (await page.run(batchesIn)).length;
  await openField(click, 0);
  await typeInto(page, click, 'fw-name', 'Type de contrat');
  await click('[data-fk="fw-ok"]');
  await delay(300);
  if (await page.run(fieldSnap)) note('champ', `${where} : « ${t('an.fld.win.save')} » ne ferme pas la fenêtre`);
  const row = (await tool.snap()).fields.find(field => !field.locked && field.name.includes('Type de contrat'));
  if (!row) note('champ', `${where} : le nom enregistré n'est pas dans la ligne du champ`);
  else if (!row.name.includes('Contrat') || row.strays) note('champ', `${where} : la ligne dit « ${row.name} » (le nom, puis la colonne « Contrat » en repère, dans la ligne)`);
  if ((await page.run(batchesIn)).length !== before) note('champ', `${where} : changer le nom écrit dans Grist`);
}

// Ajouter une valeur : le résumé, le bouton qui dit qu'il écrit, une seule `ModifyColumn` qui garde les autres options.
async function addValueProblems(page, t, note, tool, click, where) {
  await openField(click, 0);
  let snap = await page.run(fieldSnap);
  if (snap.name.value !== 'Type de contrat') note('champ', `${where} : le nom enregistré n'est pas relu à la réouverture (« ${snap.name.value} »)`);
  await typeInto(page, click, 'fw-val-in', 'Apprenti');
  await page.press('Enter');
  await delay(200);
  snap = await page.run(fieldSnap);
  if (!snap.values.includes('Apprenti')) note('champ', `${where} : Entrée n'ajoute pas la valeur (${snap.values})`);
  const says = snap.preview ? snap.preview.join(' | ') : '';
  if (!snap.preview || !says.includes(t('an.fld.win.pvAdd', { values: 'Apprenti' }))) note('champ', `${where} : le résumé dit « ${says} » (« ${t('an.fld.win.pvAdd', { values: 'Apprenti' })} » attendu)`);
  if (snap.ok.text !== t('an.fld.win.write')) note('champ', `${where} : le bouton dit « ${snap.ok.text} » (« ${t('an.fld.win.write')} » attendu : Grist va être écrit)`);
  if (snap.focused !== 'fw-val-in') note('clavier', `${where} : le clavier est sur « ${snap.focused} » après l'ajout (« fw-val-in » attendu)`);
  await readable(page, note, `${where}, résumé`, PREVIEW_PROBES);
  await click('[data-fk="fw-ok"]');
  await delay(400);
  const written = modifies(await page.run(batchesIn));
  const [action] = written.filter(each => each[0] === 'ModifyColumn');
  if (written.length !== 1 || !action) { note('champ', `${where} : « ${t('an.fld.win.write')} » n'écrit pas une seule ModifyColumn (${JSON.stringify(written)})`); return; }
  const options = JSON.parse(action[3].widgetOptions || '{}');
  if (action[1] !== 'Personnes' || action[2] !== 'Contrat' || action[3].type !== undefined || options.choices.join() !== 'Titulaire,Contractuelle,Stagiaire,Apprenti') {
    note('champ', `${where} : l'action écrite est ${JSON.stringify(action)}`);
  }
}

// Retirer une valeur : le résumé le dit ; Échap n'écrit rien, et la fenêtre rouverte retrouve les valeurs de Grist.
async function removeValueProblems(page, t, note, click, where) {
  const before = (await page.run(batchesIn)).length;
  await openField(click, 1);
  await click('[data-fk="fw-val-x:2"]');
  await delay(200);
  const snap = await page.run(fieldSnap);
  if (snap.values.includes('Pilotage')) note('champ', `${where} : la croix ne retire pas la valeur (${snap.values})`);
  if (!snap.preview || !snap.preview.join(' ').includes(t('an.fld.win.pvRemove', { values: 'Pilotage' }))) note('champ', `${where} : le résumé ne dit pas la valeur retirée (${snap.preview})`);
  await page.press('Escape');
  await delay(250);
  if (await page.run(fieldSnap)) note('champ', `${where} : Échap ne ferme pas la fenêtre`);
  if ((await page.run(batchesIn)).length !== before) note('champ', `${where} : Échap a écrit dans Grist`);
  await openField(click, 1);
  const again = await page.run(fieldSnap);
  if (again.values.join() !== 'Budget,Marchés publics,Pilotage' || again.preview !== null) note('champ', `${where} : la fenêtre rouverte n'a pas les valeurs de Grist (${again.values})`);
  await page.press('Escape');
  await delay(200);
}

// Des valeurs déjà saisies dans une colonne qui n'est ni du texte ni un choix : les autres types sont grisés avec leur raison, un clic ne change rien.
async function lockedTypesProblems(page, t, note, click, where) {
  await openField(click, 3);
  const snap = await page.run(fieldSnap);
  const others = snap.types.filter(type => type.genre !== 'date');
  if (!snap.types.find(type => type.genre === 'date').pressed) note('champ', `${where} : « Date » n'est pas le type en cours de « Arrivee »`);
  if (others.some(type => !type.disabled || type.title !== t('an.fld.win.noConvert'))) note('champ', `${where} : les autres types ne sont pas tous grisés avec leur raison (${others.map(type => `${type.genre}:${type.disabled}`)})`);
  if (!snap.hints.includes(t('an.fld.win.noConvert'))) note('champ', `${where} : la raison des types grisés ne se lit pas sous le type (${snap.hints})`);
  if (snap.stray) note('champ', `${where} : la fenêtre écrit « null » ou « undefined »`);
  await click('[data-type="text"]');
  await delay(150);
  const after = await page.run(fieldSnap);
  if (after.types.find(type => type.genre === 'text').pressed || after.preview) note('champ', `${where} : un clic sur un type grisé le change`);
  await readable(page, note, `${where}, types grisés`, PREVIEW_PROBES);
  await page.press('Escape');
  await delay(200);
}

// Le choix devient choix multiple : les valeurs de Grist restent, les cellules de texte deviennent des listes, en un seul lot.
async function typeProblems(page, t, note, tool, click, where) {
  const before = (await page.run(batchesIn)).length;
  await openField(click, 0);
  await click('[data-fk="fw-type:choicelist"]');
  await delay(200);
  const snap = await page.run(fieldSnap);
  const says = snap.preview ? snap.preview.join(' | ') : '';
  if (!says.includes(t('an.fld.win.pvType', { col: 'Contrat', from: t('an.type.choice'), to: t('an.type.choicelist') }))) note('champ', `${where} : le résumé ne dit pas le type (« ${says} »)`);
  if (!snap.preview || snap.preview.length < 3) note('champ', `${where} : le résumé n'a pas le type, les cellules découpées et les valeurs (${says})`);
  if (!snap.values.includes('Apprenti')) note('champ', `${where} : les valeurs ne suivent pas le changement de type (${snap.values})`);
  await click('[data-fk="fw-ok"]');
  await delay(500);
  const batches = (await page.run(batchesIn)).slice(before);
  const last = batches[batches.length - 1] || [];
  if (last.length !== 2 || last[0][0] !== 'ModifyColumn' || last[0][3].type !== 'ChoiceList' || last[1][0] !== 'BulkUpdateRecord') {
    note('champ', `${where} : le changement de type n'est pas un seul lot « ModifyColumn puis BulkUpdateRecord » (${JSON.stringify(last).slice(0, 300)})`);
    return;
  }
  const lists = last[1][3].Contrat;
  if (!lists.every(list => list[0] === 'L') || lists.length < 5) note('champ', `${where} : les cellules ne deviennent pas des listes (${JSON.stringify(lists)})`);
  const row = (await tool.snap()).fields.find(field => field.name.includes('Type de contrat'));
  if (!row || row.type !== t('an.type.choicelist')) note('champ', `${where} : la ligne dit « ${row && row.type} » après le changement (« ${t('an.type.choicelist')} » attendu)`);
}

// Une autre colonne : la liste avec recherche, les valeurs de la nouvelle colonne relues ; deux champs ne portent pas le même nom ; un refus de Grist dit tel quel.
async function columnProblems(page, t, note, tool, click, where) {
  await openField(click, 2);
  await click('[data-fk="fw-col"]');
  await delay(300);
  if (!await page.run(() => document.querySelector('.mod.pk') !== null)) { note('champ', `${where} : la colonne n'ouvre pas la liste avec recherche`); await page.press('Escape'); return; }
  await click('.mod.pk [data-fk="pick-use:Site"]');
  await delay(500);
  const snap = await page.run(fieldSnap);
  if (!snap || snap.column !== 'Site' || snap.name.placeholder !== 'Site') note('champ', `${where} : la fenêtre ne montre pas la colonne « Site » (${snap && snap.column})`);
  else if (snap.values.join() !== 'Siège,Campus Nord,Campus Sud' || !snap.types.find(type => type.genre === 'choice').pressed) note('champ', `${where} : la nouvelle colonne n'est pas relue (${snap.values})`);
  await click('[data-fk="fw-ok"]');
  await delay(300);
  const row = (await tool.snap()).fields.filter(field => !field.locked)[2];
  if (!row || row.name !== 'Site') note('champ', `${where} : la ligne dit « ${row && row.name} » après le changement de colonne (« Site » attendu)`);
  // Deux champs, un seul nom.
  await openField(click, 0);
  await typeInto(page, click, 'fw-name', 'Site');
  await click('[data-fk="fw-ok"]');
  await delay(250);
  const taken = await page.run(fieldSnap);
  if (!taken || taken.note !== t('an.fld.win.errTaken') || !taken.warn) note('champ', `${where} : un nom déjà pris n'est pas refusé dit (« ${taken && taken.note} »)`);
  await page.press('Escape');
  await delay(200);
  // Un refus de Grist.
  await page.run(() => { window.__annuaireRefuse = 'Blocked by test'; });
  await openField(click, 1);
  await click('[data-fk="fw-val-x:2"]');
  await click('[data-fk="fw-ok"]');
  await delay(400);
  const refused = await page.run(fieldSnap);
  if (!refused || !refused.note.includes(t('an.fld.win.refused', { reason: 'Blocked by test' })) || !refused.warn) note('champ', `${where} : le refus de Grist n'est pas dit tel quel (« ${refused && refused.note} »)`);
  await page.run(() => { window.__annuaireRefuse = ''; });
  await page.press('Escape');
  await delay(200);
}

// Créer une colonne avec ses valeurs : la rangée des valeurs n'apparaît que pour un choix ; l'action écrite porte les valeurs.
async function createProblems(page, t, note, tool, click, where) {
  if (!await click('[data-fk="field-add"]')) return;
  await delay(300);
  if (!await click('.mod.pk [data-fk="pick-new:"]')) { await page.press('Escape'); return; }
  await delay(300);
  const hidden = () => page.run(() => { const row = document.querySelector('.mod.an-nl [data-fk="nc-val-in"]'); return !row || row.getClientRects().length === 0; });
  if (!(await hidden())) note('champ', `${where} : les valeurs s'affichent pour un type qui n'en a pas`);
  await typeInto(page, click, 'nc-name', 'Etiquettes');
  await click('[data-fk="nc-type:ChoiceList"]');
  await delay(150);
  if (await hidden()) note('champ', `${where} : les valeurs n'apparaissent pas pour un choix multiple`);
  await typeInto(page, click, 'nc-val-in', 'Alpha, Beta');
  await page.press('Enter');
  await delay(150);
  await click('[data-fk="nc-ok"]');
  await delay(500);
  const [action] = modifies(await page.run(batchesIn)).filter(each => each[0] === 'AddColumn');
  if (!action || action[2] !== 'Etiquettes' || action[3].type !== 'ChoiceList' || JSON.parse(action[3].widgetOptions || '{}').choices.join() !== 'Alpha,Beta') {
    note('champ', `${where} : la colonne créée ne porte pas ses valeurs (${JSON.stringify(action)})`);
  }
  const added = (await tool.snap()).fields.filter(field => !field.locked).map(field => field.name);
  if (!added.includes('Etiquettes')) note('champ', `${where} : la colonne créée n'est pas devenue un champ (${added})`);
}

export async function champProblems(page, t, note, click, { width, mode, language }) {
  const view = { width, mode, language };
  const where = `la fenêtre « ${t('an.fld.win.title', { name: '…' })} » à ${width} px (${mode})`;
  await reload(page, `?lang=${language}`, view);
  if (!await click('[data-fk="configure"]')) return;
  await delay(300);
  const tool = tools(page, note);
  await tool.click('[data-fk="tab:fields"]');
  const rows = await tool.snap();
  if (rows.fields.some(field => field.strays)) note('hors de sa ligne', `${where} : un champ de la liste déborde de sa ligne avec son crayon`);
  await readable(page, note, `${where}, la liste`, { 'le nom de la colonne': PROBES['le nom de la colonne'] });
  await openField(click, 0);
  if (!startProblems(await page.run(fieldSnap), t, note, where)) { await click('[data-fk="set-cancel"]'); return; }
  await readable(page, note, where, PROBES);
  if (width < 600) { await page.press('Escape'); await delay(200); await click('[data-fk="set-cancel"]'); return; }
  await page.press('Escape');
  await delay(200);
  await nameProblems(page, t, note, tool, click, where);
  await addValueProblems(page, t, note, tool, click, where);
  await removeValueProblems(page, t, note, click, where);
  await lockedTypesProblems(page, t, note, click, where);
  await typeProblems(page, t, note, tool, click, where);
  await columnProblems(page, t, note, tool, click, where);
  await createProblems(page, t, note, tool, click, where);
  await click('[data-fk="set-cancel"]');
}
