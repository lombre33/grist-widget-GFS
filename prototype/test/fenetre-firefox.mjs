// Ce que les essais d'une fenêtre sous Firefox ont en commun (test/partager-recevoir-firefox.mjs, test/partager-autre-firefox.mjs) : la mesure d'une fenêtre ouverte (tient dans la page, titre et boutons en place,
// rien qui sorte, clavier dedans), et les gestes à la vraie souris qui l'attendent, la pressent et en vérifient la mise en page.
import { delay } from './corbeille-firefox.mjs';

// Un nom de document assez long pour que la fenêtre le coupe si elle ne le laisse pas passer à la ligne.
export const LONG_DOC = 'Essai de réception du service de la comptabilité fournisseurs de la région Nord-Est';

// Ce que la page montre d'une fenêtre (`selector`, avec son corps `bodySelector`) ; elle s'exécute dans la page : rien d'extérieur n'y est visible, tout passe par les arguments.
// `fields` : { nom: [sélecteur dans la fenêtre, 'value' | 'text'] } ce qui est propre à cette fenêtre ; `globals` : { nom: [propriété de `window`, valeur si elle manque] } les actes que le parcours a notés.
export function windowMeasure(selector, bodySelector, fields, globals) {
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const out = { modal: null };
  for (const [key, [name, fallback]] of Object.entries(globals)) out[key] = window[name] || fallback;
  const modal = document.querySelector(selector);
  if (!modal) return out;
  const box = modal.getBoundingClientRect();
  const head = modal.querySelector('.mod-head').getBoundingClientRect();
  const foot = modal.querySelector('.mod-foot').getBoundingClientRect();
  const active = document.activeElement;
  const outside = node => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); };
  out.modal = {
    title: text(modal.querySelector('.mod-head')), body: text(modal.querySelector(bodySelector)), note: text(modal.querySelector('.mod-note')), focus: active && active.dataset ? active.dataset.fk || null : null, inside: modal.contains(active),
    inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1,
    sticky: head.bottom <= foot.top + 1 && foot.bottom <= box.bottom + 1 && head.top >= box.top - 1,
    outside: [...modal.querySelectorAll(`${bodySelector} *, .mod-foot *, .mod-head *`)].filter(outside).map(node => node.className || node.tagName).slice(0, 5),
    keys: [...modal.querySelectorAll('[data-fk]')].map(node => node.dataset.fk), greyed: [...modal.querySelectorAll('[aria-disabled="true"]')].map(node => node.dataset.fk),
  };
  for (const [key, [pick, kind]] of Object.entries(fields)) {
    const node = modal.querySelector(pick);
    out.modal[key] = kind === 'value' ? (node ? node.value : null) : text(node);
  }
  return out;
}

// Le centre, à l'écran, de l'élément que désigne ce sélecteur, amené dans la page.
export const centerOf = selector => { const node = document.querySelector(selector); if (!node) return null; node.scrollIntoView({ block: 'nearest' }); const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };

// Les gestes d'un essai de fenêtre : attendre un état (`snap` le mesure), presser une commande par sa clé `data-fk` à la vraie souris, vérifier qu'un écran tient.
export function windowTools(page, run, snap) {
  const expect = async (kind, what, test) => {
    let now = await snap();
    for (let i = 0; i < 40 && !test(now); i += 1) { await delay(75); now = await snap(); }
    if (!test(now)) run.note(kind, `${what} (état : ${JSON.stringify({ ...now, modal: now.modal && { ...now.modal, body: String(now.modal.body).slice(0, 90) } }).slice(0, 700)})`);
    return now;
  };
  const press = async (kind, key) => { const at = await page.run(centerOf, `[data-fk="${key}"]`); if (!at) { run.note(kind, `« ${key} » devait être dans la fenêtre`); return false; } await page.click(...at); return true; };
  // L'écran d'une fenêtre qui tient : dans la page, titre et boutons en place, rien qui sorte.
  const fits = (kind, now, what) => {
    if (!now.modal) return;
    if (!now.modal.inPage) run.note(kind, `${what} : la fenêtre devait tenir dans la page`);
    if (!now.modal.sticky) run.note(kind, `${what} : le titre et les boutons devaient rester en place`);
    if (now.modal.outside.length) run.note(kind, `${what} : rien ne devait sortir de la fenêtre (sort : ${now.modal.outside.join(', ')})`);
  };
  return { expect, press, fits };
}
