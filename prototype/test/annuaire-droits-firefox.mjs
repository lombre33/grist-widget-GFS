// « Qui modifie les fiches » sous Firefox (règle du 03/11 ; module Annuaire, retour du porteur du 25/11 : « par défaut les administrateurs, mais aussi chacun sa propre fiche,
// son niveau hiérarchique avec en option le niveau en dessous, ou un rôle désigné »), à la vraie souris, sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js,
// `?rights=…&admin=0&me=…`). Suite de test/annuaire-firefox.mjs ; l'essai n'écrit rien (la fenêtre « Modifier » s'ouvre et se range). À mesurer, pour des personnes et des règles :
// le bouton « Modifier » de la fiche, ouvert ou grisé avec la phrase qui dit qui modifie (jamais masqué), un clic sur le grisé qui redit la phrase dans le pied sans ouvrir de
// fenêtre, un clic sur l'ouvert qui ouvre la fenêtre ; et la lisibilité de la phrase (4,5:1). La règle elle-même s'essaie sous Node (test/annuaire-edit-rights.test.mjs).
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';
import { clickOn } from './annuaire-table-firefox.mjs';

// ---------- ce qui s'exécute dans la page ----------

function ficheState() {
  const button = document.querySelector('.an-side [data-fk="edit"]');
  const name = document.querySelector('.an-side .an-fiche-id .an-pe-name, .an-side .an-fiche-id h3, .an-side .an-fiche-id b');
  return button ? { name: name ? name.textContent.trim() : '', disabled: button.getAttribute('aria-disabled') === 'true', title: button.title, text: button.textContent.trim(),
    foot: document.querySelector('.an-foot').textContent.replace(/\s+/g, ' ').trim(), editing: document.querySelector('.mod.an-edit') !== null,
    box: (r => [r.left, r.top, r.right, r.bottom])(button.getBoundingClientRect()), view: [innerWidth, innerHeight] } : null;
}

// ---------- l'essai ----------

const ME = { camille: 'camille.durand@exemple.fr', nathan: 'nathan.roussel@exemple.fr', louis: 'louis.girard@exemple.fr' };
const PEOPLE = { 1: 'Camille Durand', 2: 'Inès Marchand', 3: 'Nathan Roussel', 4: 'Louis Girard', 5: 'Emma Rolland' };

async function reload(page, query, { width, mode }) {
  await page.goto(`${await page.run(() => `${location.origin}${location.pathname}`)}${query}`);
  await page.run(() => window.__ready);
  await page.view({ width, scale: 1, mode });
  await page.run(() => void window.__annuaire.open());
  await page.until(() => document.querySelector('.mod.an .an-person, .mod.an .an-pcard') !== null);
}

// La fiche de la personne `row` (on la cherche par son nom dans la liste, puis on l'ouvre) ; rend l'état de son bouton « Modifier ».
async function fiche(page, click, row) {
  await page.run(() => { const close = document.querySelector('.an-side .an-side-x'); if (close) close.click(); });
  await delay(100);
  if (!await click('[data-fk="v:list"]') || !await click('[data-fk="search"]')) return null;
  await page.chord('Control', 'a');
  await page.press(...PEOPLE[row].split(''));
  await delay(150);
  if (!await click(`[data-fk="pe:${row}"]`)) return null;
  await delay(150);
  return page.run(ficheState);
}

function listOf(language, parts) {
  return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(parts);
}

// Une personne, ce qu'on attend (`reason` : la phrase du bouton grisé, ou null quand il doit être ouvert).
async function probe(page, t, note, click, { row, reason, where }) {
  const state = await fiche(page, click, row);
  if (!state) { note('droits', `${where} : la fiche de ${PEOPLE[row]} ne s'ouvre pas`); return; }
  const who = `${where}, ${PEOPLE[row]}`;
  if (state.text !== t('an.edit')) note('droits', `${who} : le bouton dit « ${state.text} » (« ${t('an.edit')} » attendu : grisé, jamais masqué)`);
  const [left, top, right, bottom] = state.box;
  if (left < -1 || top < -1 || right > state.view[0] + 1 || bottom > state.view[1] + 1) note('hors de la page', `${who} : le bouton « Modifier » sort de la page`);
  if (reason === null) {
    if (state.disabled) note('droits', `${who} : « Modifier » est grisé alors que la règle l'ouvre (« ${state.title} »)`);
    if (state.title !== t('an.edit.tip')) note('droits', `${who} : le bouton dit « ${state.title} » (« ${t('an.edit.tip')} » attendu)`);
    await clickOn(page, note, '.an-side [data-fk="edit"]');
    await delay(300);
    if (!(await page.run(ficheState)).editing) note('droits', `${who} : « Modifier » ne s'ouvre pas alors que la règle l'ouvre`);
    await page.press('Escape');
    await delay(250);
    return;
  }
  if (!state.disabled) note('droits', `${who} : « Modifier » est ouvert alors que la règle ne l'ouvre pas`);
  if (state.title !== reason) note('droits', `${who} : le bouton dit « ${state.title} » (« ${reason} » attendu)`);
  await clickOn(page, note, '.an-side [data-fk="edit"]');
  await delay(250);
  const after = await page.run(ficheState);
  if (after.editing) { note('droits', `${who} : un clic sur « Modifier » grisé ouvre quand même la fenêtre`); await page.press('Escape'); await delay(250); }
  if (after.foot !== reason) note('droits', `${who} : le pied dit « ${after.foot} » après le clic (« ${reason} » attendu)`);
}

async function scenario(page, t, note, click, view, { query, label, people }) {
  const where = `qui modifie les fiches, ${label} (${view.width} px)`;
  await reload(page, `?lang=${view.language}&${query}`, view);
  for (const [row, reason] of people) await probe(page, t, note, click, { row, reason, where });
}

export async function droitsProblems(page, t, note, click, { width, mode, language }) {
  const view = { width, mode, language };
  const admins = t('an.edit.whyAdmins');
  const rules = who => t('an.edit.whyRules', { who: listOf(language, who.map(key => t(`an.edit.who.${key}`))) });
  await scenario(page, t, note, click, view, { query: '', label: 'administrateur', people: [[1, null], [5, null]] });
  await scenario(page, t, note, click, view, { query: `admin=0&me=${ME.camille}`, label: 'sans règle', people: [[1, admins], [2, admins]] });
  await scenario(page, t, note, click, view, { query: `rights=self&admin=0&me=${ME.camille}`, label: 'chacun la sienne', people: [[1, null], [2, rules(['self'])]] });
  await scenario(page, t, note, click, view, { query: 'rights=self&admin=0', label: 'adresse inconnue', people: [[1, `${rules(['self'])} ${t('an.edit.whyNoIdentity')}`]] });
  await scenario(page, t, note, click, view, { query: `rights=own&admin=0&me=${ME.nathan}`, label: 'sa structure', people: [[2, null], [1, rules(['own'])], [5, rules(['own'])]] });
  await scenario(page, t, note, click, view, { query: `rights=below&admin=0&me=${ME.nathan}`, label: 'sa structure et en dessous',
    people: [[2, null], [1, null], [4, rules(['below'])], [5, rules(['below'])]] });
  await scenario(page, t, note, click, view, { query: `rights=self,role&admin=0&me=${ME.louis}`, label: 'rôle désigné', people: [[1, null], [5, null], [4, null]] });
  await scenario(page, t, note, click, view, { query: `rights=self,role&admin=0&me=${ME.camille}`, label: 'sans le rôle', people: [[1, null], [5, rules(['self', 'role'])]] });
  for (const [what, value] of Object.entries(await page.run(contrasts, { 'la raison de « Modifier »': ['.an-foot', '.mod.an'] }))) {
    if (value < 4.5) note('contraste', `qui modifie les fiches : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
  }
}
