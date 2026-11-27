// Le squelette de l'explorateur sous Firefox (27/11, demande du porteur : « une impression de fluidité à chaque ouverture » ; index.html `#boot`, css/gfs.css `.boot` ; règle du 03/11 : une interface se mesure aussi
// dans le navigateur du porteur). Une page fabriquée avec les vraies feuilles de style de GFS et le vrai squelette de `index.html`, ouverte dans un vrai Firefox sans écran à 700, 520 et 380 px de large, 400 de haut,
// en clair et en sombre : il remplit le cadre sans le dépasser, ses barres se voient sur l'en-tête, sur le volet et sur la liste, elles pulsent doucement, rien n'y déborde à gauche ni à droite, et il ne dit rien (aucun texte).
// Il passe sous le reste : `z-index` 0, sous les cadres des apps. Ce qui se passe avec un vrai Grist (première image avant l'explorateur, remplacement à 2 px près) : labo/run-squelette.mjs.
// Firefox absent : l'essai est SAUTÉ et le dit (`labo/installer-firefox.sh` le pose dans le cloud). Les captures sont dans `labo/shots/`.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { findFirefox, startFirefox, serveSite } from './firefox.mjs';

const binary = findFirefox();
const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sheets = [...index.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(match => match[0]).join('\n');
const from = index.indexOf('<div class="ex boot" id="boot"');
const skeleton = index.slice(from, index.indexOf('<div class="frames"'));
const PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Essai</title>\n${sheets}\n</head><body data-gfs="starting"><main class="stage" id="stage">\n${skeleton}\n</main></body></html>`;
const SHOTS = join(ROOT, 'labo', 'shots');

// Ce qui s'exécute dans la page : les mesures du squelette.
function measure() {
  const boot = document.getElementById('boot');
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const channels = text => (text.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const light = rgb => { const [r, g, b] = rgb.map(value => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [hi, lo] = [light(a), light(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const backgroundOf = node => { for (let at = node; at; at = at.parentElement) { const color = getComputedStyle(at).backgroundColor; if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color; } return 'rgb(255, 255, 255)'; };
  const bars = [...boot.querySelectorAll('.boot-bar')];
  const contrast = [['.ex-head', '.boot-title'], ['.ex-tree', '.boot-leaf'], ['.ex-main', '.boot-name']].map(([where, what]) => {
    const bar = boot.querySelector(`${where} ${what}`);
    return { where, shown: !!bar && bar.getBoundingClientRect().width > 0, ratio: bar ? Math.round(ratio(channels(getComputedStyle(bar).backgroundColor), channels(backgroundOf(bar.parentElement))) * 100) / 100 : 0 };
  });
  const root = document.documentElement;
  return {
    boot: box(boot), viewport: { width: innerWidth, height: innerHeight },
    head: box(boot.querySelector('.ex-head')), foot: box(boot.querySelector('.ex-foot')), tree: box(boot.querySelector('.ex-tree')),
    text: boot.textContent.trim(), zIndex: getComputedStyle(boot).zIndex, pointer: getComputedStyle(boot).pointerEvents, hidden: boot.getAttribute('aria-hidden'),
    barCount: bars.length, animated: bars.every(bar => getComputedStyle(bar).animationName === 'boot-pulse'), contrast,
    overflowX: [boot, ...boot.querySelectorAll('.ex-head, .ex-body, .ex-main, .ex-foot')].some(node => node.scrollWidth > node.clientWidth + 1), pageScrolls: root.scrollHeight > innerHeight + 1 || root.scrollWidth > innerWidth + 1,
    leavesShown: [...boot.querySelectorAll('.boot-leaf')].filter(leaf => leaf.getBoundingClientRect().width > 0).length,
  };
}

describe('le squelette de l\'explorateur sous Firefox', { skip: !binary && 'Firefox absent : `bash prototype/labo/installer-firefox.sh` le pose dans le cloud' }, () => {
  let firefox;
  let site;
  before(async () => {
    mkdirSync(SHOTS, { recursive: true });
    site = await serveSite(ROOT, { '/squelette-essai.html': PAGE });
    firefox = await startFirefox(binary);
    await firefox.page.goto(`${site.url}/squelette-essai.html`);
  });
  after(async () => {
    if (firefox) await firefox.close();
    if (site) await site.close();
  });

  for (const mode of ['light', 'dark']) {
    for (const width of [700, 520, 380]) {
      test(`${width} × 400, ${mode === 'dark' ? 'sombre' : 'clair'} : il remplit le cadre, ses barres se voient, rien ne déborde, il ne dit rien`, async () => {
        const { page } = firefox;
        await page.view({ width, height: 400, mode });
        await page.until(() => document.getElementById('boot') && document.getElementById('boot').getBoundingClientRect().width > 0);
        const m = await page.run(measure);
        writeFileSync(join(SHOTS, `squelette-firefox-${mode}-${width}.png`), await page.shot({ x: 0, y: 0, width, height: 400 }));
        assert.equal(m.hidden, 'true');
        assert.equal(m.text, '', 'aucun texte');
        assert.equal(m.zIndex, '0', 'sous les cadres des apps');
        assert.equal(m.pointer, 'none');
        assert.ok(Math.abs(m.boot.width - m.viewport.width) <= 1 && Math.abs(m.boot.height - m.viewport.height) <= 1, `il remplit le cadre : ${JSON.stringify(m.boot)} dans ${JSON.stringify(m.viewport)}`);
        assert.ok(m.head.top >= 0 && m.foot.bottom <= m.viewport.height + 1, `de haut en bas dans le cadre : ${JSON.stringify({ head: m.head, foot: m.foot })}`);
        assert.equal(m.overflowX, false, 'rien ne déborde sur les côtés');
        assert.equal(m.pageScrolls, false, 'la page ne défile pas');
        assert.ok(m.barCount >= 20, `de quoi occuper la grille : ${m.barCount} barres`);
        assert.equal(m.animated, true, 'les barres pulsent');
        for (const each of m.contrast.filter(item => item.shown)) assert.ok(each.ratio >= 1.1 && each.ratio <= 2.2, `barre visible mais douce sur ${each.where} : ${each.ratio}:1`);
        assert.ok(m.contrast.filter(item => item.shown).length >= 2, 'au moins l\'en-tête et la liste montrent des barres');
        if (width < 520) assert.equal(m.leavesShown, 0, 'le volet se replie comme celui de l\'explorateur');
        else assert.ok(m.leavesShown >= 5, 'le volet montre ses lignes');
      });
    }
  }
});
