// Firefox pour les essais d'interface (demande du porteur, 03/11 : vérifier aussi les interfaces, sous Firefox, le navigateur qu'il emploie). Aucune bibliothèque : Firefox lui-même (dans le cloud,
// `labo/installer-firefox.sh` ; ailleurs, celui de la machine) et un petit client WebSocket (test/websocket-client.mjs : celui de Node 22 s'arrête à la 4 097e trame). Firefox se pilote par WebDriver BiDi, le protocole qu'il parle de lui-même (`--remote-debugging-port`) :
// ni geckodriver, ni Selenium, et pas Playwright, qui ne pilote qu'un Firefox modifié par lui (ses hôtes de téléchargement sont refusés dans le cloud).
// Un seul Firefox pour tout un fichier d'essais ; la page se règle à une largeur, un zoom (`devicePixelRatio`) et un mode (clair ou sombre) par `page.view`. La souris et le clavier sont ceux
// du navigateur (`input.performActions`) : jamais `dispatchEvent`.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createSocketServer } from 'node:net';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { openSocket } from './websocket-client.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Où est Firefox : `GFS_FIREFOX` (le fichier exécutable), le dossier de labo/installer-firefox.sh, puis les emplacements usuels. Rend le chemin, ou null.
// `GFS_SANS_FIREFOX` (n'importe quelle valeur) : ne pas mesurer sous Firefox sur cette machine. Les mesures de mise en page (un nom coupé de 4 px, deux en-têtes qui se touchent) dépendent des polices de la machine ;
// le contrôle au push de GitHub (.github/workflows/essais.yml) n'a pas celles du cloud ni celles du porteur, et y montrait des écarts qui n'en sont pas. La mesure se joue dans le cloud (labo/installer-firefox.sh) et chez le porteur.
export function findFirefox(env = process.env) {
  if (env.GFS_SANS_FIREFOX) return null;
  const installed = join(env.GFS_FIREFOX_DIR || join(homedir(), '.cache', 'gfs-firefox'), 'root', 'envs', 'ff', 'bin', 'firefox');
  const candidates = [env.GFS_FIREFOX, installed, '/usr/bin/firefox', '/usr/local/bin/firefox', '/snap/bin/firefox', '/Applications/Firefox.app/Contents/MacOS/firefox',
    'C:\\Program Files\\Mozilla Firefox\\firefox.exe', 'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'];
  return candidates.find(path => path && existsSync(path)) || null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
};

// Le dossier du prototype servi tel quel, plus les pages que l'essai fabrique ({ '/essai.html': '<!doctype html>…' }). Rend { url, close() }. Un chemin qui sort du dossier est refusé.
export function serveSite(root, pages = {}) {
  const base = normalize(root);
  const answer = (response, status, type, body) => { response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); response.end(body); };
  const server = createServer((request, response) => {
    let path;
    try { path = decodeURIComponent(request.url.split('?')[0]); } catch (error) { answer(response, 400, 'text/plain', 'adresse illisible'); return; }
    if (Object.hasOwn(pages, path)) { answer(response, 200, MIME['.html'], pages[path]); return; }
    const file = normalize(join(base, path));
    if (!file.startsWith(base + sep) || !existsSync(file) || !statSync(file).isFile()) { answer(response, 404, 'text/plain', 'introuvable'); return; }
    answer(response, 200, MIME[extname(file)] || 'application/octet-stream', readFileSync(file));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(done => { server.close(done); server.closeAllConnections(); }),
  })));
}

// Les réglages de Firefox pour un essai : une vraie souris (sans cela, Firefox sans écran se dit « sans survol » et la liste montre tous ses boutons), et rien qui appelle le réseau ou ouvre une page d'accueil.
const PREFS = {
  'ui.primaryPointerCapabilities': 6, 'browser.shell.checkDefaultBrowser': false, 'app.update.enabled': false, 'app.update.auto': false, 'toolkit.telemetry.enabled': false,
  'datareporting.policy.dataSubmissionEnabled': false, 'datareporting.healthreport.uploadEnabled': false, 'browser.aboutwelcome.enabled': false, 'startup.homepage_welcome_url': '',
  'browser.startup.homepage': 'about:blank', 'layout.css.prefers-color-scheme.content-override': 1,
};

const freePort = () => new Promise(resolve => { const probe = createSocketServer(); probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)); }); });

// La conversation avec Firefox : une commande, sa réponse ; les messages du journal de la page (`log.entryAdded`) sont gardés, et `on` écoute les autres événements (`network.beforeRequestSent`).
class Bidi {
  #socket;
  #next = 1;
  #waiting = new Map();
  #listeners = new Map();
  logs = [];

  constructor(socket) {
    this.#socket = socket;
    socket.onmessage = event => this.#receive(JSON.parse(event.data));
    socket.onclose = () => { for (const { reject } of this.#waiting.values()) reject(new Error('Firefox a fermé la connexion')); this.#waiting.clear(); };
  }

  #receive(message) {
    if (message.type === 'event') {
      if (message.method === 'log.entryAdded') this.logs.push(message.params);
      for (const listener of this.#listeners.get(message.method) || []) listener(message.params);
      return;
    }
    const entry = this.#waiting.get(message.id);
    if (!entry) return;
    this.#waiting.delete(message.id);
    if (message.type === 'error') entry.reject(new Error(`${message.error} : ${message.message}`)); else entry.resolve(message.result);
  }

  send(method, params = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const id = this.#next++;
      const timer = setTimeout(() => { this.#waiting.delete(id); reject(new Error(`${method} : Firefox ne répond pas (${timeout / 1000} s)`)); }, timeout);
      this.#waiting.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) { this.#listeners.set(method, [...(this.#listeners.get(method) || []), listener]); }

  close() { try { this.#socket.close(); } catch (error) { /* déjà fermée */ } }
}

// Les touches du clavier, au code que WebDriver leur donne.
export const KEYS = {
  Tab: '\uE004', Enter: '\uE007', Escape: '\uE00C', Space: '\uE00D', ArrowDown: '\uE015', ArrowUp: '\uE013', ArrowLeft: '\uE012', ArrowRight: '\uE014', Home: '\uE011', End: '\uE010', Backspace: '\uE003',
  Delete: '\uE017', F2: '\uE032', F10: '\uE03A', Shift: '\uE008', Control: '\uE009', Alt: '\uE00A',
};

// Un onglet : on y charge une page, on y règle la vue, on y exécute des fonctions (leur résultat revient en JSON), on y agit à la souris et au clavier.
export class Page {
  #bidi;
  #context;

  constructor(bidi, context) { this.#bidi = bidi; this.#context = context; }

  get logs() { return this.#bidi.logs; }

  async goto(url) { await this.#bidi.send('browsingContext.navigate', { context: this.#context, url, wait: 'complete' }); }

  // Largeur et hauteur de la page en pixels CSS, zoom de l'écran (1 ; 1,5 pour un portable réglé à 150 %), mode que Grist poserait sur la page (`data-grist-appearance`).
  async view({ width, height = 400, scale = 1, mode = 'light' }) {
    await this.#bidi.send('browsingContext.setViewport', { context: this.#context, viewport: { width, height }, devicePixelRatio: scale });
    await this.run(appearance => document.documentElement.setAttribute('data-grist-appearance', appearance), mode);
    await delay(60);
  }

  // `fn` s'exécute dans la page (elle ne voit rien du module qui l'écrit) ; `args` et le résultat passent en JSON.
  run(fn, ...args) { return this.#evaluate(this.#context, fn, args); }

  async #evaluate(context, fn, args) {
    const expression = `(async () => JSON.stringify(await (${fn.toString()})(...${JSON.stringify(args)})))()`;
    const reply = await this.#bidi.send('script.evaluate', { expression, target: { context }, awaitPromise: true });
    if (reply.type === 'exception') throw new Error(`dans la page : ${reply.exceptionDetails.text}`);
    return reply.result.type === 'undefined' ? undefined : JSON.parse(reply.result.value);
  }

  // Comme `run`, dans le cadre de la page dont l'adresse contient `part` (un cadre d'une autre origine aussi : WebDriver y entre). Le cadre doit exister : sinon l'erreur le dit.
  async runInFrame(part, fn, ...args) {
    const { contexts } = await this.#bidi.send('browsingContext.getTree', { root: this.#context });
    const all = nodes => nodes.flatMap(node => [node, ...all(node.children || [])]);
    const found = all(contexts).find(node => node.context !== this.#context && node.url.includes(part));
    if (!found) throw new Error(`aucun cadre à l'adresse « ${part} »`);
    return this.#evaluate(found.context, fn, args);
  }

  // Répond à la place du réseau aux pages des `hostnames` (HTTPS) : `body` en HTML, sans rien demander à l'hôte (les sites de vidéos ne sont pas joignables du cloud). Rend la liste, tenue à jour, des adresses demandées.
  async stub(hostnames, body) {
    const requested = [];
    await this.#bidi.send('session.subscribe', { events: ['network.beforeRequestSent'] });
    await this.#bidi.send('network.addIntercept', { phases: ['beforeRequestSent'], urlPatterns: hostnames.map(hostname => ({ type: 'pattern', protocol: 'https', hostname })) });
    this.#bidi.on('network.beforeRequestSent', params => {
      if (!params.isBlocked) return;
      requested.push(params.request.url);
      this.#bidi.send('network.provideResponse', { request: params.request.request, statusCode: 200, reasonPhrase: 'OK', headers: [{ name: 'content-type', value: { type: 'string', value: 'text/html; charset=utf-8' } }], body: { type: 'string', value: body } }).catch(() => {});
    });
    return requested;
  }

  // Attend que `fn` rende une valeur vraie (au plus `timeout` ms), et la rend.
  async until(fn, args = [], timeout = 5000) {
    const started = Date.now();
    for (;;) {
      const value = await this.run(fn, ...args);
      if (value) return value;
      if (Date.now() - started > timeout) throw new Error(`la page n'a pas atteint l'état attendu : ${fn.toString().slice(0, 120)}`);
      await delay(50);
    }
  }

  #pointer(actions) {
    return this.#bidi.send('input.performActions', { context: this.#context, actions: [{ type: 'pointer', id: 'souris', parameters: { pointerType: 'mouse' }, actions }] });
  }

  // La souris va au point (x, y) de la page, en pixels CSS ; `click` y appuie et relâche le bouton gauche.
  move(x, y) { return this.#pointer([{ type: 'pointerMove', x: Math.round(x), y: Math.round(y) }]); }

  click(x, y) { return this.#pointer([{ type: 'pointerMove', x: Math.round(x), y: Math.round(y) }, { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 }]); }

  // Un glissement, au vrai pointeur du navigateur : appuyer en `from`, tirer de dix pixels (le navigateur ne lance le glissement qu'alors), traverser jusqu'à `to` par `steps` pas, attendre un instant, lâcher.
  // Les points sont en pixels CSS de la page. Firefox sans écran (et sous Xvfb) lance le glissement HTML5 (`dragstart`, `dragenter`, `dragover` arrivent) mais ne l'achève pas : ni `drop` ni `dragend` ni
  // `mouseup` ne viennent après le lâcher, le glissement reste en cours jusqu'au prochain chargement de la page. Mesuré le 04/11 sur une page de deux éléments et Firefox 159 ; le dépôt se mesure sous Chromium.
  drag([fromX, fromY], [toX, toY], steps = 10) {
    const along = Array.from({ length: steps }, (unused, step) => ({
      type: 'pointerMove', x: Math.round(fromX + 10 + ((toX - fromX - 10) * (step + 1)) / steps), y: Math.round(fromY + 10 + ((toY - fromY - 10) * (step + 1)) / steps), duration: 25,
    }));
    return this.#pointer([{ type: 'pointerMove', x: Math.round(fromX), y: Math.round(fromY) }, { type: 'pointerDown', button: 0 }, { type: 'pointerMove', x: Math.round(fromX) + 10, y: Math.round(fromY) + 10, duration: 50 },
      ...along, { type: 'pause', duration: 150 }, { type: 'pointerUp', button: 0 }]);
  }

  press(...keys) {
    const actions = keys.flatMap(key => [{ type: 'keyDown', value: KEYS[key] || key }, { type: 'keyUp', value: KEYS[key] || key }]);
    return this.#bidi.send('input.performActions', { context: this.#context, actions: [{ type: 'key', id: 'clavier', actions }] });
  }

  // Des touches tenues ensemble (Maj+F10) : appuyées dans l'ordre, relâchées dans l'ordre inverse.
  chord(...keys) {
    const actions = [...keys.map(key => ({ type: 'keyDown', value: KEYS[key] || key })), ...[...keys].reverse().map(key => ({ type: 'keyUp', value: KEYS[key] || key }))];
    return this.#bidi.send('input.performActions', { context: this.#context, actions: [{ type: 'key', id: 'clavier', actions }] });
  }

  // Le clic droit : l'événement `contextmenu` que la page attend pour son menu.
  rightClick(x, y) { return this.#pointer([{ type: 'pointerMove', x: Math.round(x), y: Math.round(y) }, { type: 'pointerDown', button: 2 }, { type: 'pointerUp', button: 2 }]); }
}

// Lance Firefox sans écran, avec un profil neuf, et rend { page, close() }. Le lanceur de Firefox est parfois un script qui lance le vrai programme sans le remplacer (celui de conda) : Firefox a donc son propre
// groupe de processus (`detached`), qu'on arrête en entier, sans quoi un Firefox resterait vivant après l'essai et empêcherait Node de finir.
export async function startFirefox(binary) {
  const profile = mkdtempSync(join(tmpdir(), 'gfs-firefox-'));
  writeFileSync(join(profile, 'user.js'), Object.entries(PREFS).map(([key, value]) => `user_pref(${JSON.stringify(key)}, ${JSON.stringify(value)});`).join('\n'));
  const port = await freePort();
  const grouped = process.platform !== 'win32';
  const child = spawn(binary, ['--headless', '--no-remote', '--profile', profile, '--remote-debugging-port', String(port), 'about:blank'],
    { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MOZ_HEADLESS: '1' }, detached: grouped });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk).slice(-2000); });
  const stop = () => { try { if (grouped) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch (error) { /* déjà arrêté */ } };
  process.once('exit', stop);
  try {
    const bidi = new Bidi(await connect(port, child, () => output));
    await bidi.send('session.new', { capabilities: {} });
    await bidi.send('session.subscribe', { events: ['log.entryAdded'] });
    const { contexts } = await bidi.send('browsingContext.getTree');
    return {
      page: new Page(bidi, contexts[0].context),
      async close() {
        try { await bidi.send('browser.close', {}, 3000); } catch (error) { /* il se ferme sans répondre, ou ne répond pas : on l'arrête ensuite */ }
        bidi.close();
        await Promise.race([new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); }), delay(3000)]);
        stop();
        for (const stream of [child.stdout, child.stderr]) stream.destroy();
        process.removeListener('exit', stop);
        rmSync(profile, { recursive: true, force: true });
      },
    };
  } catch (error) {
    stop();
    throw error;
  }
}

// Firefox met quelques secondes à écouter : on réessaie jusqu'à ce qu'il réponde, ou qu'il s'arrête.
async function connect(port, child, outputOf) {
  const started = Date.now();
  for (;;) {
    if (child.exitCode !== null) throw new Error(`Firefox s'est arrêté (code ${child.exitCode}) : ${outputOf().slice(-400)}`);
    try { return await openSocket(`ws://127.0.0.1:${port}/session`); } catch (error) {
      if (Date.now() - started > 30000) throw new Error(`Firefox n'écoute pas sur le port ${port} : ${outputOf().slice(-400)}`);
      await delay(150);
    }
  }
}
