// Le calendrier du kit (kit 0.8.0, `creerCalendrier` ; cahier 4.5) dans un vrai Grist (grist-static), à 700 × 400, à la vraie souris et au vrai clavier. La sonde ZC (labo/sondes/z-calendrier/) est une app
// écrite avec le VRAI kit, comme le sera Tuesday : sous la politique d'une app hébergée (`style-src 'self'`, ni image ni réseau), dans le cadre isolé de GFS (`sandbox` sans `allow-same-origin`, origine
// opaque), qui monte le module, pose l'ambiance de GFS et réserve le bord de la barre de GFS. Ce que la passe mesure :
//   1. le départ : le cadre est isolé, le module est monté dans la langue de GFS, la page ne déborde pas, la barre de GFS n'en recouvre rien, la sixième semaine du mois se rejoint à la molette ;
//   2. les gestes à la souris et au clavier : ouvrir un événement, ajouter par la saisie rapide (Entrée, Échap, refus de l'hôte), la liste d'un jour, naviguer, les trois vues ;
//   3. le glisser-déposer HTML5 dans le sous-cadre de GFS : un événement sur un autre jour, une barre de plusieurs jours, le plateau « Sans date », un bloc horaire, et le retour à sa place quand l'hôte refuse ;
//   4. la couleur que Grist donne à un événement se pose sous `style-src 'self'` (par le CSSOM) ; la lecture seule grise et ne glisse pas ;
//   5. le calendrier suit l'ambiance de GFS (fond de la page, du calendrier, repère d'aujourd'hui) et chaque texte garde 4,5:1 au moins dans les quatre ambiances, en clair et en sombre, dans le mois avec son
//      plateau, la liste d'un jour, la saisie, la semaine et le jour ; une couleur libre ; « Revenir à Grist Factory » ;
//   6. aucun refus de la politique de sécurité du contenu, aucune erreur de page, aucune requête hors du serveur du labo, le même cadre du début à la fin.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark, KIT_DIR=<dossier du kit> (par défaut le sous-module prototype/kit : ce que GFS référence).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLab } from './lab-setup.mjs';
import { say, check, constat, contrastAudit, serveKit } from './lab-common.mjs';
import { themeGestures } from './theme-gestes.mjs';
import { HEURES, LIGNES, TOUT } from './jeu-calendrier.mjs';

const KIT = process.env.KIT_DIR || fileURLToPath(new URL('../kit', import.meta.url));
if (!existsSync(join(KIT, 'js/calendrier/index.js'))) {
  say(`le kit 0.8.0 n'est pas là (${KIT}) : git submodule update --init prototype/kit, ou KIT_DIR=<dossier du dépôt grist-factory-kit>`);
  process.exit(1);
}
const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const other = scheme === 'light' ? 'dark' : 'light';
const run = `calendrier-kit-${lang}-${scheme}`;

const MOTS = {
  fr: { titre: 'Novembre 2026', suivant: 'Décembre 2026', jours: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], semaine: 'S44', aujourdhui: 'Aujourd\'hui', sansDate: 'Sans date', ecartee: 'Une tâche écartée', lecture: /Lecture seule/,
    jourListe: 'Vendredi 13 novembre 2026', titreJour: 'Mardi 3 novembre 2026' },
  en: { titre: 'November 2026', suivant: 'December 2026', jours: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], semaine: 'W44', aujourdhui: 'Today', sansDate: 'No date', ecartee: 'One task left out', lecture: /Read only/,
    jourListe: 'Friday, November 13, 2026', titreJour: 'Tuesday, November 3, 2026' },
}[lang];

const lab = await startLab({ lang, colorScheme: scheme, probes: ['zc'] });
const { page } = lab;
// Les avertissements et erreurs de la console, avec leur origine (la page de GFS en porte un connu : le script d'API de Grist y pose une feuille de style en ligne que sa politique refuse), et les requêtes
// qui sortent du serveur du labo (le calendrier n'en fait aucune).
const noted = [];
const outside = [];
page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') noted.push({ text: m.text().slice(0, 200), url: m.location().url || '' }); });
page.on('pageerror', error => noted.push({ text: error.message, url: 'pageerror' }));
page.on('request', request => { if (!/^(http:\/\/127\.0\.0\.1:(8910|8911)\/|data:|blob:|about:)/.test(request.url())) outside.push(request.url()); });
await serveKit(page, KIT);
await lab.fitPanel(undefined, 700, 400);
const frame = lab.frame;
const shot = name => lab.shotPanel(run, name, frame);
const until = async (probe, timeout = 8000) => {
  const end = Date.now() + timeout;
  let value;
  while (Date.now() < end) { value = await probe().catch(() => false); if (value) return value; await page.waitForTimeout(100); }
  return value;
};
const canon = value => JSON.stringify(value, (key, item) => (item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item));
const same = (a, b) => canon(a) === canon(b);
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
// Les erreurs de page, les avertissements de GFS et ceux qui viennent de la sonde ou du kit : ce que le calendrier pourrait causer.
const ours = () => noted.filter(item => item.url === 'pageerror' || /^GFS/.test(item.text) || /z-calendrier|\/kit\//.test(item.url));

const app = await lab.openApp('sonde-zc', /z-calendrier\//, frame);
await app.waitForFunction(() => window.sonde && window.sonde.pret, null, { timeout: 20000 });
// Ce que la sonde a reçu du module et de GFS, et ce qu'on lui commande (labo/sondes/z-calendrier/app.js).
const sonde = () => app.evaluate(() => JSON.parse(JSON.stringify({ appels: sonde.appels, violations: sonde.violations, barre: sonde.barre, langue: sonde.langue, hote: sonde.hote, ambiances: sonde.ambiances })));
const calls = async name => (await sonde()).appels.filter(item => item.nom === name).map(item => item.valeur);
const show = (lignes, options = {}) => app.evaluate(([l, o]) => sonde.definir(l, o), [lignes, options]);
const answer = reponse => app.evaluate(r => { sonde.reponse = r; }, reponse);
const forget = () => app.evaluate(() => { sonde.appels.length = 0; sonde.reponse = 'ok'; });
const at = selector => app.locator(selector);
const settle = () => app.waitForFunction(() => document.getAnimations().length === 0, null, { timeout: 4000 }).catch(() => {});

// La vraie souris : au centre de l'élément tel qu'il est affiché (s'il est sous un autre, c'est l'autre qui reçoit le clic).
const centre = async locator => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('introuvable ou caché');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const click = async locator => { const { x, y } = await centre(typeof locator === 'string' ? at(locator) : locator); await page.mouse.click(x, y); };
// Le glissement du navigateur : appuyer, tirer de quelques pixels (il ne se lance qu'alors), traverser jusqu'à la cible, attendre un instant, lâcher.
const drag = async (from, to) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(250);
};
const view = index => click(at('.cal-vue').nth(index));
const title = () => at('.cal-titre').innerText();
const toolbar = () => at('.cal-barre').evaluate(el => Math.round(el.getBoundingClientRect().height));   // une ligne : 44 px ; deux : 81 px
// Le jour où l'événement est affiché (la cellule qui porte le coin haut gauche de sa barre) : ce que la personne voit, jamais seulement « la même semaine ».
const dayOf = id => app.evaluate(wanted => {
  const bar = document.querySelector(`.cal-evt[data-id="${wanted}"]`);
  if (!bar) return null;
  const box = bar.getBoundingClientRect();
  const cell = [...document.querySelectorAll('.cal-fond[data-jour]')].find(item => { const r = item.getBoundingClientRect(); return r.left <= box.left + 4 && box.left + 4 < r.right && r.top <= box.top + 2 && box.top + 2 < r.bottom; });
  return cell ? cell.dataset.jour : null;
}, id);
const painted = () => app.evaluate(() => {
  const of = selector => { const node = document.querySelector(selector); return node ? getComputedStyle(node).backgroundColor : null; };
  return { page: getComputedStyle(document.body).backgroundColor, cal: of('.cal'), today: of('.cal-num-aujourdhui'), surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() };
});

// ---------- 1. le départ ----------
await show(LIGNES);
await at('.cal-evt[data-id="2"]').waitFor();
await page.waitForTimeout(300);
const origin = await painted();
let seen = await sonde();
const sandbox = await frame.evaluate(() => document.querySelector('.app-frame').getAttribute('sandbox'));
say('départ :', { hote: seen.hote, langue: seen.langue, barre: seen.barre, sandbox, origin });
await shot('1-depart');
check('le sous-cadre de l\'app est isolé : pas d\'allow-same-origin', typeof sandbox === 'string' && !sandbox.includes('allow-same-origin'), sandbox);
check(`l'app est hébergée, le module est monté dans la langue de GFS : « ${MOTS.titre} », les noms des jours, le numéro de semaine, « ${MOTS.aujourdhui} », « ${MOTS.sansDate} », l'avis de la tâche écartée`,
  seen.hote === true && seen.langue === lang && (await title()) === MOTS.titre && same(await at('.cal-nom').allInnerTexts(), MOTS.jours) && (await at('.cal-corps .cal-sem').first().innerText()) === MOTS.semaine
  && (await at('.cal-aujourdhui').innerText()) === MOTS.aujourdhui && (await at('.cal-plateau-bouton').evaluate(b => b.firstChild.textContent)) === MOTS.sansDate && (await at('.cal-avis').innerText()).startsWith(MOTS.ecartee),
  { titre: await title(), noms: await at('.cal-nom').allInnerTexts() });
const barBox = await frame.locator('#floaters').boundingBox();
const calBox = await at('.cal').boundingBox();
const meet = barBox.x < calBox.x + calBox.width && barBox.x + barBox.width > calBox.x && barBox.y < calBox.y + calBox.height && barBox.y + barBox.height > calBox.y;
check('la barre de GFS est au bord gauche, l\'hôte en a réservé la zone : le calendrier commence à droite d\'elle, sans rien de recouvert', seen.barre && seen.barre.bord === 'gauche' && !meet && calBox.x >= barBox.x + barBox.width, { barre: seen.barre, barBox, calBox });
const heights = { mois: await toolbar() };
const overflow = await app.evaluate(() => { const root = document.documentElement; return { x: root.scrollWidth - root.clientWidth, y: root.scrollHeight - root.clientHeight }; });
check('la page de l\'app ne déborde pas à 700 × 400 : le calendrier remplit le cadre, ses défilements sont les siens', overflow.x <= 0 && overflow.y <= 0, overflow);
const sixth = () => app.evaluate(() => { const r = document.querySelector('.cal-fond[data-jour="2026-12-06"]').getBoundingClientRect(); return { bas: Math.round(r.bottom), fenetre: window.innerHeight }; });
const before = await sixth();
await page.mouse.move((await centre(at('.cal-corps'))).x, (await centre(at('.cal-corps'))).y);
for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 120);
await page.waitForTimeout(300);
const after = await sixth();
say('sixième semaine :', { avant: before, apres: after });
check('la sixième semaine du mois (30 nov. au 6 déc.) est coupée par le bas du panneau et se rejoint à la molette, jusqu\'au bout', before.bas > before.fenetre && after.bas <= after.fenetre, { before, after });
await page.mouse.wheel(0, -600);
await page.waitForTimeout(200);

// ---------- 2. les gestes ----------
await forget();
await click('.cal-evt[data-id="2"]');
check('un clic sur un événement le dit à l\'hôte (`onOuvrir`), au clavier aussi (Entrée sur l\'événement pris par le focus)', same(await calls('ouvrir'), [2]) && await (async () => {
  await at('.cal-evt[data-id="2"]').focus();
  await page.keyboard.press('Enter');
  return same(await calls('ouvrir'), [2, 2]);
})(), await calls('ouvrir'));

const errorsBefore = ours().length;
await click('.cal-fond[data-jour="2026-11-17"]');
await at('.cal-saisie-champ').waitFor();
await page.keyboard.press('Enter');
await page.keyboard.type('Appeler le fournisseur');
await page.keyboard.press('Enter');
await until(async () => (await calls('ajouter')).length === 1);
check('la saisie rapide : un clic sur un jour libre l\'ouvre, Entrée sans titre n\'envoie rien, Entrée avec un titre envoie { debut, titre } et la ferme',
  same(await calls('ajouter'), [{ debut: '2026-11-17', titre: 'Appeler le fournisseur' }]) && (await at('.cal-saisie').count()) === 0, await calls('ajouter'));
await click('.cal-num[data-jour="2026-11-18"]');
await at('.cal-saisie-champ').waitFor();
await page.keyboard.type('Brouillon');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('Échap ferme la saisie sans rien envoyer et sans erreur de page (la saisie retire son champ au moment où il perd le focus)', (await at('.cal-saisie').count()) === 0 && (await calls('ajouter')).length === 1 && ours().length === errorsBefore, ours().slice(errorsBefore));
await answer('refus');
await click('.cal-fond[data-jour="2026-11-17"]');
await at('.cal-saisie-champ').waitFor();
await page.keyboard.type('Refusée');
await page.keyboard.press('Enter');
await at('.cal-saisie-champ[aria-invalid="true"]').waitFor({ timeout: 4000 }).catch(() => {});
check('un ajout refusé par l\'hôte laisse la saisie ouverte avec son titre, marquée invalide', (await at('.cal-saisie-champ[aria-invalid="true"]').count()) === 1 && (await at('.cal-saisie-champ').inputValue()) === 'Refusée');
await page.keyboard.press('Escape');
await forget();

await click('.cal-plus');
await at('.cal-liste').waitFor();
const list = await at('.cal-liste-ligne').allTextContents();
const listTitle = await at('.cal-liste-titre').evaluate(el => el.firstChild.textContent);
await shot('2-liste');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
check(`« +2 » ouvre la liste du jour (${MOTS.jourListe}), trois tâches triées, Échap la ferme sans erreur`, same(list, ['Bilan', 'Maquettes', 'Revue']) && listTitle === MOTS.jourListe && (await at('.cal-liste').count()) === 0 && ours().length === errorsBefore, { list, listTitle });

await click(at('.cal-fleche').nth(1));
const next = await title();
await click('.cal-aujourdhui');
check(`naviguer : le mois suivant (${MOTS.suivant}), puis « ${MOTS.aujourdhui} » ramène sur ${MOTS.titre}, et l'hôte reçoit l'état à chaque pas`, next === MOTS.suivant && (await title()) === MOTS.titre && same((await calls('etat')).at(-1), { vue: 'mois', jourCourant: '2026-11-03' }), { next, etats: await calls('etat') });
await show(TOUT, { vue: 'mois' });
await view(1);
await at('.cal-vue-semaine').waitFor();
const week = { colonnes: await at('.cal-colonne').count(), premier: await at('.cal-fond').first().getAttribute('data-jour'), dernier: await at('.cal-fond').last().getAttribute('data-jour'), bande: await at('.cal-bande .cal-evt[data-id="23"]').count() };
heights.semaine = await toolbar();
await shot('2-semaine');
await view(2);
await at('.cal-vue-jour').waitFor();
heights.jour = await toolbar();
await shot('2-jour');
const day = { colonnes: await at('.cal-colonne').count(), titre: (await title()).replace(/,/g, '') };
check('les trois vues : la semaine (sept colonnes, du lundi 2 au dimanche 8, la bande des jours entiers), le jour (une colonne, le jour en toutes lettres) ; l\'hôte reçoit { vue, jourCourant }',
  week.colonnes === 7 && week.premier === '2026-11-02' && week.dernier === '2026-11-08' && week.bande === 1 && day.colonnes === 1 && day.titre === MOTS.titreJour.replace(/,/g, '') && same((await calls('etat')).at(-1), { vue: 'jour', jourCourant: '2026-11-03' }), { week, day });
constat('la barre d\'outils du calendrier tient sur une ligne (44 px) dans les trois vues, à 658 px de large (700 moins la barre de GFS que l\'hôte réserve)', Object.values(heights).every(height => height < 60), heights);
await view(0);
await show(LIGNES);
await forget();

// ---------- 3. le glisser-déposer ----------
const dropOn = async day => centre(at(`.cal-fond[data-jour="${day}"]`));
await drag(await centre(at('.cal-evt[data-id="2"]')), await dropOn('2026-11-11'));
await until(async () => (await calls('deplacer')).length === 1);
check('glisser un événement sur un autre jour (lundi 9 sur mercredi 11), à la vraie souris dans le sous-cadre isolé : l\'hôte reçoit les dates, et l\'événement est affiché au nouveau jour',
  same(await calls('deplacer'), [{ id: 2, debut: '2026-11-11', fin: '2026-11-11' }]) && (await dayOf(2)) === '2026-11-11', { appels: await calls('deplacer'), jour: await dayOf(2) });
await shot('3-deplace');
await forget();
await show(LIGNES);
for (const reponse of ['refus', 'erreur']) {
  await show([{ id: 2, titre: 'Choix de l\'hébergeur', debut: '2026-11-09' }]);
  await forget();
  await answer(reponse);
  await drag(await centre(at('.cal-evt[data-id="2"]')), await dropOn('2026-11-12'));
  await until(async () => (await calls('deplacer')).length === 1);
  await until(async () => (await dayOf(2)) === '2026-11-09');
  check(`un déplacement que l'hôte ${reponse === 'refus' ? 'refuse (`false`)' : 'rejette (une erreur)'} ramène l'événement au jour où il était (le 9, pas seulement la même semaine)`, (await dayOf(2)) === '2026-11-09' && (await calls('deplacer')).length === 1, { jour: await dayOf(2) });
}
await forget();
await show([{ id: 1, titre: 'Long', debut: '2026-11-03', fin: '2026-11-05' }]);
const bar = await at('.cal-evt[data-id="1"]').boundingBox();
await drag({ x: bar.x + 8, y: bar.y + bar.height / 2 }, await dropOn('2026-11-10'));
await until(async () => (await calls('deplacer')).length === 1);
check('glisser une barre de plusieurs jours par son premier jour (mardi 3 au jeudi 5, déposée un mardi) garde l\'écart : du 10 au 12', same(await calls('deplacer'), [{ id: 1, debut: '2026-11-10', fin: '2026-11-12' }]), await calls('deplacer'));
await forget();
await show(LIGNES);
await click('.cal-plateau-bouton');
await at('.cal-plateau').waitFor();
const puces = await at('.cal-puce').allInnerTexts();
await shot('3-plateau');
await drag(await centre(at('.cal-puce[data-id="7"]')), await dropOn('2026-11-20'));
await until(async () => (await calls('deplacer')).length === 1);
await at('.cal-evt[data-id="7"]').waitFor({ timeout: 4000 }).catch(() => {});
check('le plateau « Sans date » : deux tâches, un dépôt sur un jour (le vendredi 20) leur donne cette date, la puce quitte le plateau et l\'événement est là', same(puces, ['À planifier', 'Autre à planifier'])
  && same(await calls('deplacer'), [{ id: 7, debut: '2026-11-20', fin: '2026-11-20' }]) && (await dayOf(7)) === '2026-11-20' && same(await at('.cal-puce').allInnerTexts(), ['Autre à planifier']), { puces, appels: await calls('deplacer'), jour: await dayOf(7) });
await click('.cal-plateau-bouton');
await forget();

// Un bloc horaire de la vue Semaine : la souris le tire d'une colonne à la suivante et d'un quart d'heure plus bas (11 px : 40 px valent une heure, la durée est gardée).
await show(HEURES, { vue: 'semaine' });
await at('.cal-bloc[data-id="22"]').waitFor();
const scroller = at('.cal-heures');
const inView = async locator => { const [b, s] = [await locator.boundingBox(), await scroller.boundingBox()]; return b.y >= s.y && b.y + b.height <= s.y + s.height; };
if (!(await inView(at('.cal-bloc[data-id="22"]')))) {
  const { x, y } = await centre(scroller);
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(300);
}
const block = await at('.cal-bloc[data-id="22"]').boundingBox();
const [jeudi, vendredi] = [await at('.cal-colonne[data-jour="2026-11-05"]').boundingBox(), await at('.cal-colonne[data-jour="2026-11-06"]').boundingBox()];
const grab = { x: block.x + 10, y: block.y + 20 };
say('bloc :', { visible: await inView(at('.cal-bloc[data-id="22"]')), block, jeudi, vendredi });
await answer('refus');
await drag(grab, { x: grab.x + (vendredi.x - jeudi.x), y: grab.y + 11 });
await until(async () => (await calls('deplacer')).length === 1);
await page.waitForTimeout(300);
check('glisser un bloc horaire d\'une colonne à l\'autre : l\'hôte reçoit le vendredi 12:15 à 14:15 ; refusé, le bloc revient au jeudi',
  same(await calls('deplacer'), [{ id: 22, debut: '2026-11-06T12:15', fin: '2026-11-06T14:15' }]) && (await at('.cal-colonne[data-jour="2026-11-05"] .cal-bloc[data-id="22"]').count()) === 1
  && (await at('.cal-colonne[data-jour="2026-11-06"] .cal-bloc').count()) === 0, await calls('deplacer'));
await forget();
await drag(grab, { x: grab.x + (vendredi.x - jeudi.x), y: grab.y + 11 });
await until(async () => (await calls('deplacer')).length === 1);
await page.waitForTimeout(300);
check('accepté, le bloc est affiché au vendredi', (await at('.cal-colonne[data-jour="2026-11-06"] .cal-bloc[data-id="22"]').count()) === 1 && (await at('.cal-colonne[data-jour="2026-11-05"] .cal-bloc').count()) === 0);
await forget();

// ---------- 4. la couleur de Grist, la lecture seule ----------
await show(LIGNES, { vue: 'mois' });
await view(0);
const grist = await at('.cal-evt[data-id="1"]').first().evaluate(el => ({ fond: getComputedStyle(el).backgroundColor, texte: getComputedStyle(el).color }));
check('la couleur que Grist donne à un événement se pose sous `style-src \'self\'` (par le CSSOM) : fond #dff5e8, texte #146c48', grist.fond === 'rgb(223, 245, 232)' && grist.texte === 'rgb(20, 108, 72)' && (await sonde()).violations.length === 0, grist);
await show(LIGNES, { lectureSeule: true });
await click('.cal-fond[data-jour="2026-11-17"]');
await page.waitForTimeout(200);
await drag(await centre(at('.cal-evt[data-id="2"]')), await dropOn('2026-11-11'));
await page.waitForTimeout(300);
check('lecture seule : l\'événement n\'est pas déplaçable (aucun `draggable`), il le dit, un clic sur un jour n\'ouvre pas de saisie, un glissement à la souris n\'envoie rien, les jours sont grisés',
  (await at('.cal-evt[data-id="2"]').getAttribute('draggable')) === null && MOTS.lecture.test((await at('.cal-evt[data-id="2"]').getAttribute('title')) || '') && (await at('.cal-saisie').count()) === 0
  && (await calls('deplacer')).length === 0 && (await at('.cal-num[data-jour="2026-11-17"]').getAttribute('aria-disabled')) === 'true', { titre: await at('.cal-evt[data-id="2"]').getAttribute('title'), appels: await calls('deplacer') });
await show(LIGNES, { lectureSeule: false });
await forget();

// ---------- 5. l'ambiance de GFS ----------
const { open: openWindow, close: closeWindow, tile, pickButton, resetButton } = themeGestures(() => frame);
const showExplorer = async () => { await frame.locator('#floater-files').click(); await frame.locator('.ex').waitFor({ state: 'visible' }); };
const hideExplorer = async () => { await frame.locator('.ex-foot .btn', { hasText: /^(Fermer|Close)$/ }).click(); await frame.locator('#floaters').waitFor({ state: 'visible' }); };
const tokens = (message, mode) => message[mode === 'dark' ? 'sombre' : 'clair'];
const audit = async scope => { await settle(); return contrastAudit(app, scope, { byPoint: true }); };
// Les cinq états où passe une personne, chacun mesuré : le mois avec son plateau, la liste d'un jour, la saisie, la semaine, le jour. Les nombres sont ceux des textes que la mesure a vus (une mesure qui ne voit rien ne prouve rien).
async function measureStates() {
  await show(TOUT, { vue: 'mois' });
  await view(0);
  const out = {};
  await click('.cal-plateau-bouton');
  await at('.cal-plateau').waitFor();
  out.mois = await audit('.cal');
  await click('.cal-plateau-bouton');
  await click(at('.cal-plus').last());   // le 13 : le 3 en a un aussi, avec les heures
  await at('.cal-liste').waitFor();
  out.liste = await audit('.cal-liste');
  await page.keyboard.press('Escape');
  await click('.cal-num[data-jour="2026-11-17"]');
  await at('.cal-saisie-champ').waitFor();
  await page.keyboard.type('Rappeler');
  out.saisie = await audit('.cal-saisie');
  await page.keyboard.press('Escape');
  await view(1);
  out.semaine = await audit('.cal');
  await view(2);
  out.jour = await audit('.cal');
  await view(0);
  return out;
}
const MIN = { mois: 70, liste: 5, saisie: 1, semaine: 22, jour: 12 };
const failures = states => Object.entries(states).flatMap(([name, item]) => [...item.failures.map(text => `${name} : ${text}`), ...(item.seen < MIN[name] ? [`${name} : ${item.seen} textes mesurés seulement`] : [])]);

const choose = async id => {
  const count = (await sonde()).ambiances.length;
  await showExplorer();
  await openWindow();
  await tile(id).click();
  await until(async () => (await sonde()).ambiances.length === count + 1);
  await closeWindow();
  await hideExplorer();
  return (await sonde()).ambiances.at(-1);
};
const follows = async (message, mode) => {
  await until(async () => (await painted()).cal === rgb(tokens(message, mode)['--surface']));
  await settle();
  const now = await painted();
  return now.cal === rgb(tokens(message, mode)['--surface']) && now.page === rgb(tokens(message, mode)['--bg']) && now.today === rgb(tokens(message, mode)['--accent-solid']) ? true : now;
};
const summary = [];
for (const id of ['papier', 'brut', 'neon', 'pop']) {
  const message = await choose(id);
  for (const mode of [scheme, other]) {
    await page.emulateMedia({ colorScheme: mode });
    const followed = await follows(message, mode);
    const states = await measureStates();
    const bad = failures(states);
    summary.push({ id, mode, seen: Object.fromEntries(Object.entries(states).map(([name, item]) => [name, item.seen])), skipped: Object.values(states).reduce((sum, item) => sum + item.skipped, 0) });
    check(`${id}, ${mode === 'dark' ? 'sombre' : 'clair'} : la page, le calendrier et le repère d'aujourd'hui prennent --bg, --surface et --accent-solid de l'ambiance`, followed === true, followed);
    check(`${id}, ${mode === 'dark' ? 'sombre' : 'clair'} : chaque texte garde 4,5:1 au moins (mois et plateau, liste, saisie, semaine, jour)`, bad.length === 0, bad);
    if (mode === scheme) await shot(`5-${id}-mois`);
  }
  await page.emulateMedia({ colorScheme: scheme });
  await follows(message, scheme);
}
say('textes mesurés :', summary);

// Une couleur libre (la palette du kit), puis le retour à l'ambiance d'origine.
const count = (await sonde()).ambiances.length;
await showExplorer();
await openWindow();
await pickButton().click();
await frame.locator('.menu-panel').waitFor();
await frame.locator('.menu-panel .cp-swatch').nth(17).click();
await until(async () => (await sonde()).ambiances.length === count + 1);
await closeWindow();
await hideExplorer();
const free = (await sonde()).ambiances.at(-1);
await follows(free, scheme);
const freeStates = await measureStates();
check('une couleur libre : l\'accent du calendrier est celui du message, chaque texte garde 4,5:1', (await painted()).today === rgb(tokens(free, scheme)['--accent-solid']) && failures(freeStates).length === 0, { free: free.couleur, bad: failures(freeStates), today: (await painted()).today });
await shot('5-couleur-libre');
await showExplorer();
await openWindow();
await resetButton().click();
await until(async () => (await sonde()).ambiances.at(-1) === null);
await closeWindow();
await hideExplorer();
await until(async () => (await painted()).cal === origin.cal);
const back = await painted();
check('« Revenir à Grist Factory » : l\'app reçoit `null`, le calendrier retrouve les couleurs de la charte (la page, le calendrier, le repère d\'aujourd\'hui)', (await sonde()).ambiances.at(-1) === null && back.cal === origin.cal && back.page === origin.page && back.today === origin.today, { back, origin });

// ---------- 6. la politique, les erreurs, les requêtes, le cadre ----------
seen = await sonde();
const origins = {};
for (const item of noted) { const key = item.url.replace(/\?.*$/, '').replace(/^https?:\/\/[^/]+/, '') || '(aucune)'; origins[key] = (origins[key] || 0) + 1; }
say('refus de la politique vus par l\'app :', seen.violations, 'avertissements et erreurs de la console, par origine :', origins, 'requêtes hors du labo :', outside);
check('aucun refus de la politique de sécurité du contenu vu par l\'app (`style-src \'self\'` : les couleurs de Grist et celles de l\'ambiance passent par le CSSOM), aucune erreur de page, aucun avertissement de GFS ni du kit', seen.violations.length === 0 && ours().length === 0, { violations: seen.violations, ours: ours() });
check('aucune requête hors du serveur du labo (le calendrier n\'a ni image ni police ni bibliothèque), le même cadre du début à la fin', outside.length === 0 && !app.isDetached() && page.frames().filter(f => /z-calendrier\//.test(f.url())).length === 1, outside);

await lab.browser.close();
process.exit(process.exitCode || 0);
