// Les sous-annuaires de l'annuaire sous Firefox (règle du 03/11 ; module Annuaire, demande du porteur du 25/11, scène 10 de la maquette), à la vraie souris et au vrai clavier,
// sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js, `?sub=1` : un sous-annuaire « Pôle Ressources » déjà là, un faux « Partager »). Suite de
// test/annuaire-firefox.mjs ; l'essai écrit dans le faux Grist : il passe avec les derniers. À mesurer : la liste des annuaires (le sous-annuaire sous son origine, « Nouveau
// sous-annuaire… ») ; la pastille et le cadenas de la barre, le pied qui dit la date de la copie, les gestes grisés (« Modifier », « À vérifier », le réglage) ; le menu du
// cadenas (actualiser, partager, supprimer : ce que chacun écrit, et le grisé d'un lecteur avec sa raison) ; la fenêtre « Nouveau sous-annuaire » (qui tient dans la page, le
// bouton grisé tant que tout n'est pas dit, un nom déjà pris, les valeurs une à une, l'unique ligne écrite, le « Partager » qui suit) ; la suppression ; et la lisibilité (4,5:1).
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';

const SUB_ROW = 3; // la ligne de « Pôle Ressources » dans `GFS_Directories` : `?sub=1` crée les deux annuaires, puis le sous-annuaire
const PROBES = { 'le titre': ['.an-sub h2', '.an-sub'], 'le nom de l\'origine': ['.an-sub-of', '.an-sub'], 'un libellé': ['.an-sub .an-set-label', '.an-sub'],
  'un mot': ['.an-sub-w', '.an-sub'], 'une valeur': ['.an-sub-val', '.an-sub-val'], 'le nombre': ['.an-sub-count', '.an-sub-row'], 'le verrou': ['.an-sub-lock', '.an-sub-lock'],
  'une aide': ['.an-sub .an-set-hint', '.an-sub'] };
const BAR_PROBES = { 'la pastille': ['.an-sub-tag', '.an-sub-tag'], 'le pied': ['.an-foot', '.mod'] };

// ---------- ce qui s'exécute dans la page ----------

function installLib() {
  window.__lib = {
    box: node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; },
    text: node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : ''),
  };
}

function barSnap() {
  const { box, text } = window.__lib;
  const tag = document.querySelector('.an-sub-tag');
  const lock = document.querySelector('[data-fk="sub"]');
  const check = document.querySelector('[data-fk="check"]');
  const head = document.querySelector('.an-top');
  return { name: text(document.querySelector('.an-name-t')), tag: tag ? { shown: !tag.hidden && getComputedStyle(tag).display !== 'none', text: text(tag), title: tag.title, box: box(tag) } : null,
    lock: lock ? { box: box(lock), label: lock.getAttribute('aria-label'), popup: lock.getAttribute('aria-haspopup') } : null,
    check: check ? { disabled: check.getAttribute('aria-disabled') === 'true', title: check.title } : null, foot: text(document.querySelector('.an-foot')),
    persons: document.querySelectorAll('.an-person').length, headSideways: head.scrollWidth - head.clientWidth, window: box(document.querySelector('.mod.an')),
    viewport: { width: innerWidth, height: innerHeight } };
}

function menuSnap() {
  const { box, text } = window.__lib;
  const menu = document.querySelector('.menu');
  if (!menu) return null;
  return { box: box(menu), viewport: { width: innerWidth, height: innerHeight }, items: [...menu.querySelectorAll('.menu-item')].map(item => ({ label: text(item.querySelector('.menu-label')),
    hint: text(item.querySelector('.menu-hint')), greyed: item.getAttribute('aria-disabled') === 'true', title: item.title, box: box(item) })), sideways: menu.scrollWidth - menu.clientWidth };
}

function newSnap() {
  const { box, text } = window.__lib;
  const win = document.querySelector('.mod.an-sub');
  if (!win) return null;
  const body = win.querySelector('.an-sub-body');
  const foot = win.querySelector('.mod-foot');
  const ok = win.querySelector('[data-fk="sub-ok"]');
  return { box: box(win), viewport: { width: innerWidth, height: innerHeight }, title: text(win.querySelector('h2')), of: text(win.querySelector('.an-sub-of')),
    name: win.querySelector('[data-fk="sub-name"]').value, key: text(win.querySelector('[data-fk="sub-key"]')), values: [...win.querySelectorAll('.an-sub-val')].map(text),
    count: text(win.querySelector('.an-sub-count')), ok: { disabled: ok.getAttribute('aria-disabled') === 'true', box: box(ok), text: text(ok) }, note: text(win.querySelector('.mod-note')),
    foot: box(foot), lock: text(win.querySelector('.an-sub-lock')), bodySideways: body.scrollWidth - body.clientWidth,
    bodyScrolls: body.scrollHeight - body.clientHeight, buttons: [...win.querySelectorAll('button')].map(button => ({ fk: button.dataset.fk || '', box: box(button) })),
    focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null };
}

function pickSnap() {
  const { box, text } = window.__lib;
  const scrims = [...document.querySelectorAll('.mod-scrim')];
  const scrim = scrims[scrims.length - 1];
  const modal = scrim && scrim.querySelector('.mod:not(.an)');
  if (!modal || !modal.querySelector('.wk-list')) return null;
  return { box: box(modal), viewport: { width: innerWidth, height: innerHeight }, title: text(modal.querySelector('h2')),
    rows: [...modal.querySelectorAll('.wk-item')].map(item => ({ label: text(item.querySelector('.wk-name')), hint: text(item.querySelector('.wk-reason')), box: box(item) })) };
}

const writes = () => window.__annuaireBatches().flat();
const notices = () => window.__annuaireNotices.slice();
const shared = () => window.__annuaireShared;

// ---------- les gestes ----------

const inside = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;
const centered = box => [box.left + box.width / 2, box.top + box.height / 2];

async function readable(page, note, probes, where) {
  for (const [what, value] of Object.entries(await page.run(contrasts, probes))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
}

async function reload(page, query, { width, mode }) {
  await page.goto(`${await page.run(() => `${location.origin}${location.pathname}`)}${query}`);
  await page.run(() => window.__ready);
  await page.view({ width, scale: 1, mode });
  await page.run(installLib);
}

async function openAnnuaire(page) {
  await page.run(() => { void window.__annuaire.open(); });
  await page.until(() => document.querySelector('.an-person') !== null);
}

// Ouvre la liste des annuaires et rend ses lignes ; null quand elle ne s'ouvre pas.
async function openSwitcher(page, click) {
  await click('[data-fk="switch"]');
  return page.until(pickSnap).catch(() => null);
}

// Clique la ligne de la liste ouverte dont le nom commence par `label` ; faux quand elle manque.
async function pickRow(page, label) {
  const snap = await page.until(pickSnap).catch(() => null);
  const row = snap && snap.rows.find(each => each.label.startsWith(label));
  if (!row) return false;
  await page.click(...centered(row.box));
  await delay(250);
  return true;
}

async function showSub(page, click, name) {
  const list = await openSwitcher(page, click);
  if (!list || !(await pickRow(page, name))) return false;
  await page.until(() => document.querySelector('.an-sub-tag') !== null && !document.querySelector('.an-sub-tag').hidden).catch(() => null);
  return true;
}

// ---------- la liste et la barre ----------

async function switcherProblems(page, t, note, click, where) {
  const list = await openSwitcher(page, click);
  if (!list) { note('sous-annuaires', `${where} : la liste des annuaires ne s'ouvre pas`); return; }
  const labels = list.rows.map(row => row.label);
  const wanted = [t('an.merge.title'), 'Annuaire principal', 'Pôle Ressources', 'Annuaire des directions', t('an.new'), t('an.sub.new')];
  if (labels.join('|') !== wanted.join('|')) note('sous-annuaires', `${where} : la liste dit « ${labels.join(' | ')} » (« ${wanted.join(' | ')} » attendus : le sous-annuaire sous son origine)`);
  const sub = list.rows.find(row => row.label === 'Pôle Ressources');
  if (sub && sub.hint !== t('an.sub.of', { name: 'Annuaire principal' })) note('sous-annuaires', `${where} : la ligne du sous-annuaire dit « ${sub.hint} » (« ${t('an.sub.of', { name: 'Annuaire principal' })} » attendu)`);
  const add = list.rows.find(row => row.label === t('an.sub.new'));
  if (add && add.hint !== t('an.sub.newHint')) note('sous-annuaires', `${where} : « ${t('an.sub.new')} » dit « ${add.hint} » (« ${t('an.sub.newHint')} » attendu)`);
  if (!inside(list.box, { left: 0, top: 0, right: list.viewport.width, bottom: list.viewport.height })) note('hors de la page', `${where} : la liste des annuaires sort de la page`);
  await page.press('Escape');
  await delay(150);
}

function barProblems(snap, t, note, where, { date }) {
  if (snap.name !== 'Pôle Ressources') note('sous-annuaires', `${where} : l'en-tête dit « ${snap.name} » (« Pôle Ressources » attendu)`);
  if (!snap.tag || !snap.tag.shown || snap.tag.text !== t('an.sub.tag')) note('sous-annuaires', `${where} : la pastille dit ${JSON.stringify(snap.tag && { shown: snap.tag.shown, text: snap.tag.text })} (« ${t('an.sub.tag')} » attendu)`);
  if (snap.tag && snap.tag.title !== t('an.sub.of', { name: 'Annuaire principal' })) note('sous-annuaires', `${where} : l'info-bulle de la pastille dit « ${snap.tag.title} »`);
  if (!snap.lock) note('sous-annuaires', `${where} : le cadenas manque dans la barre`);
  else if (snap.lock.label !== t('an.sub.menu') || snap.lock.popup !== 'menu' || snap.lock.box.width < 24 || snap.lock.box.height < 24) {
    note('sous-annuaires', `${where} : le cadenas dit ${JSON.stringify({ label: snap.lock.label, popup: snap.lock.popup, w: Math.round(snap.lock.box.width), h: Math.round(snap.lock.box.height) })}`);
  }
  if (!snap.foot.includes(t('an.sub.stamp', { date }))) note('sous-annuaires', `${where} : le pied dit « ${snap.foot} » (« ${t('an.sub.stamp', { date })} » attendu : la date de la copie)`);
  if (snap.persons !== 4) note('sous-annuaires', `${where} : ${snap.persons} personnes (4 attendues : celles du « Pôle Ressources »)`);
  if (snap.headSideways > 1) note('défile de côté', `${where} : la barre défile de côté (${snap.headSideways} px)`);
  if (snap.lock && !inside(snap.lock.box, snap.window)) note('hors de la page', `${where} : le cadenas sort de la fenêtre`);
}

// Les gestes que la copie ne fait pas : « À vérifier », « Modifier » et le réglage disent pourquoi.
async function greyedProblems(page, t, note, click, where) {
  const bar = await page.run(barSnap);
  if (!bar.check || !bar.check.disabled || bar.check.title !== t('an.check.sub')) note('sous-annuaires', `${where} : « À vérifier » devrait être grisée avec « ${t('an.check.sub')} » (${JSON.stringify(bar.check)})`);
  await click('[data-fk="check"]');
  await delay(150);
  let foot = (await page.run(barSnap)).foot;
  if (!foot.includes(t('an.check.sub'))) note('sous-annuaires', `${where} : le clic sur « À vérifier » dit « ${foot} »`);
  await click('[data-fk="configure"]');
  await delay(200);
  foot = (await page.run(barSnap)).foot;
  if (!foot.includes(t('an.sub.noConfig'))) note('sous-annuaires', `${where} : le réglage d'un sous-annuaire dit « ${foot} » (« ${t('an.sub.noConfig')} » attendu)`);
  if (await page.run(() => document.querySelector('.mod.an-set') !== null)) note('sous-annuaires', `${where} : le réglage s'ouvre sur une copie`);
  await click('[data-fk^="pe:"]');
  await delay(250);
  const edit = await page.run(() => { const button = document.querySelector('[data-act="edit"]'); return button ? { disabled: button.getAttribute('aria-disabled') === 'true', title: button.title } : null; });
  if (!edit || !edit.disabled) note('sous-annuaires', `${where} : « Modifier » devrait être grisé sur une copie (${JSON.stringify(edit)})`);
  if (edit) {
    await click('[data-act="edit"]');
    await delay(200);
    foot = (await page.run(barSnap)).foot;
    if (!foot.includes(t('an.sub.noEdit'))) note('sous-annuaires', `${where} : le clic sur « Modifier » dit « ${foot} » (« ${t('an.sub.noEdit')} » attendu)`);
    if (await page.run(() => document.querySelector('.mod.an-edit') !== null)) note('sous-annuaires', `${where} : « Modifier » s'ouvre sur une copie`);
  }
  if (await page.run(() => document.querySelector('.an-side-x') !== null)) await click('.an-side-x');
}

// ---------- le menu du cadenas ----------

async function openMenuOf(page, click) {
  await click('[data-fk="sub"]');
  return page.until(menuSnap).catch(() => null);
}

function menuShape(menu, t, note, where, { date, can }) {
  if (!menu) { note('sous-annuaires', `${where} : le menu du cadenas ne s'ouvre pas`); return false; }
  const wanted = [t('an.sub.refresh'), t('an.sub.share'), t('an.sub.remove')];
  if (menu.items.map(item => item.label).join('|') !== wanted.join('|')) note('sous-annuaires', `${where} : le menu dit « ${menu.items.map(item => item.label).join(' | ')} » (« ${wanted.join(' | ')} » attendus)`);
  const hints = [date ? t('an.sub.refreshHint', { date }) : t('an.sub.refreshNoDate'), t('an.sub.shareHint'), t('an.sub.removeHint')];
  menu.items.forEach((item, at) => {
    if (item.hint !== hints[at]) note('sous-annuaires', `${where} : « ${item.label} » dit « ${item.hint} » (« ${hints[at]} » attendu)`);
    const key = ['refresh', 'share', 'remove'][at];
    if (item.greyed === can[key]) note('sous-annuaires', `${where} : « ${item.label} » est ${item.greyed ? 'grisé' : 'actif'} (${can[key] ? 'actif' : 'grisé'} attendu)`);
    if (item.greyed && !item.title) note('sous-annuaires', `${where} : « ${item.label} » est grisé sans dire pourquoi`);
  });
  if (!inside(menu.box, { left: 0, top: 0, right: menu.viewport.width, bottom: menu.viewport.height })) note('hors de la page', `${where} : le menu sort de la page`);
  if (menu.sideways > 1) note('défile de côté', `${where} : le menu défile de côté (${menu.sideways} px)`);
  return true;
}

async function adminMenuProblems(page, t, note, click, { width, mode }, { date }) {
  const where = `le menu du cadenas (administrateur) à ${width} px`;
  const menu = await openMenuOf(page, click);
  if (!menuShape(menu, t, note, where, { date, can: { refresh: true, share: true, remove: true } })) return;
  await readable(page, note, { 'une ligne': ['.menu-item .menu-label', '.menu'], 'une aide': ['.menu-item .menu-hint', '.menu'] }, `le menu du cadenas (${mode})`);
  // « Partager… » : la fenêtre des partages de GFS pour la ligne du sous-annuaire, puis la liste se relit
  await page.click(...centered(menu.items[1].box));
  await delay(300);
  const file = await page.run(shared);
  if (!file || file.key !== `gfs-annuaires:${SUB_ROW}` || file.name !== 'Pôle Ressources') note('sous-annuaires', `${where} : « Partager… » demande ${JSON.stringify(file && { key: file.key, name: file.name })} (gfs-annuaires:${SUB_ROW}, Pôle Ressources)`);
  const foot = (await page.run(barSnap)).foot;
  if (!foot.includes('Pôle Ressources')) note('sous-annuaires', `${where} : le pied ne dit pas qui voit « Pôle Ressources » après « Partager… » (« ${foot} »)`);
  // « Actualiser » : une seule écriture, sur la ligne, qui ne touche que la définition, la copie et son moment
  const before = (await page.run(writes)).length;
  const again = await openMenuOf(page, click);
  if (!again) { note('sous-annuaires', `${where} : le menu ne se rouvre pas`); return; }
  await page.click(...centered(again.items[0].box));
  await delay(500);
  const done = (await page.run(writes)).slice(before);
  if (done.length !== 1 || done[0][0] !== 'UpdateRecord' || done[0][1] !== 'GFS_Directories' || done[0][2] !== SUB_ROW ||
    Object.keys(done[0][3]).sort().join(',') !== 'Config,Copy,Table') note('sous-annuaires', `${where} : « Actualiser » écrit ${JSON.stringify(done).slice(0, 200)} (une mise à jour de Config, Copy et Table de la ligne ${SUB_ROW})`);
  const snap = await page.run(barSnap);
  if (!snap.foot.includes(t('an.sub.refreshed', { n: 4 }))) note('sous-annuaires', `${where} : après « Actualiser », le pied dit « ${snap.foot} » (« ${t('an.sub.refreshed', { n: 4 })} » attendu)`);
  if (snap.persons !== 4) note('sous-annuaires', `${where} : ${snap.persons} personnes après « Actualiser » (4 attendues)`);
}

async function readerMenuProblems(page, t, note, click, { width }, { can, date }) {
  const where = `le menu du cadenas (${can.refresh ? 'écrivain' : 'lecteur'}) à ${width} px`;
  const menu = await openMenuOf(page, click);
  if (!menuShape(menu, t, note, where, { date, can })) return;
  const at = menu.items.findIndex(item => item.greyed);
  const writesBefore = (await page.run(writes)).length;
  await page.click(...centered(menu.items[at].box));
  await delay(250);
  const snap = await page.run(barSnap);
  const why = [t('an.sub.refreshWhy'), t('an.sub.shareWhy'), t('an.sub.removeWhy')][at];
  if (!snap.foot.includes(why)) note('sous-annuaires', `${where} : le clic sur « ${menu.items[at].label} » grisé dit « ${snap.foot} » (« ${why} » attendu)`);
  if ((await page.run(writes)).length !== writesBefore) note('sous-annuaires', `${where} : un geste grisé a écrit dans le document`);
  if (await page.run(shared)) note('sous-annuaires', `${where} : « Partager… » grisé a ouvert la fenêtre des partages`);
}

// ---------- la fenêtre « Nouveau sous-annuaire » ----------

function newShape(snap, t, note, where) {
  if (!snap) { note('sous-annuaires', `${where} : la fenêtre ne s'ouvre pas`); return false; }
  const page_ = { left: 0, top: 0, right: snap.viewport.width, bottom: snap.viewport.height };
  if (!inside(snap.box, page_)) note('hors de la page', `${where} : la fenêtre sort de la page (${Math.round(snap.box.left)}, ${Math.round(snap.box.top)}, ${Math.round(snap.box.right)}, ${Math.round(snap.box.bottom)})`);
  if (!inside(snap.foot, page_)) note('sous-annuaires', `${where} : le pied avec ses boutons sort de la page`);
  if (snap.title !== t('an.sub.title')) note('sous-annuaires', `${where} : le titre dit « ${snap.title} » (« ${t('an.sub.title')} » attendu)`);
  if (snap.of !== t('an.sub.sub', { name: 'Annuaire principal' })) note('sous-annuaires', `${where} : l'origine dit « ${snap.of} » (« ${t('an.sub.sub', { name: 'Annuaire principal' })} » attendu)`);
  if (snap.bodySideways > 1) note('défile de côté', `${where} : le corps défile de côté (${snap.bodySideways} px)`);
  for (const button of snap.buttons) if (!inside(button.box, page_)) note('hors de la page', `${where} : le bouton ${button.fk} sort de la page`);
  for (const fk of ['sub-ok', 'sub-cancel']) {
    const button = snap.buttons.find(each => each.fk === fk);
    if (!button || button.box.height < 24) note('sous-annuaires', `${where} : le bouton ${fk} manque ou mesure ${button ? Math.round(button.box.height) : 0} px`);
  }
  if (snap.focused !== 'sub-name') note('clavier', `${where} : le clavier est sur « ${snap.focused} », le nom l'attend`);
  if (!snap.lock.includes(t('an.sub.lock'))) note('sous-annuaires', `${where} : la fenêtre ne dit pas qui voit le sous-annuaire à la création`);
  return true;
}

async function typeName(page, click, text) {
  await click('[data-fk="sub-name"]'); // un clic sur un bouton a pris le clavier : on le rend au nom
  await page.press(...text.split(''));
  await delay(80);
}

// Les refus de la fenêtre : un nom pris, pas de critère, pas de valeur ; le bouton grisé dit « pourquoi » au clic.
async function refusalProblems(page, t, note, click, where) {
  let snap = await page.run(newSnap);
  if (!snap.ok.disabled) note('sous-annuaires', `${where} : « ${t('an.sub.create')} » devrait être grisé tant que rien n'est dit`);
  await click('[data-fk="sub-ok"]');
  snap = await page.run(newSnap);
  if (snap.note !== t('an.sub.errName')) note('sous-annuaires', `${where} : sans nom, le clic dit « ${snap.note} » (« ${t('an.sub.errName')} » attendu)`);
  await typeName(page, click, 'pôle ressources');
  await click('[data-fk="sub-ok"]');
  snap = await page.run(newSnap);
  if (snap.note !== t('an.sub.errTaken')) note('sous-annuaires', `${where} : un nom pris dit « ${snap.note} » (« ${t('an.sub.errTaken')} » attendu, sans tenir compte de la casse)`);
  await click('[data-fk="sub-name"]');
  for (let at = 0; at < 'pôle ressources'.length; at++) await page.press('Backspace');
  await typeName(page, click, 'Direction numérique');
  await click('[data-fk="sub-ok"]');
  snap = await page.run(newSnap);
  if (snap.note !== t('an.sub.errKey')) note('sous-annuaires', `${where} : sans critère, le clic dit « ${snap.note} » (« ${t('an.sub.errKey')} » attendu)`);
  await click('[data-fk="sub-add"]');
  snap = await page.run(newSnap);
  if (snap.note !== t('an.sub.errKey')) note('sous-annuaires', `${where} : « ${t('an.sub.addValue')} » sans critère dit « ${snap.note} » (« ${t('an.sub.errKey')} » attendu)`);
}

// Le critère et ses valeurs : la liste avec recherche, les nombres par valeur, la valeur qui se retire d'un clic.
async function criteriaProblems(page, t, note, click, where) {
  await click('[data-fk="sub-key"]');
  const keys = await page.until(pickSnap).catch(() => null);
  if (!keys) { note('sous-annuaires', `${where} : la liste des critères ne s'ouvre pas`); return false; }
  if (keys.title !== t('an.sub.keyTitle')) note('sous-annuaires', `${where} : la liste des critères s'appelle « ${keys.title} » (« ${t('an.sub.keyTitle')} » attendu)`);
  if (!keys.rows.some(row => row.label === 'Pôle') || !keys.rows.length) note('sous-annuaires', `${where} : « Pôle » manque aux critères (${keys.rows.map(row => row.label).join(' | ')})`);
  if (!(await pickRow(page, 'Pôle'))) return false;
  await click('[data-fk="sub-add"]');
  const values = await page.until(pickSnap).catch(() => null);
  const row = values && values.rows.find(each => each.label === 'Pôle Ressources');
  if (!row) { note('sous-annuaires', `${where} : « Pôle Ressources » manque aux valeurs (${values ? values.rows.map(each => each.label).join(' | ') : 'liste fermée'})`); return false; }
  if (row.hint !== t('an.sub.count', { n: 4 })) note('sous-annuaires', `${where} : « Pôle Ressources » dit « ${row.hint} » (« ${t('an.sub.count', { n: 4 })} » attendu)`);
  await page.click(...centered(row.box));
  await delay(250);
  let snap = await page.run(newSnap);
  if (snap.key !== 'Pôle' || snap.values.join('|') !== 'Pôle Ressources' || snap.count !== t('an.sub.count', { n: 4 })) {
    note('sous-annuaires', `${where} : le critère dit ${JSON.stringify({ key: snap.key, values: snap.values, count: snap.count })} (Pôle, Pôle Ressources, ${t('an.sub.count', { n: 4 })})`);
  }
  if (snap.ok.disabled) note('sous-annuaires', `${where} : « ${t('an.sub.create')} » reste grisé alors que tout est dit`);
  await click('[data-fk^="sub-v:"]');
  await delay(150);
  snap = await page.run(newSnap);
  if (snap.values.length || snap.count !== t('an.sub.count', { n: 0 }) || !snap.ok.disabled) note('sous-annuaires', `${where} : retirer la valeur laisse ${JSON.stringify({ values: snap.values, count: snap.count, disabled: snap.ok.disabled })}`);
  await click('[data-fk="sub-add"]');
  if (!(await pickRow(page, 'Pôle Ressources'))) return false;
  return true;
}

async function createProblems(page, t, note, click, { width, mode }) {
  const where = `« ${t('an.sub.new')} » à ${width} px`;
  if (!(await openSwitcher(page, click)) || !(await pickRow(page, t('an.sub.new')))) { note('sous-annuaires', `${where} : « ${t('an.sub.new')} » ne s'ouvre pas`); return; }
  const first = await page.until(newSnap).catch(() => null);
  if (!newShape(first, t, note, where)) return;
  await readable(page, note, PROBES, `la fenêtre « ${t('an.sub.title')} » (${mode})`);
  await refusalProblems(page, t, note, click, where);
  if (!(await criteriaProblems(page, t, note, click, where))) return;
  await readable(page, note, PROBES, `la fenêtre « ${t('an.sub.title')} », critère choisi (${mode})`);
  const before = (await page.run(writes)).length;
  await click('[data-fk="sub-ok"]');
  await delay(700);
  const made = (await page.run(writes)).slice(before);
  const add = made.filter(each => each[0] === 'AddRecord');
  if (made.length !== 1 || add.length !== 1 || add[0][1] !== 'GFS_Directories') note('sous-annuaires', `${where} : la création écrit ${JSON.stringify(made).slice(0, 200)} (un seul AddRecord dans GFS_Directories)`);
  else {
    const record = add[0][3];
    const keys = Object.keys(record).sort().join(',');
    if (keys !== 'Config,Copy,Name,Parent,Table') note('sous-annuaires', `${where} : la ligne écrite porte ${keys} (Config,Copy,Name,Parent,Table attendues)`);
    if (record.Name !== 'Direction numérique' || record.Parent !== '1' || record.Table !== 'Personnes') note('sous-annuaires', `${where} : la ligne dit ${JSON.stringify({ Nom: record.Nom, Parent: record.Parent, Table: record.Table })}`);
    const fiches = JSON.parse(record.Copy);
    if (fiches.people.length !== 4 || fiches.people.some(person => person.name === '')) note('sous-annuaires', `${where} : la copie garde ${fiches.people.length} personnes (4 attendues)`);
    const text = JSON.stringify(fiches);
    if (/Sacha|Masquee/.test(text)) note('sous-annuaires', `${where} : la copie garde une personne masquée ou une colonne qui n'est pas un champ`);
  }
  const file = await page.run(shared);
  if (!file || file.name !== 'Direction numérique') note('sous-annuaires', `${where} : la fenêtre « Partager » ne s'ouvre pas sur le nouveau sous-annuaire (${JSON.stringify(file && file.name)})`);
  const snap = await page.run(barSnap);
  if (snap.name !== 'Direction numérique' || !snap.tag || !snap.tag.shown) note('sous-annuaires', `${where} : le nouveau sous-annuaire n'est pas montré (${snap.name})`);
  const said = await page.run(notices);
  if (!said.some(text => text.includes(t('an.sub.created', { name: 'Direction numérique', n: 4 }).split(' : ')[0]))) note('sous-annuaires', `${where} : la création ne dit rien (${said.join(' | ')})`);
}

async function removeProblems(page, t, note, click, { width }) {
  const where = `« ${t('an.sub.remove')} » à ${width} px`;
  const before = (await page.run(writes)).length;
  const menu = await openMenuOf(page, click);
  if (!menu) { note('sous-annuaires', `${where} : le menu ne s'ouvre pas`); return; }
  await page.click(...centered(menu.items[2].box));
  await delay(600);
  const done = (await page.run(writes)).slice(before);
  const remove = done.filter(each => each[0] === 'RemoveRecord');
  if (remove.length !== 1 || remove[0][1] !== 'GFS_Directories' || done.some(each => !['RemoveRecord', 'BulkRemoveRecord'].includes(each[0]))) {
    note('sous-annuaires', `${where} : la suppression écrit ${JSON.stringify(done).slice(0, 200)} (la ligne du sous-annuaire seulement, avec ce qui en parlait)`);
  }
  const snap = await page.run(barSnap);
  if (snap.name !== 'Annuaire principal' || (snap.tag && snap.tag.shown)) note('sous-annuaires', `${where} : après la suppression, on voit « ${snap.name} » (« Annuaire principal » attendu, sans pastille)`);
  const list = await openSwitcher(page, click);
  if (list && list.rows.some(row => row.label === 'Direction numérique')) note('sous-annuaires', `${where} : le sous-annuaire supprimé reste dans la liste`);
  await page.press('Escape');
  await delay(150);
}

// ---------- l'entrée ----------

export async function subProblems(page, t, note, click, { width, mode, language }) {
  const view = { width, mode };
  const date = await page.run(locale => new Date('2026-11-20T09:30:00.000Z').toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }), language === 'en' ? 'en-GB' : 'fr-FR');
  // la personne qui administre
  await reload(page, `?lang=${language}&sub=1`, view);
  await openAnnuaire(page);
  await switcherProblems(page, t, note, click, `la liste des annuaires à ${width} px`);
  if (!(await showSub(page, click, 'Pôle Ressources'))) { note('sous-annuaires', `le sous-annuaire ne s'ouvre pas à ${width} px`); return; }
  const where = `le sous-annuaire à ${width} px`;
  barProblems(await page.run(barSnap), t, note, where, { date });
  await readable(page, note, BAR_PROBES, `la barre du sous-annuaire (${mode})`);
  await greyedProblems(page, t, note, click, where);
  await adminMenuProblems(page, t, note, click, view, { date });
  await createProblems(page, t, note, click, view);
  await removeProblems(page, t, note, click, view);
  // un écrivain : actualise, mais ne partage ni ne supprime
  await reload(page, `?lang=${language}&sub=1&admin=0&me=Ecrivain@exemple.fr`, view);
  await openAnnuaire(page);
  if (await showSub(page, click, 'Pôle Ressources')) await readerMenuProblems(page, t, note, click, view, { can: { refresh: true, share: false, remove: false }, date });
  else note('sous-annuaires', `le sous-annuaire ne s'ouvre pas pour un écrivain à ${width} px`);
  // un lecteur : ne fait rien d'écrit ; « Nouveau sous-annuaire » dit pourquoi
  await reload(page, `?lang=${language}&sub=1&admin=0`, view);
  await openAnnuaire(page);
  if (await showSub(page, click, 'Pôle Ressources')) await readerMenuProblems(page, t, note, click, view, { can: { refresh: false, share: false, remove: false }, date });
  else note('sous-annuaires', `le sous-annuaire ne s'ouvre pas pour un lecteur à ${width} px`);
  if (await page.run(() => document.querySelector('.menu') !== null)) await page.press('Escape');
  if ((await openSwitcher(page, click)) && (await pickRow(page, t('an.sub.new')))) {
    await delay(200);
    const said = await page.run(notices);
    if (!said.includes(t('an.sub.newWhy'))) note('sous-annuaires', `un lecteur qui demande « ${t('an.sub.new')} » entend « ${said.join(' | ')} » (« ${t('an.sub.newWhy')} » attendu)`);
    if (await page.run(() => document.querySelector('.mod.an-sub') !== null)) note('sous-annuaires', `la fenêtre « ${t('an.sub.title')} » s'ouvre pour qui n'administre pas`);
  } else note('sous-annuaires', `« ${t('an.sub.new')} » manque à la liste d'un lecteur : un geste grisé reste visible`);
}
