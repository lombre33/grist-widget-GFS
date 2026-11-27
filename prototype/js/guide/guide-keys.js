// Le clavier de l'arbre des démarches (module Guide, demande du porteur du 27/11) : ↑ et ↓ d'une démarche à l'autre, → déplie, ← replie (ou remonte à la mère).
// Une fonction qui lit la touche et déplace le clavier ; la fenêtre (js/guide/guide-window.js) lui donne l'arbre et ce qu'elle doit déclencher.

// `ctx` : { tree (l'élément de l'arbre), index (js/guide/guide-model.js), open (Set des démarches dépliées), toggle(ligne) }.
export function treeKeys(event, active, { tree, index, open, toggle }) {
  const buttons = [...tree.querySelectorAll('.gd-tn-b')];
  const at = buttons.indexOf(active);
  if (at < 0) return;
  const row = Number(active.dataset.row);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const next = buttons[at + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) { event.preventDefault(); next.focus(); next.scrollIntoView({ block: 'nearest' }); }
  } else if (event.key === 'ArrowRight' && (index.children.get(row) || []).length && !open.has(row)) {
    event.preventDefault();
    toggle(row);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    if (open.has(row)) { toggle(row); return; }
    const mother = index.parentOf.get(row);
    if (mother !== null && mother !== undefined) buttons.find(each => Number(each.dataset.row) === mother)?.focus();
  }
}
