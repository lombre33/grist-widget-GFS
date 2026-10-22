// Le trait d'un séparateur resté seul au bord d'une ligne de la barre d'outils de Publipostage+ (`d52e40b`, l'app à 865afa3), dans GFS, dans un vrai Grist (grist-static) : quand les boutons passent à la ligne, un petit
// trait pâle ne doit pas rester seul au début ou au bout d'une ligne (la page d'état de l'app le demande dans un panneau d'environ 800 px de large). La passe ouvre un modèle, puis, pour chaque largeur de panneau de 400 à 1000 px
// (de 40 en 40, 600 et 800 compris, à 400 px de haut) et chaque bord de la barre de GFS (la barre change la place de la barre d'outils : `ToolbarGap` en tient compte), relève dans les trois rangées de la barre d'outils
// (modèle et export, champs de l'email, mise en forme) chaque séparateur (`.bar-sep`, `.v2-sep`) qui est au début ou au bout de sa ligne et vérifie qu'il est caché (`visibility: hidden`) ; elle compte aussi ceux qu'elle a vus
// cachés, pour que la mesure prouve qu'elle voit des traits seuls. LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { placeBar, EDGES } from './barre-lab.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `trait-seul-${lang}-${scheme}`;
const OPEN = 'Contrat de prestation';
const WIDTHS = Array.from({ length: 16 }, (_, i) => 400 + 40 * i);

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const errors = [];
page.on('pageerror', error => errors.push(String(error && error.message).slice(0, 160)));
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
const frame = lab.frame;
await frame.locator('.ls-row', { hasText: OPEN }).first().waitFor({ timeout: 30000 }).catch(() => {});
const app = await lab.openApp('publipostage', /\/apps\/publipostage\//, frame);
await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
await page.waitForTimeout(1500);

// Les séparateurs au bord d'une ligne de chaque rangée : combien l'app en a cachés, et lesquels restent visibles (ce qui ne doit pas arriver).
const edgeSeparators = () => app.evaluate(() => {
  const ROWS = ['#toolbar-top .bar-row', '#toolbar-top #v2-email-fields-row', '#toolbar-top #v2-toolbar'];
  const out = { lignes: 0, caches: 0, visibles: [] };
  ROWS.map(selector => document.querySelector(selector)).filter(row => row && getComputedStyle(row).display !== 'none').forEach((row, index) => {
    const units = [];
    Array.from(row.children).forEach(child => { if (child.matches('.action-cluster')) units.push(...child.children); else units.push(child); });
    const lines = [];
    units.filter(el => { const style = getComputedStyle(el); return style.display !== 'none' && style.position !== 'absolute' && style.position !== 'fixed'; }).forEach(el => {
      const rect = el.getBoundingClientRect();
      const middle = (rect.top + rect.bottom) / 2;
      const line = lines[lines.length - 1];
      if (line && Math.abs(middle - line.middle) < line.half) line.items.push(el); else lines.push({ middle, half: (rect.bottom - rect.top) / 2, items: [el] });
    });
    out.lignes += lines.length;
    lines.forEach(line => [line.items[0], line.items[line.items.length - 1]].forEach(el => {
      if (!el.matches('.bar-sep, .v2-sep')) return;
      if (getComputedStyle(el).visibility === 'hidden') out.caches += 1;
      else out.visibles.push(`${row.id || 'rangée ' + (index + 1)} → ${el.className}`);
    }));
  });
  return out;
});

const visible = [];
let hidden = 0;
let measured = 0;
for (const edge of EDGES) {
  await placeBar(lab, frame, edge, lang);
  for (const width of WIDTHS) {
    await lab.fitPanel(undefined, width, 400);
    await page.waitForTimeout(500);
    const seen = await edgeSeparators();
    measured += 1;
    hidden += seen.caches;
    if (seen.visibles.length) visible.push({ bord: edge, largeur: width, seul: seen.visibles });
    if (width === 800 || width === 600) say(`   ${edge}, ${width} px : ${seen.lignes} ligne(s) de rangée, ${seen.caches} trait(s) seul(s) caché(s), ${seen.visibles.length} visible(s)`);
  }
  await lab.shotPanel(run, `800-${edge}`, frame).catch(() => {});
}
check(`aucun trait seul visible au bord d'une ligne de la barre d'outils : ${measured} mesures (${WIDTHS.length} largeurs de 400 à 1000 px, aux quatre bords de la barre de GFS)`, visible.length === 0, visible.slice(0, 6));
check(`la mesure voit des traits seuls : l'app en a caché ${hidden} (sinon elle ne prouverait rien)`, hidden > 0, { hidden });
// Le détecteur est éprouvé : la classe qui cache le trait retirée à la main (à 800 px, la barre à gauche), la même mesure voit les traits seuls.
await placeBar(lab, frame, 'gauche', lang);
await lab.fitPanel(undefined, 800, 400);
await page.waitForTimeout(700);
await app.evaluate(() => document.querySelectorAll('.pp-sep-alone').forEach(el => el.classList.remove('pp-sep-alone')));
const naked = await edgeSeparators();
check(`le détecteur est éprouvé : la classe qui cache le trait retirée à la main, la même mesure voit ${naked.visibles.length} trait(s) seul(s) à 800 px`, naked.visibles.length > 0, naked);
check('aucune erreur de page pendant la passe', errors.length === 0, errors);
await lab.browser.close();
