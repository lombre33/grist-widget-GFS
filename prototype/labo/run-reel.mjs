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

// Le répondeur refuse un envoi de plus de 6 Mo (413) : la sonde de taille doit s'arrêter au palier de 20 Mo, après celui de 5 Mo.
const server = await startStandIn({ restPort: REST_PORT, pagePort: PAGE_PORT, repoDir: process.env.REPO_DIR, maxUploadBytes: 6 * 1024 * 1024 });
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
// Le résultat de Grist (AccessTokenResult) : { token, baseUrl, ttlMsecs }.
await frame.evaluate(([base, token]) => { grist.docApi.getAccessToken = async () => ({ baseUrl: base, token, ttlMsecs: 60000 }); }, [BASE, STANDIN_TOKEN]);
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
check('la durée du jeton est relevée (le champ de Grist est ttlMsecs)', /\n   jeton : \{"adresse":"[^"]*","dureeMs":60000\}/.test(read), read.match(/jeton : [^\n]*/)[0]);
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

// ----- 3. Les pièces jointes : rien n'est envoyé sans la confirmation. Le répondeur ne fait que recevoir et rendre les octets (la tuyauterie) ; la cellule d'une colonne
// Attachments, elle, est celle du vrai Grist (le code de Grist est le même).
await frame.locator('#pj-lancer').click();
await frame.locator('#consent-pj').waitFor({ state: 'visible' });
await lab.shotPanel('reel', '3-confirmation-pj', frame);
await frame.locator('#consent-pj-non').click();
await page.waitForTimeout(500);
check('« Annuler » n\'envoie rien : aucune ligne, aucun fichier reçu, les tables sont celles du départ', (await frame.locator('#pj tbody tr').count()) === 0 && server.uploads().length === 0 && JSON.stringify(await tables()) === JSON.stringify(initial));
await frame.locator('#pj-lancer').click();
await frame.locator('#consent-pj-oui').click();
await frame.waitForFunction(() => [...document.querySelectorAll('#pj tbody td')].some(cell => cell.textContent.includes('après le nettoyage')), null, { timeout: 90000 });
const attached = (await report()).split('3. Pièces jointes (un PDF d\'essai)')[1].split('4. Taille maximale')[0];
say('--- les pièces jointes ---');
say(attached);
const row = label => (attached.match(new RegExp(`\\n   ${label}[^\\n]*? : ([^\\n]*)`)) || [])[1] || '';
check('le jeton qui écrit est relevé, avec sa durée', /^\{"adresse":"[^"]*","dureeMs":60000\}$/.test(row('jeton en écriture')), row('jeton en écriture'));
check('l\'envoi SANS l\'en-tête X-Requested-With est refusé comme Grist le refuse : le navigateur ne rend que l\'échec, le répondeur l\'a bien reçu et refusé, rien n\'est gardé', /^\{"erreur":"TypeError : /.test(row('envoi sans l\'en-tête')) && server.refused() === 1, [row('envoi sans l\'en-tête'), server.refused()]);
check('le PDF part par un formulaire multipart avec l\'en-tête X-Requested-With (demande préalable admise), la réponse est la liste des numéros', /^\{"statut":200,"ids":\[8\],"ms":\d+\}$/.test(row('envoi d\'un PDF')), row('envoi d\'un PDF'));
check('le nom avec accents, espaces et parenthèses arrive tel quel, avec ses octets', /^\{"nom":"Facture été \(1\)\.pdf","nomIdentique":true,"octets":\d+,"octetsIdentiques":true\}$/.test(row('fiche dans la liste')), row('fiche dans la liste'));
check('le fichier se télécharge avant le rattachement, octet pour octet', /^\{"statut":200,"octets":\d+,"type":"application\/pdf","identique":true,"ms":\d+\}$/.test(row('téléchargement avant le rattachement')), row('téléchargement avant le rattachement'));
check('une colonne de type Attachments se crée dans une table d\'essai', row('table d\'essai avec une colonne') === 'ok : Sonde_GFS_pj', row('table d\'essai avec une colonne'));
check('la cellule écrite se relue, dans sa forme brute (["L", numéro]) et décodée', /^\{"ecrit":\["L",8\],"relueDecodee":.+,"relueBrute":\["L",8\]\}$/.test(row('une ligne avec la pièce jointe')), row('une ligne avec la pièce jointe'));
check('le fichier se télécharge après le rattachement, octet pour octet', /"identique":true/.test(row('téléchargement après le rattachement')), row('téléchargement après le rattachement'));
check('le remplacement : un second envoi, la cellule pointe sur le nouveau numéro', /^\{"envoi":\{"statut":200,"ids":\[9\],"ms":\d+\},"celluleRelue":\["L",9\],"attendue":\["L",9\]\}$/.test(row('remplacement')), row('remplacement'));
check('le fichier qui remplace se télécharge, octet pour octet', /"identique":true/.test(row('téléchargement du fichier qui remplace')), row('téléchargement du fichier qui remplace'));
check('l\'ancienne pièce jointe reste dans la liste (Grist l\'efface seul)', row('l\'ancienne pièce jointe') === '{"premiereToujoursListee":true,"secondeListee":true}', row('l\'ancienne pièce jointe'));
check('le répondeur a reçu deux fichiers, au nom d\'origine', JSON.stringify(server.uploads().map(file => file.name)) === JSON.stringify(['Facture été (1).pdf', 'Facture été (1).pdf']), server.uploads());
check('la table d\'essai est supprimée, les tables sont celles du départ', /^\{"avant":\d+,"apres":\d+,"identiques":true\}$/.test(row('tables du document après le nettoyage')) && JSON.stringify(await tables()) === JSON.stringify(initial), row('tables du document après le nettoyage'));
check('ni le jeton ni l\'identifiant du document ne sont dans le texte des pièces jointes', !attached.includes(STANDIN_TOKEN) && !attached.includes('ABCDEFGHIJKLMNOPQRSTUV'));
await lab.shotPanel('reel', '4-apres-pj', frame);

// ----- 4. La taille maximale : du plus petit palier au premier refus.
await frame.locator('#tailles-lancer').click();
await frame.locator('#consent-tailles').waitFor({ state: 'visible' });
await lab.shotPanel('reel', '5-confirmation-tailles', frame);
await frame.locator('#consent-tailles-oui').click();
await frame.waitForFunction(() => document.getElementById('rapport').value.includes('premier envoi refusé'), null, { timeout: 120000 });
const sized = (await report()).split('4. Taille maximale d\'un envoi')[1];
say('--- la taille maximale ---');
say(sized);
const level = label => (sized.match(new RegExp(`\\n   ${label} : ([^\\n]*)`)) || [])[1] || '';
check('les paliers de 0,1 à 5 Mo sont envoyés et téléchargés à l\'identique', ['0,1', '0,5', '1', '5'].every(mb => /^\{"envoi":\{"statut":200,"ids":\[\d+\],"ms":\d+\},"retour":\{"statut":200,"octets":\d+,"type":"application\/pdf","identique":true,"ms":\d+\}\}$/.test(level(`${mb} Mo`))), level('5 Mo'));
check('le palier de 20 Mo reçoit 413 et la sonde s\'arrête là', /^\{"envoi":\{"statut":413,"message":.*,"ms":\d+\}\}$/.test(level('20 Mo')) && level('50 Mo') === '', level('20 Mo'));
check('le plus grand envoi accepté et le premier refusé sont dits', level('plus grand envoi accepté') === '5 Mo' && level('premier envoi refusé') === '20 Mo', [level('plus grand envoi accepté'), level('premier envoi refusé')]);
check('le répondeur n\'a reçu que les paliers acceptés (2 fichiers + 4 paliers)', server.uploads().length === 6, server.uploads().map(file => file.size));
check('le message d\'attente est effacé à la fin', (await frame.locator('#tailles-etat').textContent()) === '');
await lab.shotPanel('reel', '6-apres-tailles', frame);
await lab.browser.close();
server.close();
