// Publipostage+ (1.1, consigne 051 de GFS) lit `_grist_Attachments` pour savoir si une pièce jointe est une image : le porteur a déclaré la lecture seule le 06/11 (carte « Oui, déclarer »).
// Mesuré dans un vrai Grist (grist-static) avec la vraie app dans le sous-cadre isolé, depuis son cadre :
//   1. la table se lit, avec les quatre colonnes que l'app demande (`fileName`, `fileType`, `fileExt`, `imageWidth`) ; le courtier ne dit rien ;
//   2. aucune écriture n'y passe (ajout, modification, retrait) ; le `pourquoi` français et anglais du manifeste est gardé par test/filter.test.mjs ;
//   3. une autre table interne non déclarée reste refusée (`_grist_Attachments` n'ouvre pas le reste).
//   LAB_LANG=fr|en, LAB_SCHEME=light|dark ; REPO_DIR="$(realpath ../..)" node lab-server.mjs & puis node run-pieces-jointes-publipostage.mjs
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const APP_URL = /apps\/publipostage\//;
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text()); });
const app = await lab.openApp('publipostage', APP_URL);
check('l\'app a un cadre', Boolean(app));
await page.waitForTimeout(3000);
const attempt = (name, call) => app.evaluate(async ({ name, call }) => {
  try {
    const value = await (new Function('grist', `return (${call})();`))(grist);
    return { name, refused: false, value: value === undefined ? null : JSON.stringify(value).slice(0, 120) };
  } catch (error) {
    return { name, refused: true, message: String((error && error.message) || error) };
  }
}, { name, call });

const read = await attempt('lecture', 'async () => { const table = await grist.docApi.fetchTable(\'_grist_Attachments\'); return { colonnes: [\'fileName\', \'fileType\', \'fileExt\', \'imageWidth\'].map(name => Object.keys(table).includes(name)), lignes: table.id.length }; }');
say('lecture :', JSON.stringify(read));
check('`_grist_Attachments` se lit depuis l\'app, avec les quatre colonnes qu\'elle demande', !read.refused && /"colonnes":\[true,true,true,true\]/.test(read.value), read);
const writes = [
  ['ajout', 'async () => grist.docApi.applyUserActions([[\'AddRecord\', \'_grist_Attachments\', null, { fileName: \'x.pdf\' }]])'],
  ['modification', 'async () => grist.docApi.applyUserActions([[\'UpdateRecord\', \'_grist_Attachments\', 1, { fileName: \'x.pdf\' }]])'],
  ['retrait', 'async () => grist.docApi.applyUserActions([[\'RemoveRecord\', \'_grist_Attachments\', 1]])'],
];
for (const [name, call] of writes) {
  const result = await attempt(name, call);
  say(`${name} :`, JSON.stringify(result));
  check(`l'écriture (${name}) dans \`_grist_Attachments\` est refusée par le courtier`, result.refused && /GFS_REFUSE|refus|_grist_Attachments|écrit/i.test(result.message), result);
}
const other = await attempt('autre table', 'async () => grist.docApi.fetchTable(\'_grist_Shares\')');
check('une autre table interne non déclarée reste refusée', other.refused && /GFS_REFUSE|refus|_grist_Shares/i.test(other.message), other);
check('le courtier n\'a refusé aucune LECTURE de `_grist_Attachments`', !warnings.some(text => /fetchTable|readTable|lecture/i.test(text) && /_grist_Attachments/.test(text)), warnings);
await lab.browser.close();
