// Les gestes que les passes du labo à sondes (run-ouverts, run-fermer, run-composite, run-annuler, run-stockage, run-barre, run-langue, run-theme…) répétaient chacune de leur côté : compter les
// avertissements de GFS, attendre un état, remplir les tables de fichiers d'une sonde, rouvrir GFS après un semis, lire une sonde. Une correction de l'un se fait ici, une fois.
import { say } from './lab-common.mjs';
import { isGfsWarning } from './sondes-muettes.mjs';

// Les avertissements de la console que la passe compte (`accept` : le filtre, celui qui écarte les sondes muettes par défaut, sondes-muettes.mjs).
export function collectWarnings(page, accept = isGfsWarning) {
  const warnings = [];
  page.on('console', message => { if (message.type() === 'warning' && accept(message.text())) warnings.push(message.text()); });
  return warnings;
}

// `waitFor(label, test, tries)` : attend que `test()` soit vrai (un coup de 100 ms par essai, `tries` essais), sinon le dit et rend faux.
export const waiter = (page, defaultTries = 60) => async (label, test, tries = defaultTries) => {
  for (let i = 0; i < tries; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};

// Les fichiers d'une sonde : une table du préfixe de l'app, remplie par GFS (accès complet) ; GFS les relit en repartant. `tables` : { Table: [[nom, type, secondes avant maintenant], …] }.
// Rend l'instant du semis (en secondes) : la date d'un fichier est cet instant moins son âge.
export async function seedProbeFiles(lab, tables) {
  const now = Math.floor(Date.now() / 1000);
  await lab.frame.evaluate(async ([stamp, tableRows]) => {
    const columns = [{ id: 'Nom', type: 'Text' }, { id: 'Type', type: 'Text' }, { id: 'DateModif', type: 'DateTime' }];
    await grist.docApi.applyUserActions(Object.keys(tableRows).map(name => ['AddTable', name, columns]));
    await grist.docApi.applyUserActions(Object.entries(tableRows).map(([name, rows]) => ['BulkAddRecord', name, rows.map(() => null), {
      Nom: rows.map(row => row[0]), Type: rows.map(row => row[1]), DateModif: rows.map(row => stamp - row[2]),
    }]));
  }, [now, tables]);
  return now;
}

// Recharge `frame` (le cadre du widget par défaut : GFS relit ses tables au démarrage) et rend le cadre de GFS, prêt ; `settle` : le temps de se peindre.
export async function reopenGfs(lab, frame = lab.frame, settle = 800) {
  await frame.evaluate(() => location.reload());
  await lab.page.waitForTimeout(1000);
  const gfs = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(gfs);
  await lab.page.waitForTimeout(settle);
  return gfs;
}

// Les cadres des sondes et ce qu'une sonde dit d'elle-même (`body[data-sonde]`).
export function probeTools(page) {
  const frameOf = re => page.frames().find(each => re.test(each.url()));
  const count = re => page.frames().filter(each => re.test(each.url())).length;
  const readProbe = each => each.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}')).catch(() => ({}));
  return { frameOf, count, readProbe };
}

// L'explorateur vu du cadre de GFS (`currentFrame()` : le cadre courant, que remplace un rechargement) : une ligne par son nom, les fichiers et les dossiers affichés, la phrase d'état,
// l'étoile et le compte des favoris, une table lue par la connexion de GFS, et `until(probe)` qui attend (huit secondes au plus) ce que le geste doit montrer, l'explorateur se relisant après chaque geste.
export function explorerTools(currentFrame, page) {
  const row = text => currentFrame().locator('.ls-row', { hasText: text }).first();
  const folderRow = name => currentFrame().locator('.ls-row.folder', { has: currentFrame().locator('.t', { hasText: new RegExp(`^${name}$`) }) });
  const fileNames = () => currentFrame().locator('.ls-row:not(.folder) .t').allInnerTexts();
  const folderNames = () => currentFrame().locator('.ls-row.folder .t').allInnerTexts();
  const toast = async () => ((await currentFrame().locator('#toast').isVisible()) ? (await currentFrame().locator('#toast').innerText()) : '');
  const starOn = async name => (await row(name).locator('.rb.pin').getAttribute('class')).includes(' on');
  const favCount = async () => Number(await currentFrame().locator('.tr-row[data-view="fav"] .cnt').innerText());
  const table = name => currentFrame().evaluate(tableName => grist.docApi.fetchTable(tableName), name);
  const until = async (probe, timeout = 8000) => {
    const end = Date.now() + timeout;
    let value;
    while (Date.now() < end) { value = await probe().catch(() => false); if (value) return value; await page.waitForTimeout(150); }
    return value;
  };
  return { row, folderRow, fileNames, folderNames, toast, starOn, favCount, table, until };
}
