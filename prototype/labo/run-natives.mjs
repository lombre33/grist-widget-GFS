// Le choix « CDN ou copie figée » des bibliothèques natives d'une app (demande du porteur du 10/11, choix du 11/11 ; contrats 2.6 point 14, 5.2 point 12) dans un VRAI Grist (grist-static) avec la vraie
// Publipostage+ : la vraie fenêtre « Apps et extensions », à 700 × 400, à la vraie souris (Playwright : événements du pointeur du navigateur, jamais dispatchEvent). Ce que Publipostage+ déclarera quand
// elle lira le choix (`natives` dans son manifeste, quatre fonctions) est ajouté ICI au manifeste que GFS lit : le labo seul (`transform` de lab-server.mjs), le fichier du dépôt n'est pas touché.
// À mesurer : le détail se déplie, le geste sur Word s'écrit tout de suite dans la table de GFS (`modes`, jamais dans les réglages de la vue), l'app reçoit l'événement `extensions` avec `natives` (version,
// adresse de la copie de GFS, empreinte ; jamais le CDN de GFS), le fichier servi a bien cette empreinte et le navigateur le charge en la contrôlant, `contexte` le rend à l'app qui le redemande, le retour
// au CDN vide `natives`, et en lecture seule tout est grisé et rien ne s'écrit. L'éditeur a sa copie figée dans le dépôt de l'app : son choix s'écrit, ne change rien à l'app ouverte (aucun événement, pas de
// rechargement) et part dans l'adresse du cadre (`copie=editeur`) au démarrage suivant de l'app, que la vraie page lit (consigne 066, `db6b388`) : elle charge alors son éditeur de `vendor/editeur/`
// et non d'`esm.sh`, la case « Éditeur hors ligne » de ses Réglages est cochée et grisée (GFS décide), et l'éditeur se tape au vrai clavier.
// REPO_DIR : le dépôt de GFS ; PP_DIR : un clone de Publipostage+ (le sous-module n'est pas récupéré dans le cloud). LAB_LANG=fr|en, LAB_SCHEME=light|dark, LAB_READONLY=1.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { serve } from './lab-server.mjs';
import { startLab } from './lab-setup.mjs';
import { say, check, LAB } from './lab-common.mjs';
import { reopenGfs } from './lab-gestes.mjs';

const REPO = process.env.REPO_DIR;
const PP = process.env.PP_DIR;
if (!REPO || !PP) throw new Error('REPO_DIR et PP_DIR sont attendus');
const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const readonly = process.env.LAB_READONLY === '1';
const run = `natives-${lang}-${scheme}${readonly ? '-lecture-seule' : ''}`;
const GROUPS = [
  { id: 'editeur', nom: { fr: 'Éditeur (TipTap)', en: 'Editor (TipTap)' }, copieDansApp: true, poids: 1172757 },
  { id: 'pdf', nom: { fr: 'Export PDF (pdfmake, polices, JSZip)', en: 'PDF export (pdfmake, fonts, JSZip)' }, bibliotheques: [['pdfmake', '0.2.7'], ['pdfmake-polices', '0.2.7'], ['jszip', '3.10.1']] },
  { id: 'word', nom: { fr: 'Export Word (docx)', en: 'Word export (docx)' }, bibliotheques: [['docx', '9.15.1'], ['docx-charts', '9.15.1']] },
  { id: 'excel', nom: { fr: 'Export Excel (ExcelJS)', en: 'Excel export (ExcelJS)' }, bibliotheques: [['exceljs', '4.4.0']] },
  { id: 'divers', nom: { fr: 'Divers (marked, QR code, pdf-lib)', en: 'Other (marked, QR code, pdf-lib)' }, bibliotheques: [['pdf-lib', '1.17.1'], ['marked', '15.0.12'], ['qrcode-generator', '1.4.4']] },
].map(group => (group.bibliotheques ? { ...group, bibliotheques: group.bibliotheques.map(([id, version]) => ({ id, version })) } : group));

// Le manifeste de Publipostage+ que GFS lit, avec ses quatre fonctions : tout le reste du site est servi tel quel.
const transform = (file, bytes) => {
  if (!/manifestes[/\\]publipostage\.json$/.test(file)) return bytes;
  const manifest = JSON.parse(bytes.toString('utf8'));
  manifest.natives = GROUPS;
  return Buffer.from(JSON.stringify(manifest));
};
const servers = [
  createServer(serve(join(LAB, 'site'), { prefix: '/dist/', root: join(LAB, 'node_modules/grist-static/dist') })).listen(8910, '127.0.0.1'),
  createServer(serve(REPO, { prefix: '/prototype/apps/publipostage/', root: PP }, transform)).listen(8911, '127.0.0.1'),
];

const lab = await startLab({ lang, colorScheme: scheme, query: readonly ? 'readonly=true' : '' });
const { page } = lab;
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && /GFS/.test(m.text())) warnings.push(m.text().slice(0, 200)); });
await lab.fitPanel(undefined, 700, 400);
const frame = lab.frame;
const requested = [];
page.on('request', request => requested.push(request.url()));
const shot = name => lab.shotPanel(run, name, frame);
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});

const state = () => frame.evaluate(() => {
  const app = document.querySelector('.mod .mr--app');
  const natives = app && app.querySelector('.mr-natives');
  if (!natives) return null;
  const details = app.querySelector('details');
  return {
    legend: natives.querySelector('legend').textContent.replace(/\s+/g, ' ').trim(), open: Boolean(details && details.open),
    radios: Object.fromEntries([...app.querySelectorAll('input[type=radio]')].map(input => [input.dataset.fk, { checked: input.checked, disabled: input.disabled }])),
    rows: [...app.querySelectorAll('.mr-lib')].map(row => ({ name: row.querySelector('.mr-lib-name').textContent, overflow: row.scrollWidth - row.clientWidth })),
    bodyOverflow: document.querySelector('.mod-body').scrollWidth - document.querySelector('.mod-body').clientWidth,
  };
});
const labelOf = (group, value) => frame.locator('.mr--app label', { has: frame.locator(group ? `input[data-native-for="${group}"][value="${value}"]` : `input[data-native-all][value="${value}"]`) });
const modes = async () => { const value = (await lab.rangement(frame)).value; return value && value.publipostage ? value.publipostage.modes || {} : null; };
const sha384 = bytes => `sha384-${createHash('sha384').update(bytes).digest('base64')}`;

// ----- La vraie Publipostage+ ouverte (sauf en lecture seule, où l'on ne crée rien) ; elle écoute ce que GFS lui envoie.
let app = null;
if (!readonly) {
  app = await lab.openApp('publipostage');
  await page.waitForTimeout(4000);
  check('Publipostage+ est ouverte dans son sous-cadre', Boolean(app), warnings);
  await app.evaluate(() => {
    window.__events = [];
    window.addEventListener('message', event => { const m = event.data; if (m && m.type === 'evenement' && m.nom === 'extensions') window.__events.push(m.data); });
  });
}

// ----- La fenêtre : le détail est replié, le CDN est le choix de toutes les fonctions.
await lab.openModules(frame);
const natives = frame.locator('.mr--app .mr-natives');
await natives.waitFor();
let s = await state();
check('les bibliothèques natives sont une ligne de la fenêtre, au CDN, détail replié', !s.open && s.radios['nativeall:publipostage/cdn'].checked && !/mélange|mixed/.test(s.legend), s.legend);
await shot('1-replie');
await frame.locator('.mr--app details summary').click();
s = await state();
check('le détail se déplie à la souris : une ligne par fonction (l\'éditeur et les quatre exports), rien ne déborde', s.open && s.rows.length === 5 && s.bodyOverflow <= 1 && s.rows.every(row => row.overflow <= 1), s);
await shot('2-deplie');

if (readonly) {
  check('lecture seule : tous les choix sont grisés', Object.values(s.radios).length > 0 && Object.values(s.radios).every(radio => radio.disabled), s.radios);
  const box = await labelOf('word', 'vendorise').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(600);
  check('lecture seule : un clic sur « copie figée » n\'écrit rien dans le document', (await modes()) === null || Object.keys(await modes()).length === 0, await modes());
  await shot('3-lecture-seule');
} else {
  // ----- Un geste sur Word : écrit tout de suite, rendu à l'app.
  await labelOf('word', 'vendorise').click();
  await lab.settle(frame);
  const wrote = await frame.waitForFunction(async () => {
    const data = await grist.docApi.fetchTable('GFS_Rangement');
    const at = data.id.findIndex((id, i) => data.Utilisateur[i] === '@document' && data.App[i] === 'gfs' && data.Fichier[i] === 'apps');
    return at >= 0 && JSON.parse(data.Valeur[at]).publipostage.modes;
  }, null, { timeout: 15000 }).then(handle => handle.jsonValue()).catch(() => null);
  check('le geste sur Word s\'écrit dans la table de GFS, une clé de fonction', JSON.stringify(wrote) === JSON.stringify({ 'natif:word': 'vendorise' }), wrote);
  s = await state();
  check('la ligne Word montre la copie figée, la légende dit « mélange », le détail reste déplié', s.radios['native:publipostage/word/vendorise'].checked && /mélange|mixed/.test(s.legend) && s.open, s);
  await shot('3-word-en-copie');
  await app.waitForFunction(() => window.__events.some(data => data.natives && data.natives.docx), null, { timeout: 15000 }).catch(() => {});
  const events = await app.evaluate(() => window.__events);
  const last = events[events.length - 1] || {};
  const given = last.natives || {};
  check('l\'app reçoit l\'événement `extensions` avec les deux bibliothèques de Word, pas une de plus', JSON.stringify(Object.keys(given).sort()) === JSON.stringify(['docx', 'docx-charts']), last);
  const docx = given.docx || {};
  check('chaque copie dit sa version, l\'adresse de GFS (vendor/) et son empreinte, jamais le CDN de GFS', docx.version === '9.15.1' && /^http:\/\/127\.0\.0\.1:8911\/prototype\/vendor\/docx\/9\.15\.1\//.test(docx.src) && /^sha384-/.test(docx.integrite) && !JSON.stringify(given).includes('jsdelivr'), docx);
  const bytes = Buffer.from(await (await fetch(docx.src)).arrayBuffer());
  check('le fichier que GFS sert a l\'empreinte qu\'il annonce', sha384(bytes) === docx.integrite, [sha384(bytes), docx.integrite]);
  const loaded = await app.evaluate(({ src, integrite }) => new Promise(resolve => {
    const script = document.createElement('script');
    script.src = src; script.integrity = integrite; script.crossOrigin = 'anonymous';
    script.onload = () => resolve({ loaded: true, docx: typeof window.docx }); script.onerror = () => resolve({ loaded: false });
    setTimeout(() => resolve({ loaded: false, timeout: true }), 10000);
    document.head.appendChild(script);
  }), docx);
  check('l\'app charge cette copie en laissant le navigateur contrôler l\'empreinte', loaded.loaded === true && loaded.docx === 'object', loaded);
  const bad = await app.evaluate(({ src }) => new Promise(resolve => {
    const script = document.createElement('script');
    script.src = `${src}?autre`; script.integrity = `sha384-${'A'.repeat(64)}`; script.crossOrigin = 'anonymous';
    script.onload = () => resolve({ loaded: true }); script.onerror = () => resolve({ loaded: false });
    document.head.appendChild(script);
  }), docx);
  check('une empreinte qui ne correspond pas est refusée par le navigateur (le contrôle est réel)', bad.loaded === false, bad);

  // ----- `contexte` : une app qui le redemande reçoit les mêmes copies.
  const again = await app.evaluate(() => new Promise(resolve => {
    const contract = Number(new URL(location.href).searchParams.get('gfs'));
    const listener = event => { const m = event.data; if (m && m.type === 'reponse' && m.id === 9001) { window.removeEventListener('message', listener); resolve(m.data); } };
    window.addEventListener('message', listener);
    parent.postMessage({ gfs: contract, type: 'appel', id: 9001, nom: 'contexte' }, '*');
    setTimeout(() => resolve(null), 10000);
  }));
  check('`contexte` rend les mêmes copies figées à l\'app qui le redemande', again && JSON.stringify(again.natives) === JSON.stringify(given), again && again.natives);

  // ----- Toutes en copie figée, puis le retour au CDN pour toutes.
  await labelOf(null, 'vendorise').click();
  await page.waitForTimeout(1500);
  const all = await modes();
  check('« toutes » en copie figée écrit les cinq fonctions', JSON.stringify(Object.keys(all || {}).sort()) === JSON.stringify(['natif:divers', 'natif:editeur', 'natif:excel', 'natif:pdf', 'natif:word']), all);
  await app.waitForFunction(() => window.__events.some(data => data.natives && data.natives.pdfmake && data.natives.exceljs && data.natives['qrcode-generator']), null, { timeout: 15000 }).catch(() => {});
  const many = (await app.evaluate(() => window.__events)).pop() || {};
  check('l\'app reçoit alors les neuf bibliothèques natives du manifeste d\'essai', Object.keys(many.natives || {}).length === 9, Object.keys(many.natives || {}));
  await shot('4-toutes-en-copie');
  await labelOf(null, 'cdn').click();
  await page.waitForTimeout(1500);
  check('« toutes » au CDN retire les clés : rien n\'est écrit pour le CDN', JSON.stringify(await modes()) === '{}', await modes());
  await app.waitForFunction(() => { const events = window.__events; return events.length && Object.keys(events[events.length - 1].natives || {}).length === 0; }, null, { timeout: 15000 }).catch(() => {});
  const back = (await app.evaluate(() => window.__events)).pop() || {};
  check('l\'app reçoit `natives: {}` : son CDN vaut de nouveau', back.natives && Object.keys(back.natives).length === 0, back);
  s = await state();
  check('la fenêtre dit de nouveau « CDN » pour toutes', s.radios['nativeall:publipostage/cdn'].checked && !/mélange|mixed/.test(s.legend), s.legend);

  // ----- L'éditeur : sa copie est dans le dépôt de l'app. Le choix s'écrit, rien ne change pour l'app ouverte, l'adresse du cadre le porte au démarrage suivant.
  const before = (await app.evaluate(() => window.__events)).length;
  const urlBefore = app.url();
  await labelOf('editeur', 'vendorise').click();
  await page.waitForTimeout(1500);
  check('le choix de l\'éditeur s\'écrit dans la table de GFS', JSON.stringify(await modes()) === JSON.stringify({ 'natif:editeur': 'vendorise' }), await modes());
  const events2 = await app.evaluate(() => window.__events);
  check('l\'app ouverte ne reçoit aucun événement pour l\'éditeur (GFS ne sert rien) et son cadre n\'est pas rechargé', events2.length === before && app.url() === urlBefore && !/[?&]copie=/.test(app.url()), { avant: before, apres: events2.length, url: app.url().replace(/\?.*/, '?…') });
  const phrase = await frame.locator('.mr-lib', { hasText: /Éditeur|Editor/ }).locator('.mr-note').innerText();
  check('la ligne de l\'éditeur dit que le choix prend effet au démarrage de l\'app', /prochain démarrage|next time the app starts/.test(phrase), phrase);
  await shot('5-editeur-en-copie');
  const mark = requested.length;
  const gfs2 = await reopenGfs(lab, frame);
  const app2 = await lab.openApp('publipostage', /./, gfs2);
  const address = new URL(app2.url());
  check('au démarrage suivant, l\'adresse du cadre porte `copie=editeur` (et le numéro de contrat)', address.searchParams.get('copie') === 'editeur' && address.searchParams.get('gfs') === '0', app2.url().replace(/^[^?]*/, ''));
  const read = await app2.evaluate(async () => { try { const { hostCopies } = await import(new URL('/prototype/kit/js/host.js', location.href).href); return hostCopies(location.search); } catch (error) { return String(error); } });
  check('le kit (`hostCopies`) lit ce choix dans l\'adresse du cadre, tout de suite, sans rien demander à GFS', JSON.stringify(read) === '["editeur"]', read);
  // La vraie page démarre depuis sa copie : l'éditeur vient de `vendor/editeur/` (ses 57 fichiers servis par la page), pas d'`esm.sh` ; il s'écrit au vrai clavier.
  await app2.waitForFunction(() => Boolean(document.querySelector('.ProseMirror')), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const since = requested.slice(mark);
  const fromCopy = since.filter(url => /\/apps\/publipostage\/vendor\/editeur\//.test(url));
  const fromCdn = since.filter(url => /^https:\/\/esm\.sh\/(@tiptap|@floating-ui|@handlewithcare|prosemirror|orderedmap|rope-sequence|w3c-keyname)/.test(url));
  check('l\'éditeur de la vraie page vient de sa copie (`vendor/editeur/`), pas d\'esm.sh', fromCopy.length >= 30 && fromCdn.length === 0, { copie: fromCopy.length, cdn: fromCdn.slice(0, 3) });
  // Le document d'essai n'a pas encore les tables de l'app : sa première question (créer les tables) reçoit la réponse de la personne, à la souris.
  const create = app2.locator('#pp-dialog-modal .pp-modal-actions button').filter({ hasText: lang === 'fr' ? /^Cr/ : /^Create/ });
  if (await create.count()) { await create.first().click(); await page.waitForTimeout(2500); }
  await app2.locator('.ProseMirror p').first().click();
  await page.keyboard.type('Copie hors ligne');
  const typed = await app2.evaluate(() => document.querySelector('.ProseMirror').textContent);
  check('l\'éditeur de la copie marche : on y tape au vrai clavier', typed.includes('Copie hors ligne'), typed.slice(0, 60));
  await app2.locator('#v2-btn-settings').click();
  await app2.locator('[data-settings-tab="theme"]').click();
  await page.waitForTimeout(300);
  const offline = await app2.evaluate(() => {
    const input = document.getElementById('settings-offline-editor');
    const note = document.getElementById('settings-offline-editor-gfs-note');
    return { checked: input.checked, disabled: input.disabled, noteShown: !note.hidden && note.getBoundingClientRect().height > 0, note: note.textContent.trim().slice(0, 90) };
  });
  check('Réglages > Thème > Éditeur hors ligne : cochée (ce qui est chargé) et grisée, la phrase dit où choisir (GFS décide, jamais masquée)', offline.checked && offline.disabled && offline.noteShown, offline);
  await shot('6-editeur-hors-ligne');
}
check('aucun avertissement ni erreur de GFS dans la console', warnings.length === 0, warnings);
say('captures :', run);
await lab.browser.close();
servers.forEach(server => server.close());
process.exit(process.exitCode || 0);
