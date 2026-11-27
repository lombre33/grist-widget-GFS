// LanguageTool et le passage de la Lecture à l'Édition, avec la VRAIE Publipostage+ dans un vrai Grist, à 700 × 400, à la vraie souris (Playwright : jamais dispatchEvent).
// Le retour du porteur (26/11) : « l'activation de LanguageTool, malgré que le bouton reste allumé, ne se lance pas tout le temps, notamment à l'arrivée en mode Lecture puis la bascule en
// mode Édition ». Le bouton « allumé » (enfoncé) veut dire : GFS n'a rien coupé, l'app ne marque rien, LanguageTool est libre de travailler dans le cadre de l'app. Ce que ce banc mesure, ce
// sont les deux choses que GFS et l'app contrôlent ; ce que LanguageTool en fait dépend de son extension, absente du cloud (voir la page d'essai `essais-navigateur/relance.html`).
//   1. L'arrivée en Lecture (le réglage « S'ouvre en Lecture » de la vue) puis la bascule en Édition, bouton allumé, pour un document et pour un e-mail : aucune marque `data-lt-active` nulle part,
//      à aucun moment ; ce qui change pour les zones de texte entre les deux modes (zones cachées puis montrées, zones dont `contenteditable` passe de « false » à « true », zones nées entre
//      les deux), relevé zone par zone : c'est ce que LanguageTool voit arriver.
//   2. Les mêmes passages avec le bouton coupé puis rallumé en Lecture, en Édition, entre les deux : la marque suit toujours le bouton (coupé : toutes les zones, y compris celles qui naissent ; allumé :
//      aucune), GFS ne dit rien au changement de mode, il dit un événement `correcteurs` par geste sur le bouton.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check, constat } from './lab-common.mjs';
import { openAdvancedMenu, subRows } from './reglages-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `correcteurs-modes-${lang}-${scheme}`;
const FILES = { document: 'Contrat de prestation', email: 'Convocation de session', folder: 'Formation' };
const WORDS = { fr: { back: /^Retour à l.app$/, close: /^Fermer$/ }, en: { back: /^Back to the app$/, close: /^Close$/ } }[lang];

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const errors = [];
page.on('pageerror', error => errors.push(String(error && error.message).slice(0, 160)));
const warnings = [];
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text()); });
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);

let frame = lab.frame;
let app = null;
const restart = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const lt = () => frame.locator('#floater-lt');
const stored = key => frame.evaluate(name => { try { return localStorage.getItem(name); } catch (error) { return 'REFUSÉ'; } }, key);
const waitStarted = async () => {
  await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
};
const openInFolder = async name => {
  await row(FILES.folder).dblclick();
  await frame.locator('.ls-row', { hasText: name }).first().waitFor();
  await row(name).dblclick();
};
const openFile = async name => {
  if (name === FILES.email) await openInFolder(name); else await row(name).dblclick();
  app = await lab.appFrame(/publipostage/);
  await waitStarted();
};
const backToApp = async () => { await frame.locator('.ex-foot .btn', { hasText: WORDS.back }).click(); await frame.locator('#floaters').waitFor({ state: 'visible' }); await page.waitForTimeout(300); };

// Les zones de texte de la page (la définition du kit : `textarea`, `input` de texte, `contenteditable` qui ne l'est pas à « false ») et, pour chacune : sa marque, si elle est montrée, son identité
// d'un relevé à l'autre. Les zones dont `contenteditable` est « false » sont comptées à part : ce sont celles qui deviendront des zones de texte plus tard (le champ d'un e-mail, en Lecture).
const install = () => app.evaluate(() => {
  if (window.__lt) return;
  const ids = new WeakMap();
  let next = 1;
  const id = node => { if (!ids.has(node)) ids.set(node, next++); return ids.get(node); };
  const TEXT = new Set(['', 'text', 'search', 'email', 'url', 'tel']);
  const VALUES = new Set(['', 'true', 'plaintext-only']);
  const kind = node => {
    const tag = node.tagName.toLowerCase();
    if (tag === 'textarea') return 'editable';
    if (tag === 'input') return TEXT.has((node.getAttribute('type') || '').trim().toLowerCase()) ? 'editable' : null;
    const value = node.getAttribute('contenteditable');
    if (value === null) return null;
    return VALUES.has(value.trim().toLowerCase()) ? 'editable' : 'frozen';
  };
  const name = node => `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${typeof node.className === 'string' && node.className ? `.${node.className.trim().split(/\s+/)[0]}` : ''}`;
  window.__lt = {
    snap() {
      const out = [];
      for (const node of document.querySelectorAll('textarea, input, [contenteditable]')) {
        const k = kind(node);
        if (!k) continue;
        out.push({ id: id(node), name: name(node), kind: k, mark: node.getAttribute('data-lt-active'), shown: node.getClientRects().length > 0, root: node.classList.contains('ProseMirror') });
      }
      return out;
    },
  };
});
const snap = async () => { await install(); return app.evaluate(() => window.__lt.snap()); };
const summary = zones => ({
  editable: zones.filter(z => z.kind === 'editable').length,
  frozen: zones.filter(z => z.kind === 'frozen').length,
  hidden: zones.filter(z => z.kind === 'editable' && !z.shown).length,
  marked: zones.filter(z => z.mark === 'false').length,
  otherMark: zones.filter(z => z.mark !== null && z.mark !== 'false').length,
  root: zones.filter(z => z.root).map(z => ({ shown: z.shown, mark: z.mark, kind: z.kind })),
});
// Ce qui change entre deux relevés, pour les zones de texte que LanguageTool voit.
const diff = (a, b) => {
  const before = new Map(a.map(z => [z.id, z]));
  const named = list => list.reduce((acc, z) => { acc[z.name] = (acc[z.name] || 0) + 1; return acc; }, {});
  const born = b.filter(z => !before.has(z.id));
  const gone = a.filter(z => !b.some(y => y.id === z.id));
  const shown = b.filter(z => before.has(z.id) && !before.get(z.id).shown && z.shown && z.kind === 'editable');
  const thawed = b.filter(z => before.has(z.id) && before.get(z.id).kind === 'frozen' && z.kind === 'editable');
  const frozen = b.filter(z => before.has(z.id) && before.get(z.id).kind === 'editable' && z.kind === 'frozen');
  return { born: named(born.filter(z => z.kind === 'editable')), gone: named(gone), shown: named(shown), thawed: named(thawed), frozen: named(frozen) };
};
const events = () => app.evaluate(() => window.__events.length);
// Les changements que l'app apprend de GFS (`GfsLink.onCorrecteurs`, rappelé quand `coupes` change vraiment) : un par geste sur le bouton, aucun au changement de mode.
const hook = () => app.evaluate(() => {
  if (window.__events) return;
  window.__events = [];
  GfsLink.onCorrecteurs(state => window.__events.push(state.coupes));
});

// 0. Le départ : l'app s'ouvre une première fois, le réglage « S'ouvre en Lecture » est écrit dans la vue (au vrai clic), le bouton paraît dans la barre.
await lab.openModules(frame);
await frame.locator('[data-open="publipostage"]').click();
app = await lab.appFrame(/publipostage/);
await waitStarted();
await app.locator('#v2-btn-settings').click();
await app.locator('[data-settings-tab="rowTemplate"]').click();
await app.locator('#settings-viewopen-mode').selectOption('read');
await page.waitForTimeout(1500);
await page.keyboard.press('Escape');
await frame.locator('#floater-files').click();
await frame.locator('.ls-row').first().waitFor();
await openAdvancedMenu(frame);
await subRows(frame).first().click();
await frame.locator('.menu').waitFor({ state: 'detached' });
check('le bouton LanguageTool est dans la barre de GFS, enfoncé (allumé)', (await stored('gfs.langtool')) === 'oui' && (await stored('gfs.correcteurs')) === null);
await backToApp();
check('le bouton est visible et enfoncé', (await lt().isVisible()) && (await lt().getAttribute('aria-pressed')) === 'true');

// 1. L'arrivée en Lecture puis la bascule en Édition, bouton allumé, pour un document puis pour un e-mail.
const walk = async (label, name) => {
  await restart();
  await openFile(name);
  const arrival = await snap();
  const mode = () => app.evaluate(() => (document.getElementById('btn-mode-read').classList.contains('active') ? 'read' : 'edit'));
  const first = await mode();
  const marksAtArrival = summary(arrival);
  say(`1. ${label} : arrivée en mode`, first, '|', marksAtArrival);
  check(`1. ${label} : l'arrivée est en Lecture, le bouton est allumé et aucune zone ne porte de marque`, first === 'read' && marksAtArrival.marked === 0 && marksAtArrival.otherMark === 0 && (await lt().getAttribute('aria-pressed')) === 'true', marksAtArrival);
  await app.locator('#btn-mode-edit').click();
  await page.waitForTimeout(1500);
  const editing = await snap();
  const change = diff(arrival, editing);
  say(`1. ${label} : de la Lecture à l'Édition`, JSON.stringify(change), '|', summary(editing));
  check(`1. ${label} : en Édition, toujours aucune marque et le bouton allumé`, summary(editing).marked === 0 && summary(editing).otherMark === 0 && (await lt().getAttribute('aria-pressed')) === 'true', summary(editing));
  await app.locator('#btn-mode-read').click();
  await page.waitForTimeout(1200);
  const back = await snap();
  say(`1. ${label} : de l'Édition à la Lecture`, JSON.stringify(diff(editing, back)));
  await app.locator('#btn-mode-edit').click();
  await page.waitForTimeout(1200);
  const again = await snap();
  say(`1. ${label} : de nouveau la Lecture vers l'Édition`, JSON.stringify(diff(back, again)));
  return { arrival, editing, change };
};
const docWalk = await walk('document', FILES.document);
const mailWalk = await walk('e-mail', FILES.email);
constat('1. le document : l\'éditeur est caché (display: none) à l\'arrivée en Lecture, montré à la bascule', docWalk.arrival.some(z => z.root && !z.shown) && docWalk.editing.some(z => z.root && z.shown), summary(docWalk.arrival));
constat('1. l\'e-mail : des zones de texte gelées (contenteditable="false") en Lecture deviennent de vraies zones à la bascule', Object.keys(mailWalk.change.thawed).length > 0, mailWalk.change);

// 2. Le bouton coupé puis rallumé, aux trois endroits : en Lecture, en Édition, entre les deux.
await restart();
await openFile(FILES.document);
await hook();
await install();
const marks = async () => summary(await snap());
const press = async () => { await lt().click(); await page.waitForTimeout(700); };
const readMode = () => app.locator('#btn-mode-read').click().then(() => page.waitForTimeout(1200));
const editMode = () => app.locator('#btn-mode-edit').click().then(() => page.waitForTimeout(1200));
const expectCut = async (label, cut) => {
  const s = await marks();
  const pressed = (await lt().getAttribute('aria-pressed')) === 'true';
  say(`2. ${label} :`, cut ? 'coupé' : 'allumé', JSON.stringify(s));
  check(`2. ${label} : ${cut ? 'coupé, chaque zone de texte porte la marque' : 'allumé, aucune marque'}`,
    pressed === !cut && (cut ? s.marked === s.editable && s.editable >= 2 : s.marked === 0) && s.otherMark === 0, s);
};
await expectCut('arrivée en Lecture', false);
await press(); await expectCut('coupé en Lecture', true);
await editMode(); await expectCut('Édition, coupé en Lecture', true);
await press(); await expectCut('rallumé en Édition', false);
await readMode(); await expectCut('Lecture, rallumé en Édition', false);
await press(); await expectCut('coupé en Lecture (2)', true);
await press(); await expectCut('rallumé en Lecture', false);
await editMode(); await expectCut('Édition, rallumé en Lecture', false);
await press(); await readMode(); await press(); await expectCut('coupé en Édition, rallumé en Lecture', false);
await editMode(); await expectCut('Édition à la fin', false);
check('2. GFS a dit un événement `correcteurs` par geste sur le bouton (six gestes), rien au changement de mode', (await events()) === 6, await events());

say('erreurs de page :', errors, '| avertissements GFS :', warnings);
check('aucune erreur de page, aucun avertissement de GFS', errors.length === 0 && warnings.length === 0, { errors, warnings });
await lab.browser.close();
