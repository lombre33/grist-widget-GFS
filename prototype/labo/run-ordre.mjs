// L'ordre des écouteurs `message` d'une fenêtre dans le navigateur choisi (contrats 1.2 et 9 point 4), sans Grist ni serveur : une fenêtre neuve (celle d'un cadre), un
// message que lui écrit sa page, et la liste de ceux qui l'ont vu, dans l'ordre. Le routeur de GFS compte sur l'ordre d'enregistrement (premier script de la page) ; ce
// que les navigateurs font de la phase de capture sur la fenêtre elle-même, `window.onmessage` compris, est ce qu'on mesure ici.
//
//   LAB_BROWSER=chromium|firefox|webkit node labo/run-ordre.mjs
import { engine, engineName, say, check } from './lab-common.mjs';

// Chaque cas : ce qu'on enregistre sur la fenêtre, dans cet ordre. `log` reçoit le nom de chaque écouteur qui s'exécute.
const CASES = [
  ['onmessage, puis bulle', "win.onmessage = () => log.push('onmessage'); win.addEventListener('message', () => log.push('bulle'), false);"],
  ['bulle, puis onmessage', "win.addEventListener('message', () => log.push('bulle'), false); win.onmessage = () => log.push('onmessage');"],
  ['onmessage, puis capture', "win.onmessage = () => log.push('onmessage'); win.addEventListener('message', () => log.push('capture'), true);"],
  ['capture, puis onmessage', "win.addEventListener('message', () => log.push('capture'), true); win.onmessage = () => log.push('onmessage');"],
  ['capture qui arrête, puis onmessage (le routeur de GFS)', "win.addEventListener('message', e => { log.push('capture'); e.stopImmediatePropagation(); }, true); win.onmessage = () => log.push('onmessage');"],
  ['onmessage, puis capture qui arrête (un routeur tardif)', "win.onmessage = () => log.push('onmessage'); win.addEventListener('message', e => { log.push('capture'); e.stopImmediatePropagation(); }, true);"],
];

const browser = await engine.launch(engineName === 'chromium' ? { args: ['--no-sandbox'] } : {});
const page = await browser.newPage();
await page.setContent('<!doctype html><title>ordre</title>');
const seen = {};
for (const [name, setup] of CASES) {
  seen[name] = await page.evaluate(async source => {
    const log = [];
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const win = frame.contentWindow;
    new Function('win', 'log', source)(win, log);
    win.postMessage('essai', '*');
    await new Promise(resolve => setTimeout(resolve, 200));
    frame.remove();
    return log;
  }, setup);
  say(name.padEnd(58), JSON.stringify(seen[name]));
}
const version = browser.version();
await browser.close();
const captureFirst = JSON.stringify(seen['onmessage, puis capture']) === JSON.stringify(['capture', 'onmessage']);
say(`${engineName} ${version} :`, captureFirst ? 'la phase de capture passe avant les autres écouteurs de la fenêtre, quel que soit l\'ordre d\'enregistrement' : 'l\'ordre d\'enregistrement décide, la phase de capture n\'y change rien');
check('premier enregistré, premier servi : un écouteur de capture qui arrête, enregistré avant onmessage, l\'empêche de s\'exécuter', JSON.stringify(seen['capture qui arrête, puis onmessage (le routeur de GFS)']) === JSON.stringify(['capture']));
