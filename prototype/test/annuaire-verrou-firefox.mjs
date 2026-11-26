// Le verrou réel de « qui modifie les fiches » sous Firefox (règle du 03/11 ; module Annuaire, choix du porteur, 26/11 : « Oui, sur demande, avec aperçu »), à la vraie souris, sur le vrai
// contrôle et de fausses règles d'accès (test/pages/annuaire.js, `?lock=none|current|stale|foreign&rights=…`) : c'est le DESSIN de la fenêtre qui se mesure ici, avec les gestes qu'elle
// demande ; ce que Grist fait des règles (refus à l'API, formules, structure fermée) se mesure dans le labo (labo/run-annuaire-verrou.mjs). À mesurer :
// - le bloc « Verrou dans Grist » de l'onglet « Options » : le bouton, grisé avec sa raison (jamais masqué) quand un brouillon n'est pas enregistré ou que la personne n'administre pas ;
// - la fenêtre : l'état, les règles dites en phrases (ce que Grist appliquera), ce que cela change, la structure (interrupteur proposé, ou « déjà fermée »), les règles exactes (un volet),
//   les quatre gestes (poser ou mettre à jour, retirer, fermer la structure, annuler) dont les impossibles restent là, grisés, avec leur raison ;
// - tient dans 700 × 400 et 520 × 400, rien ne sort de côté, le pied et la tête restent en place, les textes lisent 4,5:1 en clair et en sombre ;
// - Échap ferme sans rien écrire ; « Poser » écrit les colonnes d'aide puis une seule liasse (avec la structure ou sans), reprise « annuaire:lock » ; « Retirer » demande d'abord ; un refus de Grist se dit.
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';
import { clickOn } from './annuaire-table-firefox.mjs';

// ---------- ce qui s'exécute dans la page ----------

function lockSnap() {
  const win = document.querySelector('.mod.an-lk');
  if (!win) return null;
  const body = win.querySelector('.an-lk-body');
  const bound = node => (r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }))(node.getBoundingClientRect());
  const code = win.querySelector('.an-lk-code');
  const structure = win.querySelector('[data-fk="lk-structure"]');
  return { win: bound(win), title: win.querySelector('h2').textContent.trim(), head: bound(win.querySelector('.mod-head')), foot: bound(win.querySelector('.mod-foot')), body: bound(body),
    scrolls: body.scrollHeight > body.clientHeight + 1, sideways: body.scrollWidth - body.clientWidth, view: [innerWidth, innerHeight],
    state: (node => (node ? { text: node.textContent.trim(), cls: node.className } : null))(win.querySelector('.an-lk-state')),
    sections: [...win.querySelectorAll('.an-lk-sec')].map(section => ({ head: section.querySelector('h3').textContent.trim(), items: [...section.querySelectorAll('li')].map(li => li.textContent.trim()) })),
    buttons: [...win.querySelectorAll('.mod-foot .btn')].map(button => ({ fk: button.dataset.fk, text: button.textContent.trim(), disabled: button.getAttribute('aria-disabled') === 'true',
      title: button.title, box: bound(button) })),
    structure: structure ? { on: structure.classList.contains('is-on'), box: bound(structure), role: structure.getAttribute('role') } : null,
    hint: (node => (node ? node.textContent.trim() : ''))(win.querySelector('.an-lk-body > .an-set-hint')),
    closed: win.querySelector('.an-lk-ok') ? win.querySelector('.an-lk-ok').textContent.trim() : '',
    code: code ? { hidden: code.hidden, box: code.hidden ? null : bound(code), lines: [...code.querySelectorAll('code')].map(line => line.textContent), sideways: code.scrollWidth - code.clientWidth } : null,
    toggle: (node => (node ? { expanded: node.getAttribute('aria-expanded'), box: bound(node) } : null))(win.querySelector('[data-fk="lk-code"]')),
    focus: document.activeElement ? document.activeElement.dataset.fk || document.activeElement.tagName : '' };
}

function optionSnap() {
  const box = node => (r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }))(node.getBoundingClientRect());
  const open = document.querySelector('[data-fk="ol:open"]');
  const block = open && open.closest('.an-ob');
  return open ? { disabled: open.getAttribute('aria-disabled') === 'true', title: open.title, text: open.textContent.trim(), box: box(open), blockTitle: block.querySelector('.an-ob-h b').textContent.trim(),
    blockBox: box(block), note: block.querySelector('.an-ob-t small').textContent.trim(), view: [innerWidth, innerHeight],
    body: (n => ({ top: n.getBoundingClientRect().top, bottom: n.getBoundingClientRect().bottom }))(document.querySelector('.an-set-body')) } : null;
}

const askedIn = () => window.__annuaireAsks.slice();
const lockedIn = () => JSON.parse(JSON.stringify(window.__annuaireLock || []));
const batchedIn = () => window.__annuaireBatches();

// ---------- l'essai ----------

const asks = page => page.run(askedIn);
const locks = page => page.run(lockedIn);
const batches = page => page.run(batchedIn);
const inside = (inner, outer, slack = 1) => inner.left >= outer.left - slack && inner.right <= outer.right + slack && inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack;
const apart = (a, b) => a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1;

async function reload(page, query, { width, mode }) {
  await page.goto(`${await page.run(() => `${location.origin}${location.pathname}`)}${query}`);
  await page.run(() => window.__ready);
  await page.view({ width, scale: 1, mode });
  await page.run(() => void window.__annuaire.open());
  await page.until(() => document.querySelector('.mod.an .an-person, .mod.an .an-pcard') !== null);
}

async function toOptions(page, note) {
  await clickOn(page, note, '[data-fk="configure"]');
  await delay(350);
  await clickOn(page, note, '[data-fk="tab:options"]');
  await delay(250);
}

async function openWindow(page, note) {
  await clickOn(page, note, '[data-fk="ol:open"]');
  await page.until(() => document.querySelector('.mod.an-lk') !== null).catch(() => null);
  await delay(250);
  return page.run(lockSnap);
}

// La fenêtre ouverte : sa place, ses gestes, ses phrases.
function windowProblems(snap, note, t, where) {
  if (!inside(snap.win, { left: 0, top: 0, right: snap.view[0], bottom: snap.view[1] })) note('hors de la page', `${where} : la fenêtre sort de la page`);
  if (snap.title !== t('an.lock.title')) note('verrou', `${where} : le titre dit « ${snap.title} » (« ${t('an.lock.title')} » attendu)`);
  if (snap.sideways > 1) note('verrou', `${where} : la fenêtre défile de côté (${snap.sideways} px)`);
  if (snap.head.bottom > snap.body.top + 1 || snap.body.bottom > snap.foot.top + 1) note('verrou', `${where} : le titre, le corps et le pied se chevauchent`);
  for (const button of snap.buttons) {
    if (!inside(button.box, snap.foot, 2)) note('hors de la page', `${where} : le bouton « ${button.text} » sort du pied`);
    if (button.box.height < 24) note('cible', `${where} : le bouton « ${button.text} » ne mesure que ${Math.round(button.box.height)} px de haut (24 au moins)`);
  }
  for (const [at, one] of snap.buttons.entries()) for (const other of snap.buttons.slice(at + 1)) if (!apart(one.box, other.box)) note('verrou', `${where} : les boutons « ${one.text} » et « ${other.text} » se chevauchent`);
  const byFk = fk => snap.buttons.find(button => button.fk === fk);
  for (const fk of ['lk-cancel', 'lk-remove', 'lk-close', 'lk-put']) if (!byFk(fk)) note('verrou', `${where} : le bouton ${fk} manque (grisé, jamais masqué)`);
}

// L'état attendu pour chaque scénario : le mot de l'état, ce qui est ouvert, et le texte du bouton de pose.
async function scenario(page, t, note, click, view, { query, label, state, put, remove, close, rules, structure }) {
  const where = `le verrou, ${label} (${view.width} px, ${view.mode})`;
  await reload(page, `?lang=${view.language}&${query}`, view);
  await toOptions(page, note);
  const snap = await openWindow(page, note);
  if (!snap) { note('verrou', `${where} : le bouton « ${t('an.opt.lockOpen')} » n'ouvre pas la fenêtre`); return null; }
  windowProblems(snap, note, t, where);
  if (!snap.state || snap.state.text !== state) note('verrou', `${where} : l'état dit « ${snap.state && snap.state.text} » (« ${state} » attendu)`);
  const gesture = fk => snap.buttons.find(button => button.fk === fk);
  const wants = { 'lk-put': [put, put !== null], 'lk-remove': [t('an.lock.remove'), remove], 'lk-close': [t('an.lock.closeNow'), close] };
  for (const [fk, [text, open]] of Object.entries(wants)) {
    const button = gesture(fk);
    if (!button) continue;
    if (fk === 'lk-put' && put !== null && button.text !== put) note('verrou', `${where} : le bouton de pose dit « ${button.text} » (« ${put} » attendu)`);
    if (fk !== 'lk-put' && button.text !== text) note('verrou', `${where} : le bouton ${fk} dit « ${button.text} » (« ${text} » attendu)`);
    if (button.disabled === open) note('verrou', `${where} : « ${button.text} » est ${button.disabled ? 'grisé' : 'ouvert'} (${open ? 'ouvert' : 'grisé, avec sa raison'} attendu)`);
    if (button.disabled && !button.title) note('verrou', `${where} : « ${button.text} » est grisé sans dire pourquoi`);
  }
  for (const wanted of rules || []) if (!snap.sections.some(section => section.items.some(item => item.startsWith(wanted)))) note('verrou', `${where} : la phrase « ${wanted.slice(0, 70)}… » manque`);
  if (structure === 'offer' && (!snap.structure || !snap.structure.on || snap.structure.role !== 'switch')) note('verrou', `${where} : l'interrupteur de la structure manque ou n'est pas allumé`);
  if (structure === 'hint' && (snap.structure || !snap.hint)) note('verrou', `${where} : la structure ouverte devrait être dite par une phrase, sans interrupteur (le geste est dans le pied)`);
  if (structure === 'none' && snap.structure) note('verrou', `${where} : l'interrupteur de la structure est là alors que le verrou ne peut pas se poser`);
  return snap;
}

async function readable(page, note, where) {
  const ratios = await page.run(contrasts, { 'l\'état': ['.an-lk-state', '.mod.an-lk'], 'une phrase': ['.an-lk-list li', '.mod.an-lk'], 'un titre': ['.an-lk-sec h3', '.mod.an-lk'],
    'l\'aide de la structure': ['.an-lk .an-ob-t small', '.mod.an-lk'], 'un bouton grisé': ['.an-lk .mod-foot .btn[aria-disabled="true"]', '.mod.an-lk'],
    'une règle exacte': ['.an-lk-line', '.mod.an-lk'] });
  for (const [what, value] of Object.entries(ratios)) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
}

// Le volet des règles exactes : il s'ouvre, tient dans la fenêtre sans défiler de côté, et dit les deux colonnes d'aide.
async function codeProblems(page, t, note, where) {
  await clickOn(page, note, '[data-fk="lk-code"]');
  await delay(200);
  const snap = await page.run(lockSnap);
  if (!snap.code || snap.code.hidden) { note('verrou', `${where} : le volet « ${t('an.lock.code.title')} » ne s'ouvre pas`); return; }
  if (snap.toggle.expanded !== 'true') note('verrou', `${where} : le volet ouvert ne le dit pas (aria-expanded « ${snap.toggle.expanded} »)`);
  if (snap.code.sideways > 1) note('verrou', `${where} : le volet défile de côté (${snap.code.sideways} px)`);
  if (!inside(snap.code.box, snap.body, 2) && !snap.scrolls) note('hors de la page', `${where} : le volet sort du corps de la fenêtre qui ne défile pas`);
  const text = snap.code.lines.join('\n');
  for (const wanted of ['user.Access in [OWNER] → +CRUD', 'rec.GFS_Editors → +U', '→ -U']) if (!text.includes(wanted)) note('verrou', `${where} : les règles exactes ne disent pas « ${wanted} »`);
  if (!/GFS_Editors/.test(text) || !/lookupRecords/.test(text)) note('verrou', `${where} : la formule de la colonne d'aide manque dans les règles exactes`);
  await readable(page, note, where);
  await clickOn(page, note, '[data-fk="lk-code"]');
  await delay(150);
}

export async function verrouProblems(page, t, note, click, { width, mode, language }) {
  const view = { width, mode, language };
  const base = [t('an.lock.r.owners'), t('an.lock.r.editors', { who: '@@' }).split('@@')[0], t('an.lock.r.others'), t('an.lock.r.cols', { cols: '@@' }).split('@@')[0]];
  const rights = 'rights=self,below,role';

  // Le bloc de l'onglet « Options » : ouvert, puis grisé avec sa raison.
  await reload(page, `?lang=${language}&${rights}&lock=none`, view);
  await toOptions(page, note);
  let option = await page.run(optionSnap);
  const where = `le bloc « ${t('an.opt.lock')} » (${width} px, ${mode})`;
  if (!option) { note('verrou', `${where} : le bouton « ${t('an.opt.lockOpen')} » manque`); return; }
  if (option.blockTitle !== t('an.opt.lock') || option.text !== t('an.opt.lockOpen')) note('verrou', `${where} : le bloc dit « ${option.blockTitle} » et le bouton « ${option.text} »`);
  if (option.disabled || option.note !== t('an.opt.lockOpenSub')) note('verrou', `${where} : le bouton devrait être ouvert avec « ${t('an.opt.lockOpenSub')} » (grisé : ${option.disabled}, phrase : « ${option.note} »)`);
  if (option.box.height < 24) note('cible', `${where} : le bouton ne mesure que ${Math.round(option.box.height)} px de haut`);
  await clickOn(page, note, '[data-fk="oe:below"]'); // un changement du brouillon : le verrou suit le réglage enregistré
  await clickOn(page, note, '[data-fk="oe:none"]');
  option = await page.run(optionSnap);
  if (!option.disabled || option.title !== t('an.opt.lockWhy.dirty')) note('verrou', `${where} : avec un brouillon, le bouton devrait être grisé avec « ${t('an.opt.lockWhy.dirty')} » (grisé : ${option.disabled}, titre : « ${option.title} »)`);
  if (option.note !== t('an.opt.lockWhy.dirty')) note('verrou', `${where} : la raison n'est pas écrite sous le bouton (« ${option.note} »)`);
  await clickOn(page, note, '[data-fk="ol:open"]');
  await delay(250);
  if ((await page.run(lockSnap)) !== null) note('verrou', `${where} : un clic sur le bouton grisé ouvre quand même la fenêtre`);
  await reload(page, `?lang=${language}&${rights}&lock=none&admin=0&me=camille.durand@exemple.fr`, view);
  await toOptions(page, note);
  option = await page.run(optionSnap);
  if (!option || !option.disabled || option.title !== t('an.opt.lockWhy.admin')) note('verrou', `${where} : sans être propriétaire, le bouton devrait être grisé avec « ${t('an.opt.lockWhy.admin')} » (« ${option && option.title} »)`);

  // Aucun verrou : la fenêtre, ses phrases, ce que cela change, le volet des règles exactes.
  const none = await scenario(page, t, note, click, view, { query: `${rights}&lock=none`, label: 'aucun verrou', state: t('an.lock.state.none'), put: t('an.lock.put'), remove: false, close: false,
    rules: base, structure: 'offer' });
  if (none) {
    const costs = none.sections.find(section => section.head === t('an.lock.h.costs'));
    const wanted = [t('an.lock.c.tools'), t('an.lock.c.reload')];
    for (const text of wanted) if (!costs || !costs.items.includes(text)) note('verrou', `${where} : « ${text.slice(0, 60)}… » manque dans ce que cela change`);
    if (!costs || !costs.items.some(item => /GFS_Editors/.test(item) && /GFS_Node/.test(item))) note('verrou', `${where} : les deux colonnes d'aide ne sont pas dites dans ce que cela change`);
    await readable(page, note, `le verrou (${width} px, ${mode})`);
    await codeProblems(page, t, note, `le verrou, les règles exactes (${width} px, ${mode})`);
    await page.press('Escape');
    await delay(250);
    if ((await page.run(lockSnap)) !== null) note('verrou', 'Échap ne ferme pas la fenêtre du verrou');
    if ((await locks(page)).length || (await batches(page)).some(list => list.some(action => action[0] === 'AddColumn' && /^GFS_(Node|Editors)$/.test(action[2])))) note('verrou', 'fermer la fenêtre sans accord a écrit quelque chose');
  }

  // Poser, structure fermée en même temps (par défaut) : les colonnes d'aide, puis une seule liasse, reprise « annuaire:lock ».
  await scenario(page, t, note, click, view, { query: `${rights}&lock=none`, label: 'poser', state: t('an.lock.state.none'), put: t('an.lock.put'), remove: false, close: false });
  await clickOn(page, note, '[data-fk="lk-put"]');
  await delay(400);
  let written = await locks(page);
  const columns = (await batches(page)).flat().filter(action => action[0] === 'AddColumn' && /^GFS_(Node|Editors)$/.test(action[2])).map(action => action[2]);
  if (columns.join(',') !== 'GFS_Node,GFS_Editors') note('verrou', `poser écrit les colonnes d'aide « ${columns.join(', ')} » (GFS_Node, GFS_Editors attendues, dans cet ordre)`);
  if (written.length !== 1 || written[0].resume !== 'annuaire:lock') note('verrou', `poser demande ${written.length} écriture(s) de règles, reprise « ${written[0] && written[0].resume} » (une seule, reprise « annuaire:lock » attendue)`);
  const resources = written[0] ? written[0].actions.filter(action => action === 'AddRecord:_grist_ACLResources').length : 0;

  if (resources !== 3) note('verrou', `poser avec la structure écrit ${resources} ressource(s) de règles (trois attendues : les colonnes protégées, la table, la structure)`);
  if ((await page.run(lockSnap)) !== null) note('verrou', 'la fenêtre reste ouverte après « Poser »');

  // Poser sans fermer la structure : l'interrupteur éteint donne une ressource de moins.
  await scenario(page, t, note, click, view, { query: `${rights}&lock=none`, label: 'poser sans la structure', state: t('an.lock.state.none'), put: t('an.lock.put'), remove: false, close: false });
  await clickOn(page, note, '[data-fk="lk-structure"]');
  const off = await page.run(lockSnap);
  if (!off.structure || off.structure.on) note('verrou', 'l\'interrupteur de la structure ne s\'éteint pas');
  await clickOn(page, note, '[data-fk="lk-put"]');
  await delay(400);
  written = await locks(page);
  const fewer = written[0] ? written[0].actions.filter(action => action === 'AddRecord:_grist_ACLResources').length : 0;
  if (fewer !== 2) note('verrou', `poser sans la structure écrit ${fewer} ressource(s) de règles (deux attendues)`);

  // Un refus de Grist se dit.
  await scenario(page, t, note, click, view, { query: `${rights}&lock=none&lockfail=refus-d-essai`, label: 'refus de Grist', state: t('an.lock.state.none'), put: t('an.lock.put'), remove: false, close: false });
  await clickOn(page, note, '[data-fk="lk-put"]');
  await delay(400);
  const failedAsks = await asks(page);
  if (!failedAsks.includes(t('an.lock.failedTitle'))) note('verrou', `un refus de Grist ne se dit pas dans une fenêtre (${failedAsks.join(' | ')})`);

  // Posé : à jour, « Retirer » demande d'abord, « Fermer la structure » ouvert.
  const current = await scenario(page, t, note, click, view, { query: `${rights}&lock=current`, label: 'posé', state: t('an.lock.state.current'), put: null, remove: true, close: true, structure: 'hint' });
  if (current && current.sections.length && current.sections.some(section => section.head === t('an.lock.h.costs'))) note('verrou', 'le verrou posé redit encore ce que cela change');
  await clickOn(page, note, '[data-fk="lk-remove"]');
  await delay(400);
  written = await locks(page);
  const removeAsks = await asks(page);
  if (!removeAsks.includes(t('an.lock.removeTitle'))) note('verrou', `« ${t('an.lock.remove')} » n'a pas demandé l'accord d'abord (${removeAsks.join(' | ')})`);
  if (written.length !== 1 || !written[0].actions.includes('BulkRemoveRecord:_grist_ACLRules') || !written[0].actions.includes('RemoveColumn:Personnes') || written[0].resume !== 'annuaire:unlock') {
    note('verrou', `retirer écrit ${JSON.stringify(written)} (règles et colonnes d'aide attendues, reprise « annuaire:unlock »)`);
  }
  await scenario(page, t, note, click, view, { query: `${rights}&lock=current`, label: 'posé, fermer la structure', state: t('an.lock.state.current'), put: null, remove: true, close: true });
  await clickOn(page, note, '[data-fk="lk-close"]');
  await delay(300);
  const closing = await locks(page);
  if (!closing.some(entry => entry.kind === 'close' && entry.resume === 'annuaire:close')) note('verrou', `« ${t('an.lock.closeNow')} » n'a pas demandé la fermeture de la structure (${JSON.stringify(closing)})`);

  // Le réglage a changé depuis : mise à jour. Une règle d'un autre auteur : rien ne se pose.
  await scenario(page, t, note, click, view, { query: `${rights}&lock=stale`, label: 'à mettre à jour', state: t('an.lock.state.stale'), put: t('an.lock.update'), remove: true, close: false, rules: base });
  const table = 'Personnes';
  await scenario(page, t, note, click, view, { query: `${rights}&lock=foreign`, label: 'règle d\'un autre auteur', state: t('an.lock.state.foreign', { table }), put: null, remove: false, close: false,
    structure: 'none' });
}
