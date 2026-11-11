// « Créer un graphique… » de Publipostage+ (extension « Graphique ») dans un vrai Grist (grist-static), avec la vraie app, celle que GFS référence, à 700 × 400, à la vraie souris et au vrai
// clavier (Playwright : événements du pointeur et du clavier du navigateur, jamais dispatchEvent). LAB_LANG=fr|en, LAB_SCHEME=light|dark, LAB_MODE=cdn|vendorise (le mode de l'extension).
//   1. La fenêtre « Apps et extensions » : l'extension exige DEUX bibliothèques (Plotly, pour le graphique de la page ; ECharts 6.1.0, pour les graphiques créés dans le modèle : demande de
//      Publipostage+ du 02/11) ; la personne la coche et choisit son mode ; GFS donne les deux à l'app, à l'adresse et avec l'empreinte de son catalogue ; rien n'est demandé avant le premier usage.
//   2. La fenêtre « Créer un graphique… » de l'app : une table du document, « Toute la table » ; l'aperçu est une vraie image (PNG peint, pas « Aperçu indisponible »), le navigateur contrôle
//      l'empreinte du script (CDN : octets exacts du catalogue ; copie : le fichier de GFS), la politique de sécurité de l'app laisse passer l'adresse, UNE seule demande part ; les trois
//      formes que seul ECharts dessine (radar, entonnoir, jauge) se dessinent aussi.
//   3. « Insérer » pose le graphique dessiné dans le cadre de l'éditeur ; le modèle ne garde que sa définition.
// LAB_SANS_ECHARTS=1 rejoue l'état d'AVANT la demande (le manifeste de GFS sans ECharts pour l'extension) : la passe doit alors ÉCHOUER aux contrôles qui suivent la mise à disposition.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startLab } from './lab-setup.mjs';
import { say, check, LAB } from './lab-common.mjs';
import { readCatalogue, resolveLibraries, forContext } from '../js/apps/libraries.js';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const mode = process.env.LAB_MODE === 'vendorise' ? 'vendorise' : 'cdn';
const before = process.env.LAB_SANS_ECHARTS === '1';
const run = `graphique-${mode}${before ? '-avant' : ''}-${lang}-${scheme}`;
const FK = 'ext:publipostage/graphique';
const GFS_BASE = 'http://127.0.0.1:8911/prototype/';
const WORDS = lang === 'fr'
  ? { row: 'Créer un graphique…', title: 'Créer un graphique', insert: 'Insérer', whole: 'Toute la table', kinds: { radar: 'Radar', funnel: 'Entonnoir', gauge: 'Jauge' }, unavailable: /Aperçu indisponible/ }
  : { row: 'Create a chart…', title: 'Create a chart', insert: 'Insert', whole: 'Whole table', kinds: { radar: 'Radar', funnel: 'Funnel', gauge: 'Gauge' }, unavailable: /Preview unavailable/ };
const catalogue = readCatalogue(JSON.parse(readFileSync(join(LAB, '..', 'bibliotheques', 'catalogue.json'), 'utf8')));
const declared = JSON.parse(readFileSync(join(LAB, '..', 'manifestes', 'publipostage.json'), 'utf8')).extensions.find(extension => extension.id === 'graphique');
// Ce que GFS doit donner à l'app pour ce mode, lu dans son catalogue (la même fonction que GFS) ; les deux adresses sont aussi écrites, de mémoire de la demande, pour ne pas se fier qu'à elle.
const expected = forContext(resolveLibraries(catalogue, declared.bibliotheques, () => mode, GFS_BASE).libraries);
const ECHARTS = mode === 'cdn' ? 'https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js' : `${GFS_BASE}vendor/echarts/6.1.0/dist/echarts.min.js`;

const lab = await startLab({
  lang, colorScheme: scheme,
  patches: before ? [{ chemin: '/prototype/manifestes/publipostage.json', de: ', { "id": "echarts", "version": "6.1.0" }', vers: '' }] : [],
});
const { page } = lab;
const gfs = lab.frame;
const requests = [];
const warnings = [];
page.on('request', request => { if (/echarts/i.test(request.url())) requests.push(request.url()); });
page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text().slice(0, 240)); });
page.on('pageerror', error => warnings.push(`pageerror : ${error.message.slice(0, 240)}`));
await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', event => window.__csp.push(`${event.violatedDirective} ${event.blockedURI}`)); });
await lab.fitPanel(undefined, 700, 400);

// Une table de données du document, à tracer (la personne l'a dans son Grist ; GFS n'y touche pas).
await gfs.evaluate(() => grist.docApi.applyUserActions([
  ['AddTable', 'GfVentes', [{ id: 'Client', type: 'Text' }, { id: 'Montant', type: 'Numeric' }, { id: 'Cout', type: 'Numeric' }]],
  ['BulkAddRecord', 'GfVentes', [null, null, null, null], { Client: ['Dupont', 'Martin', 'Bernard', 'Petit'], Montant: [120, 90, 150, 60], Cout: [80, 70, 100, 40] }],
]));
const app = await lab.openApp('publipostage');
const tables = app.getByRole('button', { name: /Create the tables|Créer les tables/ });
await tables.first().waitFor({ timeout: 30000 });
await tables.first().click();
await app.locator('#editor-container .ProseMirror').waitFor();
await page.waitForTimeout(3000);

// ----- Les gestes de l'app, à la vraie souris.
const WIN = '#pp-chartmake-modal';
const centerOf = async selector => {
  const box = await app.locator(selector).first().boundingBox();
  if (!box || !box.width) throw new Error(`introuvable ou masqué : ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, w: box.width };
};
const click = async selector => {
  const c = await centerOf(selector);
  await page.mouse.move(c.x - 20, c.y);
  await page.mouse.move(c.x, c.y, { steps: 3 });
  await page.waitForTimeout(50);
  await page.mouse.click(c.x, c.y);
};
// Le clic au centre du libellé d'une case ou d'une forme (la case seule est trop petite pour une souris).
const clickLabelOf = async inputSelector => {
  const box = await app.locator(inputSelector).first().locator('xpath=ancestor::label[1]').boundingBox();
  const x = box.x + Math.min(box.width / 2, 40);
  const y = box.y + box.height / 2;
  await page.mouse.move(x - 15, y);
  await page.mouse.move(x, y, { steps: 3 });
  await page.waitForTimeout(50);
  await page.mouse.click(x, y);
  await page.waitForTimeout(120);
};
// La souris descend du bouton « Image » jusqu'à la ligne de son menu sans quitter le menu.
async function hoverRow(parent, row) {
  const p = await centerOf(parent);
  await page.mouse.move(p.x - 25, p.y);
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.waitForTimeout(600);
  const r = await centerOf(row);
  const inRow = Math.min(Math.max(p.x, r.x - r.w / 2 + 6), r.x + r.w / 2 - 6);
  await page.mouse.move(inRow, p.y + 10, { steps: 2 });
  await page.mouse.move(inRow, r.y, { steps: 6 });
  await page.mouse.move(r.x, r.y, { steps: 4 });
  await page.waitForTimeout(200);
  return r;
}
const windowOpen = () => app.evaluate(() => { const modal = document.getElementById('pp-chartmake-modal'); return Boolean(modal) && modal.style.display !== 'none'; });
// L'aperçu, quand il a fini de se dessiner : son état (`chart` = dessiné), l'image et le message qui le remplace.
async function preview() {
  await page.waitForTimeout(260);
  await app.waitForFunction(() => { const paper = document.querySelector('#pp-chartmake-modal .pp-chart-paper'); return Boolean(paper) && Boolean(paper.dataset.state) && paper.dataset.state !== 'loading'; }, null, { timeout: 25000 });
  await page.waitForTimeout(120);
  return app.evaluate(() => {
    const image = document.querySelector('#pp-chartmake-modal .pp-chart-image');
    return {
      state: document.querySelector('#pp-chartmake-modal .pp-chart-paper').dataset.state, src: image.getAttribute('src') || '', natural: [image.naturalWidth, image.naturalHeight],
      message: document.querySelector('#pp-chartmake-modal .pp-chart-message').textContent.trim(), ok: !document.querySelector('#pp-chartmake-modal .var-modal-primary').disabled,
    };
  });
}
// La part de l'image qui n'est pas blanche, en % : un graphique peint en a, un cadre vide n'en a pas.
const painted = uri => app.evaluate(async source => {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let count = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) count += 1;
  return Math.round((count / (canvas.width * canvas.height)) * 10000) / 100;
}, uri).catch(() => 0);

// ----- 1. La fenêtre « Apps et extensions » : l'extension, ses deux bibliothèques, son mode.
await gfs.locator('#floater-apps').click();
await gfs.locator('.mod').waitFor();
const row = gfs.locator(`[data-row="${FK}"]`);
const legend = (await row.locator('legend').innerText()).replace(/\s+/g, ' ');
const sizes = await row.locator('.sz').allInnerTexts();
say('la ligne dans la fenêtre :', (await row.innerText()).replace(/\s+/g, ' '));
check('la ligne de l\'extension nomme ses DEUX bibliothèques (Plotly, ECharts), chacune avec son poids, et dit le sien du manifeste',
  /Plotly/i.test(legend) && /E-?charts/i.test(legend) && (legend.match(/≈\s[\d\u00a0\u202f.,]+\s(Ko|Mo|KB|MB)/g) || []).length === 2 && sizes.length === 1 && new RegExp(`^≈\\s${declared.poids}\\s(Ko|KB)$`).test(sizes[0].trim()), `${legend} | ${sizes}`);
await gfs.locator(`[data-fk="${FK}"]`).check();
await lab.settle(gfs);
if (mode === 'vendorise') {
  await row.locator('.rd', { has: gfs.locator('input[value="vendorise"]') }).click();
  await lab.settle(gfs);
}
const chosen = await gfs.evaluate(() => [...document.querySelectorAll('input[data-mode-for="graphique"]')].map(input => ({ mode: input.value, checked: input.checked, disabled: input.disabled })));
check(`le mode ${mode === 'cdn' ? '« Depuis un CDN » (le défaut)' : '« Copie de GFS »'} est celui qui est coché, l'autre reste libre`,
  JSON.stringify(chosen) === JSON.stringify([{ mode: 'cdn', checked: mode === 'cdn', disabled: false }, { mode: 'vendorise', checked: mode === 'vendorise', disabled: false }]), chosen);
await lab.shotPanel(run, '1-fenetre-graphique');
await page.keyboard.press('Escape');
await app.waitForFunction(() => Extensions.isActive('graphique'), null, { timeout: 15000 });
const given = await app.evaluate(() => ({ echarts: GfsLink.library('echarts'), plotly: GfsLink.library('plotly') }));
check('GFS donne à l\'app ECharts (adresse, empreinte, forme) comme son catalogue le dit', Boolean(given.echarts) && given.echarts.src === ECHARTS && JSON.stringify(given.echarts) === JSON.stringify(expected.echarts), given.echarts);
check('GFS donne aussi Plotly, comme avant (le graphique de la page)', Boolean(given.plotly) && JSON.stringify(given.plotly) === JSON.stringify(expected.plotly), given.plotly);
check('rien n\'est demandé de la bibliothèque tant que la personne ne dessine pas', requests.length === 0, requests);

// ----- 2. La fenêtre « Créer un graphique… » : une table du document, toute la table, l'aperçu.
await app.locator('#editor-container .ProseMirror').click();
await page.keyboard.type('Bonjour', { delay: 15 });
await hoverRow('#v2-btn-image', '#v2-btn-chart-make');
const label = (await app.locator('#v2-btn-chart-make').innerText()).trim();
check(`la ligne « ${WORDS.row} » est dans le menu de l'Image, active`, label === WORDS.row && !(await app.locator('#v2-btn-chart-make').evaluate(node => node.classList.contains('v2-hover-row-disabled'))), label);
const target = await centerOf('#v2-btn-chart-make');
await page.mouse.click(target.x, target.y);
await app.waitForFunction(() => { const modal = document.getElementById('pp-chartmake-modal'); return Boolean(modal) && modal.style.display !== 'none'; }, null, { timeout: 15000 });
await preview();
check(`la fenêtre « ${WORDS.title} » s'ouvre`, (await app.locator('#pp-chartmake-title').innerText()).trim() === WORDS.title);
await click(`${WIN} .pp-chartmake-field:nth-child(1) .ss-trigger`);
await page.waitForTimeout(300);
await page.keyboard.type('vent', { delay: 15 });
await page.waitForTimeout(300);
await page.keyboard.press('Enter');
await preview();
await clickLabelOf(`${WIN} input[name="pp-chartmake-rows"][value="all"]`);
const first = await preview();
const text = first.message || '(aucun message)';
say('aperçu :', { state: first.state, natural: first.natural, message: text, requests });
await lab.shotPanel(run, '2-apercu');
check('l\'aperçu est dessiné : une image PNG, pas « Aperçu indisponible »', first.state === 'chart' && first.src.startsWith('data:image/png;base64,') && !WORDS.unavailable.test(first.message), { state: first.state, message: first.message });
const ink = await painted(first.src);
check('l\'image est peinte (axes, barres, texte), pas un cadre blanc', ink > 0.5, `${ink} % de pixels non blancs`);
check('« Insérer » s\'allume', first.ok);
check('le navigateur a demandé le fichier UNE fois, à l\'adresse que GFS a donnée', requests.length === 1 && requests[0] === ECHARTS, requests);
const script = await app.evaluate(() => [...document.scripts].filter(node => /echarts/.test(node.src)).map(node => ({ src: node.src, integrity: node.getAttribute('integrity'), crossorigin: node.crossOrigin })));
check('la balise du script porte l\'empreinte du catalogue, en anonyme (contrôlée pour de bon par le navigateur)', script.length === 1 && script[0].integrity === expected.echarts.integrite && script[0].crossorigin === 'anonymous', script);
check('la politique de sécurité de l\'app n\'a rien refusé', (await app.evaluate(() => window.__csp)).length === 0, await app.evaluate(() => window.__csp));

// ----- Les trois formes que seul ECharts dessine : un clic sur la forme, une image de plus.
const seen = new Set([first.src]);
for (const kind of ['radar', 'funnel', 'gauge']) {
  await clickLabelOf(`${WIN} input[name="pp-chartmake-kind"][value="${kind}"]`);
  const shape = await preview();
  const share = await painted(shape.src);
  check(`« ${WORDS.kinds[kind]} » se dessine : une autre image PNG, peinte`, shape.state === 'chart' && shape.src.startsWith('data:image/png;base64,') && !seen.has(shape.src) && share > 0.3, { state: shape.state, painted: share, message: shape.message });
  seen.add(shape.src);
}
await lab.shotPanel(run, '3-jauge');
check('toujours une seule demande du fichier (la bibliothèque reste chargée)', requests.length === 1, requests);

// ----- 3. « Insérer » : le graphique dessiné dans le cadre, le modèle ne garde que sa définition.
await clickLabelOf(`${WIN} input[name="pp-chartmake-kind"][value="bar"]`);
await preview();
await click(`${WIN} .var-modal-primary`);
await app.waitForFunction(() => document.querySelectorAll('.tiptap .editor-image-chart-placeholder.editor-image-chart-drawn img[src^="data:image/png"]').length === 1, null, { timeout: 25000 }).catch(() => {});
const inserted = await app.evaluate(() => {
  const frames = [...document.querySelectorAll('.tiptap .editor-image-chart-placeholder')].filter(node => !node.closest('.pp-slide-list'));
  const nodes = [...new DOMParser().parseFromString(Editor.getHTML(), 'text/html').querySelectorAll('img[data-chart-spec]')];
  return {
    frames: frames.map(node => ({ drawn: node.classList.contains('editor-image-chart-drawn'), src: (node.querySelector('img').getAttribute('src') || '').slice(0, 22) })),
    nodes: nodes.map(node => ({ spec: JSON.parse(node.getAttribute('data-chart-spec')), hasSrc: node.hasAttribute('src') })),
  };
});
await lab.shotPanel(run, '4-insere');
check('« Insérer » ferme la fenêtre et le graphique est dessiné dans le cadre', !(await windowOpen()) && inserted.frames.length === 1 && inserted.frames[0].drawn && inserted.frames[0].src === 'data:image/png;base64,', inserted);
check('le modèle ne garde que la définition (forme, table, étiquettes, colonnes), jamais l\'image', inserted.nodes.length === 1 && inserted.nodes[0].spec.kind === 'bar' && inserted.nodes[0].spec.table === 'GfVentes' && !inserted.nodes[0].hasSrc, inserted.nodes);
check('aucun avertissement de GFS ni de l\'aperçu, aucune erreur de page', warnings.filter(text => /^GFS|ChartMakeUi|pageerror/.test(text)).length === 0, warnings);
await lab.browser.close();
