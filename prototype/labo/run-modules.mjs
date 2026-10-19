// V0.2 et V0.3 : la fenêtre « Apps et extensions » dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris et au vrai clavier (Playwright :
// événements du pointeur et du clavier du navigateur, jamais dispatchEvent). Les apps installées se retiennent dans la table `GFS_Rangement` du document
// (contrats 7.4) : la question de la création, le refus, l'accord, l'écriture, le rechargement du cadre de GFS.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark, LAB_W (largeur du panneau), LAB_READONLY=1 (la vue est ouverte en lecture seule : la fenêtre se grise).
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const panelWidth = Number(process.env.LAB_W || 700);
const readonly = process.env.LAB_READONLY === '1';
const run = `modules-${lang}-${scheme}${panelWidth === 700 ? '' : `-${panelWidth}`}${readonly ? '-lecture-seule' : ''}`;
const lab = await startLab({ lang, colorScheme: scheme, query: readonly ? 'readonly=true' : '' });
const { page } = lab;
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && /GFS/.test(m.text())) warnings.push(m.text().slice(0, 200)); });
await lab.fitPanel(undefined, panelWidth, 400);
const frame = lab.frame;
const shot = name => lab.shotPanel(run, name, frame);
const text = async locator => (await locator.innerText()).replace(/\s+/g, ' ').trim();
const rangement = () => lab.rangement(frame);
const appsOption = async () => (await rangement()).value;
const insideWindow = () => frame.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('.mod')));
const count = () => text(frame.locator('.mod-count'));
// La ligne d'une extension : Publipostage+ en déclare deux, le graphique (avec un CDN) et l'édition collaborative (sans : la copie de GFS est son seul mode).
const extRow = id => frame.locator('.mr', { has: frame.locator(`[data-ext="${id}"]`) });
const state = () => frame.evaluate(() => ({
  explorerInert: document.querySelector('.ex').inert, framesInert: document.getElementById('frames').inert, floatersInert: document.getElementById('floaters').inert,
  explorerHidden: document.querySelector('.ex').hidden, windows: document.querySelectorAll('.mod').length, appFrames: document.querySelectorAll('.app-frame').length,
}));
say('panneau :', await (await frame.frameElement()).boundingBox());

// ----- Porte 3 : la première ouverture d'une section sans choix retenu ouvre la fenêtre, une fois.
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(500);
if (readonly) {
  check('lecture seule : la fenêtre ne s\'ouvre pas toute seule', (await state()).windows === 0);
  await frame.locator('.ex-title-row .tb', { hasText: /Apps/ }).click();
} else {
  check('première ouverture : la fenêtre est là', (await state()).windows === 1);
}
await frame.locator('.mod').waitFor();
say('titre :', await text(frame.locator('.mod-head')));
say('lignes :', await frame.locator('.mr').allInnerTexts().then(a => a.map(t => t.replace(/\s+/g, ' ').trim().slice(0, 90))));
say('rappel :', await text(frame.locator('.mod-note')));
check('le clavier est dans la fenêtre', await insideWindow());
check('le fond est inerte', (await state()).explorerInert === true && (await state()).framesInert === true);
check('Publipostage+ ne se décoche pas', await frame.locator('[data-fk="app:publipostage"]').isDisabled());
// Le versionnage (outils/versions.mjs) : la carte d'importation passe la politique de sécurité, et chaque fichier de GFS se charge une seule fois, à son adresse versionnée.
const loaded = await frame.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name).filter(name => /\/(js|css)\/[^/?]+\.(js|css)(\?|$)/.test(name)));
check('chaque script et chaque feuille de style de GFS est chargé à son adresse versionnée', loaded.length > 25 && loaded.every(name => /\?v=[0-9a-f]{10}$/.test(name)), loaded.filter(name => !/\?v=/.test(name)));
check('aucun fichier de GFS n\'est chargé deux fois', new Set(loaded.map(name => name.split('?')[0])).size === loaded.length);
check('1 actif sur 4', /^1 /.test(await count()) || /^1 of 4/.test(await count()), await count());
await shot('1-premiere-ouverture');
await lab.shot(run, '1-page-grist');

// ----- Le clavier : Tab ne sort jamais de la fenêtre ; Échap la ferme et rend le fond.
let kept = true;
for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); kept = kept && await insideWindow(); }
for (let i = 0; i < 14; i++) { await page.keyboard.press('Shift+Tab'); kept = kept && await insideWindow(); }
check('Tab et Maj+Tab restent dans la fenêtre', kept);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
let now = await state();
check('Échap ferme la fenêtre et rend le fond', now.windows === 0 && now.explorerInert === false && now.framesInert === true, now);
check('l\'explorateur est toujours ouvert', !now.explorerHidden);

// ----- Porte « bouton Apps » de l'explorateur.
await frame.locator('.ex-title-row .tb', { hasText: /Apps/ }).click();
await frame.locator('.mod').waitFor();
check('le bouton Apps ouvre la fenêtre', (await state()).windows === 1);
await shot('2-fenetre');
if (readonly) {
  check('lecture seule : toutes les cases sont grisées', (await frame.locator('.mod input:not(:disabled)').count()) === 0);
  say('rappel :', await text(frame.locator('.mod-note')));
  await shot('2b-lecture-seule');
  await lab.browser.close();
  say('avertissements GFS :', warnings);
  process.exit(process.exitCode || 0);
}

// ----- Installer une app : un geste, la table du document naît avec l'accord de la personne, l'installation s'enregistre tout de suite.
const before = await rangement();
check('rien n\'est écrit avant un geste : pas de table GFS_Rangement', before.table === false, before);
check('la fenêtre dit que les choix s\'enregistrent tout de suite', /tout de suite|right away/.test(await text(frame.locator('.mod-note'))), await text(frame.locator('.mod-note')));

// Le refus : rien ne s'installe, rien n'est créé, la case revient, la personne en est avertie.
await frame.locator('label', { hasText: 'Automation+' }).first().click();
await frame.locator('.ask').waitFor();
say('question :', await text(frame.locator('.ask')));
check('la question nomme la table et dit ce qui est ajouté', /GFS_Rangement/.test(await text(frame.locator('.ask'))) && /page/.test(await text(frame.locator('.ask-body'))));
check('la fenêtre des apps est inerte derrière la question', await frame.locator('.mod-scrim').first().evaluate(node => node.inert));
check('le clavier est sur le bouton principal', await frame.evaluate(() => document.activeElement && document.activeElement.dataset.fk === 'ask-yes'));
let askKept = true;
for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); askKept = askKept && await frame.evaluate(() => Boolean(document.activeElement.closest('.ask'))); }
check('Tab reste dans la question', askKept);
await shot('3a-question-creer-la-table');
await lab.shot(run, '3a-page-grist-question');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
check('Échap refuse : la question est partie, la fenêtre des apps reste', (await frame.locator('.ask').count()) === 0 && (await state()).windows === 1);
check('refusé : la case revient, 1 actif sur 4', !(await frame.locator('[data-fk="app:automation"]').isChecked()) && /^1 /.test(await count()), await count());
const refused = await rangement();
check('refusé : aucune table créée, aucune page de plus', refused.table === false && refused.pages === before.pages && refused.tables === before.tables, refused);
check('refusé : la personne est avertie', /GFS_Rangement/.test(await text(frame.locator('#toast'))), await text(frame.locator('#toast')));
check('refusé : le clavier est revenu sur la case', await frame.evaluate(() => document.activeElement && document.activeElement.dataset.fk === 'app:automation'));
await shot('3b-apres-refus');

// L'accord : la table naît avec ses colonnes et une page, la ligne réservée porte les apps.
await frame.locator('label', { hasText: 'Automation+' }).first().click();
await frame.locator('.ask').waitFor();
await frame.locator('[data-fk="ask-yes"]').click();
await frame.waitForFunction(() => document.body.dataset.registry === 'idle' && document.querySelectorAll('.ask').length === 0, null, { timeout: 15000 });
check('Automation+ installée : 2 actifs sur 4', /^2 /.test(await count()), await count());
const made = await rangement();
say('table du document :', made);
check('la table GFS_Rangement existe avec ses sept colonnes', made.table && ['Utilisateur', 'App', 'Fichier', 'Favori', 'Dossier', 'Replie', 'Valeur'].every(name => made.columns.includes(name)), made.columns);
check('Grist a ajouté une page pour elle', made.pages === before.pages + 1 && made.tables === before.tables + 1, made);
check('une seule ligne : la ligne réservée, avec les apps', made.rows === 1 && JSON.stringify(made.value) === JSON.stringify({ publipostage: { extensions: [] }, automation: { extensions: [] } }), made);
check('Automation+ a son bouton Ouvrir', await frame.locator('[data-open="automation"]').isVisible());
check('le clavier est revenu sur la case', await frame.evaluate(() => document.activeElement && document.activeElement.dataset.fk === 'app:automation'));
await lab.shot(run, '3-page-grist-apres-accord');
await shot('3-automation-installee');

// ----- Activer l'extension, choisir la copie de GFS.
check('le mode est grisé tant que l\'extension est décochée', await extRow('graphique').locator('.mr-mode').evaluate(node => node.disabled));
await frame.locator('label', { hasText: /^\s*Graphique|^\s*Chart/ }).first().click();
await page.waitForTimeout(500);
check('la table existe déjà : aucune question de plus', (await frame.locator('.ask').count()) === 0);
check('Graphique cochée : 3 actifs sur 4', /^3 /.test(await count()), await count());
check('le mode se choisit maintenant', !(await extRow('graphique').locator('.mr-mode').evaluate(node => node.disabled)));
await extRow('graphique').locator('.rd', { hasText: /Copie de GFS|GFS copy/ }).click();
await page.waitForTimeout(500);
check('mode « copie de GFS » retenu pour l\'extension', JSON.stringify(await appsOption()) === JSON.stringify({ publipostage: { extensions: ['graphique'], modes: { graphique: 'vendorise' } }, automation: { extensions: [] } }), await appsOption());
await shot('4-extension-copie-de-gfs');
await extRow('graphique').locator('.rd', { hasText: /CDN/ }).click();
await page.waitForTimeout(400);
check('retour au CDN : le défaut ne s\'écrit pas', JSON.stringify((await appsOption()).publipostage) === JSON.stringify({ extensions: ['graphique'] }), (await appsOption()).publipostage);

// ----- Le cadre de GFS est rechargé (la page de Grist se recharge, ou le niveau d'accès change : le cadre est reconstruit) : les apps reviennent de la table.
const saved = await rangement();
await frame.evaluate(() => location.reload());
await frame.waitForFunction(() => document.body.dataset.gfs === 'ready' && document.body.dataset.gfsFirstRun === 'done', null, { timeout: 60000 });
await page.waitForTimeout(500);
check('rechargé : la fenêtre des apps ne s\'ouvre pas toute seule', (await state()).windows === 0);
await frame.locator('.ex-title-row .tb', { hasText: /Apps/ }).click();
await frame.locator('.mod').waitFor();
check('rechargé : 3 actifs sur 4, comme avant', /^3 /.test(await count()), await count());
check('rechargé : Automation+ et Graphique sont cochées', (await frame.locator('[data-fk="app:automation"]').isChecked()) && (await frame.locator('[data-fk="ext:publipostage/graphique"]').isChecked()));
check('rechargé : rien n\'a été récrit ni créé', JSON.stringify(await rangement()) === JSON.stringify(saved), await rangement());
await shot('4b-apres-rechargement');

// ----- Ouvrir une app depuis sa ligne, puis la fenêtre depuis l'app (le bouton « Apps » flottant).
await frame.locator('[data-open="publipostage"]').click();
await page.waitForTimeout(600);
now = await state();
check('« Ouvrir » ferme la fenêtre et ouvre l\'app', now.windows === 0 && now.explorerHidden && now.appFrames === 1, now);
await frame.locator('#floater-apps').waitFor({ state: 'visible' });
await page.waitForTimeout(5000);
await frame.locator('#floater-apps').click();
await frame.locator('.mod').waitFor();
now = await state();
check('depuis l\'app : le cadre de l\'app est inerte', now.windows === 1 && now.framesInert === true, now);
await shot('5-depuis-une-app');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
now = await state();
check('Échap : le cadre de l\'app retrouve son état', now.windows === 0 && now.framesInert === false, now);
check('le clavier revient au bouton Apps', await frame.evaluate(() => document.activeElement && document.activeElement.id === 'floater-apps'));

// ----- Retirer l'app active : le cadre se ferme, l'explorateur revient.
await frame.locator('#floater-files').click();
await page.waitForTimeout(300);
await frame.locator('.ex-title-row .tb', { hasText: /Apps/ }).click();
await frame.locator('[data-open="automation"]').click();
await page.waitForTimeout(800);
check('Automation+ est l\'app active', await frame.evaluate(() => document.querySelector('.app-frame').title.startsWith('Automation')));
await frame.locator('#floater-apps').click();
await frame.locator('label', { hasText: 'Automation+' }).first().click();
await page.waitForTimeout(800);
now = await state();
check('retirer l\'app active ferme son cadre et rouvre l\'explorateur', now.appFrames === 0 && !now.explorerHidden, now);
check('Automation+ n\'est plus dans les réglages', !(await appsOption()).automation, await appsOption());
await shot('6-apres-retrait');
await page.keyboard.press('Escape');

// ----- La roue des réglages de la vue dans Grist : la porte permanente.
await page.getByText('Open configuration', { exact: false }).first().click({ timeout: 5000 }).catch(() => say('(pas de bouton « Open configuration » dans le panneau de Grist)'));
await page.waitForTimeout(800);
check('la roue de Grist ouvre la fenêtre', (await state()).windows === 1);
await lab.shot(run, '7-page-grist-roue');
await lab.browser.close();
say('avertissements GFS :', warnings);
