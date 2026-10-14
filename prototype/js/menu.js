// Un menu déroulant : un seul ouvert à la fois, au clavier comme à la souris (flèches, Entrée, Échap), le dernier ouvert au-dessus.
// Un article « grisé » reste dans le menu et reste cliquable : son `run` dit pourquoi il ne fait rien (« grisé, jamais masqué »).

import { h } from './dom.js';
import { icon } from './icons.js';
import { Layers } from './layers.js';

let current = null;

export const closeMenu = () => { if (current) current.close(); };
export const menuIsOpen = () => current !== null;

function itemNode(item, close) {
  const node = h('button', {
    type: 'button', class: 'menu-item', role: item.check === undefined ? 'menuitem' : 'menuitemradio', 'aria-checked': item.check === undefined ? null : String(item.check),
    'aria-disabled': item.greyed ? 'true' : null, 'data-fam': item.family || null, title: item.title || null,
  },
  item.icon ? icon(item.icon) : h('span', { class: 'ic-sp' }),
  h('span', { class: 'menu-label' }, item.label),
  item.hint ? h('span', { class: 'menu-hint' }, item.hint) : null,
  item.check ? icon('check', 'ck') : null);
  node.addEventListener('click', () => { close(); if (item.run) item.run(); });
  return node;
}

function place(menu, anchor, host, align) {
  const a = anchor.getBoundingClientRect();
  const box = host.getBoundingClientRect();
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  let left = align === 'right' ? a.right - box.left - width : a.left - box.left;
  left = Math.min(Math.max(4, left), Math.max(4, box.width - width - 4));
  let top = a.bottom - box.top + 4;
  if (top + height > box.height - 4) top = Math.max(4, a.top - box.top - height - 4);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

// items : { label, icon, family, check, greyed, hint, title, run } ou '-' (séparateur). Rend { close }.
export function openMenu(anchor, items, { host, align = 'left', label = '' } = {}) {
  closeMenu();
  const container = host || document.body;
  const menu = h('div', { class: 'menu', role: 'menu', 'aria-label': label || null });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('pointerdown', outside, true);
    menu.remove();
    anchor.setAttribute('aria-expanded', 'false');
    if (current && current.menu === menu) current = null;
  };
  const outside = event => { if (!menu.contains(event.target) && !anchor.contains(event.target)) close(); };
  for (const item of items) menu.append(item === '-' ? h('hr') : itemNode(item, () => { close(); anchor.focus({ preventScroll: true }); }));
  menu.addEventListener('keydown', event => {
    const buttons = [...menu.querySelectorAll('.menu-item')];
    const at = buttons.indexOf(document.activeElement);
    const move = index => { event.preventDefault(); buttons[(index + buttons.length) % buttons.length].focus(); };
    if (event.key === 'ArrowDown') move(at + 1);
    else if (event.key === 'ArrowUp') move(at < 0 ? -1 : at - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(-1);
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); anchor.focus({ preventScroll: true }); }
    else if (event.key === 'Tab') close();
  });
  container.append(menu);
  Layers.raise(menu, '--z-menu');
  place(menu, anchor, container, align);
  anchor.setAttribute('aria-expanded', 'true');
  document.addEventListener('pointerdown', outside, true);
  const first = menu.querySelector('[aria-checked="true"]') || menu.querySelector('.menu-item');
  if (first) first.focus({ preventScroll: true });
  current = { menu, close };
  return current;
}
