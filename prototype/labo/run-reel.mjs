// La sonde du vrai Grist (labo/reel/) dans grist-static : la tuyauterie, avec la vraie souris. La lecture REST passe par un répondeur de remplacement (rest-standin.mjs), car
// grist-static ne délivre pas de jeton : ce que la sonde dira de l'API REST d'une vraie instance, seul le porteur le mesure. L'écriture, elle, joue les vraies actions de Grist
// (le code de Grist est le même) : on relève ce qu'elles rendent, et que la table d'essai disparaît.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';
import { startStandIn, STANDIN_TOKEN } from './rest-standin.mjs';

// Les pages de la sonde sont servies sur un port, l'API de remplacement sur un autre (deux origines, comme chez le porteur) : la politique des pages n'admet que https, plus
// l'origine du répondeur pour CET essai.
const REST_PORT = 8912;
const PAGE_PORT = 8915;
const REEL = `http://127.0.0.1:${PAGE_PORT}/prototype/labo/reel/index.html`;
const BASE = `http://127.0.0.1:${REST_PORT}/o/docs/api/docs/ABCDEFGHIJKLMNOPQRSTUV`;

const server = await startStandIn({ restPort: REST_PORT, pagePort: PAGE_PORT, repoDir: process.env.REPO_DIR });
const lab = await startLab({ lang: 'fr', widget: REEL });
await lab.fitPanel(undefined, 700, 400);
const { frame, page } = lab;
const report = () => frame.locator('#rapport').inputValue();
const tables = () => frame.evaluate(async () => (await grist.docApi.listTables()).slice().sort());
await frame.waitForFunction(() => document.getElementById('rapport').value.includes('Accès accordé à la sonde : full'), null, { timeout: 30000 }).catch(() => {});

const initial = await tables();
say('tables du document au départ :', initial);
check('la sonde a reçu l\'accès complet et lit les tables', /Accès accordé à la sonde : full ; tables de l'utilisateur : \d+/.test(await report()), (await report()).split('\n')[3]);

// ----- 1. La lecture. Le jeton de grist-static n'existe pas : on le remplace, dans la page de la sonde, par celui du répondeur.
await frame.evaluate(([base, token]) => { grist.docApi.getAccessToken = async () => ({ baseUrl: base, token, ttlMs: 60000 }); }, [BASE, STANDIN_TOKEN]);
await frame.locator('#lecture-lancer').click();
await frame.waitForFunction(() => document.getElementById('rapport').value.includes('depuis un cadre isolé'), null, { timeout: 40000 });
await page.waitForTimeout(500);
const read = await report();
say('--- la lecture ---');
say(read.split('\n').slice(4).join('\n'));
check('la page de la sonde lit les tables par le jeton dans l\'adresse', /depuis la page de la sonde \(origine http:\/\/127\.0\.0\.1:8915\) › tables, jeton dans l'adresse : \{"statut":200,"tables":2\}/.test(read));
// Playwright répond lui-même aux demandes préalables des requêtes qu'il surveille : le refus par le navigateur (TypeError) ne se voit pas ici, seulement la réponse 403 du répondeur.
check('le jeton dans l\'en-tête Authorization n\'ouvre rien, depuis la page et depuis le cadre isolé', /depuis la page de la sonde[^\n]* › tables, jeton dans l'en-tête Authorization : \{"statut":403,"message":"refusé"\}/.test(read) && /depuis un cadre isolé[^\n]* › tables, jeton dans l'en-tête Authorization : \{"statut":403,"message":"refusé"\}/.test(read));
check('le cadre isolé a l\'origine null et lit les tables par le jeton dans l\'adresse', /depuis un cadre isolé \(origine null\) › tables, jeton dans l'adresse : \{"statut":200,"tables":2\}/.test(read));
check('les tables internes sont relevées (SQL)', /tables internes \(SQL\) : \{"statut":200,"tables":\["_grist_ACLRules","_grist_DocInfo","_grist_Triggers"\]\}/.test(read));
check('une pièce jointe est téléchargée depuis le cadre isolé', /depuis un cadre isolé[^\n]* › téléchargement d'une pièce jointe : \{"statut":200,"octets":7/.test(read));
check('ni le jeton ni l\'identifiant du document ne sont dans le texte', !read.includes(STANDIN_TOKEN) && !read.includes('ABCDEFGHIJKLMNOPQRSTUV'), read.match(/jeton : [^\n]*/)[0]);
check('le cadre isolé est retiré après la lecture', (await frame.locator('iframe').count()) === 0);

// ----- 2. L'écriture : rien sans la confirmation.
await frame.locator('#ecriture-lancer').click();
await frame.locator('#consent').waitFor({ state: 'visible' });
await lab.shotPanel('reel', '1-confirmation', frame);
await frame.locator('#consent-non').click();
await page.waitForTimeout(500);
check('« Annuler » n\'écrit rien : aucune ligne, aucune table', (await frame.locator('#ecriture tbody tr').count()) === 0 && JSON.stringify(await tables()) === JSON.stringify(initial));
await frame.locator('#ecriture-lancer').click();
await frame.locator('#consent-oui').click();
await frame.waitForFunction(() => document.getElementById('rapport').value.includes('tables du document après le nettoyage'), null, { timeout: 90000 });
const written = await report();
say('--- l\'écriture ---');
say(written.split('\n').slice(written.split('\n').indexOf('2. Écriture dans une table d\'essai')).join('\n'));
const after = await tables();
check('la table d\'essai et ses pages ont disparu : les tables sont celles du départ', JSON.stringify(after) === JSON.stringify(initial), { avant: initial, apres: after });
check('chaque action a une réponse (« ok » ou l\'erreur de Grist, jamais rien)', !/ : \{"erreur":"undefined/.test(written));
await lab.shotPanel('reel', '2-apres-ecriture', frame);
await lab.browser.close();
server.close();
