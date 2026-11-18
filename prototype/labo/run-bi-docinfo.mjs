// Grist-BI lit la langue et la devise du document (`_grist_DocInfo`, carte du 18/11 « Oui, lecture seule », consigne 020 de GFS à Grist-BI), avec la VRAIE Grist-BI, dans un vrai Grist
// (grist-static, 700 × 400) : ce que son « Format des nombres : comme dans la colonne » demande (`readColumnFormats`, `js/grist-api.js`).
//   1. La lecture de `_grist_DocInfo` passe : `documentSettings` revient, et `readColumnFormats` rend des réglages au lieu de se replier sans rien dire.
//   2. Elle reste une lecture : une écriture dans `_grist_DocInfo` est refusée par le courtier (le document garde ses réglages).
//   3. Rien d'autre n'est ouvert : `_grist_Attachments` et `_grist_Shares` restent refusées.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const BI_URL = /(apps\/bi|Grist-BI)\//;

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = [];
page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('GFS')) warnings.push(message.text()); });
await lab.fitPanel(undefined, 700, 400);
const frame = lab.frame;
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
const app = await lab.openApp('bi', BI_URL);
check('l\'app a un cadre', Boolean(app));
await page.waitForTimeout(3000);

const attempt = (frameOfApp, action) => frameOfApp.evaluate(async code => {
  try { return { ok: true, value: await (new Function('grist', `return (${code})(grist)`))(grist) }; } catch (error) { return { ok: false, error: String((error && error.message) || error).slice(0, 200) }; }
}, action);

// ----- 1. La lecture passe.
const read = await attempt(app, `async grist => { const info = await grist.docApi.fetchTable('_grist_DocInfo'); return { colonnes: Object.keys(info).filter(key => key === 'documentSettings'), lignes: (info.id || []).length, brut: (info.documentSettings || [])[0] }; }`);
say('lecture de _grist_DocInfo :', JSON.stringify(read));
check('la lecture de `_grist_DocInfo` passe : la colonne `documentSettings` revient avec une ligne', read.ok && read.value.colonnes.length === 1 && read.value.lignes === 1, read);
const formats = await app.evaluate(async () => {
  const warned = [];
  const original = console.warn;
  console.warn = (...parts) => { warned.push(String(parts[0]).slice(0, 120)); };
  try {
    const result = await GristBI.api.readColumnFormats('Clients');
    return { colonnes: Object.keys(result.columns).length, docSettings: result.docSettings, warned };
  } catch (error) { return { erreur: String(error.message || error), warned }; } finally { console.warn = original; }
});
say('readColumnFormats(Clients) :', JSON.stringify(formats));
check('`readColumnFormats` lit les colonnes de la table et ne se replie sur rien (aucun avertissement de l\'app)', !formats.erreur && formats.colonnes > 0 && formats.warned.length === 0, formats);

// ----- 2. Une lecture seulement.
const write = await attempt(app, `async grist => { await grist.docApi.applyUserActions([['UpdateRecord', '_grist_DocInfo', 1, { documentSettings: '{"locale":"fr-FR"}' }]]); return 'écrit'; }`);
say('écriture dans _grist_DocInfo :', JSON.stringify(write));
check('une écriture dans `_grist_DocInfo` est refusée par le courtier', write.ok === false && /GFS|refus|REFUSE/i.test(write.error || ''), write);
const after = await attempt(app, `async grist => (await grist.docApi.fetchTable('_grist_DocInfo')).documentSettings[0]`);
check('les réglages du document sont inchangés', after.ok && after.value === read.value.brut, { avant: read.value.brut, apres: after });

// ----- 3. Rien d'autre.
for (const table of ['_grist_Attachments', '_grist_Shares']) {
  const other = await attempt(app, `async grist => { await grist.docApi.fetchTable('${table}'); return 'lu'; }`);
  say(`lecture de ${table} :`, JSON.stringify(other));
  check(`\`${table}\` reste refusée`, other.ok === false, other);
}
check('aucun avertissement de GFS autre que les refus attendus', warnings.every(text => /_grist_(DocInfo|Attachments|Shares)/.test(text)), warnings.slice(0, 4));
await lab.browser.close();
