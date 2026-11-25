// Le secours d'un CDN, mesuré sous Firefox (contrats 5.2, point 14 ; kit 0.31.0, `loadScript` de js/script-loader.js ; faits vérifiés 170). Un cadre isolé comme celui d'une app de GFS
// (`sandbox="allow-scripts"`, sans `allow-same-origin`, politique de sécurité du contenu dans la page) charge une bibliothèque par un « CDN » local, avec son empreinte, et la copie de GFS en secours.
// Les « hôtes » sont des serveurs locaux : A (l'app et la copie de GFS : la même origine, `'self'`), B (le CDN, bons octets ou octets changés), D (accepte et ne répond jamais), un port fermé (mort).
// Ce que le navigateur dit, que Node ne sait pas : l'événement `error` est le même pour un hôte mort, des octets refusés par l'empreinte et une adresse que la politique ne nomme pas ; un hôte
// muet n'en lève aucun (la minuterie de 3 s décide) ; un CDN qui charge ne fait jamais demander la copie ; le code d'octets changés n'est jamais exécuté ; la copie passe sous `script-src 'self'`.
// Firefox absent : l'essai est SAUTÉ et le dit (`labo/installer-firefox.sh` le pose dans le cloud).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createSocketServer } from 'node:net';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { findFirefox, startFirefox } from './firefox.mjs';

const binary = findFirefox();
const sri = text => `sha384-${createHash('sha384').update(text).digest('base64')}`;
const GOOD = 'window.__lib = (window.__lib || 0) + 1; window.__from = (window.__from || []).concat("cdn");';
const COPY = 'window.__lib = (window.__lib || 0) + 1; window.__from = (window.__from || []).concat("copie");';
const TAMPERED = 'window.__lib = 666; window.__from = (window.__from || []).concat("PIRATE");';
const MODULE = 'window.__module = (window.__module || []).concat("cdn"); export const from = "cdn";';
const MODULE_COPY = 'window.__module = (window.__module || []).concat("copie"); export const from = "copie";';
const cors = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const listen = handler => new Promise(resolve => { const server = createServer(handler); server.listen(0, '127.0.0.1', () => resolve(server)); });
const kit = readFileSync(join(ROOT, 'kit', 'js', 'script-loader.js'), 'utf8');

describe('le secours d\'un CDN sous Firefox', { skip: !binary && 'Firefox absent : `bash prototype/labo/installer-firefox.sh` le pose dans le cloud' }, () => {
  const servers = [];
  const sockets = [];
  const asked = []; // « <hôte> <chemin> » : ce que chaque serveur a reçu
  let firefox;
  let results;

  before(async () => {
    const note = (host, req) => asked.push(`${host} ${req.url.split('?')[0]}`);
    const hang = createSocketServer(socket => { sockets.push(socket); });
    await new Promise(resolve => hang.listen(0, '127.0.0.1', resolve));
    const dead = createSocketServer();
    await new Promise(resolve => dead.listen(0, '127.0.0.1', resolve));
    const deadPort = dead.address().port;
    await new Promise(resolve => dead.close(resolve));
    const send = (res, body, type = 'text/javascript') => { res.writeHead(200, { ...cors, 'Content-Type': type }); res.end(body); };
    const files = {
      B: { '/good.js': GOOD, '/tampered.js': TAMPERED, '/mod.mjs': MODULE },
      A: { '/copie.js': COPY, '/copie-pirate.js': TAMPERED, '/copie.mjs': MODULE_COPY, '/kit/script-loader.js': kit },
    };
    const cdn = await listen((req, res) => { note('B', req); const body = files.B[req.url.split('?')[0]]; if (body === undefined) { res.writeHead(404, cors); res.end(); } else send(res, body); });
    const portB = cdn.address().port;
    const portD = hang.address().port;
    const hostB = `http://127.0.0.1:${portB}`;
    const hostD = `http://127.0.0.1:${portD}`;
    const hostDead = `http://127.0.0.1:${deadPort}`;
    const secours = { copie: { src: '/copie.js', integrite: sri(COPY) }, pirate: { src: '/copie-pirate.js', integrite: sri(COPY) }, module: { src: '/copie.mjs', integrite: sri(MODULE_COPY), forme: 'module' } };
    // La page de l'app : une politique qui nomme (ou non) le CDN, le module du kit chargé de 'self', un scénario par mesure ; le résultat part au cadre parent.
    const scenarios = `import { loadScript } from '/kit/script-loader.js';
      const say = (name, value) => parent.postMessage({ name, value }, '*');
      const lib = (src, text, extra = {}) => ({ src, integrite: ${JSON.stringify(sri(GOOD))}, forme: 'script', ...extra });
      const copy = ${JSON.stringify(secours)};
      const outcome = async (run) => { const t0 = performance.now(); try { return { ...(await run()), ms: Math.round(performance.now() - t0) }; } catch (error) { return { rejected: String(error.message), ms: Math.round(performance.now() - t0) }; } };
      const own = key => ({ ...copy[key] });
      const mode = new URLSearchParams(location.search).get('mode');
      // Une balise en cours de chargement retarde l'événement \`load\` du cadre (un hôte muet le retient) : les mesures partent après lui, comme celles d'une app qui charge une bibliothèque au premier usage.
      const main = async () => {
      if (mode === 'cdn-nomme') {
        say('1 le CDN charge : la copie n\\'est pas demandée', await outcome(() => loadScript(lib('${hostB}/good.js'), { secours: own('copie') })));
        say('1b ce qui a été exécuté', { from: window.__from, lib: window.__lib });
        window.__from = []; window.__lib = 0;
        say('2 octets changés chez le CDN : refusés par l\\'empreinte, puis la copie', await outcome(() => loadScript(lib('${hostB}/tampered.js'), { secours: own('copie') })));
        say('2b ce qui a été exécuté (jamais le code du CDN piraté)', { from: window.__from, lib: window.__lib });
        window.__from = []; window.__lib = 0;
        say('3 hôte mort (connexion refusée), puis la copie', await outcome(() => loadScript(lib('${hostDead}/good.js'), { secours: own('copie') })));
        say('4 hôte muet : la minuterie de 3 s décide, puis la copie', await outcome(() => loadScript(lib('${hostD}/good.js'), { secours: own('copie') })));
        say('5 sans secours, hôte mort : l\\'erreur remonte', await outcome(() => loadScript(lib('${hostDead}/good.js'))));
        say('6 octets changés dans la copie aussi : refusés, l\\'erreur est celle de la copie', await outcome(() => loadScript(lib('${hostDead}/good.js'), { secours: own('pirate') })));
        say('7 fichier assemblé (module), CDN mort, puis la copie', await outcome(() => loadScript(lib('${hostDead}/mod.mjs', '', { forme: 'module' }), { secours: own('module') })));
        say('7b ce que le module a posé', { module: window.__module });
        say('8 module au CDN (le CDN charge)', await outcome(() => loadScript({ src: '${hostB}/mod.mjs', integrite: ${JSON.stringify(sri(MODULE))}, forme: 'module' }, { secours: own('module') })));
      } else {
        say('9 la politique ne nomme pas le CDN : adresse refusée, la copie passe sous \\'self\\'', await outcome(() => loadScript(lib('${hostB}/good.js'), { secours: own('copie') })));
      }
      say('fin ' + mode, true);
      };
      addEventListener('load', () => setTimeout(main, 50));`;
    const frame = mode => `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' ${mode === 'cdn-nomme' ? `${hostB} ${hostD} ${hostDead}` : ''}"><script type="module" src="/scenarios.mjs?mode=${mode}"></script>`;
    const site = await listen((req, res) => {
      note('A', req);
      const path = req.url.split('?')[0];
      if (path === '/gfs.html') {
        return send(res, `<!doctype html><meta charset="utf-8"><body><iframe sandbox="allow-scripts" src="/frame.html?mode=cdn-nomme"></iframe><iframe sandbox="allow-scripts" src="/frame.html?mode=cdn-absent"></iframe>
          <script>window.__r = []; addEventListener('message', e => window.__r.push(e.data));</script>`, 'text/html');
      }
      if (path === '/frame.html') return send(res, frame(new URL(req.url, 'http://x').searchParams.get('mode')), 'text/html');
      if (path === '/scenarios.mjs') return send(res, scenarios);
      const body = files.A[path];
      if (body === undefined) { res.writeHead(404, cors); res.end(); } else send(res, body);
    });
    servers.push(cdn, site, hang);
    firefox = await startFirefox(binary);
    await firefox.page.goto(`http://127.0.0.1:${site.address().port}/gfs.html`);
    await firefox.page.until(() => window.__r.filter(item => String(item.name).startsWith('fin ')).length === 2, [], 30000);
    results = Object.fromEntries((await firefox.page.run(() => window.__r)).map(item => [item.name, item.value]));
  });

  after(async () => {
    if (firefox) await firefox.close();
    for (const socket of sockets) socket.destroy();
    for (const server of servers) server.close();
  });

  const only = prefix => results[Object.keys(results).find(name => name.startsWith(prefix))];

  test('un CDN qui charge ne fait jamais demander la copie', () => {
    const value = only('1 ');
    assert.deepEqual([value.secours, value.src.endsWith('/good.js')], [false, true]);
    assert.deepEqual(only('1b'), { from: ['cdn'], lib: 1 });
    assert.ok(asked.includes('B /good.js'), 'le CDN a bien été demandé');
    assert.equal(asked.filter(line => line === 'A /copie.js').length, 4, 'la copie est demandée par les scénarios 2, 3, 4 et 9 (le CDN échoue ou est refusé), jamais par le premier');
  });

  test('des octets changés chez le CDN sont refusés par l\'empreinte, la copie charge, et le code piraté ne s\'exécute jamais', () => {
    const value = only('2 ');
    assert.deepEqual([value.secours, value.src], [true, '/copie.js']);
    assert.deepEqual(only('2b'), { from: ['copie'], lib: 1 }, 'ni le marqueur « PIRATE » ni le 666 du fichier changé');
  });

  test('un hôte mort et un hôte muet : la copie, le muet après la minuterie de 3 s', () => {
    assert.equal(only('3 ').secours, true);
    assert.ok(only('3 ').ms < 2500, `l'hôte mort est vu tout de suite (${only('3 ').ms} ms)`);
    const mute = only('4 ');
    assert.equal(mute.secours, true);
    assert.ok(mute.ms >= 2900 && mute.ms < 6000, `le muet est attendu 3 s, pas moins ni beaucoup plus (${mute.ms} ms)`);
  });

  test('sans secours l\'erreur remonte ; une copie refusée à son tour remonte avec son adresse', () => {
    assert.match(only('5 ').rejected, /chargement refusé ou en échec : http:\/\/127\.0\.0\.1:\d+\/good\.js/);
    assert.match(only('6 ').rejected, /\/copie-pirate\.js/, 'l\'erreur est celle du dernier essai : la copie');
  });

  test('un fichier assemblé (module) passe par la copie quand le CDN est mort, et se charge au CDN quand il répond', () => {
    assert.equal(only('7 ').secours, true);
    assert.deepEqual(only('7b'), { module: ['copie'] });
    assert.equal(only('8 ').secours, false);
  });

  test('la politique de l\'app ne nomme pas le CDN : le navigateur refuse l\'adresse, la copie de GFS passe sous \'self\' sans que l\'app nomme rien', () => {
    const value = only('9 ');
    assert.deepEqual([value.secours, value.src], [true, '/copie.js']);
    assert.equal(asked.filter(line => line === 'B /good.js').length, 1, 'le CDN n\'a été demandé qu\'une fois, par le premier scénario : la politique a arrêté le second avant le réseau');
  });
});
