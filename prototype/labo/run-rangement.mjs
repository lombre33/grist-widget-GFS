// La table du document quand elle n'est pas née de GFS (contrats 6.1 point 3, 6.5 point 4, 7.4 points 3 et 6), dans un vrai Grist : une table `GFS_Rangement` d'une version plus
// ancienne (sans la colonne `Valeur`) avec une ligne qui n'est pas à GFS ; puis une valeur qui porte une app et un champ que cette version ne connaît pas ; puis une autre section
// qui écrit la ligne entre deux gestes. GFS ne pose aucune question (la table existe), ajoute la colonne absente (une seule colonne inconnue dans un lot annulerait tout), garde
// tout ce qu'il ne connaît pas et relit la ligne juste avant d'écrire. LAB_LANG=fr|en.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const lab = await startLab({ lang });
const { page } = lab;
await lab.fitPanel(undefined, 700, 400);
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && m.text().startsWith('GFS')) warnings.push(m.text()); });
let frame = lab.frame;

// Ce que la table dit (la lecture que partagent les essais : lab.rangement) : ses colonnes, ses lignes, la valeur de la ligne réservée, le nombre de pages du document.
const state = f => lab.rangement(f);
// Une autre section (ou la personne dans Grist) écrit la ligne : GFS n'en est pas prévenu (7.4 point 3).
const writeValue = async (f, value) => {
  const { reservedId } = await lab.rangement(f);
  await f.evaluate(([id, json]) => grist.docApi.applyUserActions([['UpdateRecord', 'GFS_Rangement', id, { Valeur: json }]]), [reservedId, JSON.stringify(value)]);
};
const reload = async () => {
  await page.keyboard.press('Escape');
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
};
// Un geste de la fenêtre, puis l'attente de l'écriture ; rend le nombre de fois où une question est apparue.
const gesture = async (key, mode = 'check') => {
  await lab.openModules(frame);
  await frame.locator(`[data-fk="${key}"]`)[mode]();
  let asked = 0;
  for (let i = 0; i < 80; i++) {
    if (await frame.locator('.ask').count()) asked += 1;
    if (await frame.evaluate(() => document.body.dataset.registry !== 'busy')) break;
    await page.waitForTimeout(100);
  }
  return asked;
};
const same = (a, b, keys) => keys.every(key => a[key] === b[key]);

// 1. Une table d'une version plus ancienne : six colonnes, sans `Valeur`, et une ligne qui n'est pas à GFS. À l'ouverture, GFS lit l'adresse de la personne : la colonne `Adresse`
// (et sa ligne-sonde, ajoutée puis retirée) est la seule chose qu'il pose seul ; `Valeur` attend un geste.
await frame.evaluate(async () => {
  await grist.docApi.applyUserActions([['AddTable', 'GFS_Rangement', [
    { id: 'Utilisateur', type: 'Text' }, { id: 'App', type: 'Text' }, { id: 'Fichier', type: 'Text' },
    { id: 'Favori', type: 'Bool' }, { id: 'Dossier', type: 'Text' }, { id: 'Replie', type: 'Bool' },
  ]]]);
  await grist.docApi.applyUserActions([['AddRecord', 'GFS_Rangement', null, { Utilisateur: 'a@exemple.org', App: 'publipostage', Fichier: '3', Favori: true, Dossier: 'Formation' }]]);
});
await reload();
const start = await state(frame);
say('départ :', { colonnes: start.columns, lignes: start.lines.length, pages: start.pages });
const OLD = ['Utilisateur', 'App', 'Fichier', 'Favori', 'Dossier', 'Replie'];
check('la table du départ n\'a pas de colonne Valeur : ses six colonnes, puis Adresse (posée à l\'ouverture)', !start.columns.includes('Valeur') && JSON.stringify(start.columns) === JSON.stringify([...OLD, 'Adresse']), start.columns);
check('aucune ligne-sonde ne reste', start.lines.length === 1 && !start.lines.some(line => String(line.Utilisateur).startsWith('@')), start.lines);

const asked1 = await gesture('app:automation');
const first = await state(frame);
say('après Automation+ :', { colonnes: first.columns, valeur: first.value, pages: first.pages });
check('la table existe : aucune question de création', asked1 === 0, asked1);
check('la colonne Valeur manquante est ajoutée, sans autre changement de colonnes', JSON.stringify(first.columns) === JSON.stringify([...start.columns, 'Valeur']), first.columns);
check('la ligne qui n\'est pas à GFS n\'a pas bougé', same(first.lines[0], start.lines[0], ['id', 'Utilisateur', 'App', 'Fichier', 'Favori', 'Dossier', 'Replie']), first.lines[0]);
check('la ligne réservée est ajoutée avec Automation+', first.lines.length === 2 && Boolean(first.value && first.value.automation), first.value);
check('aucune page de plus : la table existait', first.pages === start.pages, { avant: start.pages, apres: first.pages });

// 2. Une valeur qu'une version plus récente a écrite : une app et un champ que celle-ci ne connaît pas.
await writeValue(frame, { automation: { extensions: [], futur: 1 }, inconnue: { extensions: ['z'] } });
await reload();
await lab.openModules(frame);
const rows = await frame.evaluate(() => [...document.querySelectorAll('.mod input[data-fk^="app:"]')].map(input => ({ app: input.dataset.fk.replace('app:', ''), cochee: input.checked })));
say('cases des apps :', rows);
check('Automation+ est cochée, l\'app inconnue n\'est pas listée', rows.some(row => row.app === 'automation' && row.cochee) && !rows.some(row => row.app === 'inconnue'), rows);
await gesture('ext:publipostage/graphique');
const second = await state(frame);
say('après Graphique :', second.value);
check('l\'extension est retenue ; l\'app et le champ inconnus sont gardés tels quels',
  JSON.stringify(second.value) === JSON.stringify({ automation: { extensions: [], futur: 1 }, inconnue: { extensions: ['z'] }, publipostage: { extensions: ['graphique'] } }), second.value);

// 3. Une autre section écrit la ligne entre deux gestes : GFS relit avant d'écrire, rien n'est défait.
await writeValue(frame, { ...second.value, autre: { extensions: [] } });
await gesture('mode:publipostage/graphique/vendorise');
const third = await state(frame);
say('après le mode :', third.value);
check('le geste suivant garde ce que l\'autre section a écrit', Boolean(third.value && third.value.autre) && third.value.publipostage.modes && third.value.publipostage.modes.graphique === 'vendorise', third.value);
check('toujours une seule ligne réservée, la ligne d\'un autre intacte', third.lines.length === 2 && same(third.lines[0], start.lines[0], ['id', 'Utilisateur', 'App', 'Fichier', 'Favori', 'Dossier', 'Replie']), third.lines.length);
say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
