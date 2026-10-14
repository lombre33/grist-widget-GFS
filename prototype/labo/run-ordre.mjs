// L'ordre des écouteurs `message` d'une fenêtre dans le navigateur choisi (contrats 1.2 et 9, point 4), sans Grist ni serveur : une fenêtre neuve (celle d'un cadre), un
// message que lui écrit sa page, et la liste de ceux qui l'ont vu, dans l'ordre. Le routeur de GFS compte sur l'ordre d'enregistrement (premier script de la page) ; ce
// que les navigateurs font de la phase de capture sur la fenêtre elle-même, `window.onmessage` compris, est ce qu'on mesure ici. Les cas sont ceux de la page que la
// personne ouvre dans son propre navigateur (navigateur/ordre.js) : une seule liste.
//
//   LAB_BROWSER=chromium|firefox|webkit node labo/run-ordre.mjs
import { fileURLToPath } from 'node:url';
import { engine, engineName, say, check } from './lab-common.mjs';

const browser = await engine.launch(engineName === 'chromium' ? { args: ['--no-sandbox'] } : {});
const page = await browser.newPage();
await page.setContent('<!doctype html><title>ordre</title>');
await page.addScriptTag({ path: fileURLToPath(new URL('./navigateur/ordre.js', import.meta.url)) });
const seen = await page.evaluate(() => window.GFSOrdre.playAll());
const version = browser.version();
await browser.close();
for (const [name, order] of Object.entries(seen.ordres)) say(name.padEnd(58), JSON.stringify(order));
say(`${engineName} ${version} :`, seen.captureAvant ? 'la phase de capture passe avant les autres écouteurs de la fenêtre, quel que soit l\'ordre d\'enregistrement' : 'l\'ordre d\'enregistrement décide, la phase de capture n\'y change rien');
check('premier enregistré, premier servi : un écouteur de capture qui arrête, enregistré avant onmessage, l\'empêche de s\'exécuter', seen.routeurPremierSuffit);
