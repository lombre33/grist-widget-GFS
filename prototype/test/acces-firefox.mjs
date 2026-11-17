// L'accessibilité renforcée, second temps, sous Firefox (décision du porteur du 04/11, feu vert du 10/11 ; css/acces.css) : ce que Firefox calcule quand l'interrupteur de la fenêtre « Thème » est allumé, à 700 × 400. Les mesures sont dans labo/mesures-acces.mjs.
//  - le texte : aucun texte de GFS sous 14 px (l'explorateur, ses menus et ses dix fenêtres) ;
//  - les cibles : aucune commande sous 36 × 36 px (une case ou une pastille ronde compte avec la ligne qui la porte, que le clic sur son texte coche aussi) ;
//  - la barre de la ligne choisie est une vraie bordure de 6 px (la ligne choisie, le volet, l'en-tête de la liste), et sans l'interrupteur elle reste une ombre de 3 px ;
//  - aucun mouvement : ni transition ni animation sur la page, alors que sans l'interrupteur la page en a (la mesure n'est donc pas vide) ;
//  - le contraste forcé du système (Firefox lancé avec `browser.display.document_color_use` à 2, qui le force) : la ligne choisie, la vignette choisie et l'interrupteur se lisent sans couleur ni ombre.
// La mise en page de la liste et de la fenêtre « Thème » dans ce mode (lignes de 36 px, colonnes, fenêtre qui tient dans 700 × 400 sans défiler) est mesurée par test/interfaces-firefox.test.mjs (`lookProblems`).

import { BAR_WIDTH, MIN_TARGET, MIN_TEXT, barOf, forcedLook, forcedTheme, motionOf, sweep } from '../labo/mesures-acces.mjs';

// ---------- ce qui s'exécute dans la page (rien du module n'y est visible) ----------

// Le centre d'un élément (un bouton qui porte l'icône `glyph`, ou le premier élément de `selector`), amené à l'écran ; ou null.
const centerOf = (glyph, selector, nth = 0) => {
  const element = glyph ? (document.querySelector(`button use[href="#i-${glyph}"]`) || { closest: () => null }).closest('button') : document.querySelectorAll(selector)[nth];
  if (!element) return null;
  const box = element.getBoundingClientRect();
  return [box.left + box.width / 2, box.top + box.height / 2];
};

// ---------- ce que l'essai ouvre ----------

const WINDOWS = [
  ['« Ce nom est déjà pris »', () => { window.__askConflict({ app: 'Publipostage+', repeat: true }); }],
  ['« À propos »', () => { window.__about(); }],
  ['« Partager »', () => { window.__share('actif'); }],
  ['« Gérer les partages »', () => { window.__manage(); }],
  ['« Envoyer à un autre document »', () => { window.__sendOther('ok'); }],
  ['« Poids du document »', () => { window.__weight({ bytes: 18000000, files: 12 }); }],
  ['« Apps et extensions »', () => { window.__modulesWindow(); }],
  ['« Table de travail »', () => { window.__workWindow(); }],
];

// La page rendue à l'origine, puis l'accessibilité renforcée allumée (ou éteinte) par le réglage de la page d'essai.
async function setAccess(page, on) {
  await page.run(() => window.__reset());
  await page.run(state => { window.__theme.chooseAccess(state); }, on);
  await page.until(state => document.documentElement.getAttribute('data-ambiance') === (state ? 'renforcee' : null) || (!state && !document.documentElement.hasAttribute('data-ambiance')), [on]);
}

const closeAll = async page => {
  await page.press('Escape');
  await page.press('Escape');
  await page.until(() => !document.querySelector('.mod-scrim') && !document.querySelector('.menu'), [], 2000).catch(() => {});
};

// Les surfaces de l'explorateur : chacune se prépare à la vraie souris, puis se balaie.
const SURFACES = [
  { name: 'la liste', prepare: async () => {} },
  { name: 'une ligne choisie', prepare: async page => { await page.click(...await page.run(centerOf, null, '.ls-row .nm', 3)); await page.until(() => document.querySelector('.ls-row[aria-selected="true"]')); } },
  { name: 'les vignettes', prepare: async page => { await page.click(...await page.run(centerOf, 'tiles')); await page.until(() => document.querySelector('.th-grid')); } },
  { name: 'le menu « Réglages »', prepare: async page => { await page.click(...await page.run(centerOf, 'sliders')); await page.until(() => document.querySelector('.menu')); } },
  { name: 'le menu d\'une ligne', prepare: async page => { await page.move(...await page.run(centerOf, null, '.ls-row', 3)); await page.click(...await page.run(centerOf, null, '.ls-row .rb.mn svg', 3)); await page.until(() => document.querySelector('.menu')); } },
  { name: 'la fenêtre « Thème »', prepare: async page => { await page.click(...await page.run(centerOf, 'sliders')); await page.until(() => document.querySelector('.menu')); await page.click(...await page.run(centerOf, null, '.menu .menu-item', 1)); await page.until(() => document.querySelector('.th-win')); } },
  ...WINDOWS.map(([name, open]) => ({ name: `la fenêtre ${name}`, prepare: async page => { await page.run(open); await page.until(() => document.querySelector('.mod-scrim')); } })),
];

// Le texte et les cibles : chaque surface, balayée.
async function sizeProblems(page, tag) {
  const found = [];
  for (const surface of SURFACES) {
    await setAccess(page, true);
    try { await surface.prepare(page); } catch (error) { found.push({ kind: 'accessibilité renforcée : surface introuvable', text: `${tag}, ${surface.name} : ${String(error.message).slice(0, 120)}` }); await closeAll(page); continue; }
    const seen = await page.run(sweep, MIN_TEXT, MIN_TARGET);
    for (const line of seen.texts) found.push({ kind: `accessibilité renforcée : texte sous ${MIN_TEXT} px`, text: `${tag}, ${surface.name} : ${line}` });
    for (const line of seen.targets) found.push({ kind: `accessibilité renforcée : cible sous ${MIN_TARGET} px`, text: `${tag}, ${surface.name} : ${line}` });
    await closeAll(page);
  }
  return found;
}

// La barre de la ligne choisie, avec et sans l'interrupteur.
async function barProblems(page, tag) {
  const found = [];
  const note = (kind, text) => found.push({ kind: `accessibilité renforcée : ${kind}`, text: `${tag} : ${text}` });
  const choose = async () => { await page.click(...await page.run(centerOf, null, '.ls-row .nm', 3)); await page.until(() => document.querySelector('.ls-row[aria-selected="true"]')); };
  await setAccess(page, true);
  await choose();
  const on = await page.run(barOf);
  if (!on.chosen || on.chosen.width !== BAR_WIDTH || on.chosen.shadow !== 'none') note('la barre de la ligne choisie', `la ligne choisie a une bordure de ${on.chosen && on.chosen.width} px et une ombre « ${on.chosen && on.chosen.shadow} » : une vraie bordure de 6 px, sans ombre, est attendue`);
  if (on.chosen && on.chosen.color === on.plain.color) note('la barre de la ligne choisie', 'la ligne choisie a la bordure de couleur des autres lignes');
  if (on.plain.width !== BAR_WIDTH || on.head.width !== BAR_WIDTH) note('barre et colonnes', `une ligne non choisie a une bordure de ${on.plain.width} px et l'en-tête de ${on.head.width} px : la place doit être prise d'avance, ensemble`);
  if (on.chosen && Math.abs(on.chosen.left - on.plain.left) > 0.5) note('barre et colonnes', 'la ligne choisie bouge au choix');
  await page.click(...await page.run(centerOf, null, '.tr-row', 4));
  await page.until(() => document.querySelector('.tr-row[aria-current="true"]'));
  const tree = (await page.run(barOf)).tree;
  if (!tree || tree.width !== BAR_WIDTH) note('la barre du volet', `la ligne courante du volet a une bordure de ${tree && tree.width} px au lieu de ${BAR_WIDTH}`);
  await setAccess(page, false);
  await choose();
  const off = await page.run(barOf);
  if (!off.chosen || off.chosen.width !== 0 || off.chosen.shadow === 'none') note('sans l\'interrupteur', `la ligne choisie, sans l'accessibilité renforcée, n'a plus sa barre d'origine (bordure ${off.chosen && off.chosen.width} px, ombre « ${off.chosen && off.chosen.shadow} »)`);
  return found;
}

// Le mouvement : nul avec l'interrupteur, présent sans lui (sinon la mesure ne prouve rien). La page d'essai n'a pas de dossier à déplier, donc pas de flèche qui tourne : l'essai en pose une, faite du sélecteur
// que la feuille de l'explorateur anime (`.tr-row .car-slot .ic`, 0,12 s), et la retire.
const withArrow = () => {
  document.querySelector('#gfs-fleche')?.remove();
  const arrow = document.createElement('button');
  arrow.id = 'gfs-fleche';
  arrow.className = 'tr-row';
  arrow.innerHTML = '<span class="car-slot"><svg class="ic open" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5"/></svg></span>';
  arrow.style.cssText = 'position: fixed; left: -100px; top: 0';
  document.body.append(arrow);
};

async function motionProblems(page, tag) {
  const found = [];
  const note = text => found.push({ kind: 'accessibilité renforcée : mouvement', text: `${tag} : ${text}` });
  await setAccess(page, false);
  await page.run(withArrow);
  const free = await page.run(motionOf);
  if (free.moving === 0) note('sans l\'interrupteur la page n\'a aucune transition : la mesure ne prouve rien');
  await setAccess(page, true);
  await page.run(withArrow);
  const calm = await page.run(motionOf);
  if (calm.moving !== 0) note(`${calm.moving} élément(s) gardent une transition ou une animation (${calm.examples.join(', ')})`);
  if (calm.smooth !== 'auto') note(`le défilement est « ${calm.smooth} » au lieu de « auto »`);
  await page.run(() => document.querySelector('#gfs-fleche')?.remove());
  await setAccess(page, false);
  return found;
}

// Tout ce qui se joue sur le Firefox ordinaire, à 700 × 400 : le texte et les cibles, la barre, le mouvement. (L'anneau de focus ne s'y mesure pas : un Firefox sans écran ne donne le focus du système à
// aucune fenêtre, et `:focus-visible` ne s'y applique pas, même au vrai clavier ; il se mesure dans le vrai Grist, sous Chromium : labo/run-acces.mjs.)
export async function accesProblems(page, tag) {
  const found = [...await sizeProblems(page, tag), ...await barProblems(page, tag), ...await motionProblems(page, tag)];
  await page.run(() => window.__reset());
  return found;
}

// ---------- le contraste forcé : un Firefox à part, qui force les couleurs ----------

// Une passe du contraste forcé, l'accessibilité renforcée éteinte ou allumée : la barre que prend une règle de l'une peut défaire celle de l'autre (le poids des sélecteurs), la mesure se fait donc des deux façons.
async function forcedRound(page, tag, access) {
  const found = [];
  const note = (kind, text) => found.push({ kind: `contraste forcé${access ? ' avec l\'accessibilité renforcée' : ''} : ${kind}`, text: `${tag} : ${text}` });
  await setAccess(page, access);
  await page.click(...await page.run(centerOf, null, '.ls-row .nm', 3));
  await page.until(() => document.querySelector('.ls-row[aria-selected="true"]'));
  const list = await page.run(forcedLook);
  if (!list.forced) return { skipped: true, found };
  if (!list.row || list.row.width < 3 || list.row.color === list.row.plainColor || list.row.plainWidth !== list.row.width) note('la ligne choisie', `la ligne choisie a une bordure de ${list.row && list.row.width} px de couleur ${list.row && list.row.color}, les autres ${list.row && list.row.plainWidth} px de couleur ${list.row && list.row.plainColor} : la barre doit se lire, et rien ne doit bouger au choix`);
  if (!list.bar || list.bar.on < 2 || list.bar.on <= list.bar.off) note('le bouton enfoncé', `le bouton « Liste » a une bordure de ${list.bar && list.bar.on} px (l'autre ${list.bar && list.bar.off} px) : l'enfoncé doit se lire par un contour`);
  await page.click(...await page.run(centerOf, 'tiles'));
  await page.until(() => document.querySelector('.th-grid'));
  await page.click(...await page.run(centerOf, null, '.th', 1));
  await page.until(() => document.querySelector('.th[aria-selected="true"]'));
  const tiles = (await page.run(forcedLook)).tile;
  if (!tiles || tiles.width <= tiles.plainWidth) note('la vignette choisie', `la vignette choisie a une bordure de ${tiles && tiles.width} px (les autres ${tiles && tiles.plainWidth} px) : elle doit être plus épaisse`);
  await page.click(...await page.run(centerOf, 'sliders'));
  await page.until(() => document.querySelector('.menu'));
  await page.click(...await page.run(centerOf, null, '.menu .menu-item', 1));
  await page.until(() => document.querySelector('.th-win'));
  const before = await page.run(forcedTheme);
  if (before.checked <= before.other) note('la vignette d\'ambiance cochée', `la vignette cochée a une bordure de ${before.checked} px (les autres ${before.other} px)`);
  await page.click(...await page.run(centerOf, null, '.th-acc', 0));
  await page.until(state => document.querySelector('.th-acc input').checked === state, [!access]);
  const after = await page.run(forcedTheme);
  if (before.handle.left === after.handle.left) note('l\'interrupteur', 'la poignée ne change pas de côté');
  if (before.background === after.background && before.handle.background === after.handle.background) note('l\'interrupteur', `l'interrupteur garde les mêmes couleurs allumé et éteint (fond ${before.background}, poignée ${before.handle.background})`);
  await closeAll(page);
  await page.run(() => window.__reset());
  return { skipped: false, found };
}

// `page` est celle d'un Firefox lancé avec `browser.display.document_color_use` à 2 ; `navigate()` charge la page d'essai. Rend { skipped } quand ce Firefox ne force pas les couleurs.
export async function contrasteForceProblems(page, tag) {
  const origin = await forcedRound(page, tag, false);
  if (origin.skipped) return origin;
  const strict = await forcedRound(page, tag, true);
  return { skipped: false, found: [...origin.found, ...strict.found] };
}
