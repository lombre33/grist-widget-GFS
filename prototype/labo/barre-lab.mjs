// La barre de GFS devant une app (contrats 5.2, point 7), dans un vrai Grist : ce qu'elle recouvre de l'app à chaque bord. Repris par run-barre-publipostage.mjs et
// run-barre-apps.mjs. Le cadre de l'app remplit la scène de GFS : la barre et les contrôles de l'app se mesurent dans le même repère.
import { say, check } from './lab-common.mjs';

export const EDGES = ['gauche', 'haut', 'droite', 'bas'];
const EDGE_NAMES = { fr: { gauche: 'À gauche', haut: 'En haut', droite: 'À droite', bas: 'En bas' }, en: { gauche: 'Left', haut: 'Top', droite: 'Right', bas: 'Bottom' } };

// La place de la barre d'après le contrat (5.2, point 7) : 34 × 124 px au bord gauche ou droit, 124 × 34 en haut ou en bas, à 4 px du bord et centrée sur lui. Une app que GFS
// ne référence pas encore se mesure seule dans la section, la barre posée là par le calcul ; dans GFS, chaque mesure vérifie que la vraie barre est à cette place.
const BAR = { long: 124, court: 34, marge: 4 };
export function barRect(edge, { largeur, hauteur }) {
  const { long, court, marge } = BAR;
  if (edge === 'gauche' || edge === 'droite') return { x: edge === 'gauche' ? marge : largeur - marge - court, y: Math.round((hauteur - long) / 2), largeur: court, hauteur: long };
  return { x: Math.round((largeur - long) / 2), y: edge === 'haut' ? marge : hauteur - marge - court, largeur: long, hauteur: court };
}
const sameRect = (a, b) => ['x', 'y', 'largeur', 'hauteur'].every(k => Math.abs(a[k] - b[k]) <= 1);

export const dockRect = frame => frame.evaluate(() => {
  const r = document.getElementById('floaters').getBoundingClientRect();
  const s = document.getElementById('stage').getBoundingClientRect();
  return { x: r.left - s.left, y: r.top - s.top, largeur: r.width, hauteur: r.height };
});
export const dockEdge = frame => frame.evaluate(() => { const d = document.getElementById('floaters'); return { edge: d.dataset.edge, visible: !d.hidden }; });

// Ce que l'app montre près des bords, avec son rectangle dans le cadre de l'app : les contrôles qu'une main peut atteindre (boutons, champs, liens, onglets, zones d'écriture ou de
// dessin), et les panneaux qu'elle pose par-dessus son contenu (menus, bulles, journaux : position fixe ou absolue, un fond, un bord ou une ombre ; fenêtres : la boîte peinte
// posée dans un voile fixe qui couvre le cadre), hors des voiles eux-mêmes et hors d'un panneau déjà compté. `group` : un sélecteur CSS ; chaque élément qu'il contient reçoit `groupe: true`
// (la barre d'outils d'une app, pour la dire à part) ; chaque part porte aussi ses `classes` (pour en écarter un fond). `extra` : des sélecteurs de plus, pour ce que l'app montre sans en faire un contrôle (un logo, une pastille).
export const appParts = (app, { group = null, extra = '' } = {}) => app.evaluate(({ group, extra }) => {
  const label = el => (el.getAttribute('aria-label') || el.title || el.textContent || el.id || String(el.className || '') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
  const shown = (el, r) => {
    const style = getComputedStyle(el);
    return r.width >= 2 && r.height >= 2 && style.visibility !== 'hidden' && style.display !== 'none' && !el.closest('[hidden]');
  };
  const classes = el => (typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '');
  const part = (el, r) => ({ nom: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} « ${label(el)} »`, x: r.left, y: r.top, largeur: r.width, hauteur: r.height, groupe: Boolean(group) && Boolean(el.closest(group)), classes: classes(el) });
  const wanted = 'button, [role="button"], [role="tab"], input, select, textarea, a[href], summary, [contenteditable="true"], .ProseMirror, [tabindex="0"], [draggable="true"], canvas' + (extra ? `, ${extra}` : '');
  const controls = [...document.querySelectorAll(wanted)].map(el => [el, el.getBoundingClientRect()]).filter(([el, r]) => shown(el, r)).map(([el, r]) => part(el, r));
  const frameArea = innerWidth * innerHeight;
  const area = el => { const r = el.getBoundingClientRect(); return r.width * r.height; };
  const veil = el => el && el !== document.body && getComputedStyle(el).position === 'fixed' && area(el) >= 0.8 * frameArea;
  const isPanel = (el) => {
    const style = getComputedStyle(el);
    if (style.position !== 'fixed' && style.position !== 'absolute' && !veil(el.parentElement)) return false;
    const painted = !/rgba\(0, 0, 0, 0\)|transparent/.test(style.backgroundColor) || style.boxShadow !== 'none' || parseFloat(style.borderTopWidth) > 0;
    const r = el.getBoundingClientRect();
    return painted && r.width >= 40 && r.height >= 20 && r.width * r.height < 0.8 * frameArea && shown(el, r);
  };
  const found = [...document.body.querySelectorAll('*')].filter(isPanel);
  const outer = found.filter(el => !found.some(other => other !== el && other.contains(el)));
  return { controls, panels: outer.map(el => part(el, el.getBoundingClientRect())) };
}, { group, extra });

const overlap = (a, b) => {
  const w = Math.min(a.x + a.largeur, b.x + b.largeur) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.hauteur, b.y + b.hauteur) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};
const centerIn = (a, b) => a.x + a.largeur / 2 >= b.x && a.x + a.largeur / 2 <= b.x + b.largeur && a.y + a.hauteur / 2 >= b.y && a.y + a.hauteur / 2 <= b.y + b.hauteur;

// Place la barre au bord `edge` par son menu « Position de la barre », à la vraie souris.
export async function placeBar(lab, frame, edge, lang) {
  if ((await dockEdge(frame)).edge === edge) return;
  await frame.locator('#floater-place').click();
  await frame.locator('.menu .menu-item', { hasText: new RegExp(`^${EDGE_NAMES[lang][edge]}$`) }).click();
  await lab.page.waitForTimeout(500);
}

// Une app seule : la place de la barre dessinée dans la page de Grist, par-dessus le cadre de l'app, le temps d'une capture (rien n'est posé dans l'app).
async function drawBar(lab, app, rect) {
  const box = await (await app.frameElement()).boundingBox();
  await lab.page.evaluate(({ x, y, w, h }) => {
    const mark = document.createElement('div');
    mark.id = 'labo-place-barre';
    Object.assign(mark.style, { position: 'fixed', left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, boxSizing: 'border-box', border: '2px dashed #c62828', borderRadius: '6px', background: 'rgba(198, 40, 40, .12)', zIndex: '2147483647', pointerEvents: 'none' });
    document.body.appendChild(mark);
  }, { x: box.x + rect.x, y: box.y + rect.y, w: rect.largeur, h: rect.hauteur });
}
const eraseBar = lab => lab.page.evaluate(() => document.getElementById('labo-place-barre')?.remove());

// Pour chaque bord : la barre y est (vérifié, à la place que dit le contrat), ce qu'elle recouvre de l'app (dit, en pourcentage de chaque contrôle ou panneau, « centre » quand son
// milieu est dessous), une capture. `frame` : le cadre de GFS ; `null` pour une app seule dans la section (la barre posée par le calcul, dessinée sur la capture). `screen` nomme
// l'écran de l'app mesuré, dans les lignes et les captures. Rend { gauche: { controles: [ « contrôle n % » ], panneaux: [ … ] }, … }.
export async function measureEdges({ lab, frame, app, run, lang, screen = '' }) {
  const at = screen ? `${screen}, ` : '';
  const first = await appParts(app);
  const size = await app.evaluate(() => ({ largeur: innerWidth, hauteur: innerHeight }));
  say(`${at}l'app montre ${first.controls.length} contrôles et ${first.panels.length} panneaux à ${size.largeur} × ${size.hauteur}${frame ? '' : ', seule (barre posée par le calcul)'}`);
  const under = (items, rect) => items
    .map(c => ({ ...c, part: Math.round((100 * overlap(c, rect)) / (c.largeur * c.hauteur)), centre: centerIn(c, rect) }))
    .filter(c => c.part > 0)
    .map(c => `${c.nom} ${c.part} %${c.centre ? ' (centre)' : ''}`);
  const result = {};
  for (const edge of EDGES) {
    let rect = barRect(edge, size);
    if (frame) {
      await placeBar(lab, frame, edge, lang);
      rect = await dockRect(frame);
      const now = await dockEdge(frame);
      check(`${at}${edge} : la barre est à l'écran à ce bord, à la place que dit le contrat`, now.visible && now.edge === edge && sameRect(rect, barRect(edge, size)), { mesuree: rect, contrat: barRect(edge, size) });
    }
    const parts = await appParts(app);
    result[edge] = { controles: under(parts.controls, rect), panneaux: under(parts.panels, rect) };
    say(`${at}bord ${edge} : la barre (${Math.round(rect.largeur)} × ${Math.round(rect.hauteur)} à x ${Math.round(rect.x)}, y ${Math.round(rect.y)}) recouvre ${result[edge].controles.length} contrôle(s) et ${result[edge].panneaux.length} panneau(x) de l'app :`, result[edge]);
    if (!frame) await drawBar(lab, app, rect);
    await lab.shotPanel(run, `${screen ? screen + '-' : ''}bord-${edge}`, frame || app);
    if (!frame) await eraseBar(lab);
  }
  return result;
}
