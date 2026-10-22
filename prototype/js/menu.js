// Un menu déroulant : un seul ouvert à la fois, au clavier comme à la souris (flèches, Entrée, Échap), le dernier ouvert au-dessus.
// Un article « grisé » reste dans le menu et reste cliquable : son `run` dit pourquoi il ne fait rien (« grisé, jamais masqué »).
// Un article qui porte `submenu` (une liste d'articles) ouvre un sous-menu à côté de lui : par un clic, Entrée ou la flèche droite ; Échap ou la flèche gauche le referme.

import { h } from './dom.js';
import { icon } from './icons.js';
import { Layers } from './layers.js';

let current = null;

export const closeMenu = () => { if (current) current.close(); };
export const menuIsOpen = () => current !== null;

// `open(node, articles)` : ce que fait le clic d'un article à sous-menu.
function itemNode(item, close, open) {
  const sub = Array.isArray(item.submenu);
  const node = h('button', {
    type: 'button', class: 'menu-item', role: item.check === undefined ? 'menuitem' : 'menuitemradio', 'aria-checked': item.check === undefined ? null : String(item.check),
    'aria-disabled': item.greyed ? 'true' : null, 'aria-haspopup': sub ? 'menu' : null, 'aria-expanded': sub ? 'false' : null, 'data-fam': item.family || null, title: item.title || null,
  },
  item.icon ? icon(item.icon) : h('span', { class: 'ic-sp' }),
  h('span', { class: 'menu-label' }, item.label),
  item.hint ? h('span', { class: 'menu-hint' }, item.hint) : null,
  item.check ? icon('check', 'ck') : null,
  sub ? icon('chev-right', 'sub-chev') : null);
  node.addEventListener('click', () => {
    if (sub) { open(node, item.submenu); return; }
    close();
    if (item.run) item.run();
  });
  return node;
}

// Le côté d'un menu posé à côté de son bouton : celui qu'on demande ; avec `flip` (un sous-menu), l'autre quand le menu n'y tient pas ; quand aucun côté ne suffit, le plus large, où le menu
// se rétrécit (ses mentions se coupent par « … », jamais son nom) : un sous-menu ne recouvre jamais l'article qui l'ouvre.
const NARROWEST = 160;
function sideFor(menu, a, box, side, flip) {
  const rooms = { right: box.right - a.right - 8, left: a.left - box.left - 8 };
  const other = side === 'right' ? 'left' : 'right';
  if (!flip || menu.offsetWidth <= rooms[side]) return side;
  if (menu.offsetWidth <= rooms[other]) return other;
  const widest = rooms.right >= rooms.left ? 'right' : 'left';
  menu.style.maxWidth = `${Math.max(rooms[widest], NARROWEST)}px`;
  return widest;
}

// `side` : 'below' (par défaut : au-dessous du bouton, au-dessus s'il n'y a pas la place), 'above', ou à côté de lui, 'right' ou 'left' (le menu d'une barre posée sur un bord).
// `flip` : un menu posé à côté passe de l'autre côté quand il n'y a pas la place du premier, ou se rétrécit quand il n'y en a d'aucun côté (un sous-menu).
function place(menu, anchor, host, align, side, flip = false) {
  const a = anchor.getBoundingClientRect();
  const box = host.getBoundingClientRect();
  const at = side === 'right' || side === 'left' ? sideFor(menu, a, box, side, flip) : side;
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const fit = (value, size, room) => Math.min(Math.max(4, value), Math.max(4, room - size - 4));
  let left = align === 'right' ? a.right - box.left - width : a.left - box.left;
  let top = a.bottom - box.top + 4;
  if (at === 'right' || at === 'left') {
    left = at === 'right' ? a.right - box.left + 4 : a.left - box.left - width - 4;
    top = a.top - box.top;
  } else if (at === 'above' || top + height > box.height - 4) {
    top = a.top - box.top - height - 4;
  }
  menu.style.left = `${fit(left, width, box.width)}px`;
  menu.style.top = `${fit(top, height, box.height)}px`;
}

// Les flèches, Début et Fin d'un menu ou d'un sous-menu : le focus passe d'article en article, en boucle.
function navigate(menu, event) {
  const buttons = [...menu.querySelectorAll('.menu-item')];
  const at = buttons.indexOf(document.activeElement);
  const move = index => { event.preventDefault(); buttons[(index + buttons.length) % buttons.length].focus(); };
  if (event.key === 'ArrowDown') move(at + 1);
  else if (event.key === 'ArrowUp') move(at < 0 ? -1 : at - 1);
  else if (event.key === 'Home') move(0);
  else if (event.key === 'End') move(-1);
}

// items : { label, icon, family, check, greyed, hint, title, run, submenu } ou '-' (séparateur). Rend { close }.
export function openMenu(anchor, items, { host, align = 'left', label = '', side = 'below' } = {}) {
  closeMenu();
  const container = host || document.body;
  const menu = h('div', { class: 'menu', role: 'menu', 'aria-label': label || null });
  let closed = false;
  let sub = null; // le sous-menu ouvert : { element, parent }
  const closeSub = () => {
    if (!sub) return;
    sub.element.remove();
    sub.parent.setAttribute('aria-expanded', 'false');
    sub = null;
  };
  const close = () => {
    if (closed) return;
    closed = true;
    closeSub();
    document.removeEventListener('pointerdown', outside, true);
    menu.remove();
    anchor.setAttribute('aria-expanded', 'false');
    if (current && current.menu === menu) current = null;
  };
  const done = () => { close(); anchor.focus({ preventScroll: true }); };
  const outside = event => {
    const inside = menu.contains(event.target) || (sub && sub.element.contains(event.target)) || anchor.contains(event.target);
    if (!inside) close();
  };
  const subKeys = (event, element, parent) => {
    if (event.key === 'Escape' || event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); closeSub(); parent.focus({ preventScroll: true }); }
    else if (event.key === 'Tab') close();
    else navigate(element, event);
  };
  const openSub = (parent, entries) => {
    closeSub();
    const element = h('div', { class: 'menu menu-sub', role: 'menu', 'aria-label': parent.querySelector('.menu-label').textContent });
    for (const entry of entries) element.append(itemNode(entry, done));
    container.append(element);
    Layers.raise(element, '--z-menu');
    place(element, parent, container, 'left', 'right', true);
    parent.setAttribute('aria-expanded', 'true');
    element.addEventListener('keydown', event => subKeys(event, element, parent));
    sub = { element, parent };
    const first = element.querySelector('.menu-item');
    if (first) first.focus({ preventScroll: true });
  };
  for (const item of items) menu.append(item === '-' ? h('hr') : itemNode(item, done, openSub));
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); done(); }
    else if (event.key === 'Tab') close();
    else if (event.key === 'ArrowRight' && document.activeElement.getAttribute('aria-haspopup')) { event.preventDefault(); document.activeElement.click(); }
    else navigate(menu, event);
  });
  menu.addEventListener('focusin', event => { if (sub && event.target !== sub.parent) closeSub(); });
  container.append(menu);
  Layers.raise(menu, '--z-menu');
  place(menu, anchor, container, align, side);
  anchor.setAttribute('aria-expanded', 'true');
  document.addEventListener('pointerdown', outside, true);
  const first = menu.querySelector('[aria-checked="true"]') || menu.querySelector('.menu-item');
  if (first) first.focus({ preventScroll: true });
  current = { menu, close };
  return current;
}
