// Construire du DOM sans jamais interpréter du texte comme du HTML : les noms de fichiers viennent du document, donc d'une personne.
// Les enfants sont des nœuds ou du texte (ajouté comme texte) ; aucun `innerHTML`.

// h('button', { class: 'btn', dataset: { id: 3 }, on: { click: fn }, vars: { '--d': 2 }, 'aria-pressed': false }, enfants…)
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'on') for (const [type, fn] of Object.entries(value)) el.addEventListener(type, fn);
    else if (key === 'vars') for (const [name, v] of Object.entries(value)) el.style.setProperty(name, String(v)); // CSSOM : permis sous `style-src 'self'`
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  el.append(...children.flat(Infinity).filter(child => child !== null && child !== undefined && child !== false));
  return el;
}

export const clear = el => { el.replaceChildren(); return el; };

// Texte pour une info-bulle ou un lecteur d'écran : jamais plus d'une ligne.
export const oneLine = value => String(value ?? '').replace(/\s+/g, ' ').trim();
