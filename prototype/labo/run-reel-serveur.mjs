// La sonde du vrai Grist (labo/reel/) contre un VRAI serveur Grist : l'image officielle, à la version de l'instance du porteur (`bash vrai-serveur.sh`, Docker). Ce que ni grist-static
// (pas d'API REST, pas de jeton) ni le répondeur de remplacement (écrit par nous : il avait caché la garde CSRF de Grist) ne peuvent dire : le jeton, la lecture REST depuis une autre
// origine et depuis un cadre isolé, l'envoi d'une pièce jointe, sa cellule, son remplacement, la taille d'un envoi. La page de la sonde est servie sur un autre port (une autre
// origine, comme github.io) et reçoit, pour CET essai, l'adresse du serveur dans son `connect-src` (le fichier du dépôt n'est pas touché). Le cloud n'atteint pas docs.getgrist.com :
// le script de l'API des widgets vient du serveur local. Chromium seulement : le Firefox du porteur reste à lui (la sonde dit le navigateur dans son résultat).
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { GRIST, openConnectIn, requireServer, newContext, createDocument, addWidget } from './lab-serveur.mjs';

const PAGE_PORT = 8916;
const REEL = `http://127.0.0.1:${PAGE_PORT}/prototype/labo/reel/index.html`;

// Le document est prêt : la sonde y est ajoutée avec l'accès complet, et rend son cadre une fois l'accès accordé.
async function addProbe(page, path) {
  await addWidget(page, path, REEL);
  const frame = page.frames().find(each => each.url().includes('/labo/reel/index.html'));
  await frame.waitForFunction(() => document.getElementById('rapport').value.includes('Accès accordé à la sonde'), null, { timeout: 30000 });
  return frame;
}

const report = frame => frame.locator('#rapport').inputValue();
const section = (text, from, to) => text.split(from)[1].split(to)[0];
const line = (text, label) => (text.match(new RegExp(`\\n   ${label}[^\\n]*? : ([^\\n]*)`)) || [])[1] || '';

async function playReading(frame) {
  await frame.locator('#lecture-lancer').click();
  await frame.waitForFunction(() => document.getElementById('rapport').value.includes('depuis un cadre isolé'), null, { timeout: 60000 });
  await frame.page().waitForTimeout(800);
  const read = section(await report(frame), '1. Lecture', '2. Écriture');
  say('--- la lecture ---');
  say(read);
  const fromPage = /depuis la page de la sonde \(origine http:\/\/127\.0\.0\.1:8916\)/;
  check('la page de la sonde (autre origine) lit les tables par le jeton dans l\'adresse', new RegExp(`${fromPage.source} › tables, jeton dans l'adresse : \\{"statut":200,"tables":\\d+\\}`).test(read));
  check('le cadre isolé (origine null) lit les tables par le jeton dans l\'adresse', /depuis un cadre isolé \(origine null\) › tables, jeton dans l'adresse : \{"statut":200,"tables":\d+\}/.test(read));
  check('le jeton dans l\'en-tête Authorization n\'ouvre rien : le navigateur refuse la demande préalable, de la page comme du cadre isolé', (read.match(/jeton dans l'en-tête Authorization : \{"erreur":"TypeError/g) || []).length === 2);
  check('une pièce jointe se liste depuis la page et depuis le cadre isolé', (read.match(/› pièces jointes : \{"statut":200,"nombre":\d+\}/g) || []).length === 2);
  check('la durée du jeton est relevée (le champ de Grist est ttlMsecs)', /"dureeMs":\d{4,}/.test(read));
  check('ni le jeton ni l\'identifiant du document ne sont dans le texte', !/eyJ[A-Za-z0-9_-]{20,}/.test(read) && !/jeton : \{"adresse":"[^"]*\/docs\/[A-Za-z0-9]{10,}/.test(read));
}

const SAME = /^\{"statut":200,"octets":\d+,"type":"application\/pdf","identique":true,"ms":\d+\}$/;

async function playAttachments(frame) {
  await frame.locator('#pj-lancer').click();
  await frame.locator('#consent-pj-oui').click();
  await frame.waitForFunction(() => [...document.querySelectorAll('#pj tbody td')].some(cell => cell.textContent.includes('après le nettoyage')), null, { timeout: 120000 });
  const text = section(await report(frame), '3. Pièces jointes (un PDF d\'essai)', '4. Taille maximale');
  say('--- les pièces jointes ---');
  say(text);
  check('SANS l\'en-tête X-Requested-With, l\'envoi échoue : Grist répond 401 avant d\'ajouter ses en-têtes CORS, le navigateur ne rend que l\'échec', /^\{"erreur":"TypeError/.test(line(text, 'envoi sans l\'en-tête')), line(text, 'envoi sans l\'en-tête'));
  check('AVEC l\'en-tête, le PDF part par un formulaire multipart, la réponse est la liste des numéros', /^\{"statut":200,"ids":\[\d+\],"ms":\d+\}$/.test(line(text, 'envoi d\'un PDF')), line(text, 'envoi d\'un PDF'));
  check('le nom avec accents, espaces et parenthèses arrive tel quel, avec ses octets', /"nomIdentique":true,"octets":\d+,"octetsIdentiques":true/.test(line(text, 'fiche dans la liste')), line(text, 'fiche dans la liste'));
  check('le fichier se télécharge avant, puis après son rattachement à une cellule, octet pour octet', SAME.test(line(text, 'téléchargement avant le rattachement')) && SAME.test(line(text, 'téléchargement après le rattachement')));
  const cell = line(text, 'une ligne avec la pièce jointe');
  check('la cellule d\'une colonne Attachments se relue : brute et décodée, ["L", numéro]', /^\{"ecrit":\["L",(\d+)\],"relueDecodee":\["L",\1\],"relueBrute":\["L",\1\]\}$/.test(cell), cell);
  const replaced = line(text, 'remplacement');
  check('le remplacement : un second envoi, la cellule pointe sur le nouveau numéro, le nouveau fichier se télécharge', /"celluleRelue":\["L",(\d+)\],"attendue":\["L",\1\]/.test(replaced) && SAME.test(line(text, 'téléchargement du fichier qui remplace')), replaced);
  check('l\'ancienne pièce jointe reste dans la liste (Grist l\'efface seul, au bout de 7 jours)', line(text, 'l\'ancienne pièce jointe') === '{"premiereToujoursListee":true,"secondeListee":true}');
  check('la table d\'essai est supprimée, les tables sont celles du départ', /"identiques":true/.test(line(text, 'tables du document après le nettoyage')));
}

async function playSizes(frame) {
  await frame.locator('#tailles-lancer').click();
  await frame.locator('#consent-tailles-oui').click();
  await frame.waitForFunction(() => document.getElementById('rapport').value.includes('premier envoi refusé'), null, { timeout: 600000 });
  const text = (await report(frame)).split('4. Taille maximale d\'un envoi')[1];
  say('--- la taille maximale ---');
  say(text);
  check('un serveur sans limite d\'envoi accepte tous les paliers (jusqu\'à 50 Mo), téléchargés à l\'identique jusqu\'à 20 Mo', line(text, 'plus grand envoi accepté') === '50 Mo' && /^aucun/.test(line(text, 'premier envoi refusé')) && /"identique":true/.test(line(text, '20 Mo')), [line(text, 'plus grand envoi accepté'), line(text, 'premier envoi refusé')]);
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/labo[/\\]reel[/\\][^/\\]*\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi);
  const page = await context.newPage();
  const frame = await addProbe(page, await createDocument(page));
  say((await report(frame)).split('\n').slice(0, 4).join('\n'));
  await playReading(frame);
  await playAttachments(frame);
  await playSizes(frame);
} finally {
  await browser.close();
  pages.close();
}
