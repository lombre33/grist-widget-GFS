// Le courtier avec le VRAI script d'API de Grist, dans un vrai Grist (contrats 9, points 1, 2, 5 et 6) : ce que Grist rejoue à une app qui démarre après GFS ; `configure`
// absorbé ; le jeton relayé ; les noms de tables que Grist normalise, comparés à ce que le courtier juge, puis ce que le courtier fait de chacun (la sonde H).
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { norm } from '../js/filter.js';

// Des noms qui visent les préfixes réservés (GFS_, celui d'une autre app) par un détour : espaces, tirets, « _ » de tête, pleine chasse, signes combinants, lettres
// que seule une translittération ramènerait à G, F ou S.
const NAMES = ['GFS_Rangement', '_GFS_Rangement', '__gfs_rangement', 'gfs rangement', 'GFS-rangement', 'GFS.rangement', 'GFS rangement', 'GFS​_rangement',
  'ＧＦＳ_rangement', 'ǴFS_rangement', 'ᴳFS_rangement', 'ɢFS_rangement', 'GƑS_rangement', 'ǤFS_rangement', 'GFŞ_rangement', 'GFſ_rangement',
  'Gᴍ_x', 'Publipostage_Autre', 'publipostage autre', 'Ｐublipostage_x', 'Publipostage·autre', 'SondeH_Essai', 'sondeh essai', 'Éléphant', '1abc', '___', 'a b c'];

// COURTIER_JUGE=large : le jugement du nom avant l'appel est volontairement affaibli (il ne retire plus les « _ » de tête et ne remplace plus les signes) pour mesurer
// le contrôle d'après : l'identifiant que Grist rend est relu, la table créée est retirée, une table renommée retrouve son nom.
const wide = process.env.COURTIER_JUGE === 'large';
const WEAKEN = { fichier: 'filter.js', de: "\n  .replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+/, '').toLowerCase();", vers: '.toLowerCase();' };
const lab = await startLab({ lang: 'fr', probes: true, patches: wide ? [WEAKEN] : [] });
await lab.fitPanel(undefined, 700, 400);
const gfs = lab.frame;
const app = await lab.openApp('sonde-h', /h-courtier\//);
await lab.page.waitForTimeout(2500);
const probe = async () => JSON.parse(await app.evaluate(() => document.body.dataset.courtier || '{}'));
const viaApp = (fn, ...args) => app.evaluate(([name, rest]) => window.courtier[name](...rest), [fn, args]);
const direct = (actions) => gfs.evaluate(async list => {
  try { return { ok: true, resultat: await grist.docApi.applyUserActions(list) }; } catch (error) { return { ok: false, message: String(error && error.message).slice(0, 160) }; }
}, actions);
const tableIds = () => gfs.evaluate(async () => (await grist.docApi.listTables()).slice());
const baseline = await tableIds();
const realId = result => (result.ok ? result.resultat.retValues[0].table_id : `ERREUR ${result.message}`);

// ----- 1. Ce que Grist rejoue à une app qui démarre après GFS, et `configure` absorbé.
const start = await probe();
say('rejeu :', start.rejeu);
const names = start.rejeu.map(entry => entry.nom);
check('l\'app apprend ses options (onOptions) et ses lignes (onRecords) sans rien demander', names.includes('onOptions') && names.includes('onRecords'), names);
const records = start.rejeu.find(entry => entry.nom === 'onRecords');
check('onRecords : les lignes de la section de GFS, avec ses vraies colonnes (pas la correspondance demandée par l\'app)', records && records.lignes === 2 && records.colonnes.includes('Nom') && !records.colonnes.includes('Etiquette'), records);
const options = start.rejeu.find(entry => entry.nom === 'onOptions');
check('l\'app lit SON niveau d\'accès dans les options', options && options.acces === 'full', options);
const panel = (await lab.page.locator('.test-right-panel').innerText()).replace(/\s+/g, ' ');
say('panneau de droite :', panel.slice(0, 260));
check('configure absorbé : le panneau de droite garde la configuration de GFS (pas de correspondance de colonnes)', /Open configuration/.test(panel) && !/Etiquette|Étiquette/.test(panel));

// ----- 2. Le jeton : relayé tel quel quand le manifeste le déclare ; l'erreur de Grist arrive au bon cadre.
const viaBroker = await viaApp('jeton');
const viaGrist = await gfs.evaluate(async () => { try { return { ok: true, resultat: await grist.docApi.getAccessToken({ readOnly: true }) }; } catch (error) { return { ok: false, message: String(error && error.message).slice(0, 160) }; } });
say('jeton, par le courtier :', viaBroker, '| directement :', viaGrist);
check('le jeton est relayé : même issue que sans courtier (grist-static n\'en délivre pas)', viaBroker.ok === viaGrist.ok && (viaBroker.ok || viaGrist.message.includes(viaBroker.message.slice(0, 30)) || viaBroker.message.includes(viaGrist.message.slice(0, 30))));

// ----- 3. Les noms : ce que Grist rend pour chaque nom (sans courtier), ce que le courtier en juge, ce qu'il fait de la demande.
const rows = [];
const WIDE_NAMES = ['gfs rangement', 'GFS-rangement', '_GFS_x', '__gfs_rangement', 'GFS.x', 'publipostage autre'];
for (const name of (wide ? WIDE_NAMES : NAMES)) {
  const real = realId(await direct([['AddTable', name, [{ id: 'A', type: 'Text' }]]]));
  if (!real.startsWith('ERREUR')) await direct([['RemoveTable', real]]);
  const brokered = await viaApp('ajouterTable', name);
  const created = brokered.ok ? brokered.resultat.retValues[0].table_id : null;
  if (created) await direct([['RemoveTable', created]]);
  rows.push({ name, juge: norm(name), reel: real, courtier: brokered.ok ? `créée : ${created}` : `${brokered.code || 'erreur'} : ${brokered.message.slice(0, 90)}` });
}
for (const row of rows) say(JSON.stringify(row.name), '| jugé', JSON.stringify(row.juge), '| Grist :', row.reel, '| courtier :', row.courtier);
const reserved = id => /^gfs_/i.test(id) || /^publipostage_/i.test(id) || /^automation_/i.test(id);
const dangerous = rows.filter(row => reserved(row.reel) && !reserved(row.juge));
const conservative = rows.filter(row => !row.reel.startsWith('ERREUR') && reserved(row.juge) && !reserved(row.reel));
say('divergences dangereuses (Grist crée un nom réservé que le jugement laisse passer) :', dangerous.map(row => row.name));
if (wide) check('jugement affaibli : chaque nom réservé est arrêté APRÈS l\'appel, par le contrôle de l\'identifiant réel', rows.every(row => /Grist a donné à une table le nom/.test(row.courtier)), rows.map(row => row.courtier.slice(0, 70)));
say('divergences prudentes (le jugement refuse, Grist n\'aurait rien réservé) :', conservative.map(row => row.name));
const leftovers = (await tableIds()).filter(id => !baseline.includes(id));
check('aucune table créée par le courtier ne reste (les noms réservés sont refusés ou retirés)', leftovers.length === 0, leftovers);
check('le courtier ne laisse jamais créer un nom réservé', rows.every(row => !/créée : (GFS_|Publipostage_|Automation_)/i.test(row.courtier)));

// ----- 4. RenameTable : ce que Grist rend, et le contrôle après coup.
const made = await viaApp('ajouterTable', 'SondeH_Avant');
const renamed = await viaApp('renommerTable', 'SondeH_Avant', 'SondeH_Apres');
say('RenameTable par le courtier :', renamed);
const afterRename = await tableIds();
check('RenameTable : la table porte son nouveau nom', made.ok && afterRename.includes('SondeH_Apres') && !afterRename.includes('SondeH_Avant'), afterRename.filter(id => !baseline.includes(id)));
const forbidden = await viaApp('renommerTable', 'SondeH_Apres', wide ? 'gfs pris' : 'GFS_Pris');
say('renommer vers GFS_ :', forbidden);
check('renommer vers un nom réservé est refusé', !forbidden.ok);
if (wide) check('jugement affaibli : le refus vient du contrôle d\'après', /Grist a donné à une table le nom/.test(forbidden.message), forbidden.message);
const stillThere = await tableIds();
// GFS a pu créer sa propre table du document (GFS_Rangement, avec l'accord de la personne) avant l'essai : elle est dans `baseline`, seul un GFS_ de plus compterait.
check('la table garde son nom après le refus', stillThere.includes('SondeH_Apres') && !stillThere.some(id => /^GFS_/i.test(id) && !baseline.includes(id)), stillThere.filter(id => !baseline.includes(id)));
// Que rend RenameTable quand le nom demandé est normalisé par Grist ? (le contrat 3.3, point 4, dit « rien d'exploitable »)
const odd = await direct([['RenameTable', 'SondeH_Apres', 'sondeh \u00e9tat nouveau']]);
const oddIds = (await tableIds()).filter(id => !baseline.includes(id));
say('RenameTable avec un nom à normaliser : retValues', odd.ok ? odd.resultat.retValues : odd, '| identifiants réels après :', oddIds);
check('RenameTable rend l\'identifiant réel (celui qu\'on lit ensuite dans _grist_Tables)', odd.ok && oddIds.includes(odd.resultat.retValues[0]), { retValues: odd.ok && odd.resultat.retValues, reel: oddIds });
for (const id of oddIds) await direct([['RemoveTable', id]]);
await lab.browser.close();
