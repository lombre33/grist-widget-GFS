// Ouvrir le bon modèle de Publipostage+ depuis l'explorateur de GFS (consigne 010 ; contrats 5.2 point 3 et 5.4 point 1), avec la vraie app, celle que GFS référence, dans un vrai Grist, à
// 700 × 400, à la vraie souris et au vrai clavier. Le double-clic d'un fichier lance l'app sur ce modèle (l'`ouverture` du contexte) ; l'app déjà ouverte reçoit l'appel `ouvrir`, et pose
// sa question « Enregistrer / Abandonner / Annuler » dans le panneau quand des modifications attendent : GFS attend, sans rien dire. « Nouveau » (consigne 014) ouvre un modèle vierge du
// type, au démarrage comme app déjà ouverte, sans phrase de GFS ; l'ouverture n'est rendue qu'une fois (contrats 5.2, point 3) : un cadre rechargé sur place ne refait pas le « Nouveau », sauf quand l'app l'a voulu elle-même (Réglages) : elle rouvre alors le modèle où la personne était.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `ouvrir-publipostage-${lang}-${scheme}`;
const WORDS = lang === 'fr'
  ? { opened: /Ouvert depuis l.explorateur\./, unsaved: /^Modèle non enregistré/, buttons: ['Annuler', 'Abandonner', 'Enregistrer'], types: { document: /Document/, grille: /Grille/, email: /E-mail/, macro: /Macro/ } }
  : { opened: /Opened from the explorer\./, unsaved: /^Template not saved/, buttons: ['Cancel', 'Discard', 'Save'], types: { document: /Document/, grille: /Grid/, email: /Email/, macro: /Macro/ } };
const USUAL = 'Feuille d’émargement'; // le modèle ★ du document d'essai : celui que l'app ouvre d'elle-même
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
page.on('console', m => { if (m.type() === 'warning' && m.text().startsWith('GFS')) warnings.push(m.text()); });
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
// La personne a un modèle ★ (par défaut) : c'est celui que l'app ouvre d'elle-même, le double-clic doit passer devant.
await lab.frame.evaluate(() => grist.docApi.applyUserActions([['UpdateRecord', 'Publipostage_Modeles', 1, { EstParDefaut: true }]]));

// GFS repart (le document garde ses tables) : l'explorateur d'abord, aucune app ouverte.
let frame = lab.frame;
let app = null;
const restart = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(800);
};
await restart();

const row = text => frame.locator('.ls-row', { hasText: text }).first();
const toast = async () => ((await frame.locator('#toast').isVisible()) ? (await frame.locator('#toast').innerText()).replace(/\s+/g, ' ') : '');
const explorerHidden = () => frame.locator('.ex').isHidden();
// Ce que la personne voit dans l'app : le modèle ouvert (numéro, nom, texte) et le coin d'état.
const shown = () => app.evaluate(() => ({
  id: String(Templates.getCurrentId()), name: document.getElementById('template-name').value,
  text: document.querySelector('.ProseMirror').textContent, status: document.getElementById('status-msg').textContent,
}));
const waitShown = async (name, ms = 12000) => {
  for (let i = 0; i < ms / 100; i++) {
    const seen = await shown().catch(() => null);
    if (seen && seen.name === name) return seen;
    await page.waitForTimeout(100);
  }
  return shown().catch(() => null);
};
// L'app a fini de démarrer quand son coin d'état a dit quelque chose.
const waitStarted = async () => {
  await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
  await page.waitForTimeout(600);
};
const goRoot = async () => { if (await frame.locator('.crumbs [data-path=""]').count()) await frame.locator('.crumbs [data-path=""]').click(); };
const showFiles = async () => {
  await frame.locator('#floater-files').click();
  await frame.locator('.ls-row').first().waitFor();
  await goRoot();
  await frame.locator('.ls-row', { hasText: 'Quittance de loyer' }).first().waitFor();
};
// Ce que le document retient : les modèles (tous leurs champs, la date comprise) et les réglages de la section.
const snapshot = () => frame.evaluate(async () => JSON.stringify({
  modeles: await grist.docApi.fetchTable('Publipostage_Modeles'), vue: (await grist.docApi.fetchTable('_grist_Views_section')).options,
}));
const contentOf = name => frame.evaluate(async n => {
  const data = await grist.docApi.fetchTable('Publipostage_Modeles');
  return data.Contenu[data.Nom.indexOf(n)];
}, name);

// 1. « Nouveau » quand l'app n'est pas ouverte (consigne 014) : elle démarre sur un modèle vierge du type demandé, à la place du ★ ; GFS ne dit rien, le coin d'état de l'app garde « modèle non
//    enregistré », rien n'est écrit dans le document.
const blankShown = () => app.evaluate(() => ({
  id: String(Templates.getCurrentId() || ''), name: document.getElementById('template-name').value, text: document.querySelector('.ProseMirror').textContent,
  status: document.getElementById('status-msg').textContent, email: !document.getElementById('btn-create-email').hidden, grid: GridEditor.isActive(),
  macro: getComputedStyle(document.getElementById('macro-editor-modal')).display !== 'none',
}));
const isBlank = seen => Boolean(seen) && seen.id === '' && seen.name === '' && seen.text === '' && WORDS.unsaved.test(seen.status);
const waitFor = async (test, ms = 12000) => {
  for (let i = 0; i < ms / 100; i++) {
    const seen = await blankShown().catch(() => null);
    if (test(seen)) return seen;
    await page.waitForTimeout(100);
  }
  return blankShown().catch(() => null);
};
// Le premier départ de l'app écrit lui-même dans le document (des colonnes ajoutées à ses tables) : il passe par la fenêtre des apps, sans consigne, avant la première mesure.
await lab.openModules(frame);
await frame.locator('[data-open="publipostage"]').click();
app = await lab.appFrame(/publipostage/);
await waitStarted();
const before = await snapshot();
await restart();
await frame.locator('.btn.primary').click();
await frame.locator('.menu-item', { hasText: WORDS.types.document }).click();
app = await lab.appFrame(/publipostage/);
await waitStarted();
const blank = await waitFor(isBlank);
say('au démarrage, « Nouveau » :', blank, 'phrase de GFS :', await toast());
check('« Nouveau » quand l\'app n\'est pas ouverte : elle démarre sur un modèle vierge à la place du ★, son coin d\'état garde « modèle non enregistré », GFS ne dit rien',
  isBlank(blank) && (await toast()) === '' && (await explorerHidden()), { blank, phrase: await toast() });
const afterStart = await snapshot();
const diffOf = (a, b) => {
  const x = JSON.parse(a); const y = JSON.parse(b);
  const columns = Object.keys({ ...x.modeles, ...y.modeles }).filter(key => JSON.stringify(x.modeles[key]) !== JSON.stringify(y.modeles[key]));
  return { colonnes: columns, vueAvant: x.vue, vueApres: y.vue };
};
check('rien n\'est écrit dans le document par cette ouverture (ni modèle, ni ★, ni réglage de la vue)', afterStart === before, diffOf(before, afterStart));
await lab.shotPanel(run, '0-nouveau-au-demarrage', frame);

// 1 bis. La personne écrit, nomme et enregistre ce modèle, puis le cadre de l'app est rechargé sur place (sa langue, un réglage qui le demande) : l'app redemande son contexte, n'y retrouve pas le
//    « Nouveau » déjà fait et reprend son ordre habituel (le ★), au lieu de rouvrir un modèle vierge.
const NAMED = 'Modèle du labo';
const WRITTEN = 'Écrit dans le modèle vierge';
const box = await app.locator('.ProseMirror p').first().boundingBox();
await page.mouse.click(box.x + 20, box.y + box.height / 2);
await page.keyboard.type(WRITTEN);
await app.locator('#btn-rename-template').click();
await page.keyboard.type(NAMED);
await page.keyboard.press('Enter');
await app.locator('#btn-save').click();
let namedSaved = false;
for (let i = 0; i < 100 && !namedSaved; i++) { namedSaved = Boolean(await contentOf(NAMED).catch(() => undefined)); if (!namedSaved) await page.waitForTimeout(100); }
check('le modèle vierge est enregistré sous son nom, avec ce qui a été écrit', namedSaved && (await contentOf(NAMED)).includes(WRITTEN), await contentOf(NAMED));
await app.evaluate(() => { window.__avant = true; });
await app.evaluate(() => location.reload()).catch(() => {});
await app.waitForFunction(() => !window.__avant && Boolean(document.getElementById('status-msg') && document.getElementById('status-msg').textContent), null, { timeout: 30000 });
await page.waitForTimeout(800);
const usual = await shown().catch(() => ({ name: '' }));
say('modèle ouvert après le rechargement du cadre :', usual, 'phrase de GFS :', await toast());
check('le cadre de l\'app rechargé sur place reprend son ordre habituel (le ★), il ne rouvre pas de modèle vierge, GFS ne dit rien',
  usual.name === USUAL && usual.id !== '' && !WORDS.opened.test(usual.status) && !WORDS.unsaved.test(usual.status) && (await toast()) === '', { usual, phrase: await toast() });
await lab.shotPanel(run, '1-apres-rechargement', frame);
const base = await snapshot();

// 2. Le double-clic d'un fichier quand l'app n'est pas ouverte : elle démarre sur CE modèle.
await restart();
await row('Contrat de prestation').dblclick();
app = await lab.appFrame(/publipostage/);
let seen = await waitShown('Contrat de prestation');
say('au démarrage :', seen, 'phrase de GFS :', await toast());
check('le double-clic lance l\'app sur le modèle cliqué, avant le ★', seen.name === 'Contrat de prestation' && seen.text === 'Contrat de prestation' && seen.name !== usual.name, { seen, usual });
check('le coin d\'état dit pourquoi, et GFS n\'ajoute aucune phrase', WORDS.opened.test(seen.status) && (await toast()) === '' && (await explorerHidden()), { status: seen.status, phrase: await toast() });
await waitStarted();
await app.evaluate(() => { window.__marque = 'avant'; });

// 3. L'app est déjà ouverte : GFS lui envoie l'appel `ouvrir`, elle change de modèle sans se recharger.
await showFiles();
await row('Quittance de loyer').dblclick();
seen = await waitShown('Quittance de loyer');
say('app déjà ouverte :', seen, 'phrase de GFS :', await toast());
check('l\'app déjà ouverte ouvre le modèle cliqué, dans le même cadre (elle n\'est pas rechargée)',
  seen.name === 'Quittance de loyer' && seen.text === 'Quittance de loyer' && (await app.evaluate(() => window.__marque)) === 'avant' && page.frames().filter(f => /\/apps\/publipostage\//.test(f.url())).length === 1, seen);
check('le coin d\'état dit pourquoi, l\'explorateur se ferme, GFS n\'ajoute aucune phrase', WORDS.opened.test(seen.status) && (await explorerHidden()) && (await toast()) === '', { status: seen.status, phrase: await toast() });

// 4. Le modèle déjà ouvert : rien ne change.
await showFiles();
await row('Quittance de loyer').dblclick();
await page.waitForTimeout(800);
const again = await shown();
check('le modèle demandé est déjà ouvert : rien ne change, l\'explorateur se ferme, aucune phrase', JSON.stringify(again) === JSON.stringify(seen) && (await explorerHidden()) && (await toast()) === '', { again, phrase: await toast() });
check('rien n\'est écrit dans le document par ces ouvertures (ni modèle, ni ★, ni réglage de la vue)', (await snapshot()) === base);

// 4 bis. Le rechargement que l'app veut elle-même (Réglages > Déclencheur : changer le caractère, puis « Recharger maintenant » ; le changement de langue passe par le même chemin) : elle rouvre le
//    modèle où la personne était, ici celui du dernier double-clic, et non le ★ comme après un rechargement venu d'ailleurs (1 bis). L'identifiant passe par le fragment de l'adresse du cadre (le
//    stockage est refusé dans le cadre isolé) ; GFS ne rend pas l'ouverture une seconde fois et ne dit rien. Le choix de langue de l'app est, lui, refusé dans GFS : sans stockage, il ne survivrait pas.
await app.evaluate(() => { window.__langue = 'avant'; });
await app.locator('#v2-btn-settings').click();
const langBefore = await app.evaluate(() => document.querySelector('input[name="settings-lang"]:checked').value);
await app.locator(`label:has(input[name="settings-lang"][value="${langBefore === 'fr' ? 'en' : 'fr'}"])`).click();
await page.waitForTimeout(1500);
const langAfter = await app.evaluate(() => ({ mark: window.__langue, checked: document.querySelector('input[name="settings-lang"]:checked').value }));
check('le choix de langue de l\'app est refusé dans GFS (pas de stockage dans le cadre isolé) : le cadre n\'est pas rechargé et la case revient sur la langue de la page',
  langAfter.mark === 'avant' && langAfter.checked === langBefore, { langBefore, langAfter });
await app.locator('[data-settings-tab="triggerKey"]').click();
await app.locator('#settings-trigger-char').focus();
await page.keyboard.press('ArrowDown');
const notice = await app.locator('#settings-trigger-reload-notice').isVisible();
await app.evaluate(() => { window.__rechargement = 'avant'; });
await app.locator('#settings-trigger-reload-btn').click();
await app.waitForFunction(() => !window.__rechargement && Boolean(document.getElementById('status-msg') && document.getElementById('status-msg').textContent), null, { timeout: 30000 });
await page.waitForTimeout(800);
const reopened = await shown().catch(() => ({ name: '' }));
say('après « Recharger maintenant » :', reopened, 'adresse du cadre :', app.url(), 'phrase de GFS :', await toast());
check('« Recharger maintenant » (Déclencheur) : l\'app se recharge et rouvre le modèle où la personne était, pas le ★ ; GFS ne dit rien',
  notice && reopened.name === 'Quittance de loyer' && reopened.text === 'Quittance de loyer' && reopened.name !== USUAL && (await toast()) === '', { notice, reopened, phrase: await toast() });
check('l\'adresse du cadre redevient celle de GFS (access et gfs gardés, plus de fragment) et l\'app reste un seul cadre',
  /access=/.test(app.url()) && /gfs=/.test(app.url()) && !app.url().includes('#') && page.frames().filter(f => /\/apps\/publipostage\//.test(f.url())).length === 1, app.url());
check('rien n\'est écrit dans le document par ce rechargement', (await snapshot()) === base);
if (reopened.name !== 'Quittance de loyer') { await showFiles(); await row('Quittance de loyer').dblclick(); await waitShown('Quittance de loyer'); }

// 5. Des modifications attendent : l'app pose sa question dans le panneau, GFS attend sans rien dire. L'enregistrement automatique de l'app (toutes les 2,5 s) peut passer entre la frappe
//    et la demande : elle enregistre alors, ouvre sans question, et l'essai recommence sur l'autre modèle (jamais plus de huit fois).
const dialog = () => app.evaluate(() => {
  const overlay = document.getElementById('pp-dialog-modal');
  if (!overlay || getComputedStyle(overlay).display === 'none') return null;
  const box = overlay.querySelector('.modal-content').getBoundingClientRect();
  return { buttons: [...overlay.querySelectorAll('.pp-modal-actions button')].filter(b => !b.hidden).map(b => b.textContent), inPanel: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight };
});
const typeAtEnd = async text => {
  const box = await app.locator('.ProseMirror p').first().boundingBox();
  await page.mouse.click(box.x + box.width - 3, box.y + box.height / 2);
  await page.keyboard.press('End');
  await page.keyboard.type(text);
};
const pair = { open: 'Quittance de loyer', other: 'Contrat de prestation' };
const pending = async (token, via) => {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const typed = `${token}${attempt}`;
    await typeAtEnd(` ${typed}`);
    await showFiles();
    if (via === 'bouton') { await row(pair.other).click(); await frame.locator('.ex-foot .btn').first().click(); } else await row(pair.other).dblclick();
    for (let i = 0; i < 25 && !(await dialog()); i++) await page.waitForTimeout(100);
    if (await dialog()) return { typed, attempt };
    say(`(essai ${attempt} : l'enregistrement automatique est passé, l'app a ouvert sans question)`);
    [pair.open, pair.other] = [pair.other, pair.open];
    await waitShown(pair.open);
  }
  return null;
};
const button = label => app.locator('#pp-dialog-modal .pp-modal-actions button', { hasText: label });

let episode = await pending('ANNULE', 'bouton');
let asked = episode && (await dialog());
await lab.shotPanel(run, '1-question', frame);
check('des modifications attendent : l\'app pose sa question dans le panneau (Annuler, Abandonner, Enregistrer), l\'explorateur est fermé, GFS ne dit rien',
  Boolean(asked) && asked.inPanel && asked.buttons.join('|') === WORDS.buttons.join('|') && (await explorerHidden()) && (await toast()) === '', { asked, phrase: await toast() });
await page.waitForTimeout(1500);
check('GFS attend la personne sans délai : après 1,5 s, la question est toujours là, aucune phrase', Boolean(await dialog()) && (await toast()) === '');
await button(WORDS.buttons[0]).click();
await page.waitForTimeout(800);
seen = await shown();
check('« Annuler » : le modèle ouvert reste, avec ce qui a été tapé ; GFS ne dit rien', seen.name === pair.open && seen.text.includes(episode.typed) && (await toast()) === '' && !(await dialog()), { seen, phrase: await toast() });

episode = await pending('ABANDONNE', 'double-clic');
await button(WORDS.buttons[1]).click();
const left = pair.open;
seen = await waitShown(pair.other);
check('« Abandonner » : le modèle demandé s\'ouvre et dit pourquoi, ce qui a été tapé n\'est pas gardé', seen.name === pair.other && WORDS.opened.test(seen.status) && !(await contentOf(left)).includes(episode.typed), { seen, content: await contentOf(left) });
[pair.open, pair.other] = [pair.other, pair.open];

episode = await pending('ENREGISTRE', 'double-clic');
await button(WORDS.buttons[2]).click();
const saved = pair.open;
seen = await waitShown(pair.other);
check('« Enregistrer » : le modèle quitté est enregistré (l\'écriture de l\'app passe par GFS pendant que son appel attend), puis le modèle demandé s\'ouvre',
  seen.name === pair.other && (await contentOf(saved)).includes(episode.typed) && WORDS.opened.test(seen.status), { seen, content: await contentOf(saved) });
[pair.open, pair.other] = [pair.other, pair.open];
await lab.shotPanel(run, '2-apres-enregistrement', frame);

// 6. Un fichier rangé dans un dossier : l'explorateur y entre, le double-clic ouvre le modèle (le dossier part dans l'appel, l'app l'ignore).
await showFiles();
await row('Facturation').dblclick();
await frame.locator('.ls-row', { hasText: 'Facture / devis multi-TVA' }).first().waitFor();
await row('Facture / devis multi-TVA').dblclick();
seen = await waitShown('Facture / devis multi-TVA');
check('un fichier d\'un dossier s\'ouvre aussi : l\'app ouvre ce modèle', seen && seen.name === 'Facture / devis multi-TVA' && seen.text === 'Facture / devis multi-TVA' && (await explorerHidden()), seen);

// 7. « Nouveau » quand l'app est ouverte (consigne 014) : GFS envoie « ouvrir » sans fichier ; l'app ouvre un modèle vierge du type par le chemin de son bouton « Nouveau » (avec sa question quand des
//    modifications attendent), l'explorateur se ferme, GFS ne dit rien. Un modèle vierge de chaque type, sans rien écrire dans le document.
const newOfType = async type => {
  await showFiles();
  await frame.locator('.btn.primary').click();
  await frame.locator('.menu-item', { hasText: WORDS.types[type] }).click();
};
let open = 'Facture / devis multi-TVA'; // le modèle ouvert : l'enregistrement automatique peut passer entre la frappe et la demande, l'app ouvre alors le vierge sans question et l'essai recommence sur un modèle de la racine
const pendingNew = async token => {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const typed = `${token}${attempt}`;
    await typeAtEnd(` ${typed}`);
    await page.waitForTimeout(((attempt - 1) % 4) * 350); // décale le clic par rapport au passage de l'enregistrement automatique, qui tourne toutes les 2,5 s
    await newOfType('document');
    for (let i = 0; i < 25 && !(await dialog()); i++) await page.waitForTimeout(100);
    if (await dialog()) return { typed, attempt };
    say(`(essai ${attempt} : l'enregistrement automatique est passé, l'app a ouvert le vierge sans question)`);
    open = open === 'Quittance de loyer' ? 'Contrat de prestation' : 'Quittance de loyer';
    await showFiles();
    await row(open).dblclick();
    await waitShown(open);
  }
  return null;
};

episode = await pendingNew('NOUVEAU-ANNULE');
asked = episode && (await dialog());
await lab.shotPanel(run, '3-nouveau-question', frame);
check('« Nouveau » avec des modifications en attente : l\'app pose sa question dans le panneau (Annuler, Abandonner, Enregistrer), l\'explorateur est fermé, GFS ne dit rien',
  Boolean(asked) && asked.inPanel && asked.buttons.join('|') === WORDS.buttons.join('|') && (await explorerHidden()) && (await toast()) === '', { asked, phrase: await toast() });
await button(WORDS.buttons[0]).click();
await page.waitForTimeout(800);
seen = await shown();
check('« Annuler » : le modèle ouvert reste avec ce qui a été tapé, pas de vierge, GFS ne dit rien', seen.name === open && seen.text.includes(episode.typed) && (await toast()) === '' && !(await dialog()), { seen, phrase: await toast() });

// Un passage de l'enregistrement automatique déjà parti quand la question s'ouvre écrit parfois le texte tapé pendant qu'elle est posée : l'épisode recommence alors, sur un autre modèle.
let abandoned = null;
let kept = true;
for (let attempt = 1; attempt <= 4 && kept; attempt++) {
  episode = await pendingNew(`NOUVEAU-ABANDONNE${attempt}-`);
  const left = open;
  await button(WORDS.buttons[1]).click();
  abandoned = await waitFor(isBlank);
  kept = (await contentOf(left)).includes(episode.typed);
  if (kept && attempt < 4) {
    say(`(épisode ${attempt} : l'enregistrement automatique a écrit le texte tapé pendant la question)`);
    open = open === 'Quittance de loyer' ? 'Contrat de prestation' : 'Quittance de loyer';
    await showFiles();
    await row(open).dblclick();
    await waitShown(open);
  }
}
check('« Abandonner » : le modèle vierge s\'ouvre (coin d\'état « modèle non enregistré »), ce qui a été tapé n\'est pas gardé, GFS ne dit rien', isBlank(abandoned) && !kept && (await toast()) === '', { abandoned, kept, phrase: await toast() });
const afterBlank = await snapshot();

const WAITS = { grille: s => Boolean(s) && s.grid, email: s => Boolean(s) && s.email, macro: s => Boolean(s) && s.macro };
const SHOWN = { grille: 'une grille vierge', email: 'un e-mail vierge (le bouton « Créer l\'e-mail »)', macro: 'l\'écran de composition d\'un macro-modèle vide' };
for (const type of ['grille', 'email', 'macro']) {
  await newOfType(type);
  const result = await waitFor(WAITS[type]);
  say(`« Nouveau » ${type} :`, result, 'phrase de GFS :', await toast());
  check(`« Nouveau » (${type}) avec l'app ouverte : ${SHOWN[type]}, l'explorateur se ferme, GFS ne dit rien`, WAITS[type](result) && (await explorerHidden()) && (await toast()) === '', { result, phrase: await toast() });
  if (type === 'macro') await lab.shotPanel(run, '4-nouveau-macro', frame);
}
check('rien n\'est écrit dans le document par ces ouvertures de modèles vierges', (await snapshot()) === afterBlank);
say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
