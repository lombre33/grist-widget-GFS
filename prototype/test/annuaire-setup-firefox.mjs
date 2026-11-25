// Le réglage de l'annuaire sous Firefox (règle du 03/11 ; module Annuaire, demande du porteur du 25/11 : réglage en onglets, sur la maquette), à la vraie souris et au vrai clavier,
// sur le vrai contrôle et un faux Grist en mémoire (test/pages/annuaire.js). Suite de test/annuaire-firefox.mjs, appelée avec le réglage ouvert. À mesurer : trois onglets (Personnes,
// Hiérarchie, Champs de la fiche), un seul panneau à la fois, la fenêtre et son pied dans la page, rien qui défile de côté ; « Séparer le nom et le prénom » (le prénom et l'ordre du
// nom, qui se referment) ; la hiérarchie (les niveaux de la maquette : nom, compte, colonne, boutons dans leur carte ; l'aperçu de l'arbre ; la création d'un niveau en trois temps :
// son nom, sa place parmi les autres, puis sa colonne, orange tant qu'elle manque, l'onglet qui avertit, « Enregistrer » qui refuse et montre où) ; l'option éteinte (grisée, jamais
// masquée) ; les champs (les interrupteurs « Liste » et « Filtre » à la souris, le filtre grisé quand le type ne s'y prête pas, monter, descendre, les suggestions) ; puis, en
// enregistrant, ce que la fenêtre de l'annuaire en fait : l'arbre et l'organigramme grisés sans hiérarchie, la pastille d'un champ en liste, le numéro de la fiche qui se compose.
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';

const PROBES = {
  tab: ['.an-tab[aria-selected="false"]', '.an-tabs'], tabOn: ['.an-tab[aria-selected="true"]', '.an-tabs'], label: ['.an-set-label', '.mod'], hint: ['.an-set-hint', '.mod'],
  sectionTitle: ['.an-sec h3', '.mod'], optTitle: ['.an-opt h3', '.an-opt'], optText: ['.an-opt p', '.an-opt'], why: ['.an-set-why', '.an-set-why'], lab: ['.an-lab', '.mod'],
  lvName: ['.an-lv-name', '.an-lvrow'], lvPath: ['.an-lv-path', '.an-lvrow'], lvCount: ['.an-lv-cnt', '.an-lvrow'], lvTodo: ['.an-lv-todo', '.an-lvrow'], tag: ['.an-tag', '.an-tag'],
  prev: ['.an-prev li', '.an-prev'], ftype: ['.an-f-type', '.mod'], fname: ['.an-f-name', '.mod'], fhead: ['.an-frow.is-head span', '.mod'], sug: ['.an-sug', '.an-sug'],
  disclose: ['.an-disclose-b', '.mod'], slot: ['.an-slot-lv', '.an-slot-lv'], note: ['.an-set-note', '.mod-foot'],
};

// ---------- ce qui s'exécute dans la page ----------

function setupSnap() {
  const modal = document.querySelector('.mod.an-set');
  if (!modal) return null;
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const text = node => node.textContent.replace(/\s+/g, ' ').trim();
  const body = modal.querySelector('.an-set-body');
  const panel = modal.querySelector('[role="tabpanel"]');
  const strays = (node, outer) => [...node.querySelectorAll('*')].filter(each => each.getClientRects().length && box(each).right > outer.right + 1).length;
  return {
    box: box(modal), view: [document.documentElement.clientWidth, document.documentElement.clientHeight], foot: box(modal.querySelector('.mod-foot')), title: text(modal.querySelector('h2')),
    note: text(modal.querySelector('.an-set-note')), sideways: body.scrollWidth - body.clientWidth, panel: panel ? panel.getAttribute('aria-labelledby') : null,
    tabs: [...modal.querySelectorAll('.an-tab')].map(tab => ({ id: tab.dataset.tab, on: tab.getAttribute('aria-selected') === 'true', text: text(tab), dot: Boolean(tab.querySelector('.an-tab-dot')), box: box(tab) })),
    levels: [...modal.querySelectorAll('.an-lvrow')].map(card => ({ name: card.querySelector('.an-lv-name').value, todo: card.classList.contains('is-todo'), fresh: card.classList.contains('is-new'),
      count: text(card.querySelector('.an-lv-cnt')), path: text(card.querySelector('.an-lv-src')), strays: strays(card, box(card)), box: box(card) })),
    marker: Boolean(modal.querySelector('.an-ins')), preview: modal.querySelector('.an-prev') ? text(modal.querySelector('.an-prev')) : null,
    off: Boolean(modal.querySelector('.an-hier-body.is-off')), inert: Boolean(modal.querySelector('.an-hier-body[inert]')),
    switches: [...modal.querySelectorAll('.an-sw')].map(sw => ({ fk: sw.dataset.fk, on: sw.getAttribute('aria-checked') === 'true', disabled: sw.getAttribute('aria-disabled') === 'true' })),
    fields: [...modal.querySelectorAll('.an-frow:not(.is-head)')].map(row => ({ name: text(row.querySelector('.an-f-name')), type: text(row.querySelector('.an-f-type')), locked: row.classList.contains('is-locked'), strays: strays(row, box(row)) })),
    sugs: [...modal.querySelectorAll('.an-sug')].map(chip => text(chip)), keys: [...modal.querySelectorAll('[data-fk]')].map(node => node.dataset.fk),
    invalid: [...modal.querySelectorAll('[aria-invalid="true"]')].map(node => node.dataset.fk), order: [...modal.querySelectorAll('[data-act="order"]')].map(node => `${node.dataset.order}:${node.getAttribute('aria-pressed')}`),
  };
}

function centerOfText(selector, wanted, exact) {
  const node = [...document.querySelectorAll(selector)].find(each => { const text = each.textContent.replace(/\s+/g, ' ').trim(); return exact ? text === wanted : text.includes(wanted); });
  if (!node) return null;
  node.scrollIntoView({ block: 'nearest' });
  const r = node.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

// L'état de la fenêtre de l'annuaire derrière le réglage : l'arbre, les vues, les pastilles et le lien du numéro dans la fiche.
function windowSnap() {
  const modal = document.querySelector('.mod.an');
  const hidden = selector => { const node = modal.querySelector(selector); return !node || node.hidden || node.getClientRects().length === 0; };
  const org = modal.querySelector('.an-seg-b[data-view="org"]');
  const call = modal.querySelector('.an-fiche-card a[href^="tel:"]');
  return { treeHidden: hidden('.an-tree'), org: org ? { disabled: org.getAttribute('aria-disabled') === 'true', title: org.title } : null, note: modal.querySelector('.an-foot').textContent.trim(),
    pills: [...modal.querySelectorAll('.an-person .an-pill')].map(pill => pill.textContent.trim()), call: call ? { href: call.getAttribute('href'), target: call.target, rel: call.rel } : null,
    orgModes: [...modal.querySelectorAll('[data-act="org-mode"]')].map(node => `${node.dataset.mode}:${node.getAttribute('aria-disabled') === 'true' ? 'grisé' : 'ok'}`) };
}

// ---------- les gestes ----------

// Taper au clavier puis laisser les frappes se poser (la liste des places se redessine à chaque lettre).
const press = async (page, text) => { await page.press(...text.split('')); await delay(250); };

function tools(page, note) {
  const click = async (selector, wanted = null, exact = false) => {
    const at = wanted === null ? await page.run(selectorCenter, selector) : await page.run(centerOfText, selector, wanted, exact);
    if (!at) { note('introuvable', `${selector}${wanted ? ` « ${wanted} »` : ''} n'est pas dans la page`); return false; }
    await page.click(...at);
    await delay(140);
    return true;
  };
  const snap = () => page.run(setupSnap);
  return { click, snap };
}

function selectorCenter(selector) {
  const node = document.querySelector(selector);
  if (!node) return null;
  node.scrollIntoView({ block: 'nearest' });
  const r = node.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

const fits = (inner, outer, slack = 0.6) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;

// La fenêtre du réglage : dans la page, son pied avec elle, rien qui défile de côté, un seul panneau pour l'onglet choisi.
function frame(snap, note, where, tab) {
  const view = { left: 0, top: 0, right: snap.view[0], bottom: snap.view[1] };
  if (!fits(snap.box, view)) note('hors de la page', `${where} : la fenêtre du réglage sort de la page`);
  if (!fits(snap.foot, view)) note('réglage', `${where} : le pied du réglage sort de la page`);
  if (snap.sideways > 1) note('défile de côté', `${where} : le corps du réglage défile de côté (${snap.sideways} px)`);
  if (snap.panel !== `an-tab-${tab}`) note('réglage', `${where} : le panneau est « ${snap.panel} » (« an-tab-${tab} » attendu)`);
  if (snap.tabs.filter(each => each.on).length !== 1) note('réglage', `${where} : ${snap.tabs.filter(each => each.on).length} onglets sont choisis (un seul attendu)`);
  for (const tabBox of snap.tabs) if (!fits(tabBox.box, view)) note('réglage', `${where} : l'onglet « ${tabBox.text} » sort de la page`);
}

async function contrast(page, note, where) {
  for (const [what, value] of Object.entries(await page.run(contrasts, PROBES))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
}

// ---------- chaque onglet ----------

export async function setupProblems(page, t, note, { wide, width, mode }) {
  const { click, snap } = tools(page, note);
  const where = `le réglage (${mode}, ${width} px)`;
  let state = await snap();
  if (!state) { note('réglage', `${where} : la fenêtre n'est pas ouverte`); return; }
  const expected = ['people', 'hier', 'fields'].map(id => t(`an.tab.${id}`));
  if (state.tabs.map(tab => tab.text.replace(t('an.tab.todo'), '').trim()).join() !== expected.join()) note('réglage', `${where} : les onglets sont « ${state.tabs.map(tab => tab.text).join(' | ')} » (« ${expected.join(' | ')} » attendus)`);
  for (const id of ['people', 'hier', 'fields']) {
    if (!await click(`[data-fk="tab:${id}"]`)) continue;
    state = await snap();
    frame(state, note, `${where}, onglet ${id}`, id);
    await contrast(page, note, `${where}, onglet ${id}`);
  }
  if (!wide) { await click('[data-fk="tab:people"]'); return; }
  await peopleProblems(page, t, note, tools(page, note), where);
  await levelsProblems(page, t, note, tools(page, note), where);
  await fieldsProblems(page, t, note, tools(page, note), where);
}

// « Séparer le nom et le prénom » : le prénom et l'ordre du nom apparaissent, et disparaissent quand on referme.
async function peopleProblems(page, t, note, { click, snap }, where) {
  await click('[data-fk="tab:people"]');
  const before = await snap();
  if (before.keys.includes('pc:first') || before.keys.includes('order:first-last')) note('réglage', `${where} : le prénom est là avant d'avoir déplié « ${t('an.set.split')} »`);
  await click('[data-fk="toggle-split"]');
  const open = await snap();
  if (!open.keys.includes('pc:first')) note('réglage', `${where} : « ${t('an.set.split')} » ne montre pas la colonne du prénom`);
  if (open.order.join() !== 'first-last:true,last-first:false') note('réglage', `${where} : l'ordre du nom dit ${open.order.join()} (prénom d'abord attendu)`);
  frame(open, note, `${where}, nom séparé`, 'people');
  await click('[data-fk="order:last-first"]');
  if ((await snap()).order.join() !== 'first-last:false,last-first:true') note('réglage', `${where} : « ${t('an.set.order.last-first')} » ne se choisit pas à la souris`);
  await click('[data-fk="toggle-split"]');
  if ((await snap()).keys.includes('pc:first')) note('réglage', `${where} : refermer « ${t('an.set.split')} » laisse la colonne du prénom`);
}

// La hiérarchie : les niveaux de la maquette, la création en trois temps, l'orange, l'option éteinte.
async function levelsProblems(page, t, note, tool, where) {
  const { click, snap } = tool;
  await click('[data-fk="tab:hier"]');
  await delay(500);
  const state = await snap();
  if (state.levels.length !== 3) { note('réglage', `${where} : ${state.levels.length} niveaux (3 attendus)`); return; }
  for (const level of state.levels) {
    if (level.strays) note('hors de son cadre', `${where} : un niveau « ${level.name} » a ${level.strays} éléments hors de sa carte`);
    if (!level.count) note('réglage', `${where} : le niveau « ${level.name} » ne dit pas combien de valeurs il a`);
  }
  if (!state.preview || !state.preview.includes('Pôle Ressources')) note('réglage', `${where} : l'aperçu de l'arbre ne montre pas « Pôle Ressources » (« ${state.preview} »)`);
  await contrast(page, note, `${where}, niveaux`);
  await escapeProblems(page, note, tool, where);
  await titleLeadProblems(page, t, note, tool, where);
  await createLevel(page, t, note, tool, where);
  await todoLevel(page, t, note, tool, where);
  await offOption(page, t, note, tool, where);
}

// Le poste et « responsable de sa structure » (l'onglet « Hiérarchie ») : leur liste s'ouvre à la souris, le choix se pose et reste dit dans le bouton.
// (Mesuré dans un vrai Grist le 25/11 : ces deux listes n'avaient pas de nom d'aide et le geste échouait sans rien dire.)
async function titleLeadProblems(page, t, note, { click }, where) {
  for (const [key, column] of [['title', 'Poste'], ['lead', 'Chef']]) {
    await click(`[data-fk="pc:${key}"]`);
    if (!await page.run(() => document.querySelector('.mod.pk') !== null)) { note('réglage', `${where} : la colonne « ${t(`an.set.${key}`)} » ne s'ouvre pas à la souris`); continue; }
    await click('.wk-name', column, true);
    const shown = await page.run(fk => { const node = document.querySelector(`.mod.an-set [data-fk="${fk}"]`); return node ? node.textContent.trim() : ''; }, `pc:${key}`);
    if (shown !== column) note('réglage', `${where} : après avoir choisi « ${column} », le bouton de « ${t(`an.set.${key}`)} » dit « ${shown} »`);
  }
}

// Échap dans une liste ne ferme que la liste : le réglage et l'annuaire derrière restent (le clavier est à la fenêtre du dessus).
async function escapeProblems(page, note, { click, snap }, where) {
  await click('[data-fk="lp:0"]');
  const open = await page.run(() => document.querySelector('.mod.pk') !== null);
  if (!open) { note('réglage', `${where} : la colonne d'un niveau ne s'ouvre pas à la souris`); return; }
  await page.press('Escape');
  await delay(150);
  const after = await page.run(() => ({ list: document.querySelector('.mod.pk') !== null, setup: document.querySelector('.mod.an-set') !== null, annuaire: document.querySelector('.mod.an') !== null }));
  if (after.list) note('clavier', `${where} : Échap ne ferme pas la liste`);
  if (!after.setup) note('clavier', `${where} : Échap dans la liste ferme aussi le réglage`);
  if (!after.annuaire) note('clavier', `${where} : Échap dans la liste ferme l'annuaire derrière`);
  if (!await snap()) await click('[data-fk="configure"]');
}

// Un niveau nouveau : son nom, sa place (entre le premier et le deuxième), sa colonne (Structure › Direction) ; puis on le monte, on le descend, on le retire.
async function createLevel(page, t, note, { click, snap }, where) {
  await click('[data-fk="level-add"]');
  const open = await page.run(() => { const m = document.querySelector('.mod.an-nl'); return m ? { title: m.querySelector('h2').textContent, ok: m.querySelector('[data-fk="nl-ok"]').getAttribute('aria-disabled') } : null; });
  if (!open) { note('réglage', `${where} : « ${t('an.set.addLevel')} » n'ouvre pas la fenêtre du nouveau niveau`); return; }
  if (open.ok !== 'true') note('réglage', `${where} : « ${t('an.lv.add')} » est ouvert avant qu'on ait donné un nom`);
  await press(page, 'Direction générale');
  await click('[data-fk="nl-slot:1"]');
  const placed = await page.run(() => document.querySelector('[data-fk="nl-slot:1"]').getAttribute('aria-pressed'));
  if (placed !== 'true') note('réglage', `${where} : la place choisie à la souris ne se marque pas`);
  await click('[data-fk="nl-ok"]');
  await click('.wk-name', 'Structure ›', true);
  await click('.wk-name', 'Direction', true);
  const state = await snap();
  const [, made] = state.levels;
  if (state.levels.length !== 4 || !made || made.name !== 'Direction générale') { note('réglage', `${where} : le niveau n'est pas à la place choisie (${state.levels.map(level => level.name).join(' | ')})`); return; }
  if (!made.fresh || !state.marker) note('réglage', `${where} : le niveau ajouté n'est pas repéré (« ${t('an.lv.here')} »)`);
  if (made.todo) note('réglage', `${where} : le niveau a sa colonne et reste orange`);
  if (!made.path.includes('Direction')) note('réglage', `${where} : le niveau dit « ${made.path} » (« Direction » attendu)`);
  if (made.strays) note('hors de son cadre', `${where} : le niveau ajouté a ${made.strays} éléments hors de sa carte`);
  await contrast(page, note, `${where}, niveau ajouté`);
  await click('[data-fk="lu:1"]');
  if ((await snap()).levels[0].name !== 'Direction générale') note('réglage', `${where} : « ${t('an.set.up')} » ne monte pas le niveau`);
  await click('[data-fk="ld:0"]');
  await click('[data-fk="lr:1"]');
  const after = await snap();
  if (after.levels.length !== 3 || after.marker) note('réglage', `${where} : « ${t('an.set.remove')} » laisse ${after.levels.length} niveaux`);
}

// Un niveau sans colonne : orange, l'onglet avertit, « Enregistrer » refuse et montre où ; la colonne choisie, tout rentre dans l'ordre.
async function todoLevel(page, t, note, { click, snap }, where) {
  await click('[data-fk="level-add"]');
  await press(page, 'Essai');
  await click('[data-fk="nl-ok"]');
  await page.press('Escape');
  await delay(150);
  const state = await snap();
  const todo = state.levels.findIndex(level => level.todo);
  if (todo < 0) { note('réglage', `${where} : un niveau sans colonne n'est pas orange`); return; }
  if (!state.tabs.find(tab => tab.id === 'hier').dot) note('réglage', `${where} : l'onglet « ${t('an.tab.hier')} » n'avertit pas du niveau sans colonne`);
  if (!state.levels[todo].path.includes(t('an.lv.todo'))) note('réglage', `${where} : le niveau orange ne dit pas « ${t('an.lv.todo')} »`);
  await contrast(page, note, `${where}, niveau orange`);
  await click('[data-fk="set-save"]');
  const refused = await snap();
  if (!refused) { note('réglage', `${where} : « ${t('an.set.save')} » a fermé le réglage malgré un niveau sans colonne`); return; }
  if (refused.note !== t('an.set.errLevel')) note('réglage', `${where} : le pied dit « ${refused.note} » (« ${t('an.set.errLevel')} » attendu)`);
  if (!refused.invalid.includes(`lp:${todo}`)) note('réglage', `${where} : le niveau sans colonne n'est pas désigné (${refused.invalid.join() || 'rien'})`);
  await click(`[data-fk="lp:${todo}"]`);
  await click('.wk-name', 'Nom', true);
  const fixed = await snap();
  if (fixed.levels.some(level => level.todo) || fixed.tabs.find(tab => tab.id === 'hier').dot) note('réglage', `${where} : la colonne choisie ne rend pas le niveau à son état normal`);
  if (fixed.note) note('réglage', `${where} : le pied garde « ${fixed.note} » après la correction`);
  await click(`[data-fk="lr:${todo}"]`);
}

// L'option éteinte : tout reste affiché, grisé et hors de portée du clavier ; rallumée, tout revient (les niveaux sont gardés).
async function offOption(page, t, note, { click, snap }, where) {
  await click('[data-fk="hier-toggle"]');
  const off = await snap();
  if (!off.off || !off.inert) note('réglage', `${where} : l'option éteinte ne grise pas ce qu'elle débloque (grisé ${off.off}, inerte ${off.inert})`);
  if (off.levels.length !== 3) note('réglage', `${where} : l'option éteinte masque les niveaux (${off.levels.length} vus, 3 attendus)`);
  frame(off, note, `${where}, option éteinte`, 'hier');
  await click('[data-fk="hier-toggle"]');
  const on = await snap();
  if (on.off || on.levels.length !== 3) note('réglage', `${where} : rallumée, l'option ne rend pas les niveaux (${on.levels.length})`);
}

// Les champs : les interrupteurs à la souris, le filtre grisé quand le type ne s'y prête pas, monter, descendre, une suggestion qu'on ajoute puis retire.
async function fieldsProblems(page, t, note, { click, snap }, where) {
  await click('[data-fk="tab:fields"]');
  const state = await snap();
  if (!state.fields[0] || !state.fields[0].locked) { note('réglage', `${where} : la ligne des champs fixes manque`); return; }
  const dates = state.fields.findIndex(field => field.type === t('an.type.date'));
  for (const row of state.fields) if (row.strays) note('hors de son cadre', `${where} : la ligne « ${row.name} » a ${row.strays} éléments hors de sa ligne`);
  const first = state.switches.find(sw => sw.fk && sw.fk.startsWith('fl:'));
  if (!first) { note('réglage', `${where} : aucun interrupteur « ${t('an.fld.col.list')} »`); return; }
  await click(`[data-fk="${first.fk}"]`);
  if ((await snap()).switches.find(sw => sw.fk === first.fk).on === first.on) note('réglage', `${where} : l'interrupteur « ${t('an.fld.col.list')} » ne bascule pas à la souris`);
  await click(`[data-fk="${first.fk}"]`);
  const dateFilter = dates >= 0 ? state.switches.filter(sw => sw.fk && sw.fk.startsWith('ff:'))[dates - state.fields.filter(field => field.locked).length] : null;
  if (dateFilter && !dateFilter.disabled) note('réglage', `${where} : le filtre d'un champ date n'est pas grisé`);
  const locked = state.switches.filter(sw => sw.fk && sw.fk.startsWith('lk-'));
  if (locked.some(sw => !sw.disabled)) note('réglage', `${where} : un interrupteur d'une ligne fixe n'est pas grisé`);
  await moveProblems(t, note, { click, snap }, where);
  await sugProblems(t, note, { click, snap }, where, state);
  await contrast(page, note, `${where}, champs`);
}

// Monter et descendre un champ : le premier passe en deuxième, puis revient.
async function moveProblems(t, note, { click, snap }, where) {
  const names = state => state.fields.filter(field => !field.locked).map(field => field.name);
  const before = names(await snap());
  await click('[data-fk="fd:0"]');
  const moved = names(await snap());
  if (moved[0] !== before[1] || moved[1] !== before[0]) note('réglage', `${where} : « ${t('an.set.down')} » ne descend pas le champ (${before.join()} puis ${moved.join()})`);
  await click('[data-fk="fu:1"]');
  if (names(await snap()).join() !== before.join()) note('réglage', `${where} : « ${t('an.set.up')} » ne remonte pas le champ`);
}

// Une suggestion qu'on ajoute (la dernière), puis qu'on retire.
async function sugProblems(t, note, { click, snap }, where, state) {
  if (!state.sugs.length) { note('réglage', `${where} : aucune suggestion de champ`); return; }
  const before = state.fields.length;
  await click('.an-sug', state.sugs[state.sugs.length - 1].replace(/\s+/g, ' '));
  const added = await snap();
  if (added.fields.length !== before + 1) { note('réglage', `${where} : une suggestion cliquée n'ajoute pas de champ (${before} puis ${added.fields.length})`); return; }
  await click(`[data-fk="fr:${added.fields.filter(field => !field.locked).length - 1}"]`);
  if ((await snap()).fields.length !== before) note('réglage', `${where} : « ${t('an.set.remove')} » ne retire pas le champ ajouté`);
}

// Ce que la fenêtre de l'annuaire fait de ce qu'on enregistre : sans la hiérarchie ni le responsable, plus d'arbre et un organigramme grisé qui dit comment l'allumer ; un champ
// « Liste » donne sa pastille ; tout revient quand on rétablit. Le numéro de la fiche est un lien d'appel.
export async function savedProblems(page, t, note, click) {
  const where = 'le réglage enregistré';
  const tool = tools(page, note);
  const reopen = async () => { await click('[data-fk="configure"]'); await delay(200); };
  const save = async () => { await click('[data-fk="set-save"]'); await delay(500); };
  await telProblems(page, t, note, click);
  await reopen();
  await tool.click('[data-fk="tab:fields"]');
  const fields = await tool.snap();
  const listed = fields.switches.find(sw => sw.fk && sw.fk.startsWith('fl:'));
  if (listed) await tool.click(`[data-fk="${listed.fk}"]`);
  await save();
  const withPill = await page.run(windowSnap);
  if (listed && !withPill.pills.includes('Titulaire')) note('liste', `${where} : un champ « ${t('an.fld.col.list')} » ne donne pas sa pastille dans la liste (${withPill.pills.join(' | ')})`);
  await reopen();
  await tool.click('[data-fk="tab:fields"]');
  if (listed) await tool.click(`[data-fk="${listed.fk}"]`);
  await tool.click('[data-fk="tab:hier"]');
  await tool.click('[data-fk="hier-toggle"]');
  await save();
  const off = await page.run(windowSnap);
  if (!off.treeHidden) note('hiérarchie', `${where} : sans l'option « ${t('an.hier.title')} », l'arbre reste affiché`);
  if (off.org && off.org.disabled) note('organigramme', `${where} : le responsable direct est là et l'organigramme est grisé`);
  await click('[data-fk="v:org"]');
  const modes = (await page.run(windowSnap)).orgModes;
  if (modes.join() !== 'structures:grisé,managers:ok') note('organigramme', `${where} : sans niveaux, les vues de l'organigramme sont « ${modes.join()} » (structures grisée attendue)`);
  await click('[data-fk="v:list"]');
  await reopen();
  await tool.click('[data-fk="tab:fields"]');
  await tool.click('[data-fk="mgr-remove"]');
  await save();
  const bare = await page.run(windowSnap);
  if (!bare.org || !bare.org.disabled) note('organigramme', `${where} : sans niveaux ni responsable direct, l'organigramme n'est pas grisé`);
  else if (bare.org.title !== t('an.org.noHierarchy')) note('organigramme', `${where} : l'organigramme grisé dit « ${bare.org.title} » (« ${t('an.org.noHierarchy')} » attendu)`);
  await click('[data-fk="v:org"]');
  if ((await page.run(windowSnap)).note !== t('an.org.noHierarchy')) note('organigramme', `${where} : un clic sur l'organigramme grisé ne dit pas comment l'allumer`);
  await restore(page, t, note, tool, save, reopen, where);
}

// On rétablit : l'option rallumée (les niveaux ont été gardés), le responsable direct par sa suggestion.
async function restore(page, t, note, tool, save, reopen, where) {
  await reopen();
  await tool.click('[data-fk="tab:hier"]');
  await tool.click('[data-fk="hier-toggle"]');
  await tool.click('[data-fk="tab:fields"]');
  await tool.click('[data-fk="sug-manager"]');
  await tool.click('.wk-name', 'Responsable', true);
  await save();
  const back = await page.run(windowSnap);
  if (back.treeHidden) note('hiérarchie', `${where} : rallumée, l'option ne rend pas l'arbre (les niveaux devaient être gardés)`);
  if (back.org && back.org.disabled) note('organigramme', `${where} : rétabli, l'organigramme reste grisé`);
  await tool.click('[data-fk="v:list"]');
}

// La fiche d'une personne qui a un numéro : un lien d'appel (« tel: »), qui s'ouvre à part ; sans numéro, pas de lien.
async function telProblems(page, t, note, click) {
  const where = 'la fiche';
  if (!await click('[data-fk="pe:1"]')) return;
  const withPhone = await page.run(windowSnap);
  if (!withPhone.call) note('numéro', `${where} : le numéro n'est pas un lien d'appel`);
  else if (withPhone.call.href !== 'tel:0102030411' || withPhone.call.target !== '_blank' || !withPhone.call.rel.includes('noopener')) note('numéro', `${where} : le lien d'appel est ${JSON.stringify(withPhone.call)}`);
  await click('[data-fk="side-x"]');
  if (await click('[data-fk="pe:2"]') && (await page.run(windowSnap)).call) note('numéro', `${where} : une personne sans numéro a un lien d'appel`);
  await click('[data-fk="side-x"]');
}
