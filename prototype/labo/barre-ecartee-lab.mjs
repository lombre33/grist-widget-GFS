// Le rejeu de la barre de GFS devant Publipostage+ une fois sa consigne 025 faite (run-barre-ecartee.mjs) : les gestes à la vraie souris et les mesures que partagent ses scénarios. La zone est celle que l'app
// reçoit de GFS (`GfsBar.zone()`, contrats 5.2 point 7), jamais un chiffre : « rien ne passe sous la barre » veut dire qu'aucune partie de l'app n'en recouvre un pixel.
import { say, check } from './lab-common.mjs';
import { dockRect, dockEdge, placeBar, EDGES } from './barre-lab.mjs';

export const SIZES = [[700, 400], [560, 300], [700, 180]];
const EPSILON = 0.02; // la mise en page arrondit au 64e de pixel : ce que GFS ne peut pas mesurer

export const toRect = zone => ({ left: zone.x, top: zone.y, right: zone.x + zone.width, bottom: zone.y + zone.height });
export const partRect = part => ({ left: part.x, top: part.y, right: part.x + part.largeur, bottom: part.y + part.hauteur });
export const hits = (rect, zone) => Boolean(rect) && rect.left < zone.right - EPSILON && rect.right > zone.left + EPSILON && rect.top < zone.bottom - EPSILON && rect.bottom > zone.top + EPSILON;
export const inFrame = (rect, [width, height]) => rect.left >= -0.5 && rect.top >= -0.5 && rect.right <= width + 0.5 && rect.bottom <= height + 0.5;
export const show = rect => (rect ? [rect.left, rect.top, rect.right, rect.bottom].map(n => Math.round(n)).join(', ') : 'absent');
export const label = (name, rect) => `${name} ${show(rect)}`;
export const wait = (r, ms) => r.page.waitForTimeout(ms);
// Ce qu'un scénario rend : ce qu'il a mesuré, ce que la barre empêche d'ouvrir (`dessous`), ce qui recouvre la zone (`sur`, ce qui ne doit pas arriver) et ce qu'il faut noter.
export const none = () => ({ mesures: 0, dessous: [], sur: [], notes: [] });

// Ce que l'app croit de la barre : le bord et la zone en rectangle du cadre, ou null (barre masquée, explorateur ouvert).
export const readZone = app => app.evaluate(() => {
  const zone = GfsBar.zone();
  return zone ? { edge: GfsBar.edge(), left: zone.x, top: zone.y, right: zone.x + zone.width, bottom: zone.y + zone.height } : null;
});

// La barre telle que GFS la dessine, et la zone qu'il a envoyée : la zone est la barre agrandie de 4 px, rognée au cadre (la marge du contrat). Dit si le bord et la place concordent.
export async function barAgreesWithZone(frame, app) {
  const [dock, zone, shown] = [await dockRect(frame), await readZone(app), await dockEdge(frame)];
  if (!zone || !shown.visible) return { ok: false, dock, zone, shown };
  const size = await app.evaluate(() => [innerWidth, innerHeight]);
  const want = { left: Math.max(0, dock.x - 4), top: Math.max(0, dock.y - 4), right: Math.min(size[0], dock.x + dock.largeur + 4), bottom: Math.min(size[1], dock.y + dock.hauteur + 4) };
  const near = ['left', 'top', 'right', 'bottom'].every(side => Math.abs(want[side] - zone[side]) <= 1);
  const edges = { left: 'gauche', top: 'haut', right: 'droite', bottom: 'bas' };
  return { ok: near && edges[zone.edge] === shown.edge, dock, zone, shown };
}

// Un point du cadre de l'app, dans la page de Grist (la vraie souris y va) ; et « où le pointeur arriverait-il ? » : 'libre' (le cadre de l'app est sous le pointeur), 'barre' (un élément de GFS, la barre, est posé dessus)
// ou 'hors' (hors du cadre de l'app : plus bas que le panneau, ou sorti par le défilement : la barre n'y est pour rien).
export async function pagePoint(app, x, y) {
  const box = await (await app.frameElement()).boundingBox();
  return { x: box.x + x, y: box.y + y };
}
export async function whereIs(frame, app, x, y) {
  const [width, height] = await app.evaluate(() => [innerWidth, innerHeight]);
  if (x < 0 || y < 0 || x >= width || y >= height) return 'hors';
  const origin = await (await app.frameElement()).evaluate(el => { const box = el.getBoundingClientRect(); return { x: box.left, y: box.top }; });
  const free = await frame.evaluate(([px, py]) => { const el = document.elementFromPoint(px, py); return Boolean(el) && el.tagName === 'IFRAME'; }, [origin.x + x, origin.y + y]);
  return free ? 'libre' : 'barre';
}
export const reachable = async (frame, app, x, y) => (await whereIs(frame, app, x, y)) === 'libre';

// Le rectangle d'un élément de l'app (ou null : absent ou sans taille), dans le repère du cadre.
export const rectOf = (app, selector) => app.evaluate(sel => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom } : null;
}, selector);
export const centerOf = (app, selector) => app.evaluate(sel => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
}, selector);

// Les gestes d'une passe : la souris dans le cadre de l'app. `park` la range hors du cadre, sur la page de Grist à côté de lui : là aucun menu de l'app ne s'ouvre au survol (un coin du cadre en ouvrait un, qui recouvrait
// le bouton suivant) et ceux qui l'étaient se referment. `pressOutside` : un appui de la vraie souris dans le cadre, sur un endroit inerte (le coin d'état, à défaut le texte, à défaut un point quelconque
// sans contrôle, cherché sur une grille : dans un cadre bas, un menu ouvert peut couvrir le coin d'état et le texte être sous le cadre), qui referme un menu ouvert au clic.
export function hands({ page, frame, app, size, zone }) {
  const hand = {
    async move(x, y, steps = 1) { const at = await pagePoint(app, x, y); await page.mouse.move(at.x, at.y, { steps }); },
    // Un seul mouvement jusqu'au point, puis le clic : un chemin en deux temps depuis le coin du cadre traversait au passage « Type d'export » (menu au survol), dont le menu recouvrait la cible.
    async click(x, y) { const at = await pagePoint(app, x, y); await page.mouse.move(at.x, at.y); await page.waitForTimeout(60); await page.mouse.click(at.x, at.y); },
    async contextClick(x, y) { const at = await pagePoint(app, x, y); await page.mouse.move(at.x, at.y); await page.waitForTimeout(60); await page.mouse.click(at.x, at.y, { button: 'right' }); },
    async park() {
      const box = await (await app.frameElement()).boundingBox();
      await page.mouse.move(box.x >= 8 ? box.x - 6 : box.x + box.width + 6, box.y + 3);
      await page.waitForTimeout(150);
    },
    async pressOutside() {
      for (const selector of ['#status-msg', '.tiptap p']) {
        const at = await centerOf(app, selector);
        if (!at || (await whereIs(frame, app, at.x, at.y)) !== 'libre') continue;
        // Que rien d'autre ne soit posé là : un menu ouvert peut s'être décalé sur le coin d'état pour éviter la zone de la barre, et l'appui tomberait dans le menu au lieu de le fermer.
        const onTop = await app.evaluate(([sel, x, y]) => { const el = document.querySelector(sel); const top = document.elementFromPoint(x, y); return Boolean(el && top && (el === top || el.contains(top))); }, [selector, at.x, at.y]);
        if (!onTop) continue;
        await hand.click(at.x, at.y);
        return true;
      }
      for (let y = 8; y < size[1]; y += 24) {
        for (let x = 8; x < size[0]; x += 40) {
          if ((await whereIs(frame, app, x, y)) !== 'libre') continue;
          const inert = await app.evaluate(([px, py]) => {
            const top = document.elementFromPoint(px, py);
            return Boolean(top) && !top.closest('button, a, input, select, textarea, label, summary, [contenteditable], [role="menu"], [role="menuitem"], [role="button"], [role="option"], [tabindex], .pp-show-menu');
          }, [x, y]);
          if (!inert) continue;
          await hand.click(x, y);
          return true;
        }
      }
      return false;
    },
    reach: (x, y) => reachable(frame, app, x, y),
    where: (x, y) => whereIs(frame, app, x, y),
  };
  return hand;
}

// Attend qu'un élément de l'app ait une taille (ouvert), au plus `ms` ; rend sa boîte, ou null.
export async function shownRect(r, selector, ms = 2000) {
  for (let waited = 0; waited < ms; waited += 100) {
    const rect = await rectOf(r.app, selector);
    if (rect) return rect;
    await wait(r, 100);
  }
  return null;
}
// Ce qui recouvrait le dernier opener rendu 'couvert' (pour la note de `unopened`).
let coveredBy = null;
// Un opener cliqué à la vraie souris s'il est atteignable ; rend 'absent' (pas montré dans ce cadre), 'hors' (hors du cadre : sorti par le défilement ou plus bas que le panneau), 'dessous' (la barre le recouvre),
// 'couvert' (un autre élément de l'app le recouvre) ou 'clique'.
export async function clickOpener(r, selector) {
  let at = await centerOf(r.app, selector);
  if (!at) return 'absent';
  let where = await r.hand.where(at.x, at.y);
  if (where === 'hors') {
    // Un contenu du document qui a défilé hors de vue : la personne le fait défiler, le geste en fait autant.
    await r.app.evaluate(sel => { document.querySelector(sel).scrollIntoView({ block: 'center', inline: 'center' }); }, selector);
    await wait(r, 200);
    at = await centerOf(r.app, selector);
    where = at ? await r.hand.where(at.x, at.y) : 'hors';
  }
  if (where !== 'libre') return where === 'barre' ? 'dessous' : 'hors';
  // Rien d'autre de l'app n'est posé sur le bouton, à cet endroit (une liste trop basse pour le montrer, un menu ouvert, un panneau) : sinon le clic irait ailleurs, et la barre n'y est pour rien.
  const cover = await r.app.evaluate(([sel, x, y]) => {
    const el = document.querySelector(sel);
    const top = document.elementFromPoint(x, y);
    if (el && top && (el === top || el.contains(top))) return null;
    // Le plus proche ancêtre qui a un identifiant ou une classe, pour dire par quoi le bouton est recouvert.
    const named = top && (top.closest('[id], [class]') || top);
    return named ? `${named.tagName.toLowerCase()}${named.id ? '#' + named.id : ''}${typeof named.className === 'string' && named.className.trim() ? '.' + named.className.trim().split(/\s+/).join('.') : ''}` : 'rien';
  }, [selector, at.x, at.y]);
  coveredBy = cover;
  if (cover) return 'couvert';
  await r.hand.click(at.x, at.y);
  return 'clique';
}
// Ce qu'un scénario dit d'un geste qui n'a pas pu se faire : sous la barre (à part, c'est elle qui l'empêche), sinon une note (hors du cadre, pas montré).
export function unopened(out, state, name) {
  if (state === 'dessous') out.dessous.push(name);
  else out.notes.push(`${name} : ${state === 'hors' ? 'hors du cadre (la barre n\'y est pour rien)' : state === 'couvert' ? `recouvert par un autre élément de l'app, ${coveredBy} (la barre n'y est pour rien)` : 'pas montré dans ce cadre'}`);
}
// Du bouton d'un menu au survol à l'une de ses lignes sans quitter le menu (le pont de survol les relie) : tout droit sous le bouton, puis jusqu'à la ligne, puis le clic.
export async function clickRow(r, trigger, row) {
  const x = Math.min(Math.max(trigger.x, row.left + 6), row.right - 6);
  await r.hand.move(x, trigger.y + 10, 2);
  await r.hand.move(x, (row.top + row.bottom) / 2, 8);
  await r.hand.move((row.left + row.right) / 2, (row.top + row.bottom) / 2, 3);
  await r.page.mouse.down();
  await r.page.mouse.up();
}

// Ce que la consigne demande à chaque taille : tout à 700 × 400 et à 560 × 300 ; à 700 × 180 (le cadre bas), le logo et la sortie de la Lecture épurée (la page au repos, qui compte le logo, et la Lecture épurée), et « Présenter »
// (la barre masquée puis rendue vaut à toute taille). Le reste s'y mesure aussi, et se dit sans compter en échec.
const LOW_FRAME_ASKED = ['repos', 'lecture', 'presenter'];
export const asked = (size, part) => size[1] >= 300 || LOW_FRAME_ASKED.includes(part);

// Un scénario rendu : un contrôle (rien sur la zone), ce qu'il a mesuré et ce que la barre a empêché d'ouvrir, dits à part. `strict` faux : ce que la consigne ne demande pas à cette taille (700 × 180 n'est là que pour le
// logo et la sortie de la Lecture épurée) se dit, sans compter en échec.
export function judge(tag, name, out, strict = true) {
  const facts = [`${out.mesures} mesuré(s)`, out.dessous.length ? `${out.dessous.length} sous la barre` : ''].filter(Boolean).join(', ');
  if (strict) check(`${tag} · ${name} : rien ne recouvre la zone de la barre (${facts})`, out.sur.length === 0, out.sur);
  else say(`   ${tag} · ${name} (hors de ce que la consigne demande à cette taille) : ${out.sur.length ? `${out.sur.length} élément(s) recouvrent la zone` : 'rien ne recouvre la zone'} (${facts})`, out.sur.length ? out.sur : '');
  if (out.dessous.length) say(`   ${tag} · ${name} : la souris n'y va pas, la barre est dessus :`, out.dessous);
  if (out.notes.length) say(`   ${tag} · ${name} : à noter :`, out.notes);
}

// Chaque taille de cadre et chaque bord (SIZES=700x400,… EDGES=gauche,… pour n'en prendre que quelques-uns) : le cadre à cette taille, la barre à ce bord, un contrôle (la zone que l'app reçoit est la barre que GFS
// dessine, agrandie de 4 px), puis `{ tag, edge, r }` avec `r` : { page, frame, app, size, zone, hand }, la zone et les gestes de la passe. Un bord où l'app ne reçoit pas la zone n'est pas rendu (le contrôle l'a dit).
export async function* stands({ lab, page, frame, app, lang, onlySizes, onlyEdges }) {
  for (const [width, height] of SIZES) {
    if (onlySizes && !onlySizes.includes(`${width}x${height}`)) continue;
    await lab.fitPanel(undefined, width, height);
    await page.waitForTimeout(800);
    for (const edge of EDGES) {
      if (onlyEdges && !onlyEdges.includes(edge)) continue;
      const tag = `${width} × ${height}, ${edge}`;
      await placeBar(lab, frame, edge, lang);
      await page.waitForTimeout(400);
      const agree = await barAgreesWithZone(frame, app);
      check(`${tag} : la zone que l'app reçoit est la barre que GFS dessine, agrandie de 4 px`, agree.ok, agree);
      const real = await readZone(app);
      const bar = await dockRect(frame);
      // ZONE_PAD=40 : une zone agrandie de 40 px de chaque côté, pour s'assurer que les contrôles voient bien ce qui passe dessous (un contrôle qui ne peut pas échouer ne prouve rien).
      const pad = Number(process.env.ZONE_PAD) || 0;
      const zone = real && { ...real, left: real.left - pad, top: real.top - pad, right: real.right + pad, bottom: real.bottom + pad };
      const dock = { left: bar.x - pad, top: bar.y - pad, right: bar.x + bar.largeur + pad, bottom: bar.y + bar.hauteur + pad };
      if (zone) yield { tag, edge, r: { page, frame, app, size: [width, height], zone, dock, hand: hands({ page, frame, app, size: [width, height], zone }) } };
    }
  }
}
