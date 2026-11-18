// Les deux extensions de Grist-BI (ses demandes `d3-cloud` et `pdfjs`, acceptées par le porteur le 18/11), avec la VRAIE Grist-BI que GFS référence (92da65c), dans un vrai Grist (grist-static) : à la vraie
// souris, à 700 × 400. L'app branche ces bibliothèques depuis la consigne 019 (`js/extensions.js`, `GristBI.extensions`) : le labo mesure ce que GFS lui donne, que le fichier marche dans SON cadre, et que le
// chargeur de l'app suit les trois états (`inactive`, `active`, retirée) sans recharger, sa tuile « Nuage de mots » et son menu « Mots-clés des publications » restant grisés, jamais masqués, sans l'extension.
//   1. La fiche de Grist-BI : « Nuage de mots » et « Mots-clés des PDF », décochées au départ, chacune avec sa bibliothèque ; la copie de GFS est le seul mode (le CDN est grisé avec sa raison).
//   2. Décochées : l'app ne reçoit ni extension ni bibliothèque (`GfsLink.extensions()` vide, `GfsLink.library()` rend `null`).
//   3. Cochée, « Nuage de mots » : l'app (déjà ouverte) reçoit l'extension et d3-cloud seul, de la copie de GFS, forme « module », empreinte du catalogue ; pas pdf.js.
//   4. Dans le cadre de l'app (origine « null »), le fichier se charge par `<script type="module" integrity crossorigin>` : `GfsPaquets['d3-cloud']` porte `CloudLayout` par défaut, qui place des mots
//      (le vrai paquet, pas un faux) dans la boîte demandée.
//   5. Cochée, « Mots-clés des PDF » : l'app reçoit pdf.js (la copie de Publipostage+, un seul fichier) ; chargé de la même façon, il lit le texte d'un vrai PDF (`getTextContent`) sans refus.
//   6. Retirer « Nuage de mots » : l'app ne reçoit plus d3-cloud, et pdf.js reste.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark. Le Chromium du cloud (141) n'a pas `getOrInsertComputed` de Map et de WeakMap que pdf.js 6 attend : le labo les pose (la même fonction que run-lire-publipostage).
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { installApp, showRow, setExtension, extensionOn, closeModules } from './lab-gestes.mjs';
import { makePdf, pageTitle, ACCENTED_LINE } from './pdf-fixture.mjs';
import { addModernMethods } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `bi-ext-${lang}-${scheme}`;
const BI_URL = /(apps\/bi|Grist-BI)\//;
const CLOUD = 'ext:bi/nuage-de-mots';
const KEYWORDS = 'ext:bi/mots-cles-pdf';
const ORIGIN = 'http://127.0.0.1:8911/prototype/';
const NAMES = lang === 'fr' ? { cloud: 'Nuage de mots', keywords: 'Mots-clés des PDF' } : { cloud: 'Word cloud', keywords: 'PDF keywords' };

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && BI_URL.test(message.location().url || '')) errors.push(message.text()); });
await page.context().addInitScript(addModernMethods);
await lab.fitPanel(undefined, 700, 400);
const frame = lab.frame;
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});

// Ce que l'app reçoit : le lien du kit est le même module que celui de l'app (un module ES est mis en cache par adresse).
const received = app => app.evaluate(async () => {
  const { GfsLink } = await import(new URL('kit/js/gfs-link.js', location.href).href);
  const library = id => { const found = GfsLink.library(id); return found ? { src: found.src, integrite: found.integrite, forme: found.forme } : null; };
  return { extensions: GfsLink.extensions(), cloud: library('d3-cloud'), pdfjs: library('pdfjs') };
});
const waitReceived = async (app, test, label) => {
  let last = null;
  for (let i = 0; i < 40; i++) {
    last = await received(app);
    if (test(last)) return last;
    await page.waitForTimeout(250);
  }
  say('pas arrivé :', label, JSON.stringify(last));
  return last;
};

// Ce que le chargeur de l'app (js/extensions.js) dit d'une extension : son état, et ce que `load` rend (le module, ou null quand elle n'est pas donnée).
const loader = (app, id) => app.evaluate(async extension => {
  const api = GristBI.extensions;
  const state = api.stateOf(extension);
  const module = await api.load(extension);
  return { state, loaded: module ? Object.keys(module).length : null, default: module && typeof module.default, getDocument: module && typeof module.getDocument, version: module && module.version };
}, id);

// ----- 1. La fiche de Grist-BI.
await lab.openModules(frame);
await installApp(frame, 'bi');
await lab.settle(frame);
const cloudRow = await showRow(frame, CLOUD);
const keywordsRow = await showRow(frame, KEYWORDS);
check('la fiche de Grist-BI porte « ' + NAMES.cloud + ' » et « ' + NAMES.keywords + ' »', (await cloudRow.count()) === 1 && (await keywordsRow.count()) === 1);
check('décochées au départ : chacune propose de l\'ajouter', (await cloudRow.getAttribute('data-on')) === 'true' && (await keywordsRow.getAttribute('data-on')) === 'true');
const cardOf = async (_app, extension) => frame.locator('.fp-ext', { has: frame.locator(`[data-parent="bi"][data-ext="${extension}"]`) });
const cloudCard = await cardOf('bi', 'nuage-de-mots');
const keywordsCard = await cardOf('bi', 'mots-cles-pdf');
const cloudText = (await cloudCard.innerText()).replace(/\s+/g, ' ');
const keywordsText = (await keywordsCard.innerText()).replace(/\s+/g, ' ');
say('carte « nuage » :', cloudText);
say('carte « mots-clés » :', keywordsText);
check('chaque carte dit son nom et ce qu\'elle ajoute', cloudText.includes(NAMES.cloud) && keywordsText.includes(NAMES.keywords));
await lab.shotPanel(run, '1-fiche', frame);

// ----- 2. Décochées : l'app ne reçoit rien.
await closeModules(page, frame);
const app = await lab.openApp('bi', BI_URL);
check('l\'app a un cadre', Boolean(app));
await page.waitForTimeout(3000);
const off = await received(app);
say('décochées, l\'app reçoit :', JSON.stringify(off));
check('décochées : aucune extension, aucune bibliothèque', off.extensions.length === 0 && off.cloud === null && off.pdfjs === null, off);
const offCloud = await loader(app, 'nuage-de-mots');
const offKeywords = await loader(app, 'mots-cles-pdf');
check('décochées, le chargeur de l\'app dit « inactive » pour les deux et ne charge rien (les fonctions restent grisées, jamais masquées)', offCloud.state === 'inactive' && offCloud.loaded === null &&
  offKeywords.state === 'inactive' && offKeywords.loaded === null, { offCloud, offKeywords });

// ----- 3. Le nuage de mots coché, l'app étant ouverte.
await lab.openModules(frame);
await setExtension(frame, CLOUD, true);
await lab.settle(frame);
const hint = (await (await cardOf('bi', 'nuage-de-mots')).locator('.fp-ext-libs > :last-child').innerText()).trim();
check('« ' + NAMES.cloud + ' » est ajoutée, et la copie de GFS est le seul mode de d3-cloud (le CDN est grisé avec sa raison)', (await extensionOn(frame, CLOUD)) && hint.length > 0, hint);
await lab.shotPanel(run, '2-nuage-ajoute', frame);
await closeModules(page, frame);
const cloudOn = await waitReceived(app, state => state.extensions.includes('nuage-de-mots'), 'le nuage de mots');
say('nuage coché, l\'app reçoit :', JSON.stringify(cloudOn));
check('l\'app reçoit l\'extension, sans rechargement', cloudOn.extensions.join() === 'nuage-de-mots', cloudOn);
check('d3-cloud vient de la copie de GFS : sa source, l\'empreinte du catalogue, la forme « module »', cloudOn.cloud && cloudOn.cloud.src === `${ORIGIN}vendor/d3-cloud/1.0.0/d3-cloud.js` && /^sha384-q1KvVuPu5gLsypxXouTgdg1dT1JqvKeP9uKICf37NNV5FA5zj9XN55UQwm\+Ii76F$/.test(cloudOn.cloud.integrite) && cloudOn.cloud.forme === 'module', cloudOn.cloud);
check('pdf.js n\'est pas livré avec le nuage de mots (1,6 Mo de moins)', cloudOn.pdfjs === null, cloudOn.pdfjs);
const onCloud = await loader(app, 'nuage-de-mots');
const stillKeywords = await loader(app, 'mots-cles-pdf');
check('l\'app (ouverte, sans rechargement) passe « Nuage de mots » à « active » et son chargeur rend le module de d3-cloud ; « Mots-clés des PDF » reste « inactive »', onCloud.state === 'active' &&
  onCloud.default === 'function' && stillKeywords.state === 'inactive' && stillKeywords.loaded === null, { onCloud, stillKeywords });

// ----- 4. Le fichier se charge dans le cadre de l'app, comme elle le fera, et place des mots.
const loaded = await app.evaluate(async source => {
  const load = ({ src, integrite }) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = src;
    script.integrity = integrite;
    script.crossOrigin = 'anonymous';
    script.onload = resolve;
    script.onerror = () => reject(new Error(`refusé : ${src}`));
    document.head.append(script);
  });
  const violations = [];
  document.addEventListener('securitypolicyviolation', event => violations.push(`${event.violatedDirective} ${event.blockedURI}`));
  try { await load(source); } catch (error) { return { erreur: error.message, violations }; }
  const paquet = globalThis.GfsPaquets && globalThis.GfsPaquets['d3-cloud'];
  if (!paquet) return { erreur: 'GfsPaquets[d3-cloud] absent', violations };
  const CloudLayout = paquet.modules['d3-cloud'].default;
  const layout = new CloudLayout().size([500, 300]).overflow(false);
  const words = [['Grist', 60], ['données', 44], ['rapport', 36], ['tuile', 28], ['filtre', 24], ['graphique', 20], ['mots', 16], ['nuage', 14]];
  const placed = words.map(([text, size]) => layout.getSprite(text, { size, font: 'sans-serif', padding: 1, rotate: 0, datum: { text, size } })).filter(Boolean).map(sprite => layout.place(sprite)).filter(Boolean);
  // `size` est la boîte centrée sur [0, 0] et `overflow(false)` garde chaque mot dedans ; deux mots n'ont jamais le même centre (les masques de d3-cloud s'emboîtent, leurs rectangles peuvent se toucher).
  const inside = placed.every(word => Math.abs(word.x) <= 250 && Math.abs(word.y) <= 150);
  const distinct = new Set(placed.map(word => `${Math.round(word.x)},${Math.round(word.y)}`)).size === placed.length;
  return { version: paquet.version, genre: typeof CloudLayout, nommee: CloudLayout === paquet.modules['d3-cloud'].CloudLayout, placed: placed.map(word => [word.datum.text, Math.round(word.x), Math.round(word.y)]), inside, distinct, violations, origine: window.origin };
}, cloudOn.cloud);
say('d3-cloud dans le cadre de l\'app :', JSON.stringify(loaded));
check('le cadre de l\'app est isolé (origine « null ») et le fichier s\'y charge sans refus (empreinte bonne, aucune violation de politique)', loaded.origine === 'null' && !loaded.erreur && loaded.violations.length === 0, loaded);
check('`GfsPaquets[\'d3-cloud\']` porte la version de GFS et `CloudLayout` par défaut, comme l\'import par défaut que `js/charts.js` attend', loaded.version === '1.0.0' && loaded.genre === 'function' && loaded.nommee === true, loaded);
check('le vrai d3-cloud place les huit mots dans la boîte demandée (500 × 300), chacun à sa place', Array.isArray(loaded.placed) && loaded.placed.length === 8 && loaded.inside === true && loaded.distinct === true, loaded.placed);

// ----- 5. Les mots-clés des PDF cochés : pdf.js, la copie que Publipostage+ lit déjà, un seul fichier.
await lab.openModules(frame);
await setExtension(frame, KEYWORDS, true);
await lab.settle(frame);
await lab.shotPanel(run, '3-deux-extensions', frame);
await closeModules(page, frame);
const both = await waitReceived(app, state => state.extensions.includes('mots-cles-pdf'), 'les mots-clés');
say('les deux cochées, l\'app reçoit :', JSON.stringify(both));
check('l\'app reçoit les deux extensions, d3-cloud et pdf.js', both.extensions.sort().join() === 'mots-cles-pdf,nuage-de-mots' && both.cloud !== null && both.pdfjs !== null, both);
check('pdf.js est la copie de GFS que Publipostage+ lit déjà (même fichier, même empreinte), forme « module »', both.pdfjs && both.pdfjs.src === `${ORIGIN}vendor/pdfjs/1.0.0/pdfjs.js` && both.pdfjs.forme === 'module' && /^sha384-c85h\+cJ0v9hcBB/.test(both.pdfjs.integrite), both.pdfjs);
const pdf = makePdf({ pages: 2, title: 'Publication' });
const reading = await app.evaluate(async ({ source, bytes }) => {
  const violations = [];
  document.addEventListener('securitypolicyviolation', event => violations.push(`${event.violatedDirective} ${event.blockedURI}`));
  const script = document.createElement('script');
  script.type = 'module';
  script.src = source.src;
  script.integrity = source.integrite;
  script.crossOrigin = 'anonymous';
  try { await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = () => reject(new Error('refusé')); document.head.append(script); }); } catch (error) { return { erreur: error.message, violations }; }
  const pdfjs = globalThis.GfsPaquets.pdfjs.modules['pdfjs-dist/build/pdf.min.mjs'];
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, verbosity: 0 }).promise;
  const texts = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const content = await (await doc.getPage(number)).getTextContent();
    texts.push(content.items.map(item => item.str).join(' '));
  }
  return { version: pdfjs.version, pages: doc.numPages, texts, violations };
}, { source: both.pdfjs, bytes: [...pdf] });
say('pdf.js dans le cadre de l\'app :', JSON.stringify(reading));
check('pdf.js 6.5.438 se charge dans le cadre de l\'app sans refus', !reading.erreur && reading.version === '6.5.438' && reading.violations.length === 0, reading);
check('il lit le texte d\'un vrai PDF : deux pages, le titre de chacune, accents compris', reading.pages === 2 && reading.texts[0].includes(pageTitle('Publication', 1)) && reading.texts[1].includes(pageTitle('Publication', 2)) && reading.texts[0].includes(ACCENTED_LINE), reading.texts);

const onKeywords = await loader(app, 'mots-cles-pdf');
check('« Mots-clés des PDF » passe à « active » et le chargeur de l\'app rend le module de pdf.js (version 6.5.438)', onKeywords.state === 'active' && onKeywords.getDocument === 'function' && onKeywords.version === '6.5.438', onKeywords);

// ----- 6. Retirer « Nuage de mots » : d3-cloud s'en va, pdf.js reste.
await lab.openModules(frame);
await setExtension(frame, CLOUD, false);
await lab.settle(frame);
await closeModules(page, frame);
const removed = await waitReceived(app, state => !state.extensions.includes('nuage-de-mots'), 'le retrait');
say('nuage retiré, l\'app reçoit :', JSON.stringify(removed));
check('retirer « ' + NAMES.cloud + ' » : l\'app ne reçoit plus d3-cloud, pdf.js reste', removed.extensions.join() === 'mots-cles-pdf' && removed.cloud === null && removed.pdfjs !== null, removed);
const gone = await loader(app, 'nuage-de-mots');
check('« Nuage de mots » retirée pendant que l\'app est ouverte : elle repasse « inactive » et ne rend plus le module déjà chargé (la fonction se grise, jamais à moitié)', gone.state === 'inactive' && gone.loaded === null, gone);
check('aucune erreur de script dans l\'app', errors.length === 0, errors.slice(0, 3));
await lab.browser.close();
