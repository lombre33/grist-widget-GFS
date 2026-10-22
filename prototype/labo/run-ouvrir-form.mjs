// « Nouveau » et le double-clic d'un formulaire de Form+ depuis l'explorateur de GFS (consigne 010 de Form+ : `GfsLink.opening()` au démarrage, `GfsLink.onOpen` quand elle tourne ;
// contrats 5.2 point 3 et 5.4 point 1), avec la vraie app, celle que GFS référence, dans un vrai Grist, à 700 × 400, à la vraie souris. Le manifeste ouvre le type « formulaire »
// (`actions.ouvrir`) et `ACCEPTS_OPEN.form` dit que l'app connaît l'ouverture : GFS ne pose plus sa phrase provisoire.
//   1. Le menu « Nouveau » propose « Formulaire », grisé tant que Form+ n'est pas installée (un clic dit pourquoi), dégrisé ensuite.
//   2. « Nouveau > Formulaire » dans un document sans formulaire : Form+ démarre sur son écran de départ, GFS ne dit rien, rien n'est écrit dans le document.
//   3. Des formulaires sont enregistrés (une ligne chacun, sur la section partagée de GFS, comme Form+ les range) : « Nouveau » doit encore donner l'écran de départ.
//   4. Le double-clic d'un formulaire quand l'app n'est pas ouverte : elle démarre sur CE formulaire (son titre, ses questions).
//   5. L'app est déjà ouverte : le double-clic d'un autre formulaire l'ouvre dans le même cadre (non rechargé), sans question ni phrase de GFS ; le même deux fois ne change rien ;
//      « Nouveau » la ramène à son écran de départ, toujours dans le même cadre.
//   6. La langue de GFS change : Form+ se recharge et retrouve le formulaire qu'elle tenait.
// Deux CONSTAT, à Form+ (consigne 012), mesurés à c249c4a : au démarrage, « Nouveau » rouvre un ancien formulaire (`onOptions` ne lit pas `raison: nouveau` : le formulaire gardé ouvert,
// sinon `resolveMyDefinition()`, ambiguë dans GFS) ; déjà ouverte, « Nouveau » laisse l'éditeur du formulaire précédent affiché sous l'écran de départ (`showConfig()` ne cache `#editor`
// que par « Changer de formulaire source »). Le labo les dit sans les exiger ; ils passent en `check` quand Form+ les aura corrigés.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark ; LAB_LIVE=1 pour jouer le site en ligne de l'app au lieu de sa copie.
import { startLab } from './lab-setup.mjs';
import { seedFormDesigner } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `ouvrir-form-${lang}-${scheme}`;
const WORDS = lang === 'fr'
  ? { form: /^Formulaire/, start: /Comment voulez-vous démarrer/i, other: 'English', otherCode: 'en' }
  : { form: /^Form/, start: /How do you want to start/i, other: 'Français', otherCode: 'fr' };
const FIRST = { title: 'Inscription à une formation', question: 'Ville de départ' };
const SECOND = { title: 'Demande de matériel', question: 'Matériel demandé' };
const FORM_URL = /(apps\/form|FormPlus)\//;
// Le Grist du labo est en http : la politique de l'app (`connect-src 'self' https:`) refuse sa lecture de /forms/N, ce que Grist en ligne (https) laisse passer. Propre au labo.
const LAB_ONLY = /Content Security Policy|Refused to connect/;
const LAB_GRIST = /127\.0\.0\.1:8910\/o\/docs\/api\/s\/LABO\/forms\/\d+/;

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
const errors = [];
page.on('console', message => {
  if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text());
  if (message.type() === 'error' && FORM_URL.test(message.location().url || '') && !(LAB_ONLY.test(message.text()) && LAB_GRIST.test(message.text()))) errors.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));
await lab.fitPanel(undefined, 700, 400);

let frame = lab.frame;
let app = null;
const restart = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
// Ce que Form+ n'a pas encore corrigé : dit, sans faire échouer le rejeu (consigne 012) ; « OK » dès qu'elle l'aura fait, et le moment de le passer en `check`.
const constat = (label, ok, detail) => (ok ? say('OK    ', label) : say('CONSTAT', label, detail));
const toast = async () => ((await frame.locator('#toast').isVisible()) ? (await frame.locator('#toast').innerText()).replace(/\s+/g, ' ') : '');
const explorerHidden = () => frame.locator('.ex').isHidden();
// La table n'existe qu'à partir du premier formulaire : « absente » le dit.
const rowsOf = () => frame.evaluate(async () => {
  if (!(await grist.docApi.listTables()).map(String).includes('FormPlus_Formulaires')) return 'absente';
  const data = await grist.docApi.fetchTable('FormPlus_Formulaires');
  return JSON.stringify([data.id, data.Nom, data.Definition]);
});
const formFrames = () => page.frames().filter(f => FORM_URL.test(f.url()) && !f.isDetached());
// Ce que la personne voit dans l'app, par l'état affiché (classe `hidden` et style calculé) : « Connexion à Grist… » d'abord, puis l'écran de départ, le concepteur ou le formulaire.
const shown = () => app.evaluate(() => {
  const on = id => { const el = document.getElementById(id); return Boolean(el) && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; };
  const title = document.getElementById('opt-title');
  return {
    loading: on('loading'),
    choices: on('config') && on('step1') && on('start-choices'),
    editor: on('editor'),
    title: title ? title.value : '',
    questions: [...document.querySelectorAll('#qlist input, #qlist textarea')].map(field => field.value).join(' | '), // les libellés des questions sont des champs de saisie
    texte: document.body.innerText.replace(/\s+/g, ' ').slice(0, 100),
  };
});
// Attend que l'app ait fini de se connecter, puis que `test` soit vrai.
const waitShown = async (test, ms = 15000) => {
  for (let i = 0; i < ms / 200; i++) {
    const seen = await shown().catch(() => null);
    if (seen && !seen.loading && test(seen)) return seen;
    await page.waitForTimeout(200);
  }
  return shown().catch(() => null);
};
// L'app a fini de décider ce qu'elle montre : connectée, puis un moment pour ses lectures de la table (le concepteur ne s'affiche qu'après elles).
const settled = async () => {
  await waitShown(() => true);
  await page.waitForTimeout(1500);
  return shown();
};
const showFiles = async () => {
  await frame.locator('#floater-files').click();
  await frame.locator('.ls-row').first().waitFor();
  if (await frame.locator('.crumbs [data-path=""]').count()) await frame.locator('.crumbs [data-path=""]').click();
};
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const newMenuItem = async () => {
  await frame.locator('.btn.primary').click();
  await frame.locator('.menu').waitFor();
  return frame.locator('.menu-item', { hasText: WORDS.form }).first();
};

// 1. Le menu « Nouveau » : Form+ n'est pas encore installée, la ligne est là, grisée ; un clic dit pourquoi.
await restart();
let item = await newMenuItem();
check('« Nouveau » propose « Formulaire » (le manifeste de Form+ ouvre ce type), grisé tant que Form+ n\'est pas installée', (await item.count()) === 1 && (await item.getAttribute('aria-disabled')) === 'true', await item.count());
await lab.shotPanel(run, '0-menu-grise', frame);
// La vraie souris sur la ligne grisée (Playwright refuse de cliquer un contrôle grisé : on pose le pointeur nous-mêmes).
const greyed = await item.boundingBox();
await page.mouse.click(greyed.x + greyed.width / 2, greyed.y + greyed.height / 2);
await page.waitForTimeout(500);
check('un clic sur la ligne grisée ne lance rien : la fenêtre « Apps et extensions » ou une phrase dit pourquoi', (await frame.locator('.mod').count()) > 0 || (await toast()) !== '', { fenetre: await frame.locator('.mod').count(), phrase: await toast() });
await page.keyboard.press('Escape');

// Installer Form+ par la fenêtre, comme une personne.
await lab.openModules(frame);
await frame.locator('[data-fk="app:form"]').check();
await lab.settle(frame);
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'hidden' });
await restart();
const before = await rowsOf();

// 2. « Nouveau > Formulaire » quand l'app n'est pas ouverte, dans un document sans formulaire.
item = await newMenuItem();
check('Form+ installée, la ligne « Formulaire » du menu « Nouveau » n\'est plus grisée', (await item.getAttribute('aria-disabled')) !== 'true', await item.getAttribute('aria-disabled'));
await item.click();
app = await lab.appFrame(FORM_URL);
let seen = await settled();
say('au démarrage, « Nouveau », sans formulaire :', seen, 'phrase de GFS :', await toast());
check('« Nouveau > Formulaire » : Form+ démarre sur son écran de départ, l\'explorateur se ferme, GFS ne dit rien', seen.choices && !seen.editor && (await toast()) === '' && (await explorerHidden()), { seen, phrase: await toast() });
check('rien n\'est écrit dans le document par cette ouverture', (await rowsOf()) === before, await rowsOf());
await lab.shotPanel(run, '1-nouveau', frame);

// 3. Des formulaires sont enregistrés, comme Form+ les range (une ligne chacun, toutes sur la section partagée de GFS) : « Nouveau » doit encore donner l'écran de départ.
await seedFormDesigner(frame, FIRST);
await seedFormDesigner(frame, { ...SECOND, questions: [{ id: 'q1', kind: 'text', label: SECOND.question, writeTable: 'Clients', writeCol: 'Ville' }] });
const saved = await rowsOf();
await restart();
item = await newMenuItem();
await item.click();
app = await lab.appFrame(FORM_URL);
seen = await settled();
say('au démarrage, « Nouveau », avec des formulaires :', seen, 'phrase de GFS :', await toast());
constat('« Nouveau > Formulaire » avec des formulaires enregistrés : l\'écran de départ, pas un ancien formulaire', seen.choices && !seen.editor, seen);
check('GFS ne dit rien, rien n\'est écrit dans le document', (await toast()) === '' && (await rowsOf()) === saved, await toast());
await lab.shotPanel(run, '1b-nouveau-avec-formulaires', frame);

// 4. Le double-clic d'un formulaire quand l'app n'est pas ouverte.
await restart();
await row(FIRST.title).dblclick();
app = await lab.appFrame(FORM_URL);
seen = await waitShown(view => view.editor && view.title === FIRST.title);
say('au démarrage, double-clic :', seen, 'phrase de GFS :', await toast());
check('le double-clic lance Form+ sur CE formulaire : son titre et ses questions', seen.editor && seen.title === FIRST.title && seen.questions.includes(FIRST.question), seen);
check('GFS ne dit rien (l\'app connaît l\'ouverture) et l\'explorateur se ferme', (await toast()) === '' && (await explorerHidden()), await toast());
await app.evaluate(() => { window.__marque = 'avant'; });
await lab.shotPanel(run, '2-double-clic', frame);

// 5. L'app est déjà ouverte : un autre formulaire, dans le même cadre.
await showFiles();
await row(SECOND.title).dblclick();
seen = await waitShown(view => view.editor && view.title === SECOND.title);
say('app déjà ouverte :', seen, 'phrase de GFS :', await toast());
check('Form+ déjà ouverte ouvre l\'autre formulaire dans le même cadre (non rechargé), sans question', seen.title === SECOND.title && seen.questions.includes(SECOND.question) && !seen.questions.includes(FIRST.question)
  && (await app.evaluate(() => window.__marque)) === 'avant' && formFrames().length === 1, seen);
check('GFS ne dit rien, l\'explorateur se ferme', (await toast()) === '' && (await explorerHidden()), await toast());
await showFiles();
await row(SECOND.title).dblclick();
await page.waitForTimeout(1000);
const again = await shown();
check('le même formulaire deux fois : rien ne change', again.title === SECOND.title && again.questions === seen.questions && (await app.evaluate(() => window.__marque)) === 'avant', again);
await showFiles();
item = await newMenuItem();
await item.click();
seen = await waitShown(view => view.choices);
check('« Nouveau » pendant que Form+ tourne : son écran de départ, dans le même cadre, sans rechargement ni phrase de GFS', seen.choices && (await app.evaluate(() => window.__marque)) === 'avant' && (await toast()) === '' && formFrames().length === 1, { seen, phrase: await toast() });
seen = await settled();
constat('« Nouveau » pendant que Form+ tourne : l\'éditeur du formulaire précédent n\'est plus affiché sous l\'écran de départ', seen.choices && !seen.editor, seen);
await lab.shotPanel(run, '3-nouveau-pendant', frame);
check('rien n\'est écrit dans le document par ces ouvertures', (await rowsOf()) === saved);

// 6. La langue de GFS change : Form+ se recharge et retrouve son formulaire.
await showFiles();
await row(FIRST.title).dblclick();
await waitShown(view => view.editor && view.title === FIRST.title);
await showFiles();
await frame.locator('.tb-lang').click();
await frame.locator('.menu').waitFor();
await frame.locator('.menu-item', { hasText: new RegExp(`^${WORDS.other}$`) }).click();
await app.waitForFunction(() => !window.__marque, null, { timeout: 30000 }).catch(() => {});
seen = await waitShown(view => view.editor && view.title === FIRST.title, 30000);
say('après le changement de langue :', seen, 'langue de l\'app :', await app.evaluate(() => document.documentElement.lang).catch(() => '?'));
check('Form+ se recharge dans l\'autre langue et rouvre le formulaire qu\'elle tenait', seen && seen.editor && seen.title === FIRST.title && seen.questions.includes(FIRST.question), seen);
check('aucun avertissement de GFS, aucune erreur de script dans l\'app', warnings.length === 0 && errors.length === 0, { avertissements: warnings, erreurs: errors });
await lab.browser.close();
