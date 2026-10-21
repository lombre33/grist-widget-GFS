// La barre de GFS au-dessus d'une app (contrats 5.2 point 7 et 5.1 `barre.masquer`), dans un vrai Grist (grist-static) : trois boutons à icône seule posés par-dessus le cadre de l'app, au bord
// que la personne choisit (gauche, haut, droite, bas), sans prendre de place à l'app, qui apprend la zone à laisser libre. La sonde R (labo/sondes/r-barre/) fait ce que fera Publipostage+ :
// elle note `contexte.barre` et chaque événement `barre`, écarte son titre et sa légende de la zone, et sait appeler `barre.masquer`. LAB_LANG=fr|en, LAB_SCHEME=light|dark.
// Tout se fait à 700 × 400, à la vraie souris (et au vrai clavier pour le premier choix). Ce que la passe mesure :
//   1. le départ : pas de barre sous l'explorateur ; l'app ouverte, la barre est à gauche, 34 × 94 px à 4 px du bord, centrée ; GFS n'a rien écrit sans un geste ; le contexte dit la zone mesurée ;
//   2. les quatre bords, un par un : le menu de position s'ouvre à côté de la barre sans la recouvrir, le choix est gardé (`gfs.barre`), la barre se pose au bord et au milieu, l'app reçoit un événement
//      `barre` (et un contexte) qui disent exactement la zone mesurée, son titre et sa légende s'en écartent, les coins et les trois autres milieux de côté restent cliquables, pas le milieu du côté de la barre ;
//   3. la taille du cadre change (un bord vertical, un bord horizontal) : la barre reste centrée et l'app le sait ;
//   4. un navigateur qui refuse de garder le choix : la phrase d'avertissement ne recouvre pas la barre ;
//   5. `barre.masquer` : la barre disparaît et revient, la réponse dit l'état, un argument hors règle est refusé (réponse ou avertissement), un nouveau contexte remet la barre ;
//   6. l'explorateur : la barre s'efface, l'app l'apprend (`barre: null`), une demande de masquer pendant ce temps ne tient pas, la barre revient à la fermeture ;
//   7. le choix tient au rechargement de GFS (c'est le navigateur qui le garde), une valeur inconnue y est ignorée, et une autre section de GFS qui change la clé est suivie sans rechargement ;
//   rien de tout cela n'écrit dans le document (ni table, ni ligne de GFS_Rangement).
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const RUN = `barre-${lang}-${scheme}`;
const GAP = 4;
const WORDS = {
  fr: { files: 'Ouvrir l’explorateur de fichiers', apps: 'Apps et extensions de Grist Factory Suite', place: 'Position de la barre', group: 'Grist Factory Suite', close: /^Fermer$/,
    edges: { gauche: 'À gauche', haut: 'En haut', droite: 'À droite', bas: 'En bas' }, notKept: 'Ce choix ne sera pas gardé : ton navigateur refuse l’enregistrement.' },
  en: { files: 'Open the file explorer', apps: 'Apps and extensions of Grist Factory Suite', place: 'Bar position', group: 'Grist Factory Suite', close: /^Close$/,
    edges: { gauche: 'Left', haut: 'Top', droite: 'Right', bas: 'Bottom' }, notKept: 'This choice will not be kept: your browser refuses to store it.' },
}[lang];
const ORDER = ['gauche', 'haut', 'droite', 'bas']; // l'ordre du menu
const SIDE = { gauche: 'right', haut: 'below', droite: 'left', bas: 'above' }; // de quel côté de la barre le menu s'ouvre
const MIDDLE = { gauche: 'w', haut: 'n', droite: 'e', bas: 's' }; // le bouton de la sonde au milieu de chaque côté

const lab = await startLab({ lang, colorScheme: scheme, probes: true });
const { page } = lab;
const warnings = [];
page.on('console', m => { if (m.type() === 'warning' && m.text().startsWith('GFS')) warnings.push(m.text()); });
await lab.fitPanel(undefined, 700, 400);
let frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);

const waitFor = async (label, test, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
// Ce que la sonde a reçu : écrit dans body[data-sonde] à chaque message ; une page rechargée repart de zéro.
const probe = target => target.evaluate(() => ({ contextes: [], evenements: [], reponses: [], erreurs: [], clics: {}, ...JSON.parse((document.body && document.body.dataset.sonde) || '{}') }));
const probeFrames = () => page.frames().filter(f => /r-barre\//.test(f.url()) && !f.isDetached());
let app = null;
const openProbe = async () => {
  await lab.openApp('sonde-r', /r-barre\//, frame);
  app = null;
  for (let i = 0; i < 60 && !app; i++) {
    const found = probeFrames();
    app = found.length ? found.at(-1) : null;
    if (!app) await page.waitForTimeout(250);
  }
  await waitFor('le contexte', async () => (await probe(app)).contextes.length >= 1);
  // La sonde dit `themeInitialized`, comme une app de Grist : GFS la montre. Tant qu'elle est cachée (`visibility: hidden`), aucun clic ne l'atteint.
  await frame.waitForFunction(() => { const el = document.querySelector('.app-frame'); return Boolean(el) && !el.classList.contains('app-frame--hidden'); }, null, { timeout: 15000 });
  return app;
};
const askContext = async () => {
  const before = (await probe(app)).contextes.length;
  await app.evaluate(() => window.sondeR.contexte());
  await waitFor('le contexte demandé', async () => (await probe(app)).contextes.length > before);
  return (await probe(app)).contextes.at(-1);
};
const call = async (name, ...args) => {
  const was = await probe(app);
  await app.evaluate(([n, a]) => window.sondeR[n](...a), [name, args]);
  const total = seen => seen.reponses.length + seen.erreurs.length;
  await waitFor(`la réponse de ${name}`, async () => total(await probe(app)) > total(was));
  const now = await probe(app);
  if (now.erreurs.length > was.erreurs.length) return { erreur: now.erreurs.at(-1) };
  return now.reponses.length > was.reponses.length ? { data: now.reponses.at(-1).data } : null;
};

// La barre telle qu'elle est posée dans la page de GFS (px dans le cadre), et le cadre.
const box = r => ({ x: r.left, y: r.top, largeur: r.width, hauteur: r.height });
const dockRect = () => frame.evaluate(() => { const r = document.getElementById('floaters').getBoundingClientRect(); const s = document.getElementById('stage').getBoundingClientRect(); return { x: r.left - s.left, y: r.top - s.top, largeur: r.width, hauteur: r.height }; });
const stageSize = () => frame.evaluate(() => { const s = document.getElementById('stage').getBoundingClientRect(); return { largeur: s.width, hauteur: s.height }; });
const dockState = () => frame.evaluate(() => {
  const d = document.getElementById('floaters');
  let stored = null;
  try { stored = localStorage.getItem('gfs.barre'); } catch (error) { stored = 'illisible'; }
  return { visible: !d.hidden && getComputedStyle(d).display !== 'none', edge: d.dataset.edge, role: d.getAttribute('role'), label: d.getAttribute('aria-label'), stored,
    place: document.getElementById('floater-place').dataset.edge, focus: document.activeElement && document.activeElement.id };
});
// La zone que l'app doit recevoir, recalculée ici d'après la barre mesurée (le contrat : la barre et 4 px autour, dans le cadre).
const expectedBarre = (edge, rect, stage) => {
  const x0 = Math.max(0, Math.round(rect.x) - GAP);
  const y0 = Math.max(0, Math.round(rect.y) - GAP);
  const x1 = Math.min(stage.largeur, Math.round(rect.x + rect.largeur) + GAP);
  const y1 = Math.min(stage.hauteur, Math.round(rect.y + rect.hauteur) + GAP);
  const zone = { x: x0, y: y0, largeur: x1 - x0, hauteur: y1 - y0 };
  return { bord: edge, epaisseur: edge === 'gauche' || edge === 'droite' ? zone.largeur : zone.hauteur, zone };
};
const flat = b => (b ? [b.bord, b.epaisseur, b.zone.x, b.zone.y, b.zone.largeur, b.zone.hauteur].join(',') : null);
const overlap = (a, b) => a.x < b.x + b.largeur && a.x + a.largeur > b.x && a.y < b.y + b.hauteur && a.y + a.hauteur > b.y;
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
// La barre est au bon bord, à 4 px de lui, et centrée sur lui.
const placedAt = (edge, rect, stage) => {
  const midX = rect.x + rect.largeur / 2;
  const midY = rect.y + rect.hauteur / 2;
  if (edge === 'gauche') return near(rect.x, GAP) && near(midY, stage.hauteur / 2);
  if (edge === 'droite') return near(rect.x + rect.largeur, stage.largeur - GAP) && near(midY, stage.hauteur / 2);
  if (edge === 'haut') return near(rect.y, GAP) && near(midX, stage.largeur / 2);
  return near(rect.y + rect.hauteur, stage.hauteur - GAP) && near(midX, stage.largeur / 2);
};
const inApp = id => app.evaluate(i => { const r = document.getElementById(i).getBoundingClientRect(); return { x: r.left, y: r.top, largeur: r.width, hauteur: r.height }; }, id);
// Cliquable à la vraie souris : la vérification de Playwright (essai de clic) dit si la barre, ou autre chose, recouvre le point visé.
const reachable = async id => {
  try { await app.locator(`#${id}`).click({ trial: true, timeout: 1500 }); return true; } catch (error) { return error.message.replace(/\u001b\[[0-9;]*m/g, '').split('\n').map(line => line.trim()).find(line => /intercepts|not visible|detached/.test(line)) || 'refusé'; }
};
const reachability = async () => Object.fromEntries(await Promise.all(['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'].map(async id => [id, await reachable(id)])));
const lastEvent = async () => (await probe(app)).evenements.at(-1);
const eventsCount = async () => (await probe(app)).evenements.length;

// ---------- 1. le départ ----------
const gfsRoot = await dockState();
check('sous l\'explorateur (aucune app), la barre n\'est pas à l\'écran', gfsRoot.visible === false, gfsRoot);
await openProbe();
let seen = await probe(app);
let state = await dockState();
let rect = await dockRect();
let stage = await stageSize();
say('au départ :', { barre: seen.contextes[0].barre, rect, stage, state });
check('le cadre de GFS mesure bien 700 × 400', near(stage.largeur, 700) && near(stage.hauteur, 400), stage);
check('l\'app ouverte, la barre est à l\'écran, à gauche par défaut', state.visible && state.edge === 'gauche' && state.place === 'gauche', state);
check('GFS n\'a rien écrit sans un geste de la personne (pas de clé `gfs.barre`)', state.stored === null, state.stored);
check('la barre mesure 34 × 94 px, à 4 px du bord gauche et centrée sur lui', near(rect.largeur, 34, 0.6) && near(rect.hauteur, 94, 0.6) && placedAt('gauche', rect, stage), rect);
check('le groupe de boutons a un nom accessible (« Grist Factory Suite ») et un rôle de groupe', state.role === 'group' && state.label === WORDS.group, state);
const names = await frame.evaluate(() => ['floater-files', 'floater-apps', 'floater-place'].map(id => { const b = document.getElementById(id); return { title: b.title, label: b.getAttribute('aria-label'), text: b.textContent.trim(), icons: b.querySelectorAll('svg').length }; }));
check('trois boutons à icône seule, dont le nom (info-bulle et nom accessible) est dans la langue de GFS', JSON.stringify(names) === JSON.stringify([WORDS.files, WORDS.apps, WORDS.place].map(text => ({ title: text, label: text, text: '', icons: 1 }))), names);
const colors = await frame.evaluate(() => {
  const parse = c => c.match(/[\d.]+/g).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => { const f = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [hi, lo] = [lum(parse(a)), lum(parse(b))].sort((p, q) => q - p); return Math.round(((hi + 0.05) / (lo + 0.05)) * 10) / 10; };
  const root = getComputedStyle(document.getElementById('floaters'));
  const icon = getComputedStyle(document.querySelector('#floater-files svg'));
  const border = getComputedStyle(document.getElementById('floaters')).borderTopColor;
  return { icone: ratio(icon.stroke, root.backgroundColor), bordure: ratio(border, root.backgroundColor), fond: root.backgroundColor, trait: icon.stroke };
});
check('l\'icône se lit sur le fond de la barre à 4,5:1 au moins (jetons de la charte)', colors.icone >= 4.5, colors);
check('le contexte de l\'app dit la zone mesurée : { bord, epaisseur, zone } = la barre et 4 px autour', flat(seen.contextes[0].barre) === flat(expectedBarre('gauche', rect, stage)), { recu: seen.contextes[0].barre, attendu: expectedBarre('gauche', rect, stage) });
check('à 700 × 400 la zone du bord gauche est x 0, y 149, 42 × 102 (épaisseur 42)', stage.largeur !== 700 || stage.hauteur !== 400 || flat(seen.contextes[0].barre) === 'gauche,42,0,149,42,102', seen.contextes[0].barre);
const documentBefore = await lab.rangement(frame);
let reach = await reachability();
say('cliquable :', reach);
check('les coins et les milieux des trois autres côtés restent cliquables ; le milieu du côté gauche est sous la barre', ['nw', 'ne', 'sw', 'se', 'n', 's', 'e'].every(id => reach[id] === true) && reach.w !== true, reach);
await lab.shotPanel(RUN, '1-depart', frame);

// ---------- 2. les quatre bords ----------
// Le premier choix se fait au clavier (Entrée sur le bouton, flèche, Entrée) ; les autres à la vraie souris.
const panelBox = async () => (await (await frame.frameElement()).boundingBox());
let keyboardDone = false;
let current = 'gauche';
const verifyEdge = async (edge, before) => {
  const arrived = await waitFor(`l'événement du bord ${edge}`, async () => (await eventsCount()) > before && (await lastEvent()).barre && (await lastEvent()).barre.bord === edge);
  state = await dockState();
  rect = await dockRect();
  stage = await stageSize();
  const expected = expectedBarre(edge, rect, stage);
  const events = (await probe(app)).evenements;
  check(`${edge} : la barre est au bord choisi, à 4 px, centrée (${Math.round(rect.largeur)} × ${Math.round(rect.hauteur)} px)`, state.visible && state.edge === edge && state.place === edge && placedAt(edge, rect, stage), { rect, stage, state });
  check(`${edge} : l'app reçoit UN événement \`barre\` pour ce changement, et il dit la zone mesurée`, arrived && events.length === before + 1 && flat(events.at(-1).barre) === flat(expected), { recu: events.slice(before), attendu: expected });
  const context = await askContext();
  check(`${edge} : un nouveau contexte dit la même chose que l'événement`, flat(context.barre) === flat(expected), { contexte: context.barre, attendu: expected });
  check(`${edge} : le choix est gardé dans le navigateur de GFS (clé \`gfs.barre\`)`, state.stored === edge, state.stored);
  const title = await inApp('titre');
  const caption = await inApp('legende');
  check(`${edge} : le titre et la légende de la sonde s'écartent de la barre (zone laissée libre, sans recouvrement)`, !overlap(title, rect) && !overlap(caption, rect), { titre: title, legende: caption, barre: rect });
  reach = await reachability();
  const others = ['nw', 'ne', 'sw', 'se', ...Object.values(MIDDLE).filter(id => id !== MIDDLE[edge])];
  check(`${edge} : les coins et les trois autres milieux de côté restent cliquables à la souris ; pas le milieu du côté de la barre`, others.every(id => reach[id] === true) && reach[MIDDLE[edge]] !== true, reach);
  const click = { gauche: 'se', haut: 'sw', droite: 'nw', bas: 'ne' }[edge];
  const clicsBefore = (await probe(app)).clics[click] || 0;
  await app.locator(`#${click}`).click();
  check(`${edge} : un vrai clic dans le coin « ${click} » atteint l'app à travers le cadre de GFS`, ((await probe(app)).clics[click] || 0) === clicsBefore + 1);
  await lab.shotPanel(RUN, `2-bord-${edge}`, frame);
};
const placeMenu = async from => {
  const menu = frame.locator('.menu');
  await menu.waitFor();
  const items = await menu.locator('.menu-item').allTextContents();
  const checked = await menu.locator('[aria-checked="true"]').allTextContents();
  const menuBox = await menu.boundingBox();
  const barBox = await frame.locator('#floaters').boundingBox();
  const panel = await panelBox();
  const inside = menuBox.x >= panel.x - 0.5 && menuBox.y >= panel.y - 0.5 && menuBox.x + menuBox.width <= panel.x + panel.width + 0.5 && menuBox.y + menuBox.height <= panel.y + panel.height + 0.5;
  const sideOk = { right: menuBox.x >= barBox.x + barBox.width, left: menuBox.x + menuBox.width <= barBox.x, below: menuBox.y >= barBox.y + barBox.height, above: menuBox.y + menuBox.height <= barBox.y }[SIDE[from]];
  const touching = !(menuBox.x >= barBox.x + barBox.width || menuBox.x + menuBox.width <= barBox.x || menuBox.y >= barBox.y + barBox.height || menuBox.y + menuBox.height <= barBox.y);
  check(`${from} : le menu de position s'ouvre ${{ right: 'à droite de', left: 'à gauche de', below: 'au-dessous de', above: 'au-dessus de' }[SIDE[from]]} la barre, sans la recouvrir, et tient dans le cadre`, sideOk && !touching && inside, { menu: menuBox, barre: barBox, panneau: panel });
  await lab.shotPanel(RUN, `2-menu-depuis-${from}`, frame);
  check(`${from} : ses quatre lignes sont les quatre bords, dans la langue de GFS, celle du bord actuel est cochée`, JSON.stringify(items) === JSON.stringify(ORDER.map(e => WORDS.edges[e])) && JSON.stringify(checked) === JSON.stringify([WORDS.edges[from]]), { items, checked });
};
for (const edge of ['haut', 'droite', 'gauche', 'bas']) {
  const before = await eventsCount();
  if (!keyboardDone) {
    // Au clavier : le bouton de position reçoit le focus, Entrée ouvre le menu (focus sur la ligne cochée), Échap le ferme sans rien changer, puis Entrée, flèche vers le bas, Entrée choisit « En haut ».
    await frame.locator('#floater-place').focus();
    await page.keyboard.press('Enter');
    await placeMenu(current);
    state = await dockState();
    const focusedChecked = await frame.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-checked'));
    check('au clavier : Entrée ouvre le menu et met le focus sur la ligne cochée', focusedChecked === 'true', focusedChecked);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    state = await dockState();
    check('au clavier : Échap ferme le menu, rend le focus au bouton et ne change rien (aucun événement, aucune clé écrite)', (await frame.locator('.menu').count()) === 0 && state.focus === 'floater-place' && state.edge === 'gauche' && state.stored === null && (await eventsCount()) === before, state);
    await page.keyboard.press('Enter');
    await frame.locator('.menu').waitFor();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    state = await dockState();
    check('au clavier : flèche vers le bas puis Entrée choisissent le bord suivant (« En haut ») et le focus revient au bouton de position', state.edge === 'haut' && state.focus === 'floater-place', state);
    keyboardDone = true;
  } else {
    await frame.locator('#floater-place').click();
    await placeMenu(current);
    await frame.locator('.menu .menu-item', { hasText: new RegExp(`^${WORDS.edges[edge]}$`) }).click();
  }
  await verifyEdge(edge, before);
  current = edge;
  // ---------- 3. la taille du cadre change (un bord vertical, un bord horizontal) ----------
  if (edge === 'droite' || edge === 'bas') {
    const countBefore = await eventsCount();
    await lab.fitPanel(frame, 560, 300);
    await waitFor('la barre suit la nouvelle taille', async () => {
      const s = await stageSize();
      const e = await lastEvent();
      return near(s.hauteur, 300, 2) && e && e.barre && flat(e.barre) === flat(expectedBarre(edge, await dockRect(), s));
    });
    rect = await dockRect();
    stage = await stageSize();
    const small = await lastEvent();
    check(`${edge} : le cadre est devenu ${Math.round(stage.largeur)} × ${Math.round(stage.hauteur)} : la barre reste centrée sur son bord et l'app a reçu la nouvelle zone`, placedAt(edge, rect, stage) && flat(small.barre) === flat(expectedBarre(edge, rect, stage)) && (await eventsCount()) > countBefore, { rect, stage, event: small.barre });
    await lab.shotPanel(RUN, `3-petit-${edge}`, frame);
    await lab.fitPanel(frame, 700, 400);
    await waitFor('la barre revient', async () => { const s = await stageSize(); const e = await lastEvent(); return near(s.hauteur, 400, 2) && near(s.largeur, 700, 2) && e.barre && flat(e.barre) === flat(expectedBarre(edge, await dockRect(), s)); });
    rect = await dockRect();
    stage = await stageSize();
    check(`${edge} : le cadre revenu à ${Math.round(stage.largeur)} × ${Math.round(stage.hauteur)}, la zone redit la mesure`, placedAt(edge, rect, stage) && flat((await lastEvent()).barre) === flat(expectedBarre(edge, rect, stage)), { rect, stage });
  }
}

// ---------- 4. un navigateur qui refuse de garder le choix ----------
// La barre est en bas : c'est là que la phrase d'état se pose. Choisir de nouveau « En bas » alors que le navigateur refuse d'écrire donne la phrase sans déplacer la barre : elle ne doit pas la recouvrir.
const chooseEdge = async edge => {
  await frame.locator('#floater-place').click();
  await frame.locator('.menu').waitFor();
  await frame.locator('.menu .menu-item', { hasText: new RegExp(`^${WORDS.edges[edge]}$`) }).click();
};
const toastBoxOf = () => frame.evaluate(() => { const r = document.getElementById('toast').getBoundingClientRect(); const s = document.getElementById('stage').getBoundingClientRect(); return { x: r.left - s.left, y: r.top - s.top, largeur: r.width, hauteur: r.height }; });
await frame.evaluate(() => { window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
const beforeRefusal = await eventsCount();
await chooseEdge('bas');
await waitFor('la phrase d\'avertissement', async () => (await frame.locator('#toast').isVisible()));
const toastText = (await frame.locator('#toast').textContent()).trim();
const toastBox = await toastBoxOf();
rect = await dockRect();
stage = await stageSize();
check('le navigateur refuse de garder : GFS le dit (« Ce choix ne sera pas gardé… ») dans la langue de GFS', toastText === WORDS.notKept, toastText);
check('la phrase se pose au-dessus de la barre en bas, sans la recouvrir, et tient dans le cadre', !overlap(toastBox, rect) && toastBox.y >= 0 && toastBox.y + toastBox.hauteur <= rect.y, { phrase: toastBox, barre: rect });
check('rien n\'a changé pour l\'app (même bord) : pas de nouvel événement', (await eventsCount()) === beforeRefusal);
await lab.shotPanel(RUN, '4-non-retenu', frame);
const beforeMove = await eventsCount();
await chooseEdge('gauche');
await waitFor('la barre passe à gauche', async () => (await dockState()).edge === 'gauche');
state = await dockState();
check('le choix vaut quand même pour la page : la barre passe à gauche, l\'app reçoit la zone, et le navigateur n\'a rien retenu de nouveau (la clé dit toujours « bas »)',
  state.edge === 'gauche' && state.stored === 'bas' && (await eventsCount()) === beforeMove + 1 && (await lastEvent()).barre.bord === 'gauche', { etat: state, evenement: (await lastEvent()).barre });
await frame.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
await chooseEdge('bas');
await waitFor('la barre revient en bas', async () => (await dockState()).edge === 'bas');
state = await dockState();
check('le navigateur accepte de nouveau : « En bas » est retenu', state.edge === 'bas' && state.stored === 'bas', state);

// ---------- 5. `barre.masquer` ----------
await page.waitForTimeout(500);
const zoneBefore = flat((await probe(app)).evenements.at(-1).barre);
let answer = await call('masquer', true, true);
await waitFor('la barre disparaît', async () => !(await dockState()).visible);
state = await dockState();
check('`barre.masquer { masquee: true }` : la réponse dit { masquee: true } et la barre disparaît', answer && answer.data && answer.data.masquee === true && !state.visible, { answer, state });
check('l\'app reçoit `barre: null` (plus rien ne la recouvre)', (await lastEvent()).barre === null);
reach = await reachability();
check('la place de la barre devient cliquable (le milieu du côté bas aussi)', Object.values(reach).every(value => value === true), reach);
await lab.shotPanel(RUN, '5-masquee', frame);
answer = await call('masquer', false, true);
await waitFor('la barre revient', async () => (await dockState()).visible);
check('`barre.masquer { masquee: false }` : la réponse dit { masquee: false }, la barre revient au même bord et l\'app reçoit la même zone', answer && answer.data && answer.data.masquee === false && (await dockState()).visible && flat((await lastEvent()).barre) === zoneBefore, { answer, evenement: (await lastEvent()).barre, avant: zoneBefore });
await app.evaluate(() => window.sondeR.masquer(true, false));
await waitFor('masquée sans id', async () => !(await dockState()).visible);
check('sans `id`, la demande vaut aussi (aucune réponse attendue)', !(await dockState()).visible);
const reAsked = await askContext();
check('un nouveau contexte remet la barre (un cadre qui redemande son contexte repart avec elle) : la barre est revenue et le contexte dit la zone', (await dockState()).visible && flat(reAsked.barre) === zoneBefore, { contexte: reAsked.barre, etat: await dockState() });
check('l\'app a aussi reçu l\'événement qui remet la zone', flat((await lastEvent()).barre) === zoneBefore);
const warningsBefore = warnings.length;
const refused = await call('masquer', 'oui', true);
await app.evaluate(() => window.sondeR.masquer(undefined, false));
await page.waitForTimeout(500);
check('un argument qui n\'est pas vrai ou faux reçoit GFS_REFUSE (avec `id`), la barre ne bouge pas', refused && refused.erreur && refused.erreur.code === 'GFS_REFUSE' && (await dockState()).visible, { refused });
const newWarnings = warnings.slice(warningsBefore).filter(text => /sonde-r : barre\.masquer refusé \(GFS_REFUSE\)/.test(text));
check('les deux refus (avec et sans `id`) se lisent en console : avertissement avec l\'app et le code', newWarnings.length === 2, warnings.slice(warningsBefore).map(text => text.slice(0, 140)));

// ---------- 6. l'explorateur ----------
const beforeExplorer = await eventsCount();
await frame.locator('#floater-files').click();
await frame.locator('.ex-foot').waitFor();
await waitFor('la barre s\'efface', async () => !(await dockState()).visible);
check('« Fichiers » : l\'explorateur s\'ouvre et la barre s\'efface (elle ne sert à rien au-dessus de lui)', !(await dockState()).visible);
check('l\'app apprend que rien ne la recouvre plus (`barre: null`), un seul événement', (await eventsCount()) === beforeExplorer + 1 && (await lastEvent()).barre === null, (await probe(app)).evenements.slice(beforeExplorer));
const hidden = await askContext();
check('un contexte demandé pendant ce temps dit `barre: null`', hidden.barre === null, hidden);
answer = await call('masquer', true, true);
check('une demande de masquer pendant que l\'app est cachée ne tient pas : la réponse dit { masquee: false }', answer && answer.data && answer.data.masquee === false, answer);
await lab.shotPanel(RUN, '6-explorateur', frame);
const beforeBack = await eventsCount();
await frame.locator('.ex-foot .btn', { hasText: WORDS.close }).click();
await waitFor('la barre revient', async () => (await dockState()).visible);
check('à la fermeture de l\'explorateur la barre revient (la demande de l\'app n\'a pas tenu) et l\'app reçoit la zone', (await dockState()).visible && (await eventsCount()) === beforeBack + 1 && flat((await lastEvent()).barre) === zoneBefore, { etat: await dockState(), evenements: (await probe(app)).evenements.slice(beforeBack) });
// Un cadre qui se recharge repart avec la barre, même s'il l'avait masquée.
await call('masquer', true, true);
await waitFor('masquée', async () => !(await dockState()).visible);
await app.evaluate(() => { document.body.dataset.ancien = '1'; location.reload(); });
await waitFor('le contexte après le rechargement du cadre', async () => {
  try { return await app.evaluate(() => !document.body.dataset.ancien && JSON.parse(document.body.dataset.sonde || '{}').contextes.length === 1); } catch (error) { return false; }
});
seen = await probe(app);
check('le cadre de l\'app rechargé alors que la barre était masquée : la barre est revenue, et le contexte dit la zone', (await dockState()).visible && flat(seen.contextes[0].barre) === zoneBefore, { contexte: seen.contextes[0].barre, etat: await dockState() });

const documentAfter = await lab.rangement(frame);
check('la barre n\'écrit rien dans le document : ni table, ni ligne de GFS_Rangement, ni page', JSON.stringify(documentAfter) === JSON.stringify(documentBefore), { avant: [documentBefore.tables, documentBefore.rows], apres: [documentAfter.tables, documentAfter.rows] });

// ---------- 7. le choix tient au rechargement de GFS ; une autre section le suit ----------
await frame.locator('#floater-place').click();
await frame.locator('.menu .menu-item', { hasText: new RegExp(`^${WORDS.edges.droite}$`) }).click();
await waitFor('à droite', async () => (await dockState()).edge === 'droite');
await frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(500);
check('GFS rechargé, sous l\'explorateur la barre n\'est pas à l\'écran mais le bord choisi est retenu (`gfs.barre` = droite)', !(await dockState()).visible && (await dockState()).stored === 'droite', await dockState());
await openProbe();
seen = await probe(app);
rect = await dockRect();
stage = await stageSize();
check('l\'app rouverte : la barre est à droite et le premier contexte dit la zone du bord droit', (await dockState()).edge === 'droite' && placedAt('droite', rect, stage) && flat(seen.contextes[0].barre) === flat(expectedBarre('droite', rect, stage)), { contexte: seen.contextes[0].barre, rect });
await frame.evaluate(() => localStorage.setItem('gfs.barre', 'diagonale'));
await frame.evaluate(() => location.reload());
await page.waitForTimeout(1000);
frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(500);
await openProbe();
seen = await probe(app);
check('une valeur inconnue dans le navigateur est ignorée : la barre est à gauche, et GFS n\'écrit rien de lui-même', (await dockState()).edge === 'gauche' && seen.contextes[0].barre.bord === 'gauche' && (await dockState()).stored === 'diagonale', { etat: await dockState(), contexte: seen.contextes[0].barre });
await frame.evaluate(() => localStorage.removeItem('gfs.barre'));

// Une autre section de GFS dans la page partage le `localStorage` de GFS : le navigateur dit à celle-ci, par l'événement `storage`, que l'autre a écrit (Grist recharge la première
// section quand on en ajoute une : l'app est rouverte ensuite).
const WIDGET = 'http://127.0.0.1:8911/prototype/index.html';
const beforeSection = warnings.slice(); // la seconde section n'a pas l'accès au document : GFS le dit en console, sans rapport avec la barre
await lab.addSection(`${WIDGET}?language=${lang}&culture=${lang === 'en' ? 'en-GB' : 'fr-FR'}`);
let sections = [];
for (let i = 0; i < 80 && sections.length < 2; i++) { sections = page.frames().filter(f => f.url().startsWith(WIDGET)); await page.waitForTimeout(500); }
for (const section of sections) await lab.gfsReady(section);
frame = sections.find(f => /access=full/.test(f.url())) || sections[0];
const sibling = sections.find(f => f !== frame);
check('la page porte deux sections de GFS', sections.length === 2, sections.map(f => f.url().slice(-60)));
await openProbe();
const countOther = await eventsCount();
await sibling.evaluate(() => localStorage.setItem('gfs.barre', 'haut'));
const followed = await waitFor('la barre suit l\'autre section', async () => (await dockState()).edge === 'haut' && (await eventsCount()) > countOther);
rect = await dockRect();
stage = await stageSize();
check('une autre section change le bord (événement `storage` du navigateur) : la barre suit sans rechargement et l\'app reçoit la zone', followed && placedAt('haut', rect, stage) && flat((await lastEvent()).barre) === flat(expectedBarre('haut', rect, stage)), { etat: await dockState(), rect, evenement: (await lastEvent()).barre });
await sibling.evaluate(() => localStorage.removeItem('gfs.barre'));
await waitFor('retour à gauche', async () => (await dockState()).edge === 'gauche');
check('la clé retirée par l\'autre section : la barre revient à gauche', (await dockState()).edge === 'gauche' && flat((await lastEvent()).barre) === flat(expectedBarre('gauche', await dockRect(), await stageSize())), await dockState());
await lab.shotPanel(RUN, '7-section-suivie', frame);

const unexpected = beforeSection.filter(text => !/barre\.masquer refusé/.test(text));
check('aucun autre avertissement de GFS pendant la passe', unexpected.length === 0, unexpected.map(text => text.slice(0, 140)));
await lab.browser.close();
