// « Nouveau > Annuaire » sous Firefox (règle du 03/11 ; module Annuaire, retour du porteur du 25/11 : « juste annuaire : si c'est le premier, on bascule sur le réglage du
// premier, sinon c'est un sous-annuaire qui hérite des paramètres du premier »), sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js, `?none=1` : aucun
// annuaire dans le document). Suite de test/annuaire-firefox.mjs. L'article du menu de l'explorateur est mesuré dans test/entries.test.mjs et test/openings.test.mjs ; la création d'un
// premier annuaire et celle d'un sous-annuaire, que `createNew` ne fait qu'appeler, l'ont été dans un vrai Grist (labo/run-annuaire.mjs, labo/run-annuaire-sous.mjs). Ici, ce que fait le
// contrôle quand l'explorateur l'appelle (`createNew`) : sans annuaire, le réglage
// d'un premier (la fenêtre de l'annuaire s'ouvre dessous) ; avec des annuaires, l'annuaire d'origine se choisit (la vue « Tous mes annuaires » n'en désigne aucun), puis la fenêtre
// d'un sous-annuaire s'ouvre sur lui ; sans être propriétaire, la phrase le dit, sans rien ouvrir.
import { delay } from './corbeille-firefox.mjs';

// ---------- ce qui s'exécute dans la page ----------

function shape(selector) {
  const modal = document.querySelector(selector);
  if (!modal) return null;
  const r = modal.getBoundingClientRect();
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');
  return { title: text(modal.querySelector('h2')), of: text(modal.querySelector('.an-sub-of')), box: [r.left, r.top, r.right, r.bottom], view: [innerWidth, innerHeight],
    annuaire: Boolean(document.querySelector('.mod.an')) };
}
const SETUP = '.mod.an-set:not(.an-sub):not(.an-pk)';
const SUB = '.mod.an-sub';
const PICK = '.mod.pk';

// ---------- l'essai ----------

function fits(snap, note, where, what) {
  const [left, top, right, bottom] = snap.box;
  if (left < -1 || top < -1 || right > snap.view[0] + 1 || bottom > snap.view[1] + 1) note('hors de la page', `${where} : la fenêtre « ${what} » sort de la page`);
}

async function reload(page, query, { width, mode }) {
  await page.goto(`${await page.run(() => `${location.origin}${location.pathname}`)}${query}`);
  await page.run(() => window.__ready);
  await page.view({ width, scale: 1, mode });
}

async function closeAll(page) {
  await page.run(() => { if (window.__annuaire.isOpen) window.__annuaire.close(); document.querySelectorAll('.mod-scrim').forEach(scrim => scrim.remove()); });
  await delay(150);
}

// Sans annuaire : le réglage d'un premier annuaire s'ouvre, la fenêtre de l'annuaire dessous ; Échap le range sans rien écrire.
async function firstProblems(page, t, note, click, view, where) {
  await reload(page, `?lang=${view.language}&none=1`, view);
  await page.run(() => { void window.__annuaire.createNew(); });
  const snap = await page.until(shape, [SETUP]).catch(() => null);
  if (!snap) { note('nouveau', `${where} : sans annuaire, « Nouveau > Annuaire » n'ouvre pas le réglage d'un premier annuaire`); return; }
  if (snap.title !== t('an.set.titleNew')) note('nouveau', `${where} : le réglage s'ouvre sur « ${snap.title} » (« ${t('an.set.titleNew')} » attendu)`);
  if (!snap.annuaire) note('nouveau', `${where} : la fenêtre de l'annuaire n'est pas ouverte sous le réglage`);
  fits(snap, note, where, snap.title);
  const wrote = await page.run(() => window.__annuaireBatches().flat().length);
  await page.press('Escape');
  await delay(250);
  if (await page.run(shape, SETUP)) note('clavier', `${where} : Échap ne range pas le réglage du premier annuaire`);
  if (await page.run(() => window.__annuaireBatches().flat().length) !== wrote) note('nouveau', `${where} : le réglage rangé a quand même écrit dans le document`);
  await closeAll(page);
}

// Avec des annuaires : l'annuaire d'origine se choisit, puis la fenêtre d'un sous-annuaire s'ouvre sur lui.
async function subProblems(page, t, note, click, view, where) {
  await reload(page, `?lang=${view.language}&sub=1`, view);
  await page.run(() => { void window.__annuaire.createNew(); });
  const pick = await page.until(shape, [PICK]).catch(() => null);
  if (!pick) { note('nouveau', `${where} : avec deux annuaires, l'annuaire d'origine ne se choisit pas`); return; }
  if (pick.title !== t('an.merge.newSubTitle')) note('nouveau', `${where} : le choix s'intitule « ${pick.title} » (« ${t('an.merge.newSubTitle')} » attendu)`);
  fits(pick, note, where, pick.title);
  if (!await click('[data-fk="pick-1"]')) { note('nouveau', `${where} : « Annuaire principal » manque dans le choix de l'origine`); return; }
  const snap = await page.until(shape, [SUB]).catch(() => null);
  if (!snap) { note('nouveau', `${where} : le choix de l'origine n'ouvre pas la fenêtre d'un sous-annuaire`); return; }
  if (snap.title !== t('an.sub.title') || !snap.of.includes('Annuaire principal')) note('nouveau', `${where} : la fenêtre dit « ${snap.title} » et « ${snap.of} » (« ${t('an.sub.title')} » et l'annuaire principal attendus)`);
  fits(snap, note, where, snap.title);
  await page.press('Escape');
  await delay(250);
  if (await page.run(shape, SUB)) note('clavier', `${where} : Échap ne range pas la fenêtre du sous-annuaire`);
  await closeAll(page);
}

// Sans être propriétaire : la phrase dit pourquoi, rien ne s'ouvre.
async function readerProblems(page, t, note, click, view, where) {
  await reload(page, `?lang=${view.language}&sub=1&admin=0`, view);
  await page.run(() => { void window.__annuaire.createNew(); });
  await page.until(() => window.__annuaireNotices.length > 0).catch(() => null);
  const said = await page.run(() => window.__annuaireNotices.slice());
  if (!said.includes(t('an.sub.newWhy'))) note('nouveau', `${where} : sans être propriétaire, la phrase dit ${JSON.stringify(said)} (« ${t('an.sub.newWhy')} » attendu)`);
  if (await page.run(shape, PICK) || await page.run(shape, SUB)) note('nouveau', `${where} : sans être propriétaire, une fenêtre s'ouvre quand même`);
  await closeAll(page);
}

export async function nouveauProblems(page, t, note, click, { width, mode, language }) {
  const view = { width, mode, language };
  const where = `« Nouveau > Annuaire » à ${width} px`;
  await firstProblems(page, t, note, click, view, where);
  await subProblems(page, t, note, click, view, where);
  await readerProblems(page, t, note, click, view, where);
}
