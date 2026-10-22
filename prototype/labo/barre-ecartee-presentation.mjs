// La barre de GFS devant les présentations de Publipostage+ (extension « Diapositives », consigne 025 faite) : le rejeu de run-barre-ecartee.mjs, dans une présentation de trois diapositives ouverte depuis l'explorateur
// de GFS. Aux mêmes tailles et aux mêmes bords que le reste : la bande des diapositives et ce qu'elle montre (miniatures, numéros, « Ajouter », « Importer », « Objets »), le ▶ et la pastille du zoom ; les menus de
// la bande (le « ⋯ » d'une miniature, les mises en page d'« Ajouter », le menu « Objets ») ; les fenêtres Transition, Fond et Notes ; le volet « Importer » et sa liste avec recherche ; puis « Présenter » (barre-ecartee-diaporama.mjs).
// La bande et le volet étendent exprès leur fond sous la barre (une gouttière : `--pp-slide-strip-bar`) : on juge leur contenu, pas ce fond.
import { check, say } from './lab-common.mjs';
import { stands, judge, asked, none, label, wait, hits, inFrame, rectOf, shownRect, clickOpener, unopened } from './barre-ecartee-lab.mjs';
import { atRest, windows } from './barre-ecartee-scenarios.mjs';
import { TOURS, tour } from './barre-ecartee-diaporama.mjs';

const FK = 'ext:publipostage/diapositives';
export const DECK = 'Trois diapositives';
const SOURCE = 'Deux diapositives';
const BREAK = '<div class="page-break-marker" contenteditable="false">Saut de page</div>';
const DECK_HTML = `<h2>Titre un</h2><p>Premier texte</p>${BREAK}<h2>Titre deux</h2><p>Deuxième texte <strong>gras</strong></p>${BREAK}<p>Trois</p>`;
export const PARTS = ['diapos-repos', 'diapos-menus', 'diapos-fenetres', 'diapos-volet', 'presenter'];
const SURFACES = ['pp-slide-strip', 'pp-slide-import'];

const STRIP = '.pp-slide-strip';
const MORE = `${STRIP} .pp-slide-item[aria-selected="true"] + .pp-slide-more`;
const THUMB = `${STRIP} .pp-slide-item[aria-selected="true"] .pp-slide-thumb`;
const ADD = `${STRIP} .pp-slide-add:not(.pp-slide-import-open):not(.pp-slide-objects-open)`;
const IMPORT = `${STRIP} .pp-slide-import-open`;
const OBJECTS = `${STRIP} .pp-slide-objects-open`;

// La présentation de trois diapositives et une autre, la source du volet « Importer » (sa liste n'existe qu'avec une autre présentation), dans la table des modèles avant que l'app démarre (elle lit ses modèles au démarrage).
export const seedDeck = frame => frame.evaluate(rows => grist.docApi.applyUserActions(rows.map(([name, html]) => ['AddRecord', 'Publipostage_Modeles', null, { Nom: name, TypeModele: 'presentation', Contenu: html }])),
  [[DECK, DECK_HTML], [SOURCE, `<h2>Source un</h2><p>Un texte</p>${BREAK}<h2>Source deux</h2><p>Un autre texte</p>`]]);

// La personne coche « Diapositives » dans la fenêtre « Apps et extensions » de GFS, puis ouvre la présentation par l'explorateur (double-clic), l'app déjà ouverte.
export async function openDeck({ lab, page, frame, app }) {
  await lab.openModules(frame);
  const box = frame.locator(`[data-fk="${FK}"]`);
  if (!(await box.isChecked())) await frame.locator(`[data-row="${FK}"] label`).click();
  await lab.settle(frame);
  check('la case « Diapositives » est cochée', await box.isChecked());
  await page.keyboard.press('Escape');
  await frame.locator('.mod').waitFor({ state: 'hidden' });
  await app.waitForFunction(() => Extensions.isActive('diapositives'), null, { timeout: 15000 });
  await app.waitForFunction(() => !LiveEntry.hasUnsavedEdits(), null, { timeout: 20000 }).catch(() => {});
  await frame.locator('#floater-files').click();
  const row = frame.locator('.ls-row', { hasText: DECK }).first();
  await row.waitFor({ timeout: 15000 });
  await row.dblclick();
  // Les essais d'avant ont tapé dans le modèle vierge : l'app pose sa question « Enregistrer / Ne pas enregistrer / Annuler » (elle en pose une à chaque ouverture que GFS demande avec des modifications en attente) ;
  // la personne répond « Ne pas enregistrer ».
  const question = app.locator('#pp-dialog-modal button', { hasText: /Ne pas enregistrer|Don.t save/ });
  const opened = () => app.evaluate(() => document.querySelectorAll('.pp-slide-item').length === 3);
  for (let i = 0; i < 150 && !(await opened()); i++) {
    if (await question.isVisible()) await question.click();
    await page.waitForTimeout(200);
  }
  check('la présentation de trois diapositives s\'ouvre depuis l\'explorateur de GFS, bande de trois miniatures', await opened());
  await page.waitForTimeout(1500);
}

// Ce qui reste, fusionné dans le rendu d'un scénario : les mesures et ce qui recouvre la zone.
const merge = (out, rest, prefix) => {
  out.mesures += rest.mesures;
  out.sur.push(...rest.sur.map(item => `${prefix} → ${item}`));
};

// 1. La bande au repos : miniatures, numéros et pastilles, « Ajouter », « Importer », « Objets », le ▶ et la pastille du zoom ; sur le bord gauche, où la bande laisse la gouttière, ce que cela donne en chiffres.
async function stripAtRest(r) {
  const out = none();
  merge(out, await atRest(r, { surfaces: SURFACES }), 'au repos');
  if (r.zone.edge === 'left') {
    const first = await rectOf(r.app, `${STRIP} .pp-slide-item`);
    const gutter = await r.app.evaluate(() => getComputedStyle(document.body).getPropertyValue('--pp-slide-strip-bar').trim());
    if (first) out.notes.push(`la bande laisse la gouttière à la barre : la première miniature commence à x = ${Math.round(first.left)}, la zone finit à x = ${Math.round(r.zone.right)} (gouttière ${gutter || '0px'})`);
  }
  return out;
}

// 2. Les menus de la bande, ouverts à la vraie souris : le « ⋯ » de la diapositive du curseur, les mises en page d'« Ajouter », le menu « Objets ».
// La miniature du curseur, amenée dans la liste et visée là où on la voit : dans un cadre bas, la liste n'en montre qu'une bande de quelques pixels (560 × 300 : 16 px), que la personne fait défiler.
const LIST = `${STRIP} .pp-slide-list`;
async function visibleThumb(r) {
  await r.app.evaluate(sel => { const el = document.querySelector(sel); if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' }); }, THUMB);
  await wait(r, 200);
  return r.app.evaluate(([thumb, list]) => {
    const el = document.querySelector(thumb);
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const clip = document.querySelector(list);
    const view = clip ? clip.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const left = Math.max(box.left, view.left, 0);
    const right = Math.min(box.right, view.right, innerWidth);
    const top = Math.max(box.top, view.top, 0);
    const bottom = Math.min(box.bottom, view.bottom, innerHeight);
    return right - left > 4 && bottom - top > 4 ? { x: (left + right) / 2, y: (top + bottom) / 2 } : null;
  }, [THUMB, LIST]);
}
// Le menu « ⋯ » de la miniature du curseur : par son bouton, que la souris fait apparaître en survolant la miniature ; quand la liste est trop basse pour le montrer, par un clic droit sur la miniature (le même menu).
async function openSlideMenu(r) {
  const thumb = await visibleThumb(r);
  if (!thumb) return 'absent';
  const where = await r.hand.where(thumb.x, thumb.y);
  if (where !== 'libre') return where === 'barre' ? 'dessous' : 'hors';
  await r.hand.park();
  await r.hand.move(thumb.x, thumb.y);
  await wait(r, 200);
  const opened = await clickOpener(r, MORE);
  if (opened === 'clique' || opened === 'dessous') return opened;
  await r.hand.contextClick(thumb.x, thumb.y);
  return 'clique';
}
const MENUS = [
  { name: 'menu ⋯ d\'une diapositive', open: openSlideMenu, panel: '.pp-slide-menu.visible' },
  { name: 'mises en page d\'« Ajouter »', open: r => clickOpener(r, ADD), panel: '.pp-slide-layouts:not(.pp-slide-objects).visible' },
  { name: 'menu « Objets »', open: r => clickOpener(r, OBJECTS), panel: '.pp-slide-objects.visible' },
];
// Un menu ouvert se referme par Échap ; s'il reste, par un appui hors de lui.
async function closeMenu(r, panel) {
  await r.page.keyboard.press('Escape');
  await wait(r, 200);
  if (!(await rectOf(r.app, panel))) return;
  await r.hand.pressOutside();
  await wait(r, 200);
}
async function stripMenus(r) {
  const out = none();
  for (const menu of MENUS) {
    const opened = await menu.open(r);
    if (opened !== 'clique') { unopened(out, opened, menu.name); continue; }
    const box = await shownRect(r, menu.panel, 1500);
    if (!box) { out.notes.push(`${menu.name} : ne s'ouvre pas`); continue; }
    out.mesures += 1;
    if (hits(box, r.zone)) out.sur.push(label(menu.name, box));
    if (!inFrame(box, r.size)) out.notes.push(label(`${menu.name} hors du cadre`, box));
    await closeMenu(r, menu.panel);
  }
  await r.hand.park();
  return out;
}

// 3. Les fenêtres que le menu « ⋯ » ouvre : Transition, Fond et Notes (voile sur tout le cadre : seule la boîte, avec son titre, son contenu et ses boutons, doit éviter la zone).
const SLIDE_WINDOWS = [['transition', 'Transition'], ['background', 'Fond'], ['notes', 'Notes']].map(([action, name]) => ({
  name: `fenêtre ${name}`,
  overlay: `#pp-slide-${action}`,
  close: null,
  open: async r => {
    const opened = await openSlideMenu(r);
    if (opened !== 'clique') return opened;
    if (!(await shownRect(r, '.pp-slide-menu.visible', 1500))) return 'absent';
    return clickOpener(r, `.pp-slide-menu.visible [data-action="${action}"]`);
  },
}));

// 4. Le volet « Importer » ouvert (il s'élargit d'une gouttière du côté de la barre) puis sa liste avec recherche : tout ce que l'app montre alors se mesure comme au repos.
async function importPanel(r, shot = null) {
  const out = none();
  const opened = await clickOpener(r, IMPORT);
  if (opened !== 'clique') { unopened(out, opened, 'bouton « Importer »'); return out; }
  if (!(await shownRect(r, '.pp-slide-import', 2000))) { out.notes.push('le volet « Importer » ne s\'ouvre pas'); return out; }
  await wait(r, 600);
  merge(out, await atRest(r, { surfaces: SURFACES }), 'volet ouvert');
  if (shot) await shot();
  const box = await rectOf(r.app, '.pp-slide-import');
  if (box && !inFrame(box, r.size)) out.notes.push(label('le volet « Importer » hors du cadre', box));
  const list = await clickOpener(r, '.pp-slide-import .ss-trigger');
  if (list === 'clique') {
    await wait(r, 500);
    merge(out, await atRest(r, { surfaces: SURFACES }), 'liste avec recherche ouverte');
    if ((await clickOpener(r, '.ss-panel .ss-option')) === 'clique') {
      await wait(r, 800);
      merge(out, await atRest(r, { surfaces: SURFACES }), 'source choisie');
    } else await r.page.keyboard.press('Escape');
    await wait(r, 200);
  } else unopened(out, list, 'liste avec recherche du volet');
  const closing = await clickOpener(r, '.pp-slide-import-close');
  if (closing !== 'clique') await r.page.keyboard.press('Escape');
  await r.app.waitForFunction(() => { const panel = document.querySelector('.pp-slide-import'); return !panel || panel.hidden || getComputedStyle(panel).display === 'none'; }, null, { timeout: 4000 }).catch(() => { out.notes.push('le volet « Importer » ne se ferme pas'); });
  await r.hand.park();
  return out;
}

// La passe : la présentation ouverte, puis à chaque taille et chaque bord les cinq parties (PARTS ; ONLY=presentation les prend toutes).
export async function runPresentation(ctx) {
  const { lab, page, frame, run, wanted } = ctx;
  const want = name => wanted('presentation') || wanted(name);
  await openDeck(ctx);
  for await (const { tag, edge, r } of stands(ctx)) {
    const name = kind => `${r.size[0]}x${r.size[1]}-${edge}-${kind}`;
    if (want('diapos-repos')) {
      judge(tag, 'la bande des diapositives au repos', await stripAtRest(r), asked(r.size, 'diapos-repos'));
      await lab.shotPanel(run, name('diapos'), frame);
    }
    if (want('diapos-menus')) judge(tag, 'les menus de la bande', await stripMenus(r), asked(r.size, 'diapos-menus'));
    if (want('diapos-fenetres')) judge(tag, 'les fenêtres Transition, Fond et Notes', await windows(r, SLIDE_WINDOWS), asked(r.size, 'diapos-fenetres'));
    if (want('diapos-volet')) judge(tag, 'le volet « Importer »', await importPanel(r, () => lab.shotPanel(run, name('volet'), frame)), asked(r.size, 'diapos-volet'));
    if (want('presenter')) {
      let first = true;
      for (const pair of TOURS) {
        await tour(r, tag, pair, first ? () => lab.shotPanel(run, name('diaporama'), frame) : null);
        first = false;
      }
    }
  }
  say('présentation : fin du rejeu');
}
