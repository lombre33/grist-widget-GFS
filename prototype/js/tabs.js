// Une rangée d'onglets selon le patron ARIA des onglets (charte : tout se fait aussi au clavier), pour « Partager » et « Gérer les partages » : seul l'onglet choisi est un arrêt de Tab
// (tabindex 0, les autres -1) ; ← et → vont à l'onglet voisin (en bouclant), Début et Fin au premier et au dernier ; l'onglet atteint est choisi et garde le clavier, bien que la fenêtre se redessine.
// `replaceKeepingFocus` est ce que les fenêtres appellent pour se redessiner : l'élément qui avait le clavier le retrouve, retrouvé par sa clé `data-fk`.

import { h } from './dom.js';

// opts : { keys, selected, label (le nom de la rangée), prefix (les clés `data-fk` sont `<prefix>-tab-<clé>`), text(clé) → le texte de l'onglet, onSelect(clé) }.
export function tabList({ keys, selected, label, prefix, text, onSelect }) {
  const fk = key => `${prefix}-tab-${key}`;
  const tabs = h('div', { class: 'mg-tabs', role: 'tablist', 'aria-label': label }, ...keys.map((key, at) => {
    const tab = h('button', { type: 'button', role: 'tab', class: 'mg-tab', id: fk(key), 'aria-selected': String(selected === key), tabindex: selected === key ? '0' : '-1', dataset: { fk: fk(key) } }, text(key));
    tab.addEventListener('click', () => onSelect(key));
    tab.addEventListener('keydown', event => {
      const to = { ArrowRight: (at + 1) % keys.length, ArrowLeft: (at - 1 + keys.length) % keys.length, Home: 0, End: keys.length - 1 }[event.key];
      if (to === undefined || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      onSelect(keys[to]);
      // L'onglet est redessiné avec le contenu : le clavier va sur le nouveau, celui qui est choisi.
      const next = tab.ownerDocument.querySelector(`[data-fk="${fk(keys[to])}"]`);
      if (next) next.focus({ preventScroll: true });
    });
    return tab;
  }));
  return tabs;
}

// `host.replaceChildren(...nodes)` qui rend le clavier à l'élément qui l'avait, quand il se retrouve (même `data-fk`) dans le nouveau contenu : sans cela, redessiner une fenêtre jette le clavier sur la page.
export function replaceKeepingFocus(host, ...nodes) {
  const active = host.ownerDocument.activeElement;
  const key = active && host.contains(active) && active.dataset ? active.dataset.fk || null : null;
  host.replaceChildren(...nodes);
  const back = key ? [...host.querySelectorAll('[data-fk]')].find(node => node.dataset.fk === key) : null;
  if (back) back.focus({ preventScroll: true });
}
