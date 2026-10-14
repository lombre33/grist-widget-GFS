// Peut-on imposer une politique de sécurité du contenu à un sous-cadre servi par GitHub Pages, donc sans en-tête de réponse ? (contrats 3.7, point 4 ;
// cahier 8, « le bac à sable ne coupe pas le réseau »). Le navigateur n'a que quelques voies : l'attribut `csp` du cadre (qui demande l'accord du serveur de
// l'enfant par l'en-tête `Allow-CSP-From`), ou un cadre fabriqué à partir de son texte (`srcdoc`, `blob:`), qui hérite de la politique de celui qui le crée.
// Pas de Grist ici : la question est celle du navigateur (LAB_BROWSER=chromium|firefox|webkit). La page de l'hôte porte la politique de GFS, lue dans
// index.html du prototype, et ses cadres les drapeaux `sandbox` de GFS.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { engine, engineName, say, check } from './lab-common.mjs';
import { SANDBOX } from '../js/frames.js';

const PORT = 8916;
const BASE = `http://127.0.0.1:${PORT}/`;
const FILES = { 'enfant.html': 'text/html; charset=utf-8', 'enfant.js': 'text/javascript; charset=utf-8', 'hote.js': 'text/javascript; charset=utf-8' };
const read = name => readFile(fileURLToPath(new URL(`./politique/${name}`, import.meta.url)));

const gfsPolicy = (await readFile(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8')).match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];

// La page de l'hôte ; `withBlob` ajoute `blob:` aux cadres permis, seul changement fait à la politique de GFS.
function hostPage(withBlob) {
  const policy = withBlob ? gfsPolicy.replace("frame-src 'self'", "frame-src 'self' blob:") : gfsPolicy;
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><title>hôte</title><script type="module" src="hote.js"></script>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, BASE);
  const name = url.pathname.slice(1);
  const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (url.searchParams.has('accord')) headers['Allow-CSP-From'] = '*';
  if (name === 'hote.html') res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' }).end(hostPage(url.searchParams.has('blob')));
  else if (name === 'ping.txt') res.writeHead(200, { ...headers, 'Content-Type': 'text/plain' }).end('pong');
  else if (FILES[name]) res.writeHead(200, { ...headers, 'Content-Type': FILES[name] }).end(await read(name));
  else res.writeHead(404).end('not found');
}).listen(PORT, '127.0.0.1');

const browser = await engine.launch(engineName === 'chromium' ? { args: ['--no-sandbox'] } : {});

// Un cas : l'hôte fabrique le cadre ; on regarde, au bout d'un instant, l'adresse que le navigateur lui a donnée (page d'erreur ou non).
async function play(hostQuery, name) {
  const page = await browser.newPage();
  const messages = [];
  page.on('console', message => { if (message.type() === 'error') messages.push(message.text().replace(/\s+/g, ' ').slice(0, 200)); });
  await page.goto(`${BASE}hote.html?base=${encodeURIComponent(BASE)}&sandbox=${encodeURIComponent(SANDBOX)}${hostQuery}`);
  const running = page.evaluate(caseName => window.runCase(caseName), name);
  await page.waitForTimeout(1500);
  const frames = page.frames().slice(1).map(frame => frame.url().replace(/^blob:.*/, 'blob:…').replace(/^http:\/\/127\.0\.0\.1:\d+\//, '/'));
  const seen = await running;
  await page.close();
  say(name.padEnd(20), JSON.stringify(seen), '| cadre :', JSON.stringify(frames), '| console :', JSON.stringify(messages.slice(0, 2)));
  return { seen, frames, messages };
}

const simple = await play('', 'simple');
check('sans politique, le sous-cadre exécute tout et atteint un autre site', simple.seen && simple.seen.inline && simple.seen.proche === 'ok' && simple.seen.autre === 'ok', simple.seen);

const sansAccord = await play('', 'attributSansAccord');
check('attribut `csp` sans l\'accord du serveur de l\'enfant : le navigateur refuse le cadre', sansAccord.seen === null, sansAccord);

const avecAccord = await play('', 'attributAvecAccord');
check('attribut `csp` avec `Allow-CSP-From` : la politique est imposée (l\'autre site est refusé)', Boolean(avecAccord.seen) && avecAccord.seen.inline && avecAccord.seen.proche === 'ok' && avecAccord.seen.autre !== 'ok' && avecAccord.messages.some(text => /connect-src http:\/\/127\.0\.0\.1/.test(text)), avecAccord);

const srcdoc = await play('', 'srcdoc');
check('cadre fabriqué par `srcdoc` : il hérite de la politique de GFS (script en ligne et autre site refusés)', Boolean(srcdoc.seen) && !srcdoc.seen.inline && srcdoc.seen.autre !== 'ok', srcdoc.seen);

const blob = await play('', 'blob');
check('cadre `blob:` : la politique de GFS (`frame-src \'self\'`) le refuse', blob.seen === null && blob.messages.some(text => /frame-src/.test(text)), blob);

const blobPermis = await play('&blob=1', 'blob');
check('cadre `blob:` une fois permis : il hérite de la politique de GFS lui aussi', Boolean(blobPermis.seen) && !blobPermis.seen.inline && blobPermis.seen.autre !== 'ok', blobPermis.seen);

await browser.close();
server.close();
