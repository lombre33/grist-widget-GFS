// Le lecteur de vidéos sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à ce banc ; le lecteur du 07/11 n'avait été joué que sous Chromium, dans un vrai Grist). Le vrai `Player`
// (js/broker/player.js) est posé dans `.frames` par-dessus un cadre d'app (test/pages/lecteur.js), avec les feuilles de style et la politique de sécurité de index.html. Les sites de vidéos ne sont pas joignables du
// cloud : Firefox les voit répondre une petite page d'essai (WebDriver BiDi, `page.stub` : la requête n'atteint pas le réseau), tout le reste est celui du navigateur. Ce que l'essai mesure, à 700 × 400, à la vraie
// souris et au vrai clavier : l'adresse et les attributs du cadre que Firefox lit, la politique de sécurité (les deux sites passent, un troisième est refusé), l'endroit où le lecteur se pose, son rognage à la zone
// de l'app, qui reçoit la souris, le panneau qui change de taille, le lecteur qui part avec l'app, et le focus (un clic dans le lecteur lui donne le clavier, un clic dans l'app le lui reprend).
// Ce qu'il ne dit pas : ce que font vraiment YouTube et Vimeo (lecture, plein écran, protection des contenus), qui ne se mesure que chez la personne, avec une vraie vidéo, et où va la touche Échap tapée dans le lecteur
// (voir `focus`).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

export const PAGE = '/essai-lecteur.html';
const APP = '/essai-lecteur-app.html';
const HOSTS = ['www.youtube-nocookie.com', 'player.vimeo.com'];
const PLAYER_URL = { youtube: 'https://www.youtube-nocookie.com/embed/', vimeo: 'https://player.vimeo.com/video/' };
const YOUTUBE = 'dQw4w9WgXcQ';
const FULL = { x: 0, y: 0, largeur: 700, hauteur: 400 };
const near = (a, b) => Math.abs(a - b) <= 1.5;
const sameBox = (box, want) => Boolean(box) && box.every((value, index) => near(value, want[index]));
const rectOf = (x, y, largeur, hauteur) => ({ x, y, largeur, hauteur });

// La page que les sites de vidéos répondent et celle de l'app : chacune note la dernière touche reçue dans son titre.
const PROVIDER_PAGE = '<!doctype html><meta charset="utf-8"><title>essai</title><body style="margin:0;background:#2a6;color:#fff;font:16px sans-serif">Lecteur d\'essai<script>addEventListener("keydown", event => { document.title = "touche:" + event.key; });</script></body>';
const APP_PAGE = '<!doctype html><meta charset="utf-8"><title>app</title><body>app<script>addEventListener("keydown", event => { document.title = "touche:" + event.key; });</script></body>';

// Les pages que le banc fabrique : la page d'essai, avec les feuilles de style et la politique de sécurité de index.html (recopiées, dans leur ordre), et celle de l'app (dans un bac à sable, comme une vraie app).
export function lecteurPages() {
  const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const sheets = index.match(/<link rel="stylesheet"[^>]*>/g) || [];
  const policy = (index.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/) || [''])[0];
  if (sheets.length < 3 || !policy) throw new Error('index.html : ses feuilles de style et sa politique de sécurité');
  const page = `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8">${policy}<title>essai</title>\n${sheets.join('\n')}\n</head>\n`
    + `<body><main class="stage"><div class="frames" id="frames"><iframe class="app-frame" title="app" src="${APP}" sandbox="allow-scripts"></iframe></div></main><script type="module" src="/test/pages/lecteur.js"></script></body></html>`;
  return { [PAGE]: page, [APP]: APP_PAGE };
}

// Firefox répond lui-même aux deux sites de vidéos ; rend la liste, tenue à jour, des adresses qu'il a demandées.
export const stubProviders = page => page.stub(HOSTS, PROVIDER_PAGE);

// Ce que la page voit : le cadre de l'app, la fenêtre du lecteur (sa boîte, si elle se voit), le décalage du cadre du fournisseur, et à qui est la souris (`:hover` : le survol qu'a Firefox).
function measure() {
  const app = document.querySelector('.app-frame');
  const players = [...document.querySelectorAll('.player')];
  const player = players[0] || null;
  const box = element => { const found = element.getBoundingClientRect(); return [found.x, found.y, found.width, found.height]; };
  return {
    app: box(app), count: players.length, hidden: player ? player.hidden : null, box: player && !player.hidden ? box(player) : null,
    inner: player ? [...['left', 'top', 'width', 'height']].map(name => player.firstElementChild.style[name]).join(' ') : null,
    src: player ? player.firstElementChild.getAttribute('src') : null, onPlayer: Boolean(document.querySelector('.player:hover')), onApp: app.matches(':hover'),
    active: document.activeElement && document.activeElement.closest('.player') ? 'lecteur' : (document.activeElement ? document.activeElement.tagName : null),
  };
}

const send = (page, name, args) => page.run((call, given) => window.__lecteur.call(call, given), name, args);
const show = (page, id, provider, video, rect, zone, start) => send(page, 'lecteur.afficher', { id, fournisseur: provider, video, rect, zone, ...(start ? { debut: start } : {}) });
const move = (page, id, rect, zone) => send(page, 'lecteur.deplacer', { id, rect, zone });
const settle = page => page.run(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 80))));

// Un essai : `note` écrit un écart, `expect` attend un état de la page (au plus 2 s).
class Run {
  constructor(page, tag, found) { this.page = page; this.tag = tag; this.found = found; }

  note(kind, text) { this.found.push({ kind: `lecteur de vidéos : ${kind}`, text: `${this.tag} : ${text}` }); }

  check(kind, ok, text) { if (!ok) this.note(kind, text); return ok; }

  async state() { await settle(this.page); return this.page.run(measure); }

  async expect(kind, text, test) {
    const started = Date.now();
    for (;;) {
      const state = await this.state();
      if (test(state)) return state;
      if (Date.now() - started > 2000) { this.note(kind, `${text} (état : ${JSON.stringify(state)})`); return state; }
    }
  }

  // Ce que la souris trouve au point (x, y) de la page : « lecteur », « app » ou « rien ».
  async topAt(x, y) {
    await this.page.move(x, y);
    const state = await this.state();
    return state.onPlayer ? 'lecteur' : (state.onApp ? 'app' : 'rien');
  }
}

// Le titre de la page du fournisseur, quand elle est chargée (au plus 2 s) : le titre attendu, sinon ce qu'il y a (ou l'absence du cadre).
async function providerTitle(page, wanted, site = PLAYER_URL.youtube) {
  const started = Date.now();
  let title;
  do {
    title = await page.runInFrame(site, () => document.title).catch(error => `absent : ${error.message}`);
    if (title === wanted) break;
    await new Promise(resolve => setTimeout(resolve, 80));
  } while (Date.now() - started < 2000);
  return title;
}

async function showYoutube(run, requested) {
  const { page } = run;
  await show(page, 'v1', 'youtube', YOUTUBE, rectOf(100, 80, 320, 180), FULL, 42);
  const state = await run.expect('afficher', 'le lecteur devait se poser', now => now.count === 1 && now.box);
  const attributes = await page.run(() => { const frame = document.querySelector('.player iframe'); return { sandbox: frame.getAttribute('sandbox'), allow: frame.getAttribute('allow'), referrerpolicy: frame.getAttribute('referrerpolicy') }; });
  run.check('adresse', state.src === `${PLAYER_URL.youtube}${YOUTUBE}?rel=0&playsinline=1&autoplay=1&start=42`, `l'adresse montée par GFS devait être celle de YouTube sans cookie, début à 42 s (adresse : ${state.src})`);
  run.check('attributs du cadre', /allow-scripts/.test(attributes.sandbox) && /allow-same-origin/.test(attributes.sandbox) && !/allow-top-navigation|allow-modals|allow-forms/.test(attributes.sandbox)
    && /autoplay/.test(attributes.allow) && /fullscreen/.test(attributes.allow) && attributes.referrerpolicy === 'strict-origin-when-cross-origin', `les attributs du cadre ont changé : ${JSON.stringify(attributes)}`);
  run.check('endroit', sameBox(state.box, [state.app[0] + 100, state.app[1] + 80, 320, 180]), `le lecteur devait être posé à (100, 80), 320 × 180, dans le cadre de l'app (boîte : ${JSON.stringify(state.box)}, cadre de l'app : ${JSON.stringify(state.app)})`);
  run.check('page demandée', requested.some(url => url.startsWith(PLAYER_URL.youtube)), 'Firefox devait demander la page du lecteur à youtube-nocookie.com (la politique de sécurité de GFS la laisse passer)');
  const provided = await providerTitle(page, 'essai');
  run.check('page chargée', provided === 'essai', `le cadre du fournisseur devait contenir la page répondue (titre : ${provided})`);
  const violations = await page.run(() => window.__violations);
  run.check('politique de sécurité', violations.length === 0, `aucun refus attendu pour youtube-nocookie.com (refus : ${JSON.stringify(violations)})`);
  run.check('inner', state.inner === '0px 0px 320px 180px', `le cadre du fournisseur devait remplir sa fenêtre (${state.inner})`);
  return state;
}

async function mouseAndClip(run, base) {
  const [x, y, width, height] = base.box;
  const here = await run.topAt(x + width / 2, y + height / 2);
  const away = await run.topAt(base.app[0] + 20, base.app[1] + 20);
  run.check('souris', here === 'lecteur' && away === 'app', `la vraie souris devait trouver le lecteur au milieu de la vignette (${here}) et l'app ailleurs (${away})`);
  await move(run.page, 'v1', rectOf(150, 60, 320, 180), rectOf(0, 100, 260, 200)); // visible : x de 150 à 260, y de 100 à 240
  const clipped = await run.expect('rognage', 'la fenêtre devait être rognée à la zone (110 × 140)', now => now.box && sameBox(now.box, [now.app[0] + 150, now.app[1] + 100, 110, 140]));
  run.check('rognage : cadre', clipped.inner === '0px -40px 320px 180px', `le cadre du fournisseur devait garder sa taille entière, décalé de la partie coupée (${clipped.inner})`);
  const inside = await run.topAt(clipped.box[0] + 50, clipped.box[1] + 50);
  const cut = await run.topAt(clipped.app[0] + 300, clipped.app[1] + 150);
  run.check('rognage : souris', inside === 'lecteur' && cut === 'app', `dans la partie visible la souris devait trouver le lecteur (${inside}), au-delà de la coupe l'app (${cut})`);
  await move(run.page, 'v1', rectOf(150, 60, 320, 180), rectOf(500, 0, 100, 100));
  await run.expect('zone sans objet', 'une zone qui ne touche pas l\'objet devait cacher le lecteur sans le retirer', now => now.count === 1 && now.hidden === true && now.box === null);
  await move(run.page, 'v1', rectOf(100, 80, 320, 180), FULL);
  await run.expect('retour en zone', 'le lecteur devait se montrer de nouveau', now => now.box && sameBox(now.box, [now.app[0] + 100, now.app[1] + 80, 320, 180]));
}

async function hideAndReplace(run, requested) {
  const { page } = run;
  await send(page, 'lecteur.masquer', { id: 'v1', masque: true });
  await run.expect('masquer', 'masquer devait cacher le lecteur', now => now.count === 1 && now.hidden === true);
  await send(page, 'lecteur.masquer', { id: 'v1', masque: false });
  await run.expect('démasquer', 'démasquer devait le montrer', now => now.box !== null);
  await show(page, 'v2', 'vimeo', '76979871/8272103f6e', rectOf(40, 40, 400, 225), FULL, 30);
  const state = await run.expect('Vimeo', 'Vimeo devait remplacer YouTube (un seul lecteur à la fois)', now => now.count === 1 && /player\.vimeo\.com/.test(now.src || ''));
  run.check('Vimeo : adresse', state.src === `${PLAYER_URL.vimeo}76979871?h=8272103f6e&autoplay=1#t=30s`, `l'adresse devait porter la clé de la vidéo non listée et le début (${state.src})`);
  run.check('Vimeo : page demandée', requested.some(url => url.startsWith(`${PLAYER_URL.vimeo}76979871`)), 'Firefox devait demander la page du lecteur à player.vimeo.com');
  const provided = await providerTitle(page, 'essai', PLAYER_URL.vimeo);
  const violations = await page.run(() => window.__violations);
  run.check('Vimeo : page chargée', provided === 'essai' && violations.length === 0, `le cadre de Vimeo devait contenir la page répondue, sans refus de la politique de sécurité (titre : ${provided}, refus : ${JSON.stringify(violations)})`);
  await send(page, 'lecteur.fermer', { id: 'v1' });
  const kept = await run.state();
  run.check('fermer un autre identifiant', kept.count === 1, 'fermer un identifiant qui n\'est plus le lecteur ne devait rien retirer');
}

async function refusals(run) {
  const { page } = run;
  const codes = [
    await show(page, 'v3', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', rectOf(0, 0, 100, 100), FULL),
    await show(page, 'v4', 'dailymotion', 'x7tgad0', rectOf(0, 0, 100, 100), FULL),
    await move(page, 'v2', { x: 'zéro', y: 0, largeur: 10, hauteur: 10 }, FULL),
  ];
  const warnings = await page.run(() => window.__lecteur.warnings);
  run.check('refus', codes.every(code => code === 'GFS_REFUSE'), `une adresse, un site inconnu et un rectangle mal formé devaient être refusés (réponses : ${JSON.stringify(codes)})`);
  run.check('refus dits', warnings.length === 3 && warnings.every(text => /refusé \(GFS_REFUSE\)/.test(text)), `chaque refus devait se lire en console (${JSON.stringify(warnings)})`);
  const state = await run.state();
  run.check('refus : rien ne bouge', state.count === 1 && /player\.vimeo\.com/.test(state.src || ''), `le lecteur en place ne devait pas changer (${state.src})`);
}

async function resizeAndLeave(run) {
  const { page } = run;
  await move(page, 'v2', rectOf(500, 50, 320, 180), rectOf(0, 0, 2000, 400));
  const narrow = await run.expect('panneau étroit', 'à 700 px la part visible devait être de 200 px (le cadre de l\'app coupe)', now => now.box && near(now.box[2], 200));
  await page.view({ width: 900, height: 400 });
  const wide = await run.expect('panneau large', 'à 900 px de large le lecteur devait suivre le cadre de l\'app (320 px visibles)', now => now.box && near(now.box[2], 320));
  run.check('panneau', narrow.box && wide.box && near(wide.app[2], 900), `le cadre de l'app devait suivre la page (${JSON.stringify(wide.app)})`);
  await page.view({ width: 700, height: 400 });
  await page.run(() => window.__lecteur.shown(false));
  await show(page, 'v5', 'youtube', YOUTUBE, rectOf(10, 10, 200, 120), FULL);
  const hiddenApp = await run.state();
  run.check('app cachée', hiddenApp.count === 1 && /player\.vimeo\.com/.test(hiddenApp.src || ''), `une app cachée derrière l'explorateur ne devait rien poser (état : ${JSON.stringify(hiddenApp)})`);
  await page.run(() => { window.__lecteur.leave(); window.__lecteur.shown(true); });
  await run.expect('app fermée', 'le lecteur devait partir avec l\'app', now => now.count === 0);
  await show(page, 'v6', 'youtube', YOUTUBE, rectOf(10, 10, 200, 120), FULL);
  await run.expect('nouveau lecteur', 'l\'app rouverte devait pouvoir en poser un nouveau', now => now.count === 1);
  await send(page, 'lecteur.fermer', { id: 'v6' });
  await run.expect('fermer', 'fermer devait retirer le lecteur', now => now.count === 0);
}

// Le focus : un clic dans le lecteur met le cadre du fournisseur au clavier (l'élément actif de la page de GFS est ce cadre), et ni ce clic ni un clic dans l'app, hors du lecteur, ne ferme le lecteur (seule l'app le ferme).
// La touche Échap tapée dans le lecteur ne se mesure PAS ici : Firefox sans écran ne donne le focus à aucune fenêtre (`document.hasFocus()` vaut faux, aussi dans le cadre du fournisseur), ne rend pas le focus à
// l'app après un clic dedans (l'élément actif reste le lecteur) et dépose la touche que WebDriver synthétise sur l'élément `iframe` de la page de GFS, jamais dans le document d'une autre origine (mesuré le 10/11,
// Firefox 160). Elle se mesure sous Chromium (labo/run-lecteur.mjs, point 8 : ni GFS, ni l'app, ni Grist ne la reçoivent) et, sous Firefox, chez la personne.
async function focus(run) {
  const { page } = run;
  await show(page, 'v8', 'youtube', YOUTUBE, rectOf(60, 50, 360, 200), FULL);
  const state = await run.expect('focus : lecteur', 'le lecteur devait se poser', now => now.box);
  await providerTitle(page, 'essai');
  await page.click(state.box[0] + state.box[2] / 2, state.box[1] + state.box[3] / 2);
  await run.expect('focus : clic dans le lecteur', 'après un clic dans le lecteur, l\'élément actif de la page de GFS devait être le cadre du fournisseur', now => now.active === 'lecteur');
  await page.click(state.app[0] + 20, state.app[1] + 20);
  const kept = await run.state();
  run.check('focus : le lecteur reste', kept.count === 1 && kept.box !== null && kept.onApp, `un clic dans le lecteur, puis dans l'app, ne devait pas fermer le lecteur (état : ${JSON.stringify(kept)})`);
  await send(page, 'lecteur.fermer', { id: 'v8' });
  await run.expect('focus : fermer', 'fermer par l\'app devait retirer le lecteur', now => now.count === 0);
}

// La politique de sécurité, par un témoin : un cadre vers un troisième site est refusé par Firefox, avec le refus qu'il note.
async function policy(run) {
  const refused = await run.page.run(() => new Promise(resolve => {
    const seen = [];
    const done = () => { frame.remove(); resolve(seen); };
    document.addEventListener('securitypolicyviolation', event => { if (event.violatedDirective.startsWith('frame-src')) { seen.push(event.blockedURI); setTimeout(done, 100); } });
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.src = 'https://www.dailymotion.com/embed/video/x7tgad0';
    document.body.append(frame);
    setTimeout(done, 3000);
  }));
  run.check('politique de sécurité : témoin', refused.length >= 1 && refused.every(uri => /dailymotion/.test(uri)), `un cadre vers un troisième site devait être refusé par la politique de GFS (refus : ${JSON.stringify(refused)})`);
}

// Les mesures du lecteur à 700 × 400, en clair (`mode` « light ») ou en sombre (« dark »), page rechargée (le lecteur de la mesure d'avant ne reste pas) ; `site` sert la page d'essai, `requested` est la liste de
// `stubProviders` ; rend les écarts { kind, text }.
export async function lecteurProblems(page, site, mode, requested) {
  const found = [];
  const run = new Run(page, `700 px, ${mode === 'dark' ? 'sombre' : 'clair'}`, found);
  requested.length = 0;
  const logged = page.logs.length;
  await page.goto(`${site.url}${PAGE}`);
  await page.run(() => window.__ready);
  await page.view({ width: 700, height: 400, scale: 1, mode });
  const steps = [
    ['afficher', async () => { run.base = await showYoutube(run, requested); }],
    ['souris et rognage', () => mouseAndClip(run, run.base)],
    ['masquer et remplacer', () => hideAndReplace(run, requested)],
    ['refus', () => refusals(run)],
    ['taille et départ', () => resizeAndLeave(run)],
    ['politique', () => policy(run)],
    ['focus', () => focus(run)],
  ];
  for (const [name, step] of steps) {
    try {
      await step();
    } catch (error) {
      run.note('geste impossible', `${name} : ${String(error.message).slice(0, 200)}`);
    }
  }
  // Le refus du témoin de la politique (un troisième site) est attendu : il se lit en console, il ne compte pas.
  const written = page.logs.slice(logged).filter(entry => ((entry.level === 'error' && entry.type === 'javascript') || /GFS/.test(entry.text || '')) && !/dailymotion/.test(entry.text || ''));
  for (const entry of written) found.push({ kind: 'lecteur de vidéos : la page écrit dans la console', text: `${run.tag} : « ${String(entry.text).slice(0, 120)} »` });
  return found;
}
