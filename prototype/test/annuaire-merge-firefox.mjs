// La vue fusionnée « Tous mes annuaires » sous Firefox (règle du 03/11 ; module Annuaire, demande du porteur du 25/11, scène 11 de la maquette), à la vraie souris et au vrai clavier,
// sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js, `?sub=1&home=merged` : les deux annuaires qui lisent la même table des personnes, plus le sous-annuaire
// « Pôle Ressources »). Suite de test/annuaire-sub-firefox.mjs ; la vue ne lit que : l'essai vérifie qu'aucun clic n'écrit. À mesurer : la fenêtre s'ouvre sur la vue réunie (nom, nombre
// d'annuaires, colonnes « Annuaire » et « Rattachement », une adresse = une fiche) ; ses gestes grisés disent pourquoi (réglage, contrôles, organigramme, « Modifier ») ; le panneau
// « Annuaires affichés » (une case par annuaire, le nombre de personnes, la mention « Sous-annuaire », qui reste dans la page à 700, 520 et 400 px ; décocher relit sur place ; le dernier
// annuaire coché ne se décoche pas ; « Un seul annuaire… » ouvre la liste) ; la liste des annuaires, qui propose « Tous mes annuaires » ; et la lisibilité (4,5:1).
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';

export const PANEL_PROBES = { 'le titre': ['.an-mp-h', '.menu-panel'], 'un annuaire': ['.an-mp .an-fv-t', '.menu-panel'], 'un nombre': ['.an-mp .an-fv-n', '.menu-panel'],
  'la phrase': ['.an-mp-note', '.menu-panel'], 'la mention': ['.an-mp-tag', '.menu-panel'], 'le retour': ['.an-mp-one .an-fv-t', '.menu-panel'] };

function installLib() {
  window.__lib = {
    box: node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; },
    text: node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : ''),
  };
}

function barSnap() {
  const { box, text } = window.__lib;
  const check = document.querySelector('[data-fk="check"]');
  const config = document.querySelector('[data-fk="configure"]');
  const org = document.querySelector('[data-fk="v:org"]');
  const head = document.querySelector('.an-top');
  const list = document.querySelector('.an-list');
  return { name: text(document.querySelector('.an-name-t')), popup: document.querySelector('.an-name').getAttribute('aria-haspopup'), foot: text(document.querySelector('.an-foot')),
    check: check ? { disabled: check.getAttribute('aria-disabled') === 'true', title: check.title } : null,
    config: config ? { disabled: config.getAttribute('aria-disabled') === 'true', title: config.title } : null,
    org: org ? { disabled: org.getAttribute('aria-disabled') === 'true', title: org.title } : null,
    sub: document.querySelector('[data-fk="sub"]') !== null, persons: document.querySelectorAll('.an-person').length,
    heads: [...document.querySelectorAll('.an-ch-t')].map(text), cells: [...document.querySelectorAll('.an-person:first-of-type .an-pe-col')].map(text),
    names: [...document.querySelectorAll('.an-pe-name')].map(text), headSideways: head.scrollWidth - head.clientWidth, listSideways: list.scrollWidth - list.clientWidth,
    window: box(document.querySelector('.mod.an')), viewport: { width: innerWidth, height: innerHeight } };
}

function panelSnap() {
  const { box, text } = window.__lib;
  const panel = document.querySelector('.an-mp');
  if (!panel) return null;
  const host = panel.closest('.menu-panel') || panel;
  return { box: box(host), viewport: { width: innerWidth, height: innerHeight }, title: text(panel.querySelector('.an-mp-h')), note: text(panel.querySelector('.an-mp-note')),
    rows: [...panel.querySelectorAll('[data-act="merge-pick"]')].map(row => ({ row: Number(row.dataset.row), label: text(row.querySelector('.an-fv-t')).replace(/Sous-annuaire|Sub-directory/, '').trim(),
      sub: row.querySelector('.an-mp-tag') !== null, count: text(row.querySelector('.an-fv-n')), checked: row.getAttribute('aria-checked') === 'true', box: box(row) })),
    one: (() => { const one = panel.querySelector('[data-act="merge-one"]'); return one ? { label: text(one), box: box(one) } : null; })(),
    focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null };
}

function pickSnap() {
  const { box, text } = window.__lib;
  const scrims = [...document.querySelectorAll('.mod-scrim')];
  const scrim = scrims[scrims.length - 1];
  const modal = scrim && scrim.querySelector('.mod:not(.an)');
  if (!modal || !modal.querySelector('.wk-list')) return null;
  return { rows: [...modal.querySelectorAll('.wk-item')].map(item => ({ label: text(item.querySelector('.wk-name')), hint: text(item.querySelector('.wk-reason')), box: box(item) })) };
}

const writes = () => window.__annuaireBatches().flat();
const inside = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;
const centered = box => [box.left + box.width / 2, box.top + box.height / 2];

async function reload(page, query, { width, mode }) {
  await page.goto(`${await page.run(() => `${location.origin}${location.pathname}`)}${query}`);
  await page.run(() => window.__ready);
  await page.view({ width, scale: 1, mode });
  await page.run(installLib);
}

// ---------- ce que la vue montre ----------

function barProblems(snap, t, note, where, annuaires) {
  const name = t('an.merge.name', { n: annuaires });
  if (snap.name !== name) note('fusion', `${where} : le nom dit « ${snap.name} » (« ${name} » attendu)`);
  if (snap.popup !== 'true') note('fusion', `${where} : le nom ouvre « ${snap.popup} » (un panneau attendu)`);
  if (snap.sub) note('fusion', `${where} : le cadenas d'un sous-annuaire se montre dans la vue réunie`);
  if (!snap.persons) note('fusion', `${where} : aucune personne dans la liste`);
  if (!snap.heads.includes(t('an.merge.origin')) || !snap.heads.includes(t('an.merge.path'))) note('fusion', `${where} : les colonnes disent « ${snap.heads.join(' | ')} » (« ${t('an.merge.origin')} » et « ${t('an.merge.path')} » attendues)`);
  if (!snap.cells.some(cell => cell.includes('Annuaire principal'))) note('fusion', `${where} : la première ligne ne dit pas son annuaire d'origine (« ${snap.cells.join(' | ')} »)`);
  if (!snap.foot.includes(t('an.merge.foot', { n: annuaires }))) note('fusion', `${where} : le pied dit « ${snap.foot} » (« ${t('an.merge.foot', { n: annuaires })} » attendu)`);
  if (!snap.check || !snap.check.disabled || snap.check.title !== t('an.check.merged')) note('fusion', `${where} : « À vérifier » dit « ${snap.check && snap.check.title} » (grisé, « ${t('an.check.merged')} » attendu)`);
  if (!snap.config || !snap.config.disabled || snap.config.title !== t('an.merge.noConfig')) note('fusion', `${where} : le réglage dit « ${snap.config && snap.config.title} » (grisé, « ${t('an.merge.noConfig')} » attendu)`);
  if (!snap.org || !snap.org.disabled || snap.org.title !== t('an.merge.noOrg')) note('fusion', `${where} : l'organigramme dit « ${snap.org && snap.org.title} » (grisé, « ${t('an.merge.noOrg')} » attendu)`);
  if (snap.headSideways > 1) note('défile de côté', `${where} : la barre défile de côté (${snap.headSideways} px)`);
  if (snap.listSideways > 1) note('défile de côté', `${where} : la liste défile de côté (${snap.listSideways} px)`);
}

async function greyedProblems(page, t, note, click, where) {
  const before = (await page.run(writes)).length;
  const cases = [['[data-fk="configure"]', 'an.merge.noConfig'], ['[data-fk="check"]', 'an.check.merged'], ['[data-fk="v:org"]', 'an.merge.noOrg']];
  for (const [selector, key] of cases) {
    await click(selector);
    await delay(120);
    const foot = (await page.run(barSnap)).foot;
    if (!foot.includes(t(key))) note('fusion', `${where} : le clic sur ${selector} dit « ${foot} » (« ${t(key)} » attendu)`);
    if (await page.run(() => document.querySelector('.mod.an-set, .mod.an-check') !== null)) { note('fusion', `${where} : le geste grisé ${selector} ouvre une fenêtre`); await page.press('Escape'); }
  }
  // la fiche d'une personne : « Modifier » dit où modifier, sans rien ouvrir
  await click('.an-person');
  await page.until(() => document.querySelector('[data-act="edit"]') !== null).catch(() => null);
  await click('[data-act="edit"]');
  await delay(150);
  const foot = (await page.run(barSnap)).foot;
  if (!foot.includes(t('an.merge.noEdit'))) note('fusion', `${where} : « Modifier » dit « ${foot} » (« ${t('an.merge.noEdit')} » attendu)`);
  if (await page.run(() => document.querySelector('.mod.an-edit') !== null)) { note('fusion', `${where} : « Modifier » ouvre la fenêtre dans la vue réunie`); await page.press('Escape'); }
  if ((await page.run(writes)).length !== before) note('fusion', `${where} : un geste grisé a écrit dans le document`);
}

// ---------- le panneau « Annuaires affichés » ----------

function panelShape(snap, t, note, where, { rows, joined }) {
  if (!snap) { note('fusion', `${where} : le panneau ne s'ouvre pas`); return false; }
  const page_ = { left: 0, top: 0, right: snap.viewport.width, bottom: snap.viewport.height };
  if (!inside(snap.box, page_)) note('hors de la page', `${where} : le panneau sort de la page (${Math.round(snap.box.left)}, ${Math.round(snap.box.top)}, ${Math.round(snap.box.right)}, ${Math.round(snap.box.bottom)})`);
  if (snap.title !== t('an.merge.shown')) note('fusion', `${where} : le titre dit « ${snap.title} » (« ${t('an.merge.shown')} » attendu)`);
  const labels = snap.rows.map(row => row.label).join('|');
  if (labels !== rows.map(row => row.label).join('|')) note('fusion', `${where} : les annuaires sont « ${labels} » (« ${rows.map(row => row.label).join('|')} » attendus)`);
  for (const wanted of rows) {
    const row = snap.rows.find(each => each.label === wanted.label);
    if (!row) continue;
    if (row.checked !== wanted.on) note('fusion', `${where} : « ${wanted.label} » est ${row.checked ? 'coché' : 'décoché'} (${wanted.on ? 'coché' : 'décoché'} attendu)`);
    if (row.sub !== Boolean(wanted.sub)) note('fusion', `${where} : « ${wanted.label} » ${row.sub ? 'porte' : 'ne porte pas'} la mention « Sous-annuaire »`);
    if (row.box.height < 26) note('fusion', `${where} : la ligne « ${wanted.label} » ne mesure que ${Math.round(row.box.height)} px`);
    if (!row.count) note('fusion', `${where} : « ${wanted.label} » ne dit pas combien de personnes`);
  }
  if (!snap.note.includes(t('an.merge.same'))) note('fusion', `${where} : la phrase dit « ${snap.note} » (« ${t('an.merge.same')} » attendu)`);
  if (joined !== undefined && joined > 0 && !snap.note.includes(t('an.merge.joined', { n: joined }))) note('fusion', `${where} : la phrase dit « ${snap.note} » (« ${t('an.merge.joined', { n: joined })} » attendu)`);
  if (!snap.one || snap.one.label !== t('an.merge.one')) note('fusion', `${where} : le retour dit « ${snap.one && snap.one.label} » (« ${t('an.merge.one')} » attendu)`);
  if (!snap.focused || !snap.focused.startsWith('mp')) note('clavier', `${where} : le clavier est sur « ${snap.focused} » (une case du panneau attendue)`);
  return true;
}

async function panelProblems(page, t, note, click, { width, mode }) {
  const where = `le panneau « ${t('an.merge.shown')} » à ${width} px`;
  await click('[data-fk="switch"]');
  const snap = await page.until(panelSnap).catch(() => null);
  const rows = [{ label: 'Annuaire principal', on: true }, { label: 'Pôle Ressources', on: true, sub: true }, { label: 'Annuaire des directions', on: true }];
  if (!panelShape(snap, t, note, where, { rows })) return;
  const counts = Object.fromEntries(snap.rows.map(row => [row.label, row.count]));
  const joined = Number((snap.note.match(/\d+/) || [0])[0]);
  if (!joined) note('fusion', `${where} : la phrase ne dit pas combien de fiches sont réunies (« ${snap.note} » : les annuaires lisent la même table)`);
  for (const [what, value] of Object.entries(await page.run(contrasts, PANEL_PROBES))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu, ${mode})`);
  // décocher « Annuaire des directions » : la vue se relit sur place, le panneau reste, rien ne s'écrit
  const before = (await page.run(writes)).length;
  const direction = snap.rows.find(row => row.label === 'Annuaire des directions');
  await page.click(...centered(direction.box));
  await delay(400);
  const next = await page.run(panelSnap);
  if (!next) { note('fusion', `${where} : le panneau se ferme quand on décoche un annuaire`); return; }
  if (next.rows.find(row => row.label === 'Annuaire des directions').checked) note('fusion', `${where} : « Annuaire des directions » reste coché`);
  if (next.rows.find(row => row.label === 'Annuaire des directions').count !== counts['Annuaire des directions']) note('fusion', `${where} : le nombre d'un annuaire décoché change (${counts['Annuaire des directions']} → ${next.rows.find(row => row.label === 'Annuaire des directions').count})`);
  const bar = await page.run(barSnap);
  if (bar.name !== t('an.merge.name', { n: 2 })) note('fusion', `${where} : après avoir décoché, le nom dit « ${bar.name} » (« ${t('an.merge.name', { n: 2 })} » attendu)`);
  if ((await page.run(writes)).length !== before) note('fusion', `${where} : cocher ou décocher écrit dans le document`);
  // le dernier coché ne se décoche pas
  for (const label of ['Pôle Ressources', 'Annuaire principal']) {
    const row = (await page.run(panelSnap)).rows.find(each => each.label === label);
    await page.click(...centered(row.box));
    await delay(300);
  }
  const last = await page.run(barSnap);
  const final = await page.run(panelSnap);
  if (!final || final.rows.filter(row => row.checked).length !== 1) note('fusion', `${where} : le dernier annuaire se décoche (${final ? final.rows.filter(row => row.checked).length : 0} coché)`);
  if (!last.foot.includes(t('an.merge.atLeast'))) note('fusion', `${where} : le dernier annuaire coché dit « ${last.foot} » (« ${t('an.merge.atLeast')} » attendu)`);
  // Échap ferme le panneau seul, la fenêtre reste
  await page.press('Escape');
  await delay(200);
  if (await page.run(() => document.querySelector('.an-mp') !== null)) note('clavier', `${where} : Échap ne ferme pas le panneau`);
  if (await page.run(() => document.querySelector('.mod.an') === null)) note('clavier', `${where} : Échap ferme toute la fenêtre au lieu du panneau`);
}

// « Un seul annuaire… » et la liste des annuaires, qui propose « Tous mes annuaires ».
async function oneProblems(page, t, note, click, where) {
  await click('[data-fk="switch"]');
  await page.until(panelSnap).catch(() => null);
  await click('[data-fk="mp-one"]');
  const list = await page.until(pickSnap).catch(() => null);
  if (!list) { note('fusion', `${where} : « ${t('an.merge.one')} » n'ouvre pas la liste des annuaires`); return; }
  if (list.rows[0].label !== t('an.merge.title')) note('fusion', `${where} : la liste commence par « ${list.rows[0].label} » (« ${t('an.merge.title')} » attendu)`);
  const row = list.rows.find(each => each.label === 'Annuaire principal');
  await page.click(...centered(row.box));
  await delay(400);
  const bar = await page.run(barSnap);
  if (bar.name !== 'Annuaire principal') note('fusion', `${where} : après « Un seul annuaire… », on voit « ${bar.name} » (« Annuaire principal » attendu)`);
  if (bar.config && bar.config.disabled) note('fusion', `${where} : le réglage reste grisé dans un seul annuaire`);
  // et on y revient par la liste
  await click('[data-fk="switch"]');
  const again = await page.until(pickSnap).catch(() => null);
  const merged = again && again.rows.find(each => each.label === t('an.merge.title'));
  if (!merged) { note('fusion', `${where} : « ${t('an.merge.title')} » manque à la liste d'un seul annuaire`); return; }
  await page.click(...centered(merged.box));
  await delay(400);
  const back = await page.run(barSnap);
  // la vue garde ce que la personne a coché (un seul annuaire, d'après le panneau plus haut)
  if (back.name !== t('an.merge.name', { n: 1 })) note('fusion', `${where} : le retour à la vue réunie dit « ${back.name} » (« ${t('an.merge.name', { n: 1 })} » attendu : elle garde les cases)`);
}

// ---------- l'entrée ----------

export async function mergeProblems(page, t, note, click, { width, mode, language }) {
  const view = { width, mode };
  await reload(page, `?lang=${language}&sub=1&home=merged`, view);
  await page.run(() => { void window.__annuaire.open(); });
  await page.until(() => document.querySelector('.an-person') !== null);
  const where = `la vue « ${t('an.merge.title')} » à ${width} px`;
  const writesBefore = (await page.run(writes)).length;
  barProblems(await page.run(barSnap), t, note, where, 3);
  await greyedProblems(page, t, note, click, where);
  if (await page.run(() => { const side = document.querySelector('.an-side'); return Boolean(side) && !side.hidden; })) await click('[data-act="side-close"]'); // la fiche se referme
  await panelProblems(page, t, note, click, view);
  await oneProblems(page, t, note, click, where);
  if ((await page.run(writes)).length !== writesBefore) note('fusion', `${where} : la vue a écrit dans le document (elle ne fait que lire)`);
}
