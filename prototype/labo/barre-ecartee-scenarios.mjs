// Les scénarios du rejeu de la barre devant Publipostage+ (run-barre-ecartee.mjs) : chacun ouvre à la vraie souris ce que l'app pose près d'un bord, mesure sa boîte dans le repère du cadre, la referme, et rend
// { mesures, dessous, sur } : ce qu'il a mesuré, ce que la barre empêche d'ouvrir (le bouton est sous elle : la souris n'y va pas), et ce qui recouvre la zone de la barre (ce qui ne doit pas arriver).
// `r` : { page, frame, app, size, zone, hand } (barre-ecartee-lab.mjs).
import { appParts } from './barre-lab.mjs';
import { hits, inFrame, partRect, rectOf, centerOf, none, label, wait, shownRect, clickOpener, clickRow, unopened } from './barre-ecartee-lab.mjs';

const TOOLBAR = '#toolbar-top';
// Ce que l'app montre sans en faire un contrôle (le logo, la pastille du zoom, le ▶, la sortie de la Lecture épurée) et les commandes de la bande des diapositives et du volet « Importer ».
const EXTRA = ['#v2-brand-logo', '#pp-page-zoom', '.pp-slide-show-open', '#btn-exit-clean-reading', '.pp-slide-strip .pp-slide-item', '.pp-slide-strip .pp-slide-num', '.pp-slide-strip .pp-slide-add',
  '.pp-slide-import-head', '.pp-slide-import-close', '.pp-slide-import-field', '.pp-slide-import .ss-trigger', '.pp-slide-import-keep', '.pp-slide-import .pp-slide-item'].join(', ');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNkYPhfz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC';
// Ce que la zone recouvre d'un bouton : sa part en % et de combien de pixels elle y entre (la plus petite des deux dimensions de ce qui se recouvre).
function covered(box, zone) {
  const width = Math.max(0, Math.min(box.right, zone.right) - Math.max(box.left, zone.left));
  const height = Math.max(0, Math.min(box.bottom, zone.bottom) - Math.max(box.top, zone.top));
  return { part: Math.round((100 * width * height) / ((box.right - box.left) * (box.bottom - box.top))), depth: Math.round(10 * Math.min(width, height)) / 10 };
}
// 1. La page au repos : tout ce que l'app montre (contrôles, panneaux, logo, pastille, ▶) et que la zone recouvre. La barre d'outils est jugée contre la barre elle-même (aucun bouton dessous) ; ce qui n'entre que dans la
// marge de 4 px de la zone se dit à part (`barreDOutils`, jamais compté en échec : la marge est un jeu, la barre n'y est pas). L'éditeur (la surface où l'on écrit, grande) se lit sous la barre sans qu'elle en cache un contrôle.
// `surfaces` : les classes des fonds que l'app étend exprès sous la barre (la bande des diapositives, le volet « Importer » : leur gouttière), dont on juge le contenu, pas le fond.
export async function atRest(r, { surfaces = [] } = {}) {
  const parts = await appParts(r.app, { group: TOOLBAR, extra: EXTRA });
  const all = [...parts.controls, ...parts.panels].filter(part => !(part.largeur >= 300 && part.hauteur >= 100) && !surfaces.some(name => part.classes.split(/\s+/).includes(name)));
  const under = all.filter(part => hits(partRect(part), r.zone));
  const isToolbar = part => part.groupe && !/v2-brand-logo/.test(part.nom);
  const toolbar = under.filter(isToolbar);
  const onBar = toolbar.filter(part => !r.dock || hits(partRect(part), r.dock));
  const inMargin = toolbar.filter(part => !onBar.includes(part)).map(part => { const share = covered(partRect(part), r.zone); return `${part.nom} (${share.part} % de la zone, ${share.depth} px dans la marge)`; });
  const sur = [...under.filter(part => !isToolbar(part)).map(part => label(part.nom, partRect(part))), ...onBar.map(part => label(`${part.nom} (barre d'outils)`, partRect(part)))];
  return { ...none(), mesures: all.length, sur, barreDOutils: inMargin };
}

// 2. Les menus déroulants de la barre d'outils : chaque groupe s'ouvre au survol de son bouton ; la boîte du menu ne recouvre pas la zone. `only` : le sélecteur d'un seul groupe (le menu « Objets » d'une présentation).
export async function menus(r, only = null) {
  const out = none();
  const ids = await r.app.evaluate(only => [...document.querySelectorAll('.v2-hover-group > .v2-hover-flyout')]
    .map((el, i) => { if (!el.id) el.id = `lab-flyout-${i}`; return el; }).filter(el => !only || el.parentElement.matches(only)).map(el => el.id), only);
  for (const id of ids) {
    const trigger = await r.app.evaluate(fid => {
      const group = document.getElementById(fid).parentElement;
      const button = group.querySelector(':scope > button') || group;
      const box = button.getBoundingClientRect();
      return box.width > 0 && box.height > 0 ? { x: box.left + box.width / 2, y: box.top + box.height / 2, name: button.id || fid } : null;
    }, id);
    if (!trigger) continue;
    const where = await r.hand.where(trigger.x, trigger.y);
    if (where !== 'libre') { unopened(out, where === 'barre' ? 'dessous' : 'hors', trigger.name); continue; }
    await r.hand.park();
    await r.hand.move(trigger.x, trigger.y);
    const box = await shownRect(r, `#${id}`, 1500);
    if (!box) { out.notes.push(`${trigger.name} : le menu ne s'ouvre pas au survol`); continue; }
    out.mesures += 1;
    if (hits(box, r.zone)) out.sur.push(label(`${trigger.name} → menu`, box));
    if (!inFrame(box, r.size)) out.notes.push(label(`${trigger.name} → menu hors du cadre`, box));
  }
  await r.hand.park();
  return out;
}

// 3. Les info-bulles des boutons de la barre d'outils qui peuvent atteindre la zone (un bouton à moins de 140 px de côté et 50 px dessous), survolés à la vraie souris. L'info-bulle est le ::after du bouton.
export async function tooltips(r) {
  const out = none();
  const hosts = await r.app.evaluate(zone => [...document.querySelectorAll('.bar-row [data-tip], #v2-toolbar [data-tip]')]
    .filter(el => !el.closest('.v2-hover-flyout'))
    .map((el, i) => {
      const box = el.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0 || getComputedStyle(el).visibility === 'hidden') return null;
      if (!el.id) el.id = `lab-tip-${i}`;
      const near = box.left - 140 < zone.right && box.right + 140 > zone.left && box.top - 10 < zone.bottom && box.bottom + 50 > zone.top;
      return near ? { id: el.id, x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
    }).filter(Boolean), r.zone);
  for (const host of hosts) {
    const where = await r.hand.where(host.x, host.y);
    if (where !== 'libre') { unopened(out, where === 'barre' ? 'dessous' : 'hors', host.id); continue; }
    await r.hand.park();
    await r.hand.move(host.x, host.y);
    const opened = await r.app.waitForFunction(id => Number(getComputedStyle(document.getElementById(id), '::after').opacity) === 1, host.id, { timeout: 1500 }).then(() => true, () => false);
    if (!opened) continue;
    const tip = await r.app.evaluate(id => {
      const el = document.getElementById(id);
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el, '::after');
      const width = parseFloat(style.width) + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const height = parseFloat(style.height) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const left = box.left + el.clientLeft + parseFloat(style.left) - width / 2;
      const top = box.top + el.clientTop + parseFloat(style.top);
      return { left, top, right: left + width, bottom: top + height };
    }, host.id);
    out.mesures += 1;
    if (hits(tip, r.zone)) out.sur.push(label(`${host.id} → info-bulle`, tip));
    if (!inFrame(tip, r.size)) out.notes.push(label(`${host.id} → info-bulle hors du cadre`, tip));
  }
  await r.hand.park();
  return out;
}

// 4. Les listes et panneaux de la barre d'outils, ouverts au clic : polices, tailles, couleur du texte, liste des modèles du titre.
const LISTS = [
  { name: 'liste des polices', opener: '#v2-font-chip', panel: '.v2-format-panel.visible' },
  { name: 'liste des tailles', opener: '#v2-size-chip-val', panel: '.v2-format-panel.visible' },
  { name: 'menu de couleur du texte', opener: '#v2-btn-text-color-caret', panel: '.v2-color-dropdown.visible' },
  { name: 'liste des modèles du titre', opener: '.tts-trigger', panel: '.tts-popup.is-open' },
];
export async function lists(r) {
  const out = none();
  for (const list of LISTS) {
    const opened = await clickOpener(r, list.opener);
    if (opened !== 'clique') { unopened(out, opened, list.name); continue; }
    const box = await shownRect(r, list.panel);
    if (!box) { out.notes.push(`${list.name} : ne s'ouvre pas`); continue; }
    out.mesures += 1;
    if (hits(box, r.zone)) out.sur.push(label(list.name, box));
    if (!inFrame(box, r.size)) out.notes.push(label(`${list.name} hors du cadre`, box));
    await r.page.keyboard.press('Escape');
    await wait(r, 150);
  }
  await r.hand.park();
  return out;
}

// 5. Les fenêtres (voile `.pp-modal` sur tout le cadre : seule la boîte, avec son titre, son contenu et ses boutons, doit éviter la zone) : Réglages (clic), la galerie de modèles (menu « + »), une confirmation.
const WINDOWS = [
  { name: 'Réglages', overlay: '#settings-modal', close: '#settings-close', open: async r => (await clickOpener(r, '#v2-btn-settings')) },
  { name: 'galerie de modèles', overlay: '#template-gallery-modal', close: '#tpl-gallery-close', open: openGallery },
  { name: 'confirmation', overlay: '#pp-dialog-modal', close: '#pp-dialog-modal .pp-modal-actions button', open: async r => { await r.app.evaluate(() => { window.__asked = Dialogs.confirm({ title: 'Supprimer ce modèle ?', message: 'Cette action ne peut pas être annulée.' }); }); return 'clique'; } },
];
// Le menu « + » au survol de son bouton, puis la ligne « À partir d'un modèle » : dans un cadre bas, le menu est plafonné au cadre et défile, la souris posée sur lui, à la molette. `r.why` dit ce qui a manqué quand la
// fenêtre ne s'ouvre pas.
async function openGallery(r) {
  const plus = await centerOf(r.app, '#btn-new');
  if (!plus) return 'absent';
  const onPlus = await r.hand.where(plus.x, plus.y);
  if (onPlus !== 'libre') { r.why = 'le bouton « + »'; return onPlus === 'barre' ? 'dessous' : 'hors'; }
  await r.hand.park();
  await r.hand.move(plus.x, plus.y);
  let row = await shownRect(r, '#v2-btn-new-from-template', 1500);
  if (!row) return 'absent';
  const middle = box => ({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 });
  let at = middle(row);
  let where = await r.hand.where(at.x, at.y);
  const flyout = where === 'hors' ? await rectOf(r.app, '#v2-new-template-flyout') : null;
  if (flyout) {
    const inside = middle(flyout);
    await r.hand.move(inside.x, inside.y, 3);
    await r.page.mouse.wheel(0, 400);
    await wait(r, 300);
    row = (await rectOf(r.app, '#v2-btn-new-from-template')) || row;
    at = middle(row);
    where = await r.hand.where(at.x, at.y);
  }
  if (where !== 'libre') { r.why = `la ligne « À partir d'un modèle » du menu « + » (de y ${Math.round(row.top)} à ${Math.round(row.bottom)})`; return where === 'barre' ? 'dessous' : 'hors'; }
  await clickRow(r, plus, row);
  return 'clique';
}
// Une fenêtre ouverte : sa boîte, son titre, son contenu et ses boutons ne recouvrent pas la zone ; fermée ensuite.
export async function measureWindow(r, win, out) {
  const box = await shownRect(r, `${win.overlay} .pp-modal-box`, 4000);
  if (!box) { out.notes.push(`${win.name} : ne s'ouvre pas`); return; }
  await wait(r, 200);
  const parts = await r.app.evaluate(sel => {
    const rect = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
    const box = document.querySelector(`${sel} .pp-modal-box`);
    return { box: rect(box), header: rect(box.querySelector('.pp-modal-header')), body: rect(box.querySelector('.pp-modal-body')), actions: rect(box.querySelector('.pp-modal-actions')) };
  }, win.overlay);
  out.mesures += 1;
  for (const [part, rect] of Object.entries(parts)) if (hits(rect, r.zone)) out.sur.push(label(`${win.name} → ${part}`, rect));
  if (!inFrame(parts.box, r.size)) out.notes.push(label(`${win.name} hors du cadre`, parts.box));
  await closeWindow(r, win);
}
export async function windows(r, list = WINDOWS) {
  const out = none();
  for (const win of list) {
    r.why = '';
    const opened = await win.open(r);
    if (opened !== 'clique') { unopened(out, opened, r.why ? `${win.name} (${r.why})` : win.name); continue; }
    await measureWindow(r, win, out);
  }
  await r.hand.park();
  return out;
}
// Fermée à la vraie souris par son bouton quand la souris l'atteint (`close`), sinon par Échap (la fenêtre doit pouvoir se fermer dans tous les cas).
async function closeWindow(r, win) {
  const at = win.close ? await centerOf(r.app, win.close) : null;
  if (at && (await r.hand.reach(at.x, at.y))) await r.hand.click(at.x, at.y);
  else await r.page.keyboard.press('Escape');
  await r.app.waitForFunction(sel => getComputedStyle(document.querySelector(sel)).display === 'none', win.overlay, { timeout: 4000 }).catch(() => {});
  await wait(r, 100);
}

// 6. Les barres flottantes d'un tableau et d'une image : le contenu est posé, puis la souris clique la cellule ou l'image.
const TOOLS = [
  { name: 'barre d\'un tableau', html: '<table><tbody><tr><td><p>A1</p></td><td><p>B1</p></td></tr><tr><td><p>A2</p></td><td><p>B2</p></td></tr></tbody></table><p>suite</p>', target: '.tiptap td', toolbar: '.v2-floating-toolbar.v2-table-toolbar.visible' },
  { name: 'barre d\'une image', html: `<p><img class="editor-image" src="data:image/png;base64,${PNG}" style="width:80px"></p><p>suite</p>`, target: '.tiptap img', toolbar: '.v2-floating-toolbar.visible' },
];
export async function floating(r, baseHtml) {
  const out = none();
  for (const tool of TOOLS) {
    await r.app.evaluate(html => { Editor.setHTML(html); }, tool.html);
    await wait(r, 500);
    const opened = await clickOpener(r, tool.target);
    if (opened !== 'clique') { unopened(out, opened, `${tool.name} (la cible)`); continue; }
    const box = await shownRect(r, tool.toolbar, 2000);
    if (!box) { out.notes.push(`${tool.name} : ne s'ouvre pas`); continue; }
    out.mesures += 1;
    if (hits(box, r.zone)) out.sur.push(label(tool.name, box));
    if (!inFrame(box, r.size)) out.notes.push(label(`${tool.name} hors du cadre`, box));
    await r.page.keyboard.press('Escape');
    await wait(r, 100);
  }
  await r.app.evaluate(html => { Editor.setHTML(html); }, baseHtml);
  await wait(r, 300);
  await r.hand.park();
  return out;
}

// 7. La liste des variables (« # » dans le texte) : la bulle posée près du curseur.
export async function variableList(r, baseHtml) {
  const out = none();
  await r.app.evaluate(() => { Editor.setHTML('<p>Bonjour </p>'); });
  await wait(r, 400);
  const opened = await clickOpener(r, '.tiptap p');
  if (opened !== 'clique') unopened(out, opened, 'liste des variables (le texte)');
  else {
    await r.page.keyboard.press('End');
    await r.page.keyboard.type(' #', { delay: 40 });
    const box = await shownRect(r, '#autocomplete-box', 2000);
    if (box) {
      out.mesures += 1;
      if (hits(box, r.zone)) out.sur.push(label('liste des variables', box));
      if (!inFrame(box, r.size)) out.notes.push(label('liste des variables hors du cadre', box));
    } else out.notes.push('liste des variables : ne s\'ouvre pas');
    await r.page.keyboard.press('Escape');
  }
  await r.app.evaluate(html => { Editor.setHTML(html); }, baseHtml);
  await wait(r, 300);
  await r.hand.park();
  return out;
}

// 8. La Lecture épurée : le menu du « Mode lecture » au survol, la ligne « Lecture épurée », puis le bouton de sortie (et le logo, qui n'y est plus), à sa place ; la sortie à la vraie souris.
export async function cleanReading(r) {
  const out = none();
  // La personne remonte à la barre d'outils : le curseur, en changeant de place dans le document (un tableau, une image, une variable), a pu faire défiler la page d'un cadre bas.
  await r.app.evaluate(() => { window.scrollTo(0, 0); });
  await wait(r, 150);
  const read = await centerOf(r.app, '#btn-mode-read');
  if (!read) { out.notes.push('Lecture épurée : le bouton « Mode lecture » n\'est pas montré'); return out; }
  const onRead = await r.hand.where(read.x, read.y);
  if (onRead !== 'libre') { unopened(out, onRead === 'barre' ? 'dessous' : 'hors', 'Lecture épurée (le bouton « Mode lecture »)'); return out; }
  await r.hand.park();
  await r.hand.move(read.x, read.y);
  const row = await shownRect(r, '#v2-btn-clean-reading', 1500);
  if (!row) { out.notes.push('Lecture épurée : le menu ne s\'ouvre pas'); return out; }
  const onRow = await r.hand.where((row.left + row.right) / 2, (row.top + row.bottom) / 2);
  if (onRow !== 'libre') { unopened(out, onRow === 'barre' ? 'dessous' : 'hors', 'Lecture épurée (la ligne du menu)'); await r.hand.park(); return out; }
  await clickRow(r, read, row);
  const active = await r.app.waitForFunction(() => CleanReading.isActive(), null, { timeout: 4000 }).then(() => true, () => false);
  if (!active) { out.notes.push('Lecture épurée : ne s\'ouvre pas'); await r.hand.park(); return out; }
  await wait(r, 400);
  const exit = await shownRect(r, '#btn-exit-clean-reading', 2000);
  if (exit) {
    out.mesures += 1;
    if (hits(exit, r.zone)) out.sur.push(label('sortie de la Lecture épurée', exit));
    if (!inFrame(exit, r.size)) out.notes.push(label('sortie de la Lecture épurée hors du cadre', exit));
    const center = { x: (exit.left + exit.right) / 2, y: (exit.top + exit.bottom) / 2 };
    const onExit = await r.hand.where(center.x, center.y);
    if (onExit === 'libre') await r.hand.click(center.x, center.y);
    else unopened(out, onExit === 'barre' ? 'dessous' : 'hors', 'Lecture épurée (la sortie, à la souris)');
  } else out.notes.push('Lecture épurée : le bouton de sortie n\'est pas montré');
  const left = await r.app.waitForFunction(() => !CleanReading.isActive(), null, { timeout: 3000 }).then(() => true, () => false);
  if (!left) { await r.page.keyboard.press('Escape'); await r.app.waitForFunction(() => !CleanReading.isActive(), null, { timeout: 3000 }).catch(() => {}); out.notes.push('Lecture épurée : la sortie à la souris ne ferme pas ; Échap la ferme'); }
  await r.hand.park();
  return out;
}
