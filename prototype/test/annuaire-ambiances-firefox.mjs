// L'annuaire dans les ambiances de GFS et sous l'accessibilité renforcée, sous Firefox (demande du porteur du 25/11 : « il faudra s'adapter aux thèmes de GFS » ; ambiances décidées le 03/11,
// accessibilité renforcée le 04/11 ; css/acces.css), à 700, 520 et 400 px, en clair et en sombre. L'essai pose chaque ambiance comme GFS la pose, par le vrai `ThemeSetting` et le vrai
// `ThemeHost` (test/pages/annuaire.js : `window.__ambiance(id)`, `window.__theme.chooseAccess(on)`), puis ouvre chaque écran de l'annuaire (la liste et la fiche, le panneau des filtres,
// l'organigramme, le menu « Insérer dans… », la fenêtre « Choisir une personne ») et mesure : le contraste de chaque texte (4,5:1) ; sous l'accessibilité renforcée, en plus, aucun texte sous
// 14 px et aucune commande sous 36 × 36 px (labo/mesures-acces.mjs, que partage test/acces-firefox.mjs), et que rien ne sort de la fenêtre ni ne défile de côté.
import { delay } from './corbeille-firefox.mjs';
import { contrasts } from './vitrine-firefox.mjs';
import { PROBES } from './annuaire-probes.mjs';
import { MENU_PROBES, PICK_PROBES } from './annuaire-links-firefox.mjs';
import { MIN_TARGET, MIN_TEXT, sweep } from '../labo/mesures-acces.mjs';
import { AMBIANCES } from '../js/theme/ambiance.js';

// Les réglages mesurés : chaque ambiance, puis l'accessibilité renforcée posée sur la première et sur une ambiance qui change les formes (« Enseigne »).
const SETTINGS = [...AMBIANCES.map(id => ({ id, access: false })), { id: 'defaut', access: true }, { id: 'enseigne', access: true }];
const FILTER_PROBES = Object.fromEntries(['fvRow', 'fvOn', 'fvCount', 'fsecHead', 'badge'].map(key => [key, PROBES[key]]));

function layout() {
  const modal = document.querySelector('.mod.an, .mod.an-pk');
  const head = document.querySelector('.an-top');
  const list = document.querySelector('.an-list');
  if (!modal) return null;
  const box = modal.getBoundingClientRect();
  return { box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom }, viewport: { width: innerWidth, height: innerHeight },
    headSideways: head ? head.scrollWidth - head.clientWidth : 0, listSideways: list ? list.scrollWidth - list.clientWidth : 0, sideways: modal.scrollWidth - modal.clientWidth };
}

async function setting(page, { id, access }) {
  await page.run((ambiance, strong) => { window.__theme.chooseAccess(strong); window.__ambiance(ambiance); }, id, access);
  await delay(200);
}

// Les mesures d'un écran : le contraste de ses textes ; sous l'accessibilité renforcée, la taille des textes et des commandes et la tenue dans la fenêtre.
async function measure(page, note, where, probes, { access, width }) {
  for (const [what, value] of Object.entries(await page.run(contrasts, probes))) if (value < 4.5) note('contraste', `${where} : le texte « ${what} » est trop pâle (contraste ${value.toFixed(2)}, 4,5 attendu)`);
  if (!access) return;
  const found = await page.run(sweep, MIN_TEXT, MIN_TARGET);
  for (const line of found.texts) note('texte trop petit', `${where} : ${line} (${MIN_TEXT} px attendus)`);
  for (const line of found.targets) note('cible trop petite', `${where} : ${line} (${MIN_TARGET} × ${MIN_TARGET} px attendus)`);
  const shape = await page.run(layout);
  if (!shape) return;
  if (shape.box.left < -1 || shape.box.right > shape.viewport.width + 1 || shape.box.bottom > shape.viewport.height + 1) note('hors de la page', `${where} : la fenêtre sort de la page à ${width} px`);
  for (const [name, value] of [['la barre', shape.headSideways], ['la liste', shape.listSideways], ['la fenêtre', shape.sideways]]) if (value > 1) note('défile de côté', `${where} : ${name} défile de côté (${value} px)`);
}

async function listScreens(page, note, click, where, opts) {
  await page.run(() => { void window.__annuaire.open(1); });
  await page.until(() => document.querySelector('.mod.an .an-person') !== null);
  await measure(page, note, `${where}, la liste`, PROBES, opts);
  await click('.an-person');
  await page.until(() => document.querySelector('[data-act="insert"]') !== null).catch(() => null);
  await measure(page, note, `${where}, la fiche`, PROBES, opts);
  if (await click('[data-act="insert"]')) {
    await page.until(() => document.querySelector('.menu') !== null).catch(() => null);
    await measure(page, note, `${where}, le menu « Insérer dans… »`, MENU_PROBES, opts);
    await page.press('Escape');
  }
  // à 400 px la fiche prend toute la place : on la referme pour revoir la liste
  if (await page.run(() => document.querySelector('[data-act="side-close"]') !== null)) await click('[data-act="side-close"]');
  await click('[data-fk="filters"]');
  await page.until(() => document.querySelector('.an-fpanel') !== null).catch(() => null);
  await measure(page, note, `${where}, les filtres`, FILTER_PROBES, opts);
  await page.press('Escape');
  await delay(150);
  if (await click('[data-fk="v:org"]')) {
    await delay(300);
    await measure(page, note, `${where}, l'organigramme`, PROBES, opts);
    await click('[data-fk="v:list"]');
  }
  await page.run(() => window.__annuaire.close());
}

async function pickScreen(page, note, where, opts) {
  await page.run(() => { window.__picked = undefined; void window.__annuaire.pick({ title: 'Choisir un destinataire', app: 'Publipostage+' }).then(result => { window.__picked = result; }); });
  await page.until(() => document.querySelector('.mod.an-pk .an-pk-row') !== null).catch(() => null);
  await measure(page, note, `${where}, la fenêtre « Choisir une personne »`, PICK_PROBES, opts);
  await page.run(() => window.__annuaire.cancelPick());
  await delay(150);
}

export async function ambiancesProblems(page, t, note, click, { width, mode, language }) {
  await page.goto(`${await page.run(() => `${location.origin}${location.pathname}`)}?lang=${language}&links=1&sub=1`);
  await page.run(() => window.__ready);
  await page.view({ width, scale: 1, mode });
  for (const choice of SETTINGS) {
    await setting(page, choice);
    const where = `l'annuaire en « ${choice.id} »${choice.access ? ' avec l\'accessibilité renforcée' : ''} (${mode}, ${width} px)`;
    const opts = { access: choice.access, width };
    await listScreens(page, note, click, where, opts);
    await pickScreen(page, note, where, opts);
  }
  await setting(page, { id: 'defaut', access: false });
}
