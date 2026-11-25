// « Créer une table » pour l'annuaire sous Firefox (règle du 03/11 ; module Annuaire, retour du porteur du 25/11 : « pour chaque option qui demande la table, laisser l'option d'en
// créer une »), à la vraie souris et au vrai clavier, sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js). Suite de test/annuaire-firefox.mjs ; l'essai écrit
// dans le faux Grist (une table, une colonne) et ne garde aucun annuaire. À mesurer : dans le réglage d'un nouvel annuaire, le choix de la table propose « Créer une table… » en
// première ligne et garde les tables du document ; la fenêtre (qui tient dans la page, le nom proposé, un nom déjà pris qui bloque et le dit, Échap qui revient à la liste, Entrée qui
// crée) ; la seule action que Grist reçoit (`AddTable`, le nom et l'adresse) ; le réglage qui prend la table et ses deux colonnes ; puis le choix d'une colonne, qui propose de créer
// celle qui manque dans la table nouvelle (le téléphone) ; et la lisibilité (4,5:1).
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';
import { press } from './annuaire-setup-firefox.mjs';

export const TABLE_PROBES = { 'le titre': ['.an-nl h2', '.an-nl'], 'un libellé': ['.an-nl .an-set-label', '.an-nl'], 'les colonnes créées': ['.an-nl .an-set-text', '.an-nl'],
  'l\'explication': ['.an-nl .an-set-hint', '.an-nl'] };

// ---------- ce qui s'exécute dans la page ----------

function windowSnap() {
  const modal = document.querySelector('.mod.an-nl');
  if (!modal) return null;
  const r = modal.getBoundingClientRect();
  const text = selector => { const node = modal.querySelector(selector); return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; };
  const input = modal.querySelector('[data-fk="nt-name"], [data-fk="nc-name"]');
  const ok = modal.querySelector('[data-fk="nt-ok"], [data-fk="nc-ok"]');
  return { title: text('h2'), name: input ? input.value : null, ok: ok ? ok.getAttribute('aria-disabled') : null, note: text('.mod-note'), columns: text('.an-set-text'),
    box: [r.left, r.top, r.right, r.bottom], view: [innerWidth, innerHeight], sideways: modal.scrollWidth - modal.clientWidth, foot: modal.querySelector('.mod-foot').getBoundingClientRect().bottom };
}

function setupSnap() {
  const modal = document.querySelector('.mod.an-set');
  if (!modal) return null;
  const text = fk => { const node = modal.querySelector(`[data-fk="${fk}"]`); return node ? node.textContent.replace(/\s+/g, ' ').trim() : null; };
  return { table: text('pt'), name: text('pc:name'), email: text('pc:email'), phone: text('pc:phone') };
}

const pickRows = () => [...document.querySelectorAll('.mod.pk .wk-item')].map(node => node.dataset.fk);

const batches = () => window.__annuaireBatches();

// Un clic à la vraie souris sur un élément, après l'avoir amené dans la fenêtre (le réglage défile : un bouton plus bas que 400 px n'est pas sous la souris sinon).
export async function clickOn(page, note, selector) {
  const at = await page.run(sel => {
    const node = document.querySelector(sel);
    if (!node) return null;
    node.scrollIntoView({ block: 'nearest' });
    const r = node.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, selector);
  if (!at) { note('introuvable', `${selector} n'est pas dans la page`); return false; }
  await page.click(...at);
  await delay(120);
  return true;
}

// ---------- l'essai ----------

function windowProblems(open, note, t, where) {
  if (open.title !== t('an.tbl.title')) note('table', `${where} : le titre dit « ${open.title} » (« ${t('an.tbl.title')} » attendu)`);
  if (open.name !== 'Directory_People') note('table', `${where} : le nom proposé est « ${open.name} » (« Directory_People » attendu)`);
  if (open.columns !== 'Name, Email') note('table', `${where} : les colonnes créées disent « ${open.columns} » (« Name, Email » attendu)`);
  if (open.ok !== 'false') note('table', `${where} : « ${t('an.tbl.ok')} » est grisé alors que le nom est libre`);
  const [left, top, right, bottom] = open.box;
  if (left < -1 || top < -1 || right > open.view[0] + 1 || bottom > open.view[1] + 1) note('hors de la page', `${where} : la fenêtre sort de la page`);
  if (open.sideways > 1) note('défile de côté', `${where} : la fenêtre défile de côté (${open.sideways} px)`);
  if (open.foot > open.view[1] + 1) note('hors de la page', `${where} : le pied de la fenêtre sort de la page`);
}

export async function tableProblems(page, t, note, click, { width, mode }) {
  const hit = selector => clickOn(page, note, selector);
  const where = `la création d'une table (${mode}, ${width} px)`;
  if (!await click('[data-fk="switch"]')) return;
  await delay(250);
  if (!await click('[data-fk="pick-__new__"]')) return;
  await delay(400);
  if (!await page.run(setupSnap)) { note('table', `${where} : le réglage d'un nouvel annuaire ne s'ouvre pas`); return; }
  await click('[data-fk="pt"]');
  await delay(250);
  const rows = await page.run(pickRows);
  if (rows[0] !== 'pick-new:') note('table', `${where} : la première ligne du choix de la table n'est pas « ${t('an.tbl.item')} » (${rows.slice(0, 3).join(' | ')})`);
  if (!rows.includes('pick-Personnes')) note('table', `${where} : les tables du document ne sont plus dans la liste (${rows.join(' | ')})`);
  if (!await click('[data-fk="pick-new:"]')) return;
  await delay(250);
  const open = await page.run(windowSnap);
  if (!open) { note('table', `${where} : « ${t('an.tbl.item')} » n'ouvre pas la fenêtre`); return; }
  windowProblems(open, note, t, where);
  for (const [what, value] of Object.entries(await page.run(contrasts, TABLE_PROBES))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
  await page.run(() => document.querySelector('[data-fk="nt-name"]').select());
  await press(page, 'Personnes');
  const taken = await page.run(windowSnap);
  if (taken.ok !== 'true' || taken.note !== t('an.tbl.taken')) note('table', `${where} : un nom pris ne bloque pas la création (« ${taken.note} », ${taken.ok})`);
  await page.press('Enter');
  await delay(200);
  if (!await page.run(windowSnap)) note('table', `${where} : Entrée sur un nom pris crée quand même la table`);
  await page.press('Escape');
  await delay(250);
  if (await page.run(windowSnap) || !(await page.run(pickRows)).length) note('clavier', `${where} : Échap dans « ${t('an.tbl.title')} » ne revient pas à la liste des tables`);
  if (!await click('[data-fk="pick-new:"]')) return;
  await delay(250);
  await page.run(() => document.querySelector('[data-fk="nt-name"]').focus());
  await page.press('Enter');
  await delay(500);
  if (await page.run(windowSnap)) { note('table', `${where} : Entrée sur un nom libre ne crée pas la table`); await page.press('Escape'); return; }
  const adopted = await page.run(setupSnap);
  if (!adopted || adopted.table !== 'Directory_People' || adopted.name !== 'Name' || adopted.email !== 'Email') {
    note('table', `${where} : le réglage prend « ${adopted && adopted.table} », « ${adopted && adopted.name} », « ${adopted && adopted.email} » (« Directory_People », « Name », « Email » attendus)`);
  }
  const made = (await page.run(batches)).flat().filter(action => action[0] === 'AddTable' && action[1] === 'Directory_People');
  const wanted = [['AddTable', 'Directory_People', [{ id: 'Name', type: 'Text' }, { id: 'Email', type: 'Text' }]]];
  if (JSON.stringify(made) !== JSON.stringify(wanted)) note('création', `${where} : Grist a reçu ${JSON.stringify(made)} (une seule action « AddTable » de « Directory_People » attendue : ${JSON.stringify(wanted)})`);
  await columnProblems(page, t, note, hit, where);
  await hit('[data-fk="set-cancel"]');
  await delay(250);
}

// Dans la table nouvelle, le choix d'une colonne propose de créer celle qui manque : le téléphone, une colonne de plus pour GFS.
async function columnProblems(page, t, note, hit, where) {
  if (!await hit('[data-fk="add-phone"]')) return;
  await delay(300);
  const rows = await page.run(pickRows);
  if (rows[0] !== 'pick-new:') { note('table', `${where} : dans la table nouvelle, le choix du téléphone ne propose pas « ${t('an.new.item', { table: 'Directory_People' })} » (${rows.join(' | ')})`); await page.press('Escape'); return; }
  await hit('[data-fk="pick-new:"]');
  await delay(250);
  await press(page, 'Phone');
  await page.press('Enter');
  await delay(500);
  const made = (await page.run(batches)).flat().filter(action => action[0] === 'AddColumn' && action[1] === 'Directory_People');
  if (made.length !== 1 || made[0][2] !== 'Phone') note('création', `${where} : Grist a reçu ${JSON.stringify(made)} (une colonne « Phone » dans « Directory_People » attendue)`);
  const state = await page.run(setupSnap);
  if (!state || state.phone !== 'Phone') note('table', `${where} : le réglage ne prend pas la colonne créée (« ${state && state.phone} »)`);
}
