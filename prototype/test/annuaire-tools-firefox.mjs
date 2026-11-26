// « À vérifier », « Écrire au groupe », « Ma présence » et l'onglet « Options » de l'annuaire sous Firefox (règle du 03/11 ; module Annuaire, demande du porteur du 25/11), à la
// vraie souris et au vrai clavier, sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js, `?tools=1` : un doublon, une personne sans rattachement, un
// responsable qui n'existe pas, un départ dépassé, une personne masquée, cinquante agents aux adresses longues). Suite de test/annuaire-firefox.mjs ; l'essai écrit dans le faux
// Grist : il passe en dernier. À mesurer : la pastille de la barre (son nombre, sa taille, grisée pour qui n'administre pas) et « Écrire » ; la fenêtre « À vérifier » (les
// contrôles et leurs comptes, une ligne par point avec le bon geste, « Comparer » qui montre ce qui diffère, « Masquer » qui n'écrit qu'une case, Échap qui ne ferme que la
// fenêtre) ; « Écrire au groupe » (la jauge qui dit « trop long », les options grisées avec leur raison, les liens qui s'ouvrent l'un après l'autre, le CSV) ; l'onglet
// « Options » du réglage (ce qu'il écrit dans la définition de l'annuaire) ; « Ma présence » (la personne masquée grisée, l'interrupteur de la fiche, ce que voit un lecteur
// qui n'administre pas) ; et la lisibilité (4,5:1).
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';
import { clickOn } from './annuaire-table-firefox.mjs';

const PROBES = { 'le titre': ['.an-chk h2', '.an-chk'], 'une ligne': ['.an-chk-t b', '.an-chk-item'], 'une explication': ['.an-chk-t small', '.an-chk-item'],
  'un contrôle': ['.an-chk-k', '.an-chk'] };
const MAIL_PROBES = { 'le titre': ['.an-mail h2', '.an-mail'], 'la jauge': ['.an-mbar-t b', '.an-mail'], 'une option': ['.an-mopt-t b', '.an-mopt'], 'une aide': ['.an-mopt-t small', '.an-mopt'] };
const OPTION_PROBES = { 'un bloc': ['.an-ob-h b', '.an-ob'], 'une phrase': ['.an-ob-t small', '.an-ob'], 'une note': ['.an-ob-note', '.an-ob'] };
const PRESENCE_PROBES = { 'la ligne': ['.an-pres-t b', '.an-pres'], 'la phrase': ['.an-pres-t small', '.an-pres'], 'la pastille': ['.an-masked', '.an-person'] };
const DOC = { people: 63, addresses: 62, points: 5 }; // le document de `?tools=1` : les personnes, leurs adresses (une personne n'en a pas), les points à vérifier

// ---------- ce qui s'exécute dans la page ----------

// Deux petits outils que les mesures de la page partagent (`page.run` n'envoie que la fonction : elle ne voit rien du module).
function installLib() {
  window.__lib = {
    box: node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; },
    text: node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : ''),
  };
}

function barSnap() {
  const { box, text } = window.__lib;
  const grab = selector => {
    const node = document.querySelector(selector);
    if (!node) return null;
    const label = node.querySelector('.an-tb-t');
    return { box: box(node), label: node.getAttribute('aria-label'), disabled: node.getAttribute('aria-disabled') === 'true', text: text(label || node), title: node.title,
      labelShown: label ? getComputedStyle(label).display !== 'none' : false };
  };
  const head = document.querySelector('.an-top');
  const badge = document.querySelector('.an-chk-n');
  const crumb = document.querySelector('.an-crumb');
  return { check: grab('[data-fk="check"]'), mail: grab('[data-fk="mail"]'), badge: badge ? { text: text(badge), box: box(badge) } : null,
    headSideways: head ? head.scrollWidth - head.clientWidth : 0, window: box(document.querySelector('.mod.an')), crumbSideways: crumb ? crumb.scrollWidth - crumb.clientWidth : 0 };
}

function checkSnap() {
  const { box, text } = window.__lib;
  const win = document.querySelector('.mod.an-chk');
  if (!win) return null;
  const list = win.querySelector('.an-chk-list');
  const button = node => ({ act: node.dataset.act, text: text(node), disabled: node.getAttribute('aria-disabled') === 'true', expanded: node.getAttribute('aria-expanded'),
    title: node.title, box: box(node) });
  const compare = item => {
    const table = item.querySelector('.an-chk-cmp');
    if (!table) return null;
    return { box: box(table), head: [...table.querySelectorAll('thead th')].map(text), sideways: table.scrollWidth - table.clientWidth,
      rows: [...table.querySelectorAll('tbody tr')].map(row => ({ full: text(row.querySelector('th')), diff: row.classList.contains('is-diff'),
        pill: Boolean(row.querySelector('th .an-pill')), values: [...row.querySelectorAll('td')].map(text) })) };
  };
  return { box: box(win), viewport: { width: innerWidth, height: innerHeight }, title: text(win.querySelector('h2')), who: text(win.querySelector('.an-ed-who')),
    kinds: [...win.querySelectorAll('.an-chk-k')].map(kind => ({ id: kind.dataset.kind, label: text(kind.querySelector('.an-chk-kt')), count: text(kind.querySelector('.an-pill')),
      on: kind.getAttribute('aria-pressed') === 'true', box: box(kind) })),
    items: [...win.querySelectorAll('.an-chk-item')].map(item => ({ name: text(item.querySelector('.an-chk-t b')).split(' · ')[0], kind: text(item.querySelector('.an-chk-is')).replace(/^· /, ''),
      why: text(item.querySelector('.an-chk-t small')), box: box(item), buttons: [...item.querySelectorAll('.an-chk-acts .btn')].map(button), compare: compare(item) })),
    listBox: box(list), listSideways: list.scrollWidth - list.clientWidth, bodySideways: win.querySelector('.an-chk-body').scrollWidth - win.querySelector('.an-chk-body').clientWidth,
    none: text(win.querySelector('.an-chk-none')), note: text(win.querySelector('.mod-note')), focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null };
}

function mailSnap() {
  const { box, text } = window.__lib;
  const win = document.querySelector('.mod.an-mail');
  if (!win) return null;
  const bar = win.querySelector('.an-mbar-b');
  const barBox = box(bar);
  return { box: box(win), viewport: { width: innerWidth, height: innerHeight }, title: text(win.querySelector('h2')), count: text(win.querySelector('.an-mbar-t b')),
    limit: text(win.querySelector('.an-mbar-t span')), over: bar.dataset.over === 'true', barWidth: barBox.width, marker: box(bar.querySelector('u')).left - barBox.left,
    fill: box(bar.querySelector('i')).width, status: text(win.querySelector('.an-mbar-s')),
    options: [...win.querySelectorAll('.an-mopt')].map(option => ({ title: text(option.querySelector('.an-mopt-t b')), hint: text(option.querySelector('.an-mopt-t small')),
      off: option.classList.contains('is-off'), box: box(option),
      buttons: [...option.querySelectorAll('.an-mopt-b .btn')].map(button => ({ tag: button.tagName, text: text(button), href: button.getAttribute('href'),
        disabled: button.getAttribute('aria-disabled') === 'true', title: button.title, box: box(button), check: Boolean(button.querySelector('.ic')) })) })),
    sideways: win.querySelector('.an-mail-body').scrollWidth - win.querySelector('.an-mail-body').clientWidth, note: text(win.querySelector('.mod-note')) };
}

function optionsSnap() {
  const { box, text } = window.__lib;
  const win = document.querySelector('.mod.an-set');
  const panel = win ? win.querySelector('.an-obs') : null;
  if (!panel) return null;
  const switches = {};
  for (const sw of win.querySelectorAll('.an-ob .an-sw')) switches[sw.dataset.fk] = { on: sw.getAttribute('aria-checked') === 'true', disabled: sw.getAttribute('aria-disabled') === 'true',
    title: sw.title, box: box(sw) };
  const body = win.querySelector('.an-set-body');
  return { box: box(win), viewport: { width: innerWidth, height: innerHeight }, tabs: [...win.querySelectorAll('.an-tab')].map(text), tabsBox: box(win.querySelector('.an-tabs')),
    blocks: [...win.querySelectorAll('.an-ob')].map(block => text(block.querySelector('.an-ob-h b'))), switches,
    rows: [...win.querySelectorAll('.an-ob .an-ob-row')].map(row => ({ label: text(row.querySelector('.an-ob-t b')), hint: text(row.querySelector('.an-ob-t small')) })),
    column: text(win.querySelector('[data-fk="op:col"]')), leave: text(win.querySelector('[data-fk="op:leave"]')), per: text(win.querySelector('.an-ob-step b')),
    seg: [...win.querySelectorAll('.an-ob-seg-b')].map(button => ({ text: text(button), on: button.getAttribute('aria-pressed') === 'true' })), bodySideways: body.scrollWidth - body.clientWidth };
}

function peopleSnap() {
  const { box, text } = window.__lib;
  const rows = [...document.querySelectorAll('.an-person')];
  const side = document.querySelector('.an-side .an-fiche-card');
  const pres = side ? side.querySelector('.an-pres') : null;
  const sw = pres ? pres.querySelector('.an-sw') : null;
  const count = document.querySelector('.an-count');
  const pill = side ? side.querySelector('.an-fiche-id .an-masked') : null;
  return { names: rows.map(row => text(row.querySelector('.an-pe-name'))), masked: rows.filter(row => row.classList.contains('is-masked')).map(row => text(row.querySelector('.an-pe-name'))),
    maskedPill: rows.filter(row => row.querySelector('.an-masked')).map(row => text(row.querySelector('.an-masked'))), count: count ? text(count) : '',
    foot: text(document.querySelector('.an-foot')),
    fiche: side ? { name: text(side.querySelector('h3')), pill: pill ? text(pill) : '', box: box(side),
      presence: pres ? { on: sw.getAttribute('aria-checked') === 'true', disabled: sw.getAttribute('aria-disabled') === 'true', title: sw.title, hint: text(pres.querySelector('small')),
        label: text(pres.querySelector('b')), box: box(pres) } : null } : null };
}

// Un lien « mailto: » ou un fichier ne se suit pas : le clic arrive, la navigation ne part pas ; le lien et le fichier offerts sont gardés pour être relus.
function guardLinks() {
  window.__saved = null;
  window.__savedBlob = null;
  const create = URL.createObjectURL.bind(URL);
  URL.createObjectURL = blob => { window.__savedBlob = blob; return create(blob); };
  document.addEventListener('click', event => {
    const link = event.target.closest && event.target.closest('a[href^="mailto:"], a[download]');
    if (!link) return;
    window.__saved = { href: link.getAttribute('href'), download: link.getAttribute('download') };
    event.preventDefault();
  }, true);
}

// Le texte du fichier offert, BOM compris (`Blob.text()` le retire : on décode les octets en le gardant).
const savedText = async () => (window.__savedBlob ? new TextDecoder('utf-8', { ignoreBOM: true }).decode(await window.__savedBlob.arrayBuffer()) : null);
const writes = () => window.__annuaireBatches().flat();
const inside = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;

async function readable(page, note, probes, where) {
  for (const [what, value] of Object.entries(await page.run(contrasts, probes))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
}

function framed(snap, note, where, kind) {
  const { box: b, viewport } = snap;
  if (b.bottom > viewport.height + 1 || b.right > viewport.width + 1 || b.left < -1 || b.top < -1) note(kind, `${where} : la fenêtre sort de la page (${Math.round(b.left)}–${Math.round(b.right)} × ${Math.round(b.top)}–${Math.round(b.bottom)})`);
}

// Retape la recherche de la liste (vide : l'efface).
async function search(page, click, text) {
  await click('.an-search input');
  await page.chord('Control', 'a');
  if (text) await page.press(...text.split('')); else await page.press('Backspace');
  await delay(250);
}

// ---------- la barre ----------

async function barProblems(page, t, note, { width }) {
  const bar = await page.run(barSnap);
  if (!bar.check) { note('barre', 'la pastille « À vérifier » n\'est pas dans la barre'); return; }
  const tip = t('an.check.tip', { n: DOC.points });
  if (bar.check.disabled) note('barre', 'la pastille « À vérifier » est grisée pour un administrateur');
  if (!bar.badge || bar.badge.text !== String(DOC.points)) note('barre', `la pastille dit « ${bar.badge ? bar.badge.text : 'rien'} » (${DOC.points} attendu)`);
  if (bar.check.label !== tip) note('barre', `la pastille dit « ${bar.check.label} » (« ${tip} » attendu)`);
  if (bar.check.box.width < 26 || bar.check.box.height < 26) note('barre', `la pastille ne mesure que ${Math.round(bar.check.box.width)} × ${Math.round(bar.check.box.height)} px`);
  if (bar.badge && !inside(bar.badge.box, bar.window, 0)) note('barre', 'le nombre de la pastille sort de la fenêtre');
  if (bar.headSideways > 1) note('barre', `l'en-tête défile de côté à ${width} px (${bar.headSideways} px)`);
  if (!bar.mail) { note('barre', 'le bouton « Écrire » n\'est pas dans la barre de la liste'); return; }
  if (bar.mail.box.height < 24) note('barre', `« Écrire » ne mesure que ${Math.round(bar.mail.box.height)} px de haut`);
  if (bar.crumbSideways > 1) note('barre', `la barre de la liste défile de côté à ${width} px (${bar.crumbSideways} px)`);
  if (bar.mail.labelShown && bar.mail.text !== t('an.write')) note('barre', `« Écrire » dit « ${bar.mail.text} » (« ${t('an.write')} » attendu)`);
  if (!bar.mail.labelShown && bar.mail.box.width < 24) note('barre', `« Écrire » sans son mot ne mesure que ${Math.round(bar.mail.box.width)} px de large`);
  if (bar.mail.label !== t('an.mail.tip', { n: DOC.people })) note('barre', `« Écrire » dit « ${bar.mail.label} » (« ${t('an.mail.tip', { n: DOC.people })} » attendu)`);
}

// ---------- « À vérifier » ----------

const EXPECTED = [['Lea Garnier', 'an.check.is.dup', ['chk-compare', 'chk-open']], ['Julien Mercier', 'an.check.is.resp', ['chk-edit', 'chk-open']],
  ['Noé Petit', 'an.check.is.att', ['chk-edit', 'chk-open']], ['Rémi Colas', 'an.check.is.dep', ['chk-hide', 'chk-open']], ['Yanis Morel', 'an.check.is.mail', ['chk-edit', 'chk-open']]];

function listProblems(snap, t, note, where, { wide }) {
  if (snap.title !== t('an.check.title')) note('à vérifier', `${where} : le titre dit « ${snap.title} » (« ${t('an.check.title')} » attendu)`);
  if (snap.who !== 'Annuaire principal') note('à vérifier', `${where} : la fenêtre dit « ${snap.who} » (« Annuaire principal » attendu)`);
  framed(snap, note, where, 'à vérifier');
  if (snap.listSideways > 1 || snap.bodySideways > 1) note('à vérifier', `${where} : la fenêtre défile de côté (${snap.listSideways} / ${snap.bodySideways} px)`);
  const counts = snap.kinds.map(kind => `${kind.id}=${kind.count}`).join(' ');
  if (counts !== 'all=5 dup=1 mail=1 att=1 resp=1 dep=1') note('à vérifier', `${where} : les contrôles comptent « ${counts} » (« all=5 dup=1 mail=1 att=1 resp=1 dep=1 » attendu)`);
  if (!snap.kinds[0] || !snap.kinds[0].on) note('à vérifier', `${where} : « ${t('an.check.all')} » n'est pas choisi à l'ouverture`);
  for (const kind of snap.kinds) if (kind.box.height < 24) note('à vérifier', `${where} : le contrôle « ${kind.label} » ne mesure que ${Math.round(kind.box.height)} px de haut`);
  const names = snap.items.map(item => item.name).sort().join('|');
  const wanted = EXPECTED.map(([name]) => name).sort().join('|');
  if (names !== wanted) note('à vérifier', `${where} : les points sont « ${names} » (« ${wanted} » attendus)`);
  for (const [name, key, acts] of EXPECTED) {
    const item = snap.items.find(each => each.name === name);
    if (!item) continue;
    if (item.kind !== t(key)) note('à vérifier', `${where} : « ${name} » est « ${item.kind} » (« ${t(key)} » attendu)`);
    if (item.buttons.map(button => button.act).join('|') !== acts.join('|')) note('à vérifier', `${where} : « ${name} » propose « ${item.buttons.map(button => button.act).join(', ')} » (« ${acts.join(', ')} » attendus)`);
    if (!item.why) note('à vérifier', `${where} : « ${name} » ne dit pas pourquoi`);
    for (const button of item.buttons) {
      if (button.box.height < 24) note('à vérifier', `${where} : le bouton « ${button.text} » de « ${name} » ne mesure que ${Math.round(button.box.height)} px de haut`);
      if (button.box.right > snap.listBox.right + 1) note('à vérifier', `${where} : le bouton « ${button.text} » de « ${name} » sort de la liste`);
    }
  }
  if (!wide && snap.kinds.some(kind => kind.box.top > snap.kinds[0].box.bottom + 2)) note('à vérifier', `${where} : les contrôles passent sur plusieurs lignes (une rangée qui défile attendue)`);
  const first = snap.items.find(item => item.name === 'Lea Garnier');
  if (first && !first.why.includes('Léa Garnier')) note('à vérifier', `${where} : le doublon ne nomme pas l'autre fiche (« ${first.why} »)`);
}

async function compareProblems(t, note, click, snapNow, where) {
  await click('[data-fk^="chk-compare:"]');
  await delay(150);
  const snap = await snapNow();
  const open = snap.items.find(item => item.name === 'Lea Garnier');
  if (!open || !open.compare) { note('à vérifier', `${where} : « Comparer » n'ouvre pas le tableau`); return; }
  if (open.buttons[0].text !== t('an.check.compareClose') || open.buttons[0].expanded !== 'true') note('à vérifier', `${where} : « Comparer » ne devient pas « ${t('an.check.compareClose')} » (« ${open.buttons[0].text} », ${open.buttons[0].expanded})`);
  if (open.compare.head.length !== 3) note('à vérifier', `${where} : le tableau a ${open.compare.head.length} colonnes (3 attendues : le libellé et deux fiches)`);
  const diff = t('an.check.diff');
  const rows = Object.fromEntries(open.compare.rows.map(row => [row.full.endsWith(diff) ? row.full.slice(0, -diff.length).trim() : row.full, row]));
  for (const label of [t('an.col.name'), t('an.mail')]) {
    const row = rows[label];
    if (!row || !row.diff || !row.pill) note('à vérifier', `${where} : la ligne « ${label} » ne dit pas qu'elle diffère (${JSON.stringify(row)})`);
  }
  const post = rows[t('an.fiche.post')];
  if (!post || post.diff) note('à vérifier', `${where} : la ligne « ${t('an.fiche.post')} » est identique et doit rester calme (${JSON.stringify(post)})`);
  if (open.compare.sideways > 1) note('à vérifier', `${where} : le tableau défile de côté (${open.compare.sideways} px)`);
  if (open.compare.box.right > snap.listBox.right + 1) note('à vérifier', `${where} : le tableau sort de la liste`);
  await click('[data-fk^="chk-compare:"]');
  await delay(120);
  if ((await snapNow()).items.some(item => item.compare)) note('à vérifier', `${where} : « ${t('an.check.compareClose')} » ne ferme pas le tableau`);
}

async function filterKindProblems(page, t, note, click, snapNow, where) {
  await click('[data-fk="ck:dep"]');
  await delay(120);
  let snap = await snapNow();
  if (snap.items.length !== 1 || snap.items[0].name !== 'Rémi Colas') note('à vérifier', `${where} : « ${t('an.check.kind.dep')} » ne garde pas seulement Rémi Colas (${snap.items.map(item => item.name).join(', ')})`);
  if (!snap.kinds.find(kind => kind.id === 'dep').on) note('à vérifier', `${where} : le contrôle choisi n'est pas marqué`);
  await page.press('ArrowUp');
  await delay(80);
  snap = await snapNow();
  if (snap.focused !== 'ck:resp') note('à vérifier', `${where} : ↑ ne va pas au contrôle d'avant (« ${snap.focused} »)`);
  await click('[data-fk="ck:all"]');
}

async function gestureProblems(page, t, note, click, snapNow, where) {
  await click('[data-fk^="chk-edit:resp"]');
  await delay(300);
  const edit = await page.run(() => ({ edit: document.querySelector('.mod.an-edit') !== null, who: (document.querySelector('.mod.an-edit .an-ed-who') || {}).textContent }));
  if (!edit.edit || edit.who !== 'Julien Mercier') note('à vérifier', `${where} : « ${t('an.check.edit')} » n'ouvre pas la fenêtre « Modifier » de Julien Mercier (${JSON.stringify(edit)})`);
  await click('[data-fk="ed-cancel"]');
  await delay(250);
  if (!(await snapNow())) note('à vérifier', `${where} : annuler « Modifier » ferme aussi « À vérifier »`);
  await click('[data-fk^="chk-open:att"]');
  await delay(300);
  const opened = await page.run(() => ({ check: document.querySelector('.mod.an-chk') !== null, fiche: (document.querySelector('.an-side .an-fiche-card h3') || {}).textContent,
    annuaire: document.querySelector('.mod.an') !== null }));
  if (opened.check || opened.fiche !== 'Noé Petit' || !opened.annuaire) note('à vérifier', `${where} : « ${t('an.check.open')} » n'ouvre pas la fiche de Noé Petit dans l'annuaire (${JSON.stringify(opened)})`);
}

async function escapeProblems(page, note, click, where) {
  await click('[data-fk="check"]');
  await delay(250);
  await page.press('Escape');
  await delay(250);
  const left = await page.run(() => ({ check: document.querySelector('.mod.an-chk') !== null, annuaire: document.querySelector('.mod.an') !== null }));
  if (left.check) note('à vérifier', `${where} : Échap ne ferme pas « À vérifier »`);
  if (!left.annuaire) note('à vérifier', `${where} : Échap ferme l'annuaire avec « À vérifier »`);
}

async function hideProblems(page, t, note, click, snapNow, where) {
  const before = (await page.run(writes)).length;
  await click('[data-fk="ck:dep"]');
  await click('[data-fk^="chk-hide:"]');
  await delay(500);
  const done = (await page.run(writes)).slice(before);
  const action = done.find(each => each[0] === 'UpdateRecord' && each[1] === 'Personnes');
  if (!action || action[2] !== 12 || JSON.stringify(action[3]) !== '{"Masquee":true}') note('à vérifier', `${where} : « Masquer » écrit ${JSON.stringify(action)} (UpdateRecord Personnes 12 {Masquee: true} attendu)`);
  if (done.filter(each => each[0] === 'UpdateRecord').length !== 1) note('à vérifier', `${where} : « Masquer » écrit plus d'une action (${JSON.stringify(done)})`);
  const snap = await snapNow();
  const all = snap && snap.kinds.find(kind => kind.id === 'all');
  if (!all || all.count !== String(DOC.points - 1)) note('à vérifier', `${where} : le point n'a pas disparu du compte (${all && all.count}, ${DOC.points - 1} attendu)`);
  if (snap && snap.kinds.some(kind => kind.id === 'dep' && kind.count !== '0')) note('à vérifier', `${where} : « ${t('an.check.kind.dep')} » compte encore un point`);
  await click('[data-fk="ck:all"]');
}

async function checkProblems(page, t, note, click, { width, mode }) {
  const snapNow = () => page.run(checkSnap);
  const where = `« À vérifier » à ${width} px`;
  await click('[data-fk="check"]');
  await delay(300);
  const start = await snapNow();
  if (!start) { note('à vérifier', 'la pastille n\'ouvre pas la fenêtre'); return; }
  listProblems(start, t, note, where, { wide: width >= 600 });
  if (start.note !== t('an.check.foot', { n: DOC.points })) note('à vérifier', `${where} : le pied dit « ${start.note} » (« ${t('an.check.foot', { n: DOC.points })} » attendu)`);
  await readable(page, note, PROBES, `« À vérifier » (${mode})`);
  await compareProblems(t, note, click, snapNow, where);
  await filterKindProblems(page, t, note, click, snapNow, where);
  await gestureProblems(page, t, note, click, snapNow, where);
  await escapeProblems(page, note, click, where);
  await click('[data-fk="check"]');
  await delay(250);
  await hideProblems(page, t, note, click, snapNow, where);
  await click('[data-fk="chk-close"]');
  await delay(200);
}

// ---------- « Écrire au groupe » ----------

function mailProblems(snap, t, note, where, { people, addresses, over }) {
  if (snap.title !== t('an.mail.title', { n: people })) note('écrire', `${where} : le titre dit « ${snap.title} » (« ${t('an.mail.title', { n: people })} » attendu)`);
  framed(snap, note, where, 'écrire');
  if (snap.sideways > 1) note('écrire', `${where} : la fenêtre défile de côté (${snap.sideways} px)`);
  if (!snap.count.startsWith(`${addresses} `)) note('écrire', `${where} : la jauge dit « ${snap.count} » (${addresses} adresses attendues)`);
  if (!/1.?800/.test(snap.limit)) note('écrire', `${where} : la limite dit « ${snap.limit} » (1 800 attendu)`);
  if (snap.over !== over) note('écrire', `${where} : la jauge ${snap.over ? 'est rouge' : 'est calme'} (${over ? 'rouge' : 'calme'} attendu)`);
  if (over && (snap.marker >= snap.barWidth - 2 || snap.marker < snap.barWidth * 0.3)) note('écrire', `${where} : le repère de la limite est à ${Math.round(snap.marker)} px d'une barre de ${Math.round(snap.barWidth)} px`);
  if (snap.status !== t(over ? 'an.mail.over' : 'an.mail.fits')) note('écrire', `${where} : la jauge dit « ${snap.status} » (« ${t(over ? 'an.mail.over' : 'an.mail.fits')} » attendu)`);
  if (snap.options.length !== 4) note('écrire', `${where} : ${snap.options.length} options (4 attendues : copier, des messages, un seul, exporter)`);
  for (const option of snap.options) {
    if (!option.hint) note('écrire', `${where} : l'option « ${option.title} » n'a pas d'aide`);
    if (option.box.right > snap.box.right + 1) note('écrire', `${where} : l'option « ${option.title} » sort de la fenêtre`);
    for (const button of option.buttons) if (button.box.height < 24) note('écrire', `${where} : le bouton « ${button.text} » ne mesure que ${Math.round(button.box.height)} px de haut`);
  }
}

async function mailBatchProblems(page, t, note, click, where) {
  const snap = await page.run(mailSnap);
  const [copy, batches, single] = snap.options;
  if (!copy || copy.buttons[0].disabled || copy.title !== t('an.mail.copy', { n: DOC.addresses })) note('écrire', `${where} : copier les ${DOC.addresses} adresses n'est pas offert (« ${copy && copy.title} »)`);
  if (batches.off || batches.title !== t('an.mail.batches', { n: 2, per: 40 })) note('écrire', `${where} : « ${batches.title} » est grisée ou mal dite (« ${t('an.mail.batches', { n: 2, per: 40 })} » attendu)`);
  const [one, two] = batches.buttons;
  if (!one || one.tag !== 'A' || !/^mailto:\?bcc=/.test(one.href || '')) note('écrire', `${where} : « ${one && one.text} » n'est pas un lien « mailto: » en Cci (${one && one.href})`);
  if (!two || !two.disabled || two.title !== t('an.mail.batchFirst', { k: 1 })) note('écrire', `${where} : « ${two && two.text} » devrait être grisé avec « ${t('an.mail.batchFirst', { k: 1 })} » (${two && two.title})`);
  if (!single.off || !single.buttons[0].disabled || single.buttons[0].tag === 'A') note('écrire', `${where} : « ${single.title} » devrait être grisé et sans lien`);
  if (single.hint !== t('an.mail.singleNo', { n: DOC.addresses })) note('écrire', `${where} : « ${single.title} » dit « ${single.hint} » (« ${t('an.mail.singleNo', { n: DOC.addresses })} » attendu)`);
  if (one && one.href && one.href.length > 1800) note('écrire', `${where} : le premier lien fait ${one.href.length} caractères (la limite est 1 800)`);
  await click('[data-fk="mail-b:0"]');
  await delay(300);
  const after = await page.run(mailSnap);
  const saved = await page.run(() => window.__saved);
  if (!saved || !/^mailto:/.test(saved.href)) note('écrire', `${where} : le clic sur « 1 sur 2 » n'a pas suivi un lien « mailto: » (${JSON.stringify(saved)})`);
  const next = after.options[1].buttons[1];
  if (!next || next.disabled || next.tag !== 'A') note('écrire', `${where} : « 2 sur 2 » ne se dégrise pas après le premier message (${next && next.tag}, ${next && next.disabled})`);
  if (!after.options[1].buttons[0].check) note('écrire', `${where} : « 1 sur 2 » ne dit pas qu'il est ouvert (une coche attendue)`);
  const first = (saved && saved.href ? saved.href : '').slice('mailto:?bcc='.length).split(',').length;
  if (first > 40) note('écrire', `${where} : le premier message a ${first} adresses (40 au plus)`);
}

async function copyAndExportProblems(page, t, note, click, where) {
  await clickOn(page, note, '[data-fk="mail-copy"]'); // la fenêtre défile : un bouton plus bas que 400 px est d'abord amené sous la souris
  await delay(400);
  const copied = await page.run(mailSnap);
  if (![t('an.mail.copied', { n: DOC.addresses }), t('an.copyFailed')].includes(copied.note)) note('écrire', `${where} : « Copier » dit « ${copied.note} » (« ${t('an.mail.copied', { n: DOC.addresses })} » attendu)`);
  await clickOn(page, note, '[data-fk="mail-export"]');
  await delay(400);
  const exported = await page.run(mailSnap);
  const saved = await page.run(() => window.__saved);
  const csv = await page.run(savedText);
  if (!saved || !/^annuaire-principal-\d{4}-\d{2}-\d{2}\.csv$/.test(saved.download || '')) note('écrire', `${where} : le fichier s'appelle « ${saved && saved.download} » (annuaire-principal-AAAA-MM-JJ.csv attendu)`);
  const rows = (csv || '').split('\r\n').filter(Boolean);
  if (!csv || !csv.startsWith('﻿')) note('écrire', `${where} : le CSV n'a pas de BOM (le tableur français ouvrirait mal les accents)`);
  if (rows.length !== DOC.people + 1) note('écrire', `${where} : le CSV a ${rows.length} lignes (${DOC.people + 1} attendues : l'en-tête et ${DOC.people} personnes)`);
  if (!(rows[0] || '').startsWith(`﻿${t('an.col.name')};${t('an.mail')}`)) note('écrire', `${where} : l'en-tête du CSV est « ${rows[0]} »`);
  if (!exported.note.includes('annuaire-principal-')) note('écrire', `${where} : le pied ne dit pas le nom du fichier (« ${exported.note} »)`);
}

async function mailWindowProblems(page, t, note, click, { width, mode }) {
  const where = `« Écrire au groupe » à ${width} px`;
  await page.run(guardLinks);
  await click('[data-fk="mail"]');
  await delay(300);
  const start = await page.run(mailSnap);
  if (!start) { note('écrire', 'le bouton « Écrire » n\'ouvre pas la fenêtre'); return; }
  mailProblems(start, t, note, where, { people: DOC.people, addresses: DOC.addresses, over: true });
  await readable(page, note, MAIL_PROBES, `« Écrire au groupe » (${mode})`);
  await mailBatchProblems(page, t, note, click, where);
  await copyAndExportProblems(page, t, note, click, where);
  await page.press('Escape');
  await delay(250);
  const left = await page.run(() => ({ mail: document.querySelector('.mod.an-mail') !== null, annuaire: document.querySelector('.mod.an') !== null }));
  if (left.mail) note('écrire', `${where} : Échap ne ferme pas la fenêtre`);
  if (!left.annuaire) note('écrire', `${where} : Échap ferme l'annuaire avec la fenêtre`);
}

async function shortListProblems(page, t, note, click, { width }) {
  const where = `« Écrire au groupe » sur une personne, à ${width} px`;
  await search(page, click, 'camille durand');
  await click('[data-fk="mail"]');
  await delay(300);
  const snap = await page.run(mailSnap);
  if (!snap) { note('écrire', `${where} : la fenêtre ne s'ouvre pas`); return; }
  mailProblems(snap, t, note, where, { people: 1, addresses: 1, over: false });
  const [copy, batches, single] = snap.options;
  if (!batches.off || !batches.buttons.every(button => button.disabled) || batches.hint !== t('an.mail.batchesFit')) note('écrire', `${where} : les messages en série devraient être grisés (« ${t('an.mail.batchesFit')} »), ils disent « ${batches.hint} »`);
  if (single.off || single.buttons[0].tag !== 'A' || single.buttons[0].href !== 'mailto:?bcc=camille.durand@exemple.fr') note('écrire', `${where} : « ${single.title} » devrait être un lien vers Camille Durand (${single.buttons[0].href})`);
  if (copy.title !== t('an.mail.copy', { n: 1 })) note('écrire', `${where} : « ${copy.title} » (« ${t('an.mail.copy', { n: 1 })} » attendu)`);
  await click('[data-fk="mail-close"]');
  await delay(200);
}

async function noAddressProblems(page, t, note, click, { width }) {
  const where = `« Écrire » sans adresse, à ${width} px`;
  await search(page, click, 'yanis morel');
  const bar = await page.run(barSnap);
  if (!bar.mail || !bar.mail.disabled || bar.mail.label !== t('an.mail.noAddress')) note('écrire', `${where} : le bouton devrait être grisé avec « ${t('an.mail.noAddress')} » (${JSON.stringify(bar.mail && { disabled: bar.mail.disabled, label: bar.mail.label })})`);
  await click('[data-fk="mail"]');
  await delay(200);
  const foot = await page.run(peopleSnap);
  if (foot.foot !== t('an.mail.noAddress')) note('écrire', `${where} : le clic ne dit pas pourquoi dans le pied (« ${foot.foot} »)`);
  if (await page.run(() => document.querySelector('.mod.an-mail') !== null)) note('écrire', `${where} : une fenêtre s'ouvre sans adresse`);
  await search(page, click, '');
}

// ---------- « Ma présence » ----------

async function presenceWriteProblems(page, t, note, click, where) {
  const before = (await page.run(writes)).length;
  await click('[data-fk="presence"]');
  await delay(500);
  const done = (await page.run(writes)).slice(before).filter(each => each[0] === 'UpdateRecord');
  if (done.length !== 1 || done[0][1] !== 'Personnes' || done[0][2] !== 13 || JSON.stringify(done[0][3]) !== '{"Masquee":false}') note('présence', `${where} : l'interrupteur écrit ${JSON.stringify(done)} (UpdateRecord Personnes 13 {Masquee: false} attendu)`);
  let snap = await page.run(peopleSnap);
  if (snap.masked.length || !snap.fiche || !snap.fiche.presence || snap.fiche.presence.on !== true || snap.fiche.pill) note('présence', `${where} : la fiche ne redevient pas visible (${JSON.stringify({ masked: snap.masked, presence: snap.fiche && snap.fiche.presence && snap.fiche.presence.on, pill: snap.fiche && snap.fiche.pill })})`);
  if (snap.foot !== t('an.pres.shown', { name: 'Sacha Bernard' })) note('présence', `${where} : le pied dit « ${snap.foot} » (« ${t('an.pres.shown', { name: 'Sacha Bernard' })} » attendu)`);
  await click('[data-fk="presence"]');
  await delay(500);
  snap = await page.run(peopleSnap);
  if (snap.foot !== t('an.pres.hidden', { name: 'Sacha Bernard' }) || !snap.masked.length) note('présence', `${where} : masquer de nouveau ne se voit pas (« ${snap.foot} », ${snap.masked.length} grisée)`);
  await page.run(() => { window.__annuaireRefuse = 'Blocked by row update access rules'; });
  await click('[data-fk="presence"]');
  await delay(400);
  snap = await page.run(peopleSnap);
  if (!snap.foot.includes('Blocked by row update access rules')) note('présence', `${where} : un refus de Grist n'est pas dit tel quel (« ${snap.foot} »)`);
  await page.run(() => { window.__annuaireRefuse = null; });
}

// Ferme la fiche ouverte, s'il y en a une (étroite, elle couvre la liste : un clic sur une ligne tomberait dessus).
async function closeFiche(page, click) {
  if (await page.run(() => document.querySelector('.an-side-x') !== null)) await click('.an-side-x');
  await delay(150);
}

async function presenceAdminProblems(page, t, note, click, { width, mode }) {
  const where = `« Ma présence » (administrateur) à ${width} px`;
  await closeFiche(page, click);
  await search(page, click, 'sacha');
  let snap = await page.run(peopleSnap);
  if (snap.names.join('|') !== 'Sacha Bernard' || snap.masked.join('|') !== 'Sacha Bernard') note('présence', `${where} : la personne masquée n'est pas listée grisée (${snap.names.join(', ')} / grisées : ${snap.masked.join(', ')})`);
  if (snap.maskedPill.join('|') !== t('an.pres.masked')) note('présence', `${where} : la pastille dit « ${snap.maskedPill.join(', ')} » (« ${t('an.pres.masked')} » attendu)`);
  await click('[data-fk^="pe:"]');
  await delay(250);
  snap = await page.run(peopleSnap);
  const pres = snap.fiche && snap.fiche.presence;
  if (!pres) { note('présence', `${where} : la fiche n'a pas la ligne « ${t('an.pres.label')} »`); return; }
  if (pres.on || pres.disabled || pres.label !== t('an.pres.label') || pres.hint !== t('an.pres.off')) note('présence', `${where} : la ligne dit ${JSON.stringify({ ...pres, box: undefined })} (case décochée, active, « ${t('an.pres.off')} » attendus)`);
  if (snap.fiche.pill !== t('an.pres.masked')) note('présence', `${where} : la fiche ne dit pas « ${t('an.pres.masked')} » (« ${snap.fiche.pill} »)`);
  if (pres.box.right > snap.fiche.box.right + 1) note('présence', `${where} : la ligne sort de la fiche`);
  await readable(page, note, PRESENCE_PROBES, `« Ma présence » (${mode})`);
  await presenceWriteProblems(page, t, note, click, where);
  await search(page, click, '');
}

async function readerProblems(page, t, note, click, { width }, { me }) {
  const where = `« Ma présence » (${me ? 'la personne masquée' : 'un lecteur'}) à ${width} px`;
  await page.run(() => { void window.__annuaire.open(); });
  await page.until(() => document.querySelector('.an-person') !== null);
  const bar = await page.run(barSnap);
  if (!bar.check || !bar.check.disabled || bar.check.label !== t('an.check.admin')) note('présence', `${where} : « À vérifier » devrait être grisée (« ${t('an.check.admin')} ») : ${JSON.stringify(bar.check && { disabled: bar.check.disabled, label: bar.check.label })}`);
  if (bar.badge) note('présence', `${where} : un lecteur qui n'administre pas voit le nombre de points`);
  await click('[data-fk="check"]');
  await delay(200);
  const foot = await page.run(peopleSnap);
  if (foot.foot !== t('an.check.admin')) note('présence', `${where} : le clic sur la pastille grisée dit « ${foot.foot} » (« ${t('an.check.admin')} » attendu)`);
  if (await page.run(() => document.querySelector('.mod.an-chk') !== null)) note('présence', `${where} : la fenêtre « À vérifier » s'ouvre pour qui n'administre pas`);
  await search(page, click, 'sacha');
  const found = await page.run(peopleSnap);
  if (me && found.names.join('|') !== 'Sacha Bernard') note('présence', `${where} : la personne masquée ne se retrouve pas elle-même (${found.names.join(', ')})`);
  if (!me && found.names.length) note('présence', `${where} : une personne masquée se voit encore (${found.names.join(', ')})`);
  if (me) await ownCardProblems(page, t, note, click, where);
  else await everyoneProblems(page, t, note, click, where);
}

async function ownCardProblems(page, t, note, click, where) {
  await closeFiche(page, click);
  await click('[data-fk^="pe:"]');
  await delay(250);
  const own = (await page.run(peopleSnap)).fiche;
  if (!own || !own.presence || own.presence.disabled) note('présence', `${where} : la personne ne peut pas changer son propre choix (${JSON.stringify(own && own.presence && { disabled: own.presence.disabled, title: own.presence.title })})`);
  await closeFiche(page, click);
  await search(page, click, 'camille');
  await click('[data-fk^="pe:"]');
  await delay(250);
  const other = (await page.run(peopleSnap)).fiche;
  if (!other || !other.presence || !other.presence.disabled || other.presence.title !== t('an.pres.noRight')) note('présence', `${where} : la fiche d'un autre devrait être grisée avec « ${t('an.pres.noRight')} » (${JSON.stringify(other && other.presence && { disabled: other.presence.disabled, title: other.presence.title })})`);
}

async function everyoneProblems(page, t, note, click, where) {
  await search(page, click, '');
  const everyone = await page.run(peopleSnap);
  if (everyone.count !== t('an.count', { n: DOC.people - 1 })) note('présence', `${where} : l'annuaire compte « ${everyone.count} » (« ${t('an.count', { n: DOC.people - 1 })} » attendu : la personne masquée n'y est pas)`);
  if (everyone.masked.length) note('présence', `${where} : des personnes grisées pour un lecteur : ${everyone.masked.join(', ')}`);
}

// ---------- l'onglet « Options » ----------

function optionsProblems(snap, t, note, where) {
  if (!snap) { note('options', `${where} : l'onglet « ${t('an.tab.options')} » n'a pas de contenu`); return false; }
  const tabs = ['people', 'hier', 'relations', 'fields', 'options'].map(id => t(`an.tab.${id}`)).join('|');
  if (snap.tabs.join('|') !== tabs) note('options', `${where} : les onglets sont « ${snap.tabs.join(' | ')} » (« ${tabs} » attendus)`);
  framed(snap, note, where, 'options');
  if (snap.bodySideways > 1) note('options', `${where} : l'onglet défile de côté (${snap.bodySideways} px)`);
  const titles = [t('an.opt.presence'), t('an.opt.rights'), t('an.opt.lock'), t('an.opt.checks'), t('an.opt.filters'), t('an.opt.mail')].join('|');
  if (snap.blocks.join('|') !== titles) note('options', `${where} : les blocs sont « ${snap.blocks.join(' | ')} » (« ${titles} » attendus)`);
  if (!snap.switches['op:on'] || !snap.switches['op:on'].on) note('options', `${where} : « ${t('an.opt.presenceOn')} » n'est pas allumée`);
  if (snap.column !== 'Masquee' || snap.leave !== 'Depart') note('options', `${where} : les colonnes disent « ${snap.column} » et « ${snap.leave} » (Masquee et Depart attendues)`);
  for (const kind of ['dup', 'mail', 'att', 'resp', 'dep']) if (!snap.switches[`oc:${kind}`] || !snap.switches[`oc:${kind}`].on) note('options', `${where} : le contrôle « ${kind} » n'est pas allumé`);
  for (const [fk, sw] of Object.entries(snap.switches)) if (sw.box.width < 26 || sw.box.height < 14) note('options', `${where} : l'interrupteur ${fk} ne mesure que ${Math.round(sw.box.width)} × ${Math.round(sw.box.height)} px`);
  return true;
}

// Qui modifie les fiches : « chacun la sienne » allumé, « et en dessous » choisi, la colonne des personnes désignées prise dans la liste avec recherche.
async function rightsEdit(page, note) {
  await clickOn(page, note, '[data-fk="oe:self"]');
  await clickOn(page, note, '[data-fk="oe:below"]');
  await clickOn(page, note, '[data-fk="oe:role"]');
  await delay(300);
  await clickOn(page, note, '.mod.pk [data-fk="pick-use:Masquee"]'); // la colonne est plus bas que la première page de la liste
  await delay(300);
}

async function optionsEditProblems(page, t, note, click, where) {
  const hit = selector => clickOn(page, note, selector); // l'onglet défile : un bouton plus bas que 400 px est d'abord amené sous la souris
  for (const fk of ['om:more', 'om:less', 'om:less', 'om:less']) await hit(`[data-fk="${fk}"]`);
  let snap = await page.run(optionsSnap);
  if (snap.per !== '30') note('options', `${where} : le compteur « Par message » dit ${snap.per} (30 attendu après +5 −5 −5 −5)`);
  await hit('[data-fk="om:to"]');
  await hit('[data-fk="of:bar"]');
  await rightsEdit(page, note);
  await hit('[data-fk="oc:mail"]');
  await hit('[data-fk="op:leave"]');
  await delay(300);
  await click('.mod.pk [data-fk="pick-none"]');
  await delay(300);
  snap = await page.run(optionsSnap);
  const chosen = text => snap.seg.find(each => each.text === text);
  if (!chosen(t('an.opt.toPlain')) || !chosen(t('an.opt.toPlain')).on) note('options', `${where} : « ${t('an.opt.toPlain')} » n'est pas choisi`);
  if (!chosen(t('an.opt.rlBelow')) || !chosen(t('an.opt.rlBelow')).on || chosen(t('an.opt.rlNone')).on) note('options', `${where} : « ${t('an.opt.rlBelow')} » n'est pas choisi pour qui modifie`);
  if (!snap.switches['oe:self'] || !snap.switches['oe:self'].on) note('options', `${where} : « ${t('an.opt.reSelf')} » n'est pas allumé`);
  if (!chosen(t('an.opt.fmBar')) || !chosen(t('an.opt.fmBar')).on || chosen(t('an.opt.fmPanel')).on) note('options', `${where} : « ${t('an.opt.fmBar')} » n'est pas choisi pour les filtres`);
  if (snap.switches['oc:mail'].on) note('options', `${where} : le contrôle « e-mail manquant » reste allumé`);
  const dep = snap.switches['oc:dep'];
  if (!dep || !dep.disabled || dep.on || dep.title !== t('an.check.needs.dep')) note('options', `${where} : sans colonne de départ, « ${t('an.check.kind.dep')} » devrait être grisé avec « ${t('an.check.needs.dep')} » (${JSON.stringify(dep && { on: dep.on, disabled: dep.disabled, title: dep.title })})`);
  if (!snap.rows.find(row => row.label === t('an.check.kind.dep') && row.hint === t('an.check.needs.dep'))) note('options', `${where} : la raison du contrôle grisé n'est pas écrite sous lui`);
  const before = (await page.run(writes)).length;
  await click('[data-fk="set-save"]');
  await delay(600);
  const saved = (await page.run(writes)).slice(before).find(each => each[0] === 'UpdateRecord' && each[1] === 'GFS_Directories');
  const config = saved ? JSON.parse(saved[3].Config) : null;
  if (!config) { note('options', `${where} : « Enregistrer » n'écrit pas la définition de l'annuaire`); return; }
  if (JSON.stringify(config.edit) !== JSON.stringify({ self: true, level: 'below', role: 'Masquee' })) note('options', `${where} : qui modifie est écrit ${JSON.stringify(config.edit)} ({ self: true, level: "below", role: "Masquee" } attendu)`);
  if (config.filterMode !== 'bar') note('options', `${where} : l'affichage des filtres est écrit « ${config.filterMode} » (« bar » attendu)`);
  if (config.mail.per !== 30 || config.mail.to !== 'to') note('options', `${where} : le message est écrit ${JSON.stringify(config.mail)} ({ per: 30, to: "to" } attendu)`);
  if (config.checks.includes('mail') || !['dup', 'att', 'resp'].every(kind => config.checks.includes(kind))) note('options', `${where} : les contrôles écrits sont ${JSON.stringify(config.checks)} (dup, att et resp, sans mail)`);
  if (config.leave !== '' || !config.presence.on || config.presence.col !== 'Masquee') note('options', `${where} : le départ et la présence sont écrits ${JSON.stringify({ leave: config.leave, presence: config.presence })}`);
}

async function optionsTabProblems(page, t, note, click, { width, mode }) {
  const where = `l'onglet « Options » à ${width} px`;
  await click('[data-fk="configure"]');
  await delay(350);
  await click('[data-fk="tab:options"]');
  await delay(250);
  if (!optionsProblems(await page.run(optionsSnap), t, note, where)) return;
  await readable(page, note, OPTION_PROBES, `l'onglet « Options » (${mode})`);
  await page.run(() => { document.querySelector('.an-set-body').scrollTop = 9999; });
  const low = await page.run(optionsSnap);
  if (low.seg.length !== 7 || low.per !== '40') note('options', `${where} : le bas de l'onglet dit « ${low.per} » et ${low.seg.length} choix (40 et 7 attendus : trois pour qui modifie, deux pour les filtres, deux pour l'envoi)`);
  await optionsEditProblems(page, t, note, click, where);
}

// ---------- l'entrée ----------

async function reload(page, query, { width, mode }) {
  await page.goto(`${await page.run(() => `${location.origin}${location.pathname}`)}${query}`);
  await page.run(() => window.__ready);
  await page.view({ width, scale: 1, mode });
  await page.run(installLib);
}

export async function toolsProblems(page, t, note, click, { width, mode, language }) {
  const view = { width, mode };
  await reload(page, `?lang=${language}&tools=1`, view);
  await page.run(() => { void window.__annuaire.open(); });
  await page.until(() => document.querySelector('.an-person') !== null);
  await barProblems(page, t, note, view);
  await mailWindowProblems(page, t, note, click, view);
  await shortListProblems(page, t, note, click, view);
  await noAddressProblems(page, t, note, click, view);
  await checkProblems(page, t, note, click, view);
  await presenceAdminProblems(page, t, note, click, view);
  await optionsTabProblems(page, t, note, click, view);
  await reload(page, `?lang=${language}&tools=1&admin=0`, view);
  await readerProblems(page, t, note, click, view, { me: false });
  await reload(page, `?lang=${language}&tools=1&admin=0&me=sacha.bernard@exemple.fr`, view);
  await readerProblems(page, t, note, click, view, { me: true });
}
