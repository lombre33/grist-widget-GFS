// La mise en page d'un organigramme (module Annuaire, demande du porteur du 25/11 : « super important »), sans bibliothèque : une carte par élément, un trait
// en équerre de chaque parent à ses enfants, les feuilles côte à côte et chaque parent centré au-dessus de ses enfants. Du code sans effet de bord : le dessin
// est à js/annuaire/annuaire-org-view.js. Un élément est { id, ch: [éléments] } ; deux organigrammes s'en servent, celui des structures (l'arbre des niveaux)
// et celui des responsables (js/annuaire/annuaire-model.js, `managerTree`).

// Tous les éléments qui ont des enfants : l'ensemble des identifiants dépliés.
export function allOpen(roots) {
  const open = new Set();
  const walk = item => { if (item.ch.length) open.add(item.id); item.ch.forEach(walk); };
  roots.forEach(walk);
  return open;
}

// Les éléments dont les enfants se voient au premier regard (retour du porteur, 25/11 : « par défaut l'organigramme est déplié jusqu'au niveau le plus bas ») :
// tous, sauf quand l'organigramme est immense (au-delà de `limit` éléments : plusieurs milliers de cartes ne tiennent pas dans un panneau, le reste se déplie à
// la demande) ; alors seulement les deux premiers étages.
export function defaultOpen(roots, limit = 400) {
  const all = [];
  const walk = (item, depth) => { all.push([item, depth]); item.ch.forEach(child => walk(child, depth + 1)); };
  roots.forEach(root => walk(root, 0));
  return new Set(all.filter(([item, depth]) => item.ch.length && (all.length <= limit || depth < 2)).map(([item]) => item.id));
}

// Les personnes d'une structure, quand l'organigramme les montre (`item.people`, des éléments sans enfant) : une pile de petites cartes sous celle de la
// structure, une par ligne, plutôt que des dizaines de cartes côte à côte. `h` : la hauteur d'une petite carte ; `gap` : l'espace entre deux ; `top` : l'espace
// avant la première.
export const CREW = Object.freeze({ h: 36, gap: 4, top: 14 }); // `top` : la place du bouton de repli, qui déborde sous la carte

// Les cartes placées et les traits : { entries: [{ item, depth, x, y, h, folded, person }], paths: [chemin SVG], width, height }.
// `box` : { w, h, gx, gy } (la carte, l'espace entre deux cartes d'un étage et entre deux étages) ; `open` : l'ensemble des identifiants dépliés. Un élément
// replié est une feuille (`folded` : combien d'enfants il cache) ; ses personnes se cachent avec lui. Une structure sans sous-structure montre toujours ses
// personnes. L'étage d'en dessous commence sous la pile des personnes.
export function layoutOrg(roots, { box, open }) {
  const entries = [];
  const paths = [];
  let leaf = 0;
  let bottom = 0;
  const place = (item, depth, top) => {
    const unfolded = open.has(item.id);
    const crew = unfolded || item.ch.length === 0 ? (item.people || []) : [];
    const stack = crew.length ? CREW.top + crew.length * (CREW.h + CREW.gap) : 0;
    const kids = unfolded ? item.ch : [];
    const placed = kids.map(child => place(child, depth + 1, top + box.h + stack + box.gy));
    const entry = { item, depth, x: placed.length ? (placed[0].x + placed.at(-1).x) / 2 : leaf * (box.w + box.gx), y: top, h: box.h, stack,
      folded: unfolded ? 0 : item.ch.length };
    if (!placed.length) leaf++;
    entries.push(entry);
    crew.forEach((person, i) => entries.push({ item: person, depth: depth + 1, x: entry.x, y: top + box.h + CREW.top + i * (CREW.h + CREW.gap), h: CREW.h,
      stack: 0,
      folded: 0, person: true }));
    bottom = Math.max(bottom, top + box.h + stack);
    if (placed.length) paths.push(...links(entry, placed, box));
    return entry;
  };
  roots.forEach(root => place(root, 0, 0));
  return { entries, paths, width: Math.max(0, leaf * (box.w + box.gx) - box.gx), height: bottom };
}

// Les traits d'un parent à ses enfants : un trait vers le bas, une barre au-dessus des enfants, un trait vers le bas pour chacun.
function links(parent, kids, box) {
  const centre = entry => entry.x + box.w / 2;
  const down = parent.y + box.h + parent.stack;
  const mid = down + box.gy / 2;
  const bar = kids.length > 1 ? `M${centre(kids[0])} ${mid}H${centre(kids.at(-1))}` : '';
  return [`M${centre(parent)} ${down}V${mid}${bar}`, ...kids.map(kid => `M${centre(kid)} ${mid}V${kid.y}`)];
}

// Les zooms que les boutons proposent, du plus petit au plus grand ; `step` rend le suivant (ou le même au bord).
export const ZOOMS = Object.freeze([0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5]);
export function step(zoom, direction) {
  const next = direction > 0 ? ZOOMS.find(each => each > zoom + 1e-9) : ZOOMS.findLast(each => each < zoom - 1e-9);
  return next || (direction > 0 ? ZOOMS.at(-1) : ZOOMS[0]);
}

// Le zoom qui fait tenir un dessin de `size` dans `view` (au plus 1 : un petit organigramme n'est pas agrandi), le plus proche des zooms proposés par-dessous.
export function fitZoom(size, view) {
  if (!size.width || !size.height) return 1;
  const wanted = Math.min(1, view.width / size.width, view.height / size.height);
  const fits = ZOOMS.filter(each => each <= wanted + 1e-9);
  return fits.length ? fits.at(-1) : ZOOMS[0];
}
