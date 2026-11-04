// Les liens entre apps avec le VRAI client du kit (`GfsLink.choose` et `GfsLink.openFile`, js/gfs-link.js du dépôt du kit, version 0.3.0), dans un vrai Grist, à 700 × 400, à la vraie souris : la sonde K
// (labo/sondes/q-liens/kit.html) est une app écrite avec le kit, comme le sera Tuesday ; le labo sert le kit sous /kit/ (KIT_DIR, par défaut le clone voisin) et appelle ses deux fonctions. Ce que fait
// GFS de la demande, et la forme exacte de ses réponses, se mesure ici avec le client réel plutôt qu'avec une enveloppe écrite à la main (run-liens.mjs). LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { startLab } from './lab-setup.mjs';
import { say, check, serveKit } from './lab-common.mjs';
import { isGfsWarning } from './sondes-muettes.mjs';

const KIT = process.env.KIT_DIR || '/home/claude/grist-factory-kit';
if (!existsSync(join(KIT, 'js/gfs-link.js'))) {
  say(`le kit n'est pas là (${KIT}) : KIT_DIR=<dossier du dépôt grist-factory-kit>`);
  process.exit(1);
}
const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `liens-kit-${lang}-${scheme}`;
const WORD = lang === 'fr'
  ? { title: 'Via le kit', cancel: 'Annuler', rows: ['Premier', 'Deuxième', 'Troisième'], gone: /Sonde O n’a plus ce fichier/ }
  : { title: 'Through the kit', cancel: 'Cancel', rows: ['First', 'Second', 'Third'], gone: /Probe O no longer has this file/ };
const ACCEPTS = {
  fichier: 'controller.js',
  de: 'const ACCEPTS_OPEN = Object.freeze({',
  vers: "const ACCEPTS_OPEN = Object.freeze({ 'sonde-o': { fichier: true, nouveau: true },",
};
const lab = await startLab({ lang, colorScheme: scheme, probes: true, patches: [ACCEPTS] });
await lab.fitPanel(undefined, 700, 400);
const { page } = lab;
const warnings = [];
page.on('console', m => { if (m.type() === 'warning' && isGfsWarning(m.text())) warnings.push(m.text()); });
// Le kit, servi sous /kit/ à l'adresse de GFS (lab-common.mjs : même origine que la page de la sonde, l'en-tête CORS ouvert comme celui de GitHub Pages).
await serveKit(page, KIT);

const now = Math.floor(Date.now() / 1000);
await lab.frame.evaluate(async ([stamp, names]) => {
  const columns = [{ id: 'Nom', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'DateModif', type: 'DateTime' }];
  await grist.docApi.applyUserActions([['AddTable', 'SondeO_Fichiers', columns]]);
  await grist.docApi.applyUserActions([['BulkAddRecord', 'SondeO_Fichiers', [null, null, null], { Nom: names, Type: ['document', 'document', 'document'], DateModif: [stamp - 60, stamp - 120, stamp - 180] }]]);
}, [now, WORD.rows]);
await lab.frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
const frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);

const waitFor = async (label, test, ms = 8000) => {
  for (let i = 0; i < ms / 100; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
const ex = frame.locator('.ex');
const toast = frame.locator('#toast');
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const shot = name => lab.shotPanel(run, name, frame);
const framesOf = re => page.frames().filter(f => re.test(f.url())).length;

await lab.openModules(frame);
await frame.locator('[data-fk="app:sonde-o"]').check();
await lab.settle(frame);
await page.keyboard.press('Escape');
await frame.locator('.mod').waitFor({ state: 'detached' });
const app = await lab.openApp('sonde-k', /kit\.html/, frame);
await waitFor('la sonde K a reçu son contexte', () => app.evaluate(() => Boolean(document.body.dataset.sonde)));
let started = await app.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}'));
check('l\'app écrite avec le kit sait qu\'elle est hébergée et a reçu son contexte, sans ouverture', started.hosted === true && started.contexte === true && started.ouverture === null, started);

say('=== choose : le client du kit demande, GFS ouvre l\'explorateur en mode choix ===');
await app.evaluate(title => { window.__choix = window.sondeK.GfsLink.choose({ types: ['document', 'document'], titre: title }); }, WORD.title);
await ex.waitFor({ state: 'visible' });
await page.waitForTimeout(300);
check('GFS ouvre l\'explorateur en mode choix avec le titre donné par l\'app, sans doublon de type', (await frame.locator('.ex-title').innerText()).trim() === WORD.title && (await frame.locator('.ls-row').count()) === 3);
await shot('1-choix');
await row(WORD.rows[2]).dblclick();
const key = await app.evaluate(() => window.__choix);
say('clé rendue :', key);
check('le double-clic rend à l\'app la clé { app, id, nom, type }, lue par le client (identifiant en texte)', JSON.stringify(key) === JSON.stringify({ app: 'sonde-o', id: '3', nom: WORD.rows[2], type: 'document' }), key);
check('l\'explorateur se referme, l\'app garde son cadre', await ex.isHidden() && framesOf(/kit\.html/) === 1);

await app.evaluate(() => { window.__choix = window.sondeK.GfsLink.choose({ types: ['document'] }); });
await ex.waitFor({ state: 'visible' });
await frame.locator('.ex-foot .btn').nth(1).click();
check('« Annuler » : le client rend null', (await app.evaluate(() => window.__choix)) === null);

say('=== choose : une demande refusée par le client lui-même, une autre par GFS ===');
const noTypes = await app.evaluate(() => window.sondeK.GfsLink.choose({ types: [] }).then(() => 'ok', error => error.code));
check('sans type, le client refuse sans rien envoyer (GFS_REFUSE) : l\'explorateur ne s\'ouvre pas', noTypes === 'GFS_REFUSE' && await ex.isHidden(), noTypes);
await app.evaluate(() => { window.__premier = window.sondeK.GfsLink.choose({ types: ['document'] }); });
await ex.waitFor({ state: 'visible' });
const second = await app.evaluate(() => window.sondeK.GfsLink.choose({ types: ['document'], apps: ['sonde-o'] }).then(() => 'ok', error => error.code));
check('un autre choix pendant le premier : refusé par le client (GFS_REFUSE), le premier continue', second === 'GFS_REFUSE' && (await frame.locator('.ex.ex--choose').count()) === 1, second);
await row(WORD.rows[0]).dblclick();
check('le premier aboutit à son tour', (await app.evaluate(() => window.__premier)).id === '1');

say('=== openFile : le fichier disparu, puis l\'ouverture ===');
const gone = await app.evaluate(() => window.sondeK.GfsLink.openFile({ app: 'sonde-o', id: 999, type: 'document' }).then(() => 'ouvert', error => error.code));
const goneText = (await toast.isVisible()) ? await toast.innerText() : '';
check('un fichier disparu : le client rejette avec GFS_INTROUVABLE, GFS le dit, l\'app reste ouverte', gone === 'GFS_INTROUVABLE' && WORD.gone.test(goneText) && framesOf(/kit\.html/) === 1, { gone, goneText });
const invalid = await app.evaluate(() => window.sondeK.GfsLink.openFile({ app: 'sonde-o' }).then(() => 'ouvert', error => error.code));
check('une clé incomplète : le client refuse sans rien envoyer (GFS_REFUSE)', invalid === 'GFS_REFUSE', invalid);

await app.evaluate(link => { window.__ouvrir = window.sondeK.GfsLink.openFile(link); }, key);
await waitFor('la sonde O ouverte', async () => framesOf(/o-ouvrir\//) === 1 && framesOf(/kit\.html/) === 0);
const o = await lab.appFrame(/o-ouvrir\//);
await waitFor('la sonde O a reçu son contexte', () => o.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}').contexte));
const opened = await o.evaluate(() => JSON.parse(document.body.dataset.sonde));
say('contexte de la sonde O :', opened.ouverture);
check('l\'app visée prend la place de l\'app écrite avec le kit et s\'ouvre sur le fichier désigné, raison « lien »', opened.ouverture && opened.ouverture.fichier.id === '3' && opened.ouverture.fichier.type === 'document' && opened.ouverture.raison === 'lien', opened.ouverture);
await shot('2-app-ouverte');

say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
