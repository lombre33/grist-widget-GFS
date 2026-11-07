// Le lecteur de vidéos que GFS pose par-dessus l'app (carte du porteur du 07/11, « Politique élargie » ; contrats 3.4 point 7, 5.2 point 11) avec la VRAIE Publipostage+ (celle que GFS référence)
// dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`) : l'app ouvre un modèle dans son éditeur, puis son code de liaison (`GfsLink.players()`, `GfsLink.player(...)`, les appels que
// `js/video-frame.js` envoie) demande à GFS de poser le lecteur. Chromium seulement ; les bibliothèques de l'app viennent du miroir (`bash build-mirror.sh`).
// YouTube et Vimeo ne sont pas atteints (le cloud d'essai n'a pas leur réseau) : le labo répond lui-même, par `page.route`, aux adresses des deux lecteurs d'une page d'essai. Tout le reste est mesuré pour de vrai :
// la politique de sécurité de GFS (elle laisse passer exactement ces deux sites, et le labo la regarde refuser un troisième), les attributs du cadre, l'endroit où il se pose, le rognage, la souris.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-lecteur.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. GFS donne ses deux sites à l'app (`GfsLink.players()`), sans que l'app les déclare elle-même ailleurs.
//   2. `afficher` (YouTube) : un cadre sur le site sans cookie, ses attributs, posé à l'endroit de la vignette dans le repère de la page, la souris l'atteint.
//   3. `deplacer` : la fenêtre suit, rognée à la zone (le cadre du fournisseur garde sa taille) ; hors de la zone, rien ne se voit ; l'app en dessous reste à la souris.
//   4. `masquer` : caché puis remontré. `afficher` (Vimeo) remplace le lecteur précédent (un seul à la fois), avec la clé de la vidéo non listée.
//   5. Refus : une adresse à la place d'un identifiant, un site inconnu : rien ne change, l'avertissement se lit en console.
//   6. La page change de taille : le lecteur suit le cadre de l'app. L'app est cachée (retour à l'explorateur) : le lecteur disparaît ; `fermer` le retire.
//   7. La politique de sécurité : un cadre vers un troisième site est refusé par le navigateur (le témoin), et aucun refus ne frappe les deux sites.
//   8. Le clavier dans le lecteur (question de l'app, 07/11) : après un clic dans le lecteur, la touche Échap tapée à la vraie touche arrive au cadre du fournisseur et à lui seul ; ni la page de GFS, ni l'app, ni la page de Grist ne la reçoivent.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check, SHOTS } from './lab-common.mjs';
import { join } from 'node:path';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { seedFiles } from './seed.mjs';
import { PAGE_PORT, openGfs, fitPanel, waitFor, rowOf } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const APP_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/apps/publipostage/`;
const MODEL = 'Contrat de prestation';
const CREATE_TABLES = lang === 'fr' ? /^Créer les tables$/ : /^Create the tables$/;
const YOUTUBE = 'dQw4w9WgXcQ';
const STUB_HOSTS = /^https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com)\//;
const appFrame = page => page.frames().find(frame => frame.url().startsWith(APP_URL) && !frame.isDetached());
const near = (a, b, tolerance = 1.5) => Math.abs(a - b) <= tolerance;
const sameBox = (box, want) => Boolean(box) && ['x', 'y', 'width', 'height'].every(key => near(box[key], want[key]));

// Ce que le navigateur de la personne a demandé aux deux sites (le labo y répond lui-même), dans l'ordre.
const requested = [];
async function stubPlayers(page) {
  await page.route(STUB_HOSTS, route => {
    requested.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>essai</title><body style="margin:0;background:#2a6;font:16px sans-serif;color:#fff">Lecteur d\'essai<script>addEventListener(\'keydown\', e => { document.title = \'touche:\' + e.key; });</script></body>' });
  });
}

// La vraie app, ouverte sur un modèle dans son éditeur.
async function openModel(run) {
  const { page, frame } = run;
  say('--- 0. Publipostage+ ouverte sur un modèle ---');
  await seedFiles(frame);
  await frame.evaluate(() => location.reload());
  await frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await rowOf(frame, MODEL).dblclick();
  const ready = await waitFor(page, 'Publipostage+ montre le modèle', async () => {
    const app = appFrame(page);
    if (!app) return false;
    const create = app.getByRole('button', { name: CREATE_TABLES });
    if (await create.count()) await create.click();
    return (await app.evaluate(() => typeof GfsLink !== 'undefined' && Boolean(document.getElementById('btn-export-pdf')) && document.getElementById('template-name').value)) === MODEL;
  }, 90000);
  check('Publipostage+ s\'ouvre sur le modèle dans son éditeur', ready);
  run.app = appFrame(page);
  await page.waitForTimeout(1500);
}

// Le cadre de l'app dans la page de Grist, le lecteur de GFS (sa fenêtre et le cadre du fournisseur) dans la même page.
const appBox = run => run.frame.locator('#frames iframe:not(.player iframe)').first().boundingBox();
const players = run => run.frame.locator('#frames .player');
const windowBox = async run => (await players(run).count()) ? players(run).first().boundingBox() : null;
const request = (run, action, args) => run.app.evaluate(([name, given]) => GfsLink.player(name, given), [action, args]);
// Ce que la vraie souris survole à un point de la page de Grist : le lecteur de GFS (sa fenêtre est alors `:hover`) ou le cadre de l'app.
const topAt = async (run, x, y) => {
  await run.page.mouse.move(x, y);
  await run.page.waitForTimeout(120);
  return (await run.frame.locator('#frames .player:hover').count()) ? 'lecteur' : 'app';
};

const rectOf = (x, y, largeur, hauteur) => ({ x, y, largeur, hauteur });

async function playContext(run) {
  say('--- 1. GFS donne ses deux sites à l\'app ---');
  const given = await run.app.evaluate(() => ({ hosted: GfsLink.hosted === true, answering: GfsLink.isAnswering(), players: GfsLink.players() }));
  check('l\'app est hébergée par GFS et GFS lui répond', given.hosted && given.answering, given);
  check('`GfsLink.players()` rend youtube et vimeo', JSON.stringify(given.players) === '["youtube","vimeo"]', given);
  run.size = await run.app.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  say('cadre de l\'app :', JSON.stringify(run.size));
}

async function playShow(run) {
  say('--- 2. afficher (YouTube) ---');
  const sent = await request(run, 'afficher', { id: 'v1', fournisseur: 'youtube', video: YOUTUBE, debut: 42, rect: rectOf(100, 80, 320, 180), zone: rectOf(0, 0, run.size.width, run.size.height) });
  check('l\'app a pu envoyer l\'appel', sent === true);
  const shown = await waitFor(run.page, 'le lecteur apparaît', async () => (await players(run).count()) === 1 && (await windowBox(run)));
  check('un lecteur est posé par GFS', shown);
  const iframe = players(run).locator('iframe');
  const attributes = await iframe.evaluate(el => ({ src: el.getAttribute('src'), sandbox: el.getAttribute('sandbox'), allow: el.getAttribute('allow'), referrerpolicy: el.getAttribute('referrerpolicy') }));
  say('cadre du lecteur :', JSON.stringify(attributes));
  check('l\'adresse est montée par GFS : YouTube sans cookie, début à 42 s', attributes.src === `https://www.youtube-nocookie.com/embed/${YOUTUBE}?rel=0&playsinline=1&autoplay=1&start=42`, attributes);
  check('le cadre garde son origine mais ne peut ni naviguer GFS ni ouvrir de fenêtre modale', /allow-scripts/.test(attributes.sandbox) && /allow-same-origin/.test(attributes.sandbox) && !/allow-top-navigation|allow-modals|allow-forms/.test(attributes.sandbox), attributes.sandbox);
  check('lecture automatique, plein écran et référent demandés', /autoplay/.test(attributes.allow) && /fullscreen/.test(attributes.allow) && attributes.referrerpolicy === 'strict-origin-when-cross-origin', attributes);
  const loaded = await waitFor(run.page, 'le navigateur a demandé la page du lecteur', async () => requested.some(url => url.startsWith('https://www.youtube-nocookie.com/embed/')));
  check('le navigateur a demandé la page du lecteur à youtube-nocookie.com (la politique de GFS la laisse passer)', loaded, requested);
  const base = await appBox(run);
  const box = await windowBox(run);
  check('le lecteur est posé à l\'endroit de la vignette, dans le repère de la page', sameBox(box, { x: base.x + 100, y: base.y + 80, width: 320, height: 180 }), { box, base });
  check('la souris au milieu de la vignette trouve le lecteur, ailleurs elle trouve l\'app', (await topAt(run, box.x + 160, box.y + 90)) === 'lecteur' && (await topAt(run, base.x + 20, base.y + 20)) === 'app');
  check('le cadre du lecteur n\'est pas décalé (il remplit sa fenêtre)', await iframe.evaluate(el => [el.style.left, el.style.top, el.style.width, el.style.height].join(' ')) === '0px 0px 320px 180px');
  await run.frame.locator('#frames').screenshot({ path: join(SHOTS, `lecteur-${lang}-${scheme}-affiche.png`) }).catch(() => {});
}

async function playMove(run) {
  say('--- 3. deplacer : la fenêtre suit, rognée à la zone ---');
  const base = await appBox(run);
  await request(run, 'deplacer', { id: 'v1', rect: rectOf(150, 60, 320, 180), zone: rectOf(0, 100, 260, 200) });
  // Visible : x de 150 à 260, y de 100 à 240 (le haut et la droite sont coupés).
  const clipped = await waitFor(run.page, 'la fenêtre est rognée', async () => sameBox(await windowBox(run), { x: base.x + 150, y: base.y + 100, width: 110, height: 140 }));
  check('la fenêtre est rognée à la zone de l\'app (110 × 140)', clipped, await windowBox(run));
  const iframe = players(run).locator('iframe');
  const inner = await iframe.evaluate(el => [el.style.left, el.style.top, el.style.width, el.style.height].join(' '));
  check('le cadre du lecteur garde sa taille entière, décalé de la partie coupée', inner === '0px -40px 320px 180px', inner);
  const box = await windowBox(run);
  check('au-delà de la zone coupée, la souris trouve l\'app et pas le lecteur', (await topAt(run, base.x + 300, base.y + 150)) === 'app' && (await topAt(run, box.x + 50, box.y + 50)) === 'lecteur');
  await request(run, 'deplacer', { id: 'v1', rect: rectOf(150, 60, 320, 180), zone: rectOf(500, 0, 100, 100) });
  const gone = await waitFor(run.page, 'rien ne se voit', async () => (await players(run).count()) === 1 && !(await players(run).first().isVisible()));
  check('une zone qui ne touche pas l\'objet cache le lecteur (le cadre reste en place, la vidéo continue)', gone);
  await request(run, 'deplacer', { id: 'v1', rect: rectOf(100, 80, 320, 180), zone: rectOf(0, 0, run.size.width, run.size.height) });
  check('revenu en pleine zone, le lecteur se montre', await waitFor(run.page, 'montré', async () => sameBox(await windowBox(run), { x: base.x + 100, y: base.y + 80, width: 320, height: 180 })));
}

async function playHideAndReplace(run) {
  say('--- 4. masquer, puis un autre lecteur ---');
  await request(run, 'masquer', { id: 'v1', masque: true });
  check('masquer cache le lecteur', await waitFor(run.page, 'masqué', async () => !(await players(run).first().isVisible())));
  await request(run, 'masquer', { id: 'v1', masque: false });
  check('démasquer le montre à nouveau', await waitFor(run.page, 'démasqué', async () => players(run).first().isVisible()));
  const before = requested.length;
  await request(run, 'afficher', { id: 'v2', fournisseur: 'vimeo', video: '76979871/8272103f6e', debut: 30, rect: rectOf(40, 40, 400, 225), zone: rectOf(0, 0, run.size.width, run.size.height) });
  const replaced = await waitFor(run.page, 'Vimeo remplace YouTube', async () => (await players(run).count()) === 1 && /player\.vimeo\.com/.test(await players(run).locator('iframe').getAttribute('src')));
  check('un seul lecteur à la fois : Vimeo remplace YouTube', replaced);
  const src = await players(run).locator('iframe').getAttribute('src');
  check('l\'adresse Vimeo porte la clé de la vidéo non listée et le début', src === 'https://player.vimeo.com/video/76979871?h=8272103f6e&autoplay=1#t=30s', src);
  check('le navigateur a demandé la page de Vimeo', await waitFor(run.page, 'Vimeo demandé', async () => requested.slice(before).some(url => url.startsWith('https://player.vimeo.com/video/76979871'))), requested);
  await request(run, 'fermer', { id: 'v1' });
  await run.page.waitForTimeout(300);
  check('fermer un identifiant qui n\'est plus le lecteur ne retire rien', (await players(run).count()) === 1);
}

async function playRefusals(run) {
  say('--- 5. refus ---');
  const mark = run.problems.length;
  await request(run, 'afficher', { id: 'v3', fournisseur: 'youtube', video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', rect: rectOf(0, 0, 100, 100), zone: rectOf(0, 0, 700, 400) });
  await request(run, 'afficher', { id: 'v4', fournisseur: 'dailymotion', video: 'x7tgad0', rect: rectOf(0, 0, 100, 100), zone: rectOf(0, 0, 700, 400) });
  await request(run, 'deplacer', { id: 'v2', rect: { x: 'zéro', y: 0, largeur: 10, hauteur: 10 }, zone: rectOf(0, 0, 700, 400) });
  await run.page.waitForTimeout(600);
  const mine = run.problems.slice(mark);
  say('console :', JSON.stringify(mine));
  check('une adresse à la place d\'un identifiant est refusée et dite en console', mine.some(text => /publipostage : lecteur\.afficher refusé \(GFS_REFUSE\).*jamais une adresse/.test(text)), mine);
  check('un site inconnu est refusé et dit en console', mine.some(text => /lecteur\.afficher refusé \(GFS_REFUSE\).*fournisseur/.test(text)), mine);
  check('un rectangle mal formé est refusé et dit en console', mine.some(text => /lecteur\.deplacer refusé \(GFS_REFUSE\).*rect/.test(text)), mine);
  mine.forEach(text => run.allow.push(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80))));
  check('le lecteur en place n\'a pas bougé (Vimeo, un seul)', (await players(run).count()) === 1 && /player\.vimeo\.com/.test(await players(run).locator('iframe').getAttribute('src')));
}

async function playResizeAndLeave(run) {
  say('--- 6. la page change de taille, l\'app est cachée ---');
  await request(run, 'deplacer', { id: 'v2', rect: rectOf(40, 40, 400, 225), zone: rectOf(0, 0, run.size.width, run.size.height) });
  await run.page.waitForTimeout(300);
  const size = run.page.viewportSize();
  await fitPanel(run.page, run.frame, 760, 440);
  await run.page.waitForTimeout(800);
  const base = await appBox(run);
  const box = await windowBox(run);
  check('le panneau grandit : le lecteur suit le cadre de l\'app', sameBox(box, { x: base.x + 40, y: base.y + 40, width: 400, height: 225 }), { box, base });
  await fitPanel(run.page, run.frame, 700, 400);
  await run.page.waitForTimeout(600);
  void size;
  // Retour à l'explorateur, à la vraie souris : le bouton « Fichiers » de la barre.
  await run.frame.locator('#floater-files').click();
  const hidden = await waitFor(run.page, 'le lecteur disparaît', async () => (await players(run).count()) === 0);
  check('l\'app est cachée par l\'explorateur : le lecteur est retiré (une vidéo ne joue pas derrière lui)', hidden);
  await request(run, 'afficher', { id: 'v6', fournisseur: 'youtube', video: YOUTUBE, rect: rectOf(10, 10, 200, 120), zone: rectOf(0, 0, run.size.width, run.size.height) });
  await run.page.waitForTimeout(600);
  check('l\'app cachée par l\'explorateur ne pose rien par-dessus lui', (await players(run).count()) === 0);
  await rowOf(run.frame, MODEL).dblclick();
  await run.page.waitForTimeout(1500);
  check('l\'app rouverte, aucun lecteur ne revient seul', (await players(run).count()) === 0);
  await request(run, 'afficher', { id: 'v5', fournisseur: 'youtube', video: YOUTUBE, rect: rectOf(10, 10, 200, 120), zone: rectOf(0, 0, run.size.width, run.size.height) });
  check('l\'app peut en poser un nouveau', await waitFor(run.page, 'nouveau', async () => (await players(run).count()) === 1));
  await request(run, 'fermer', { id: 'v5' });
  check('fermer retire le lecteur', await waitFor(run.page, 'fermé', async () => (await players(run).count()) === 0));
}

async function playKeyboard(run) {
  say('--- 8. le clavier dans le lecteur ---');
  await request(run, 'afficher', { id: 'v8', fournisseur: 'youtube', video: YOUTUBE, rect: rectOf(60, 50, 360, 200), zone: rectOf(0, 0, run.size.width, run.size.height) });
  check('un lecteur est posé', await waitFor(run.page, 'le lecteur apparaît', async () => (await players(run).count()) === 1 && (await windowBox(run))));
  const loaded = await waitFor(run.page, 'la page du lecteur', async () => run.page.frames().some(frame => frame.url().startsWith('https://www.youtube-nocookie.com/embed/') && !frame.isDetached()));
  check('le cadre du fournisseur est chargé', loaded);
  const keys = () => ({ gfs: run.frame.evaluate(() => window.__touches.slice()), app: run.app.evaluate(() => window.__touches.slice()), grist: run.page.evaluate(() => window.__touches.slice()) });
  const listen = target => target.evaluate(() => { window.__touches = []; document.addEventListener('keydown', event => window.__touches.push(event.key), true); });
  await Promise.all([listen(run.frame), listen(run.app), listen(run.page)]);
  const box = await windowBox(run);
  await run.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await run.page.waitForTimeout(300);
  const focus = await run.frame.evaluate(() => { const active = document.activeElement; return { dansLeLecteur: Boolean(active && active.closest && active.closest('.player')), balise: active ? active.tagName : null }; });
  check('après un clic dans le lecteur, le clavier est dans le cadre du fournisseur (l\'élément actif de la page de GFS est ce cadre)', focus.dansLeLecteur, focus);
  await run.page.keyboard.press('Escape');
  await run.page.waitForTimeout(400);
  const provided = run.page.frames().find(frame => frame.url().startsWith('https://www.youtube-nocookie.com/embed/') && !frame.isDetached());
  const received = await provided.evaluate(() => document.title);
  const heard = keys();
  const seen = { gfs: await heard.gfs, app: await heard.app, grist: await heard.grist };
  check('Échap, tapée à la vraie touche, est arrivée au cadre du fournisseur', received === 'touche:Escape', received);
  check('ni la page de GFS, ni l\'app, ni la page de Grist ne l\'ont reçue : un navigateur ne donne pas à un autre site les touches tapées dans un cadre', seen.gfs.length === 0 && seen.app.length === 0 && seen.grist.length === 0, seen);
  check('le lecteur est resté (rien ne l\'a fermé)', (await players(run).count()) === 1);
  await request(run, 'fermer', { id: 'v8' });
  check('fermer par l\'app le retire', await waitFor(run.page, 'fermé', async () => (await players(run).count()) === 0));
}

async function playPolicy(run) {
  say('--- 7. la politique de sécurité ---');
  const mark = run.problems.length;
  const refused = await run.frame.evaluate(() => new Promise(resolve => {
    const seen = [];
    const done = () => { frame.remove(); resolve(seen); };
    document.addEventListener('securitypolicyviolation', event => { if (event.violatedDirective.startsWith('frame-src')) { seen.push(event.blockedURI); setTimeout(done, 100); } });
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.src = 'https://www.dailymotion.com/embed/video/x7tgad0';
    document.body.append(frame);
    setTimeout(done, 4000);
  }));
  check('témoin : un cadre vers un troisième site est refusé par la politique de GFS', refused.length >= 1 && refused.every(uri => /dailymotion/.test(uri)), refused);
  const framing = run.problems.filter(text => /frame-src|Refused to frame/.test(text));
  check('seul ce témoin a été refusé : aucun refus ne frappe youtube-nocookie.com ni player.vimeo.com', framing.length >= 1 && framing.every(text => /Refused to frame 'https:\/\/www\.dailymotion\.com/.test(text)), framing);
  run.problems.splice(mark, run.problems.length - mark);
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, mirrors: true });
  await stubPlayers(run.page);
  await openModel(run);
  await playContext(run);
  await playShow(run);
  await playMove(run);
  await playHideAndReplace(run);
  await playRefusals(run);
  await playResizeAndLeave(run);
  await playPolicy(run);
  await playKeyboard(run);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune autre erreur ni avertissement de GFS dans la console', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
