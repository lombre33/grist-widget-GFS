// La fenêtre « Modifier » d'une fiche sous Firefox (règle du 03/11 ; module Annuaire, demande du porteur du 25/11 : « le bouton Modifier »), à la vraie souris et au vrai clavier,
// sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js). Suite de test/annuaire-firefox.mjs ; l'essai écrit dans le faux Grist : il passe en dernier. À mesurer :
// le bouton de la fiche (grisé et muet sur la raison quand le document ne s'écrit pas), la fenêtre (ses quatre groupes, une ligne par colonne directe, tout dans le cadre sans défiler
// de côté, le clavier sur le premier champ), le pied qui compte les champs changés, un nom vide refusé, un choix et une personne par la liste avec recherche, une case de choix
// multiple, l'interrupteur, la relecture (avant barré, après en gras), le retour au formulaire sans rien perdre, l'écriture (un seul `UpdateRecord`, rien que les colonnes changées)
// et la phrase du pied, une réponse de Grist qui refuse (dite telle quelle, la fenêtre reste ouverte), et la lisibilité (4,5:1).
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';

const PROBES = { who: ['.an-ed-who', '.an-edit'], label: ['.an-edit .an-set-label', '.an-edit'], was: ['.an-ed-was', '.an-ed-change'], now: ['.an-ed-now', '.an-ed-change'] };

// ---------- ce qui s'exécute dans la page ----------

function editSnap() {
  const win = document.querySelector('.mod.an-edit');
  if (!win) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const body = win.querySelector('.an-ed-body');
  const next = win.querySelector('[data-fk="ed-next"]');
  const note = win.querySelector('.mod-note');
  return { box: box(win), viewport: { width: window.innerWidth, height: window.innerHeight }, title: text(win.querySelector('h2')), who: text(win.querySelector('.an-ed-who')),
    sections: [...win.querySelectorAll('.an-ed-sec h3')].map(text), sideways: body.scrollWidth - body.clientWidth, body: box(body),
    rows: [...win.querySelectorAll('.an-set-row')].map(row => ({ label: text(row.querySelector('.an-set-label')), box: box(row), locked: row.classList.contains('an-ed-locked'),
      control: row.querySelector('input, .an-pickbtn, .an-ed-chips, .an-ed-bool') ? box(row.querySelector('input, .an-pickbtn, .an-ed-chips, .an-ed-bool')) : null,
      fk: (row.querySelector('[data-fk^="ef:"]') || { dataset: {} }).dataset.fk || null, value: row.querySelector('input') ? row.querySelector('input').value : text(row.querySelector('.an-set-control')),
      invalid: row.querySelector('[aria-invalid="true"]') !== null })),
    chips: [...win.querySelectorAll('.an-ed-chip')].map(chip => ({ fk: chip.dataset.fk, on: chip.getAttribute('aria-checked') === 'true', text: text(chip), box: box(chip) })),
    pills: [...win.querySelectorAll('.an-ed-pill')].map(text),
    changes: [...win.querySelectorAll('.an-ed-change')].map(change => ({ label: text(change.querySelector('dt')), was: text(change.querySelector('.an-ed-was')), now: text(change.querySelector('.an-ed-now')),
      decoration: getComputedStyle(change.querySelector('.an-ed-was')).textDecorationLine, box: box(change) })),
    note: text(note), warn: note.classList.contains('is-warn'), next: { text: text(next), disabled: next.getAttribute('aria-disabled') === 'true', box: box(next) },
    cancel: text(win.querySelector('[data-fk="ed-cancel"]')),
    focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null };
}

function ficheEditSnap() {
  const button = document.querySelector('.an-side [data-fk="edit"]');
  const card = document.querySelector('.an-side .an-fiche-card');
  if (!button || !card) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  return { button: { text: button.textContent.trim(), title: button.title, disabled: button.getAttribute('aria-disabled') === 'true', box: box(button) }, card: box(card),
    subtitle: (document.querySelector('.an-side .an-fiche-id .an-pe-sub') || { textContent: '' }).textContent.trim(), foot: document.querySelector('.an-foot').textContent.trim() };
}

const inside = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;

// ---------- les mesures ----------

function formProblems(snap, t, note, where) {
  if (snap.title !== t('an.edit.title')) note('modifier', `${where} : le titre dit « ${snap.title} » (« ${t('an.edit.title')} » attendu)`);
  if (snap.who !== 'Camille Durand') note('modifier', `${where} : la fenêtre dit « ${snap.who} » (« Camille Durand » attendu)`);
  const wanted = [t('an.edit.identity'), t('an.fiche.contact'), t('an.tab.relations'), t('an.fiche.fields')];
  if (snap.sections.join('|') !== wanted.join('|')) note('modifier', `${where} : les groupes sont « ${snap.sections.join(' | ')} » (« ${wanted.join(' | ')} » attendus)`);
  if (snap.rows.length !== 11) note('modifier', `${where} : ${snap.rows.length} lignes (11 colonnes directes attendues)`);
  if (snap.box.bottom > snap.viewport.height + 1 || snap.box.right > snap.viewport.width + 1 || snap.box.left < -1 || snap.box.top < -1) note('modifier', `${where} : la fenêtre sort de la page`);
  if (snap.sideways > 1) note('modifier', `${where} : le formulaire défile de côté (${snap.sideways} px)`);
  for (const row of snap.rows) {
    if (!inside(row.box, snap.body, 1.5) && row.box.right > snap.body.right + 1) note('modifier', `${where} : la ligne « ${row.label} » sort du formulaire`);
    if (row.control && row.control.height < 26) note('modifier', `${where} : le champ « ${row.label} » ne mesure que ${Math.round(row.control.height)} px de haut`);
  }
  if (snap.focused !== 'ef:name') note('clavier', `${where} : le clavier est sur « ${snap.focused} » (« ef:name » attendu)`);
  if (!snap.next.disabled) note('modifier', `${where} : « ${snap.next.text} » devrait être grisé tant que rien n'a changé`);
  if (snap.note !== t('an.edit.nothing')) note('modifier', `${where} : le pied dit « ${snap.note} » (« ${t('an.edit.nothing')} » attendu)`);
}

// La liste, avec Camille Durand seule (la recherche) : la fiche s'ouvre sur elle, qu'elle l'ait été ou non avant l'essai.
async function ficheButton(page, t, note, click) {
  await page.run(() => { if (!window.__annuaire.isOpen) void window.__annuaire.open(); }); // l'essai du clavier a fermé la fenêtre
  await page.until(() => document.querySelector('.mod.an .an-person, .mod.an .an-pcard') !== null);
  if (!await click('[data-fk="v:list"]') || !await click('[data-fk="search"]')) return null;
  await page.chord('Control', 'a');
  await page.press(...'camille durand'.split(''));
  await delay(150);
  const open = await page.run(() => document.querySelector('.an-side [data-fk="edit"]') !== null);
  if (!open && !await click('[data-fk="pe:1"]')) return null;
  await delay(150);
  const fiche = await page.run(ficheEditSnap);
  if (!fiche) { note('modifier', 'la fiche n\'a pas son bouton « Modifier »'); return null; }
  if (fiche.button.text !== t('an.edit')) note('modifier', `le bouton de la fiche dit « ${fiche.button.text} » (« ${t('an.edit')} » attendu)`);
  if (fiche.button.box.height < 24) note('modifier', `le bouton « Modifier » ne mesure que ${Math.round(fiche.button.box.height)} px de haut (24 au moins)`);
  if (!inside(fiche.button.box, fiche.card)) note('modifier', 'le bouton « Modifier » sort de la fiche');
  return fiche;
}

// Ce que la fenêtre a de lisible : le contraste, sous 4,5:1 : noté.
async function readable(page, note, where) {
  for (const [what, value] of Object.entries(await page.run(contrasts, PROBES))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
}

export async function typeInto(page, click, fk, text) {
  await click(`[data-fk="${fk}"]`);
  await page.chord('Control', 'a');
  if (text) await page.press(...text.split('')); else await page.press('Backspace');
  await delay(100);
}

// Un choix dans la liste avec recherche que le bouton `fk` ouvre.
export async function pickFrom(page, click, note, fk, value, where) {
  if (!await click(`[data-fk="${fk}"]`)) return false;
  await delay(150);
  const opened = await page.run(() => document.querySelector('.mod.pk') !== null);
  if (!opened) { note('modifier', `${where} : « ${fk} » n'ouvre pas la liste avec recherche`); return false; }
  const clicked = await click(`.mod.pk [data-fk="pick-${value}"]`);
  await delay(150);
  return clicked;
}

// Le formulaire rempli à la souris et au clavier : un texte, un choix, une case, un interrupteur, une personne, une liste de personnes.
async function fillForm(page, t, note, click, snapNow) {
  const where = 'le formulaire « Modifier »';
  await typeInto(page, click, 'ef:name', '');
  await click('[data-fk="ed-next"]');
  let snap = await snapNow();
  const nameRow = snap.rows.find(row => row.fk === 'ef:name');
  if (!snap.warn || snap.note !== t('an.edit.errName') || !nameRow || !nameRow.invalid) note('modifier', `${where} : un nom vide n'est pas refusé comme il faut (pied « ${snap.note} »)`);
  await typeInto(page, click, 'ef:name', 'Camille Durand');
  await typeInto(page, click, 'ef:title', 'Cheffe du budget');
  snap = await snapNow();
  if (snap.note !== t('an.edit.count', { n: 1 })) note('modifier', `${where} : après un texte, le pied dit « ${snap.note} » (« ${t('an.edit.count', { n: 1 })} » attendu)`);
  if (snap.next.disabled) note('modifier', `${where} : « ${snap.next.text} » reste grisé alors qu'un champ a changé`);
  await pickFrom(page, click, note, 'ef:Contrat', 'Stagiaire', where);
  snap = await snapNow();
  if (snap.rows.find(row => row.fk === 'ef:Contrat').value.indexOf('Stagiaire') < 0) note('modifier', `${where} : le choix « Stagiaire » ne s'affiche pas dans le champ`);
  if (snap.focused !== 'ef:Contrat') note('clavier', `${where} : après le choix, le clavier est sur « ${snap.focused} » (« ef:Contrat » attendu)`);
  await click('[data-fk="ec:Competences:Pilotage"]');
  await click('[data-fk="ef:Teletravail"]');
  await pickFrom(page, click, note, 'ef:manager', '4', where);
  await pickFrom(page, click, note, 'ea:rel:Referents', '4', where);
  snap = await snapNow();
  const pilotage = snap.chips.find(chip => chip.fk === 'ec:Competences:Pilotage');
  if (!pilotage || !pilotage.on) note('modifier', `${where} : la case « Pilotage » n'est pas cochée`);
  if (snap.chips.some(chip => chip.box.height < 24)) note('modifier', `${where} : une case de choix mesure moins de 24 px de haut`);
  if (snap.pills.length !== 3 || !snap.pills.some(pill => pill.indexOf('Louis Girard') >= 0)) note('modifier', `${where} : les référent·e·s sont « ${snap.pills.join(' | ')} » (trois dont Louis Girard attendus)`);
  if (snap.note !== t('an.edit.count', { n: 6 })) note('modifier', `${where} : le pied dit « ${snap.note} » (« ${t('an.edit.count', { n: 6 })} » attendu)`);
  if (snap.sideways > 1) note('modifier', `${where} : le formulaire défile de côté après les choix`);
}

// La relecture : chaque champ changé, avant (barré) et après ; « Retour » rend le formulaire intact.
async function reviewProblems(page, t, note, click, snapNow, { mode }) {
  const where = 'la relecture';
  await click('[data-fk="ed-next"]');
  await delay(120);
  let snap = await snapNow();
  if (snap.title !== t('an.edit.reviewTitle')) note('modifier', `${where} : le titre dit « ${snap.title} » (« ${t('an.edit.reviewTitle')} » attendu)`);
  if (snap.changes.length !== 6) note('modifier', `${where} : ${snap.changes.length} changements (6 attendus)`);
  const title = snap.changes.find(change => change.label === t('an.fiche.post'));
  if (!title) note('modifier', `${where} : le poste n'a pas son avant et son après`);
  if (title && (title.now !== 'Cheffe du budget' || title.was !== 'Cheffe du service Budget')) note('modifier', `${where} : le poste dit « ${title.was} » puis « ${title.now} »`);
  if (snap.changes.some(change => change.decoration.indexOf('line-through') < 0)) note('modifier', `${where} : une valeur d'avant n'est pas barrée`);
  if (snap.changes.some(change => change.box.left < snap.body.left - 1 || change.box.right > snap.body.right + 1)) note('modifier', `${where} : un changement sort de la fenêtre`);
  if (snap.next.text !== t('an.edit.save') || snap.cancel !== t('an.edit.back')) note('modifier', `${where} : les boutons disent « ${snap.cancel} » et « ${snap.next.text} »`);
  if (snap.sideways > 1) note('modifier', `${where} : la relecture défile de côté`);
  await readable(page, note, `${where} (${mode})`);
  await click('[data-fk="ed-cancel"]');
  snap = await snapNow();
  const row = snap && snap.rows.find(each => each.fk === 'ef:title');
  if (!snap || snap.title !== t('an.edit.title') || !row || row.value !== 'Cheffe du budget') note('modifier', `${where} : « ${t('an.edit.back')} » ne rend pas le formulaire avec ce qui était écrit`);
  await click('[data-fk="ed-next"]');
  await delay(100);
}

// L'écriture : le faux Grist reçoit une seule action ; la fenêtre se ferme, la fiche montre le nouveau poste, le pied le dit.
async function writeProblems(page, t, note, click, snapNow) {
  const where = 'l\'écriture';
  const before = await page.run(() => window.__annuaireBatches().length);
  await click('[data-fk="ed-next"]');
  await delay(400);
  if (await snapNow()) { note('modifier', `${where} : la fenêtre reste ouverte après « ${t('an.edit.save')} »`); return; }
  const batches = (await page.run(() => window.__annuaireBatches())).slice(before);
  const writes = batches.flat().filter(action => action[1] === 'Personnes');
  if (batches.length !== 1 || writes.length !== 1 || writes[0][0] !== 'UpdateRecord' || writes[0][2] !== 1) note('modifier', `${where} : le faux Grist a reçu ${JSON.stringify(batches)} (un seul UpdateRecord de la ligne 1 attendu)`);
  const got = writes[0] ? writes[0][3] : {};
  const wanted = { Poste: 'Cheffe du budget', Contrat: 'Stagiaire', Competences: ['L', 'Budget', 'Marchés publics', 'Pilotage'], Teletravail: false, Responsable: 4, Referents: ['L', 5, 3, 4] };
  if (JSON.stringify(Object.entries(got).sort()) !== JSON.stringify(Object.entries(wanted).sort())) note('modifier', `${where} : les colonnes écrites sont ${JSON.stringify(got)} (${JSON.stringify(wanted)} attendu)`);
  const fiche = await page.run(ficheEditSnap);
  if (!fiche || fiche.subtitle !== 'Cheffe du budget') note('modifier', `${where} : la fiche dit « ${fiche && fiche.subtitle} » (« Cheffe du budget » attendu)`);
  if (fiche && fiche.foot.indexOf(t('an.edit.saved', { name: 'Camille Durand' })) < 0) note('modifier', `${where} : le pied dit « ${fiche.foot} » (« ${t('an.edit.saved', { name: 'Camille Durand' })} » attendu)`);
}

// Grist refuse : la phrase de Grist est dite, la fenêtre reste ouverte, rien n'est écrit ; Échap la ferme.
async function refusedProblems(page, t, note, click, snapNow) {
  const where = 'le refus de Grist';
  await page.run(() => { window.__annuaireRefuse = 'Accès refusé par les règles du document'; });
  await click('[data-fk="edit"]');
  await delay(200);
  await typeInto(page, click, 'ef:phone', '01 02 03 04 99');
  await click('[data-fk="ed-next"]');
  await click('[data-fk="ed-next"]');
  await delay(300);
  const snap = await snapNow();
  const said = t('an.edit.refused', { reason: 'Accès refusé par les règles du document' });
  if (!snap) note('modifier', `${where} : la fenêtre s'est fermée alors que Grist a refusé`);
  else if (!snap.warn || snap.note !== said) note('modifier', `${where} : le pied dit « ${snap.note} » (« ${said} » attendu)`);
  else if (snap.next.disabled) note('modifier', `${where} : « ${snap.next.text} » reste grisé après le refus (on doit pouvoir réessayer)`);
  await page.run(() => { window.__annuaireRefuse = null; });
  await page.press('Escape');
  await delay(150);
  if (await snapNow()) note('modifier', `${where} : Échap ne ferme pas la fenêtre`);
}

// Un document qui ne s'écrit pas : le bouton est grisé, son survol dit pourquoi, un clic le redit dans le pied et n'ouvre rien.
async function blockedProblems(page, t, note, click, snapNow) {
  const where = 'le document qui ne s\'écrit pas';
  const reason = 'Document en lecture seule';
  await page.run(text => { window.__annuaireBlock = text; window.__annuaire.relocalize(); }, reason);
  await delay(150);
  const fiche = await page.run(ficheEditSnap);
  if (!fiche || !fiche.button.disabled || fiche.button.title !== reason) note('modifier', `${where} : le bouton n'est pas grisé avec sa raison (${JSON.stringify(fiche && fiche.button)})`);
  await click('[data-fk="edit"]');
  await delay(150);
  if (await snapNow()) note('modifier', `${where} : un clic sur le bouton grisé ouvre la fenêtre`);
  const after = await page.run(ficheEditSnap);
  if (after && after.foot.indexOf(reason) < 0) note('modifier', `${where} : le pied ne dit pas « ${reason} » (« ${after.foot} »)`);
  await page.run(() => { window.__annuaireBlock = null; });
}

export async function editProblems(page, t, note, click, { width, mode }) {
  const snapNow = () => page.run(editSnap);
  const fiche = await ficheButton(page, t, note, click);
  if (!fiche) return;
  await click('[data-fk="edit"]');
  await delay(250);
  const start = await snapNow();
  if (!start) { note('modifier', 'le bouton « Modifier » n\'ouvre pas la fenêtre'); return; }
  formProblems(start, t, note, `la fenêtre « Modifier » à ${width} px`);
  await readable(page, note, `le formulaire « Modifier » (${mode})`);
  await fillForm(page, t, note, click, snapNow);
  await reviewProblems(page, t, note, click, snapNow, { mode });
  await writeProblems(page, t, note, click, snapNow);
  await refusedProblems(page, t, note, click, snapNow);
  await blockedProblems(page, t, note, click, snapNow);
}
