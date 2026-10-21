// Le stockage des choix de chaque app (contrats 5.3), dans un vrai Grist (grist-static) : l'app, dans son sous-cadre à origine opaque, n'a aucun stockage à elle ; GFS lui rend sa copie dans
// `contexte.stockage` et garde ce qu'elle écrit par `stockage.ecrire` dans son propre `localStorage`. Deux sondes (labo/sondes/s-stockage/, sous deux identifiants : `sonde-s` et `sonde-t`)
// font ce que fera Publipostage+ après la consigne 024. LAB_LANG=fr|en, LAB_SCHEME=light|dark. Ce que la passe mesure :
//   1. le départ : le sous-cadre refuse son propre stockage, le contexte rend un espace vide, rien n'est gardé chez GFS ;
//   2. écrire : sans `id` aucune réponse, avec un `id` la réponse `{ retenu: true }` ; la clé est chez GFS sous `gfs.stockage.<id>.<clé>` et le document n'a reçu aucune écriture ;
//   3. relire : le cadre de l'app rechargé, puis GFS rechargé, retrouvent les valeurs (par navigateur, pas par page) ;
//   4. chaque app a son espace : la sonde T ne voit rien de la sonde S, un message qui prétend viser une autre app écrit quand même dans l'espace de la session ;
//   5. retirer par `null` ; une clé ou une valeur hors règle (`GFS_REFUSE`), un dépassement (`GFS_QUOTA`) sans rien changer ; pile le quota (1 Mo) passe ; un refus sans `id` se lit en console ;
//   6. un navigateur qui refuse de garder : `{ retenu: false }`, la valeur vaut pour la page (contexte compris), et rien n'est gardé au rechargement de GFS.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const QUOTA = 1048576;

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
const probe = target => target.evaluate(() => ({ navigateur: null, contextes: [], reponses: [], erreurs: [], ...JSON.parse((document.body && document.body.dataset.sonde) || '{}') }));
const write = (target, key, value, withId = false, extra = null) => target.evaluate(([k, v, id, more]) => window.sondeS.ecrire(k, v, id, more), [key, value, withId, extra]);
const writeBig = (target, key, size) => target.evaluate(([k, n]) => window.sondeS.ecrire(k, 'x'.repeat(n), true), [key, size]);
// Ce que GFS a gardé dans son navigateur pour les apps : les clés `gfs.stockage.*`, les valeurs longues abrégées en leur longueur.
const kept = () => frame.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('gfs.stockage.')).sort()
  .map(key => { const value = localStorage.getItem(key); return [key, value.length > 200 ? `(${value.length} caractères)` : value]; })));
// Le cadre de l'app recharge sa page (comme Publipostage+ à son changement de langue) : l'ancienne page est marquée, et on attend la nouvelle, qui redemande son contexte.
const reloadApp = async app => {
  await app.evaluate(() => { document.body.dataset.ancien = '1'; location.reload(); });
  await waitFor('le contexte après le rechargement du cadre', async () => {
    try { return await app.evaluate(() => !document.body.dataset.ancien && JSON.parse(document.body.dataset.sonde || '{}').contextes.length === 1); } catch (error) { return false; }
  });
  return probe(app);
};
const reloadGfs = async () => {
  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await page.waitForTimeout(500);
};
// Les deux sondes partagent le même dossier : le cadre de l'app qui vient de s'ouvrir est le dernier du dossier, et l'ancien (retiré par GFS) n'y est plus.
const probeFrames = () => page.frames().filter(f => /s-stockage\//.test(f.url()) && !f.isDetached());
let current = null;
const openProbe = async id => {
  if (await frame.locator('#floater-files').isVisible()) await frame.locator('#floater-files').click();
  await lab.openApp(id, /s-stockage\//, frame);
  let app = null;
  for (let i = 0; i < 60 && !app; i++) {
    const found = probeFrames().filter(f => f !== current);
    app = found.length ? found.at(-1) : null;
    if (!app) await page.waitForTimeout(250);
  }
  await waitFor(`le contexte de ${id}`, async () => (await probe(app)).contextes.length >= 1);
  current = app;
  return app;
};
const documentState = () => lab.rangement(frame);
// Deux espaces disent la même chose : les mêmes clés, les mêmes valeurs, dans n'importe quel ordre.
const sameSpace = (actual, expected) => Boolean(actual) && JSON.stringify(Object.entries(actual).sort()) === JSON.stringify(Object.entries(expected).sort());

// ---------- 1. le départ ----------
let app = await openProbe('sonde-s');
let seen = await probe(app);
say('au départ :', seen);
check('le sous-cadre à origine opaque n\'a aucun stockage à lui (localStorage refusé)', seen.navigateur === 'refusé', seen.navigateur);
check('le contexte rend un espace vide, un objet ordinaire', seen.contextes.length === 1 && seen.contextes[0].stockage && Object.keys(seen.contextes[0].stockage).length === 0 && seen.contextes[0].proto === true, seen.contextes);
check('GFS n\'a rien gardé pour les apps', Object.keys(await kept()).length === 0, await kept());
const before = await documentState();

// ---------- 2. écrire ----------
await write(app, 'pp_theme', 'dark'); // sans id : aucune réponse
await write(app, 'pp_page_zoom', '{"m1":120}', true);
await waitFor('la réponse', async () => (await probe(app)).reponses.length === 1);
seen = await probe(app);
await page.waitForTimeout(500);
seen = await probe(app);
check('un appel avec `id` reçoit { retenu: true } ; celui sans `id` n\'a reçu aucune réponse', seen.reponses.length === 1 && seen.reponses[0].kind === 'ecrire:pp_page_zoom' && seen.reponses[0].data.retenu === true && seen.erreurs.length === 0, seen);
say('chez GFS :', await kept());
check('GFS garde les clés sous gfs.stockage.<id>.<clé>, dans son propre navigateur', JSON.stringify(await kept()) === JSON.stringify({ 'gfs.stockage.sonde-s.pp_page_zoom': '{"m1":120}', 'gfs.stockage.sonde-s.pp_theme': 'dark' }), await kept());
const after = await documentState();
check('rien n\'a été écrit dans le document (ni table, ni ligne de GFS_Rangement)', JSON.stringify(after) === JSON.stringify(before), { avant: [before.tables, before.rows], apres: [after.tables, after.rows] });

// ---------- 3. relire ----------
seen = await reloadApp(app);
check('le cadre de l\'app rechargé redemande son contexte et retrouve ses valeurs', sameSpace(seen.contextes[0].stockage, { pp_theme: 'dark', pp_page_zoom: '{"m1":120}' }), seen.contextes);
await reloadGfs();
app = await openProbe('sonde-s');
seen = await probe(app);
check('GFS rechargé, l\'app rouverte retrouve ses valeurs : c\'est le navigateur de la personne qui les garde, non la page', sameSpace(seen.contextes[0].stockage, { pp_theme: 'dark', pp_page_zoom: '{"m1":120}' }), seen.contextes);

// ---------- 4. chaque app a son espace ----------
const appT = await openProbe('sonde-t');
seen = await probe(appT);
check('la sonde T, sous un autre identifiant, ne voit rien de l\'espace de la sonde S', seen.contextes[0].stockage && Object.keys(seen.contextes[0].stockage).length === 0, seen.contextes);
await write(appT, 'pp_theme', 'light', true);
await write(appT, 'intrus', 'x', true, { app: 'sonde-s', id: 'sonde-s', espace: 'sonde-s', cle2: 'a' }); // un message qui prétend viser l'app S
await waitFor('les deux réponses de T', async () => (await probe(appT)).reponses.length === 2);
say('chez GFS :', await kept());
check('T écrit dans son espace, même quand son message nomme l\'app S : rien ne bouge dans celui de S', JSON.stringify(await kept()) === JSON.stringify({
  'gfs.stockage.sonde-s.pp_page_zoom': '{"m1":120}', 'gfs.stockage.sonde-s.pp_theme': 'dark', 'gfs.stockage.sonde-t.intrus': 'x', 'gfs.stockage.sonde-t.pp_theme': 'light' }), await kept());
app = await openProbe('sonde-s');
seen = await probe(app);
check('la sonde S rouverte relit son propre espace, sans la clé « intrus » ni le thème de T', sameSpace(seen.contextes[0].stockage, { pp_theme: 'dark', pp_page_zoom: '{"m1":120}' }), seen.contextes);

// ---------- 5. retirer, refuser, quota ----------
await write(app, 'pp_theme', null, true);
await waitFor('la réponse du retrait', async () => (await probe(app)).reponses.length === 1);
seen = await probe(app);
check('null retire la clé : { retenu: true } et la clé disparaît de chez GFS, pas celles des autres', seen.reponses[0].data.retenu === true && !('gfs.stockage.sonde-s.pp_theme' in await kept()) && 'gfs.stockage.sonde-t.pp_theme' in await kept(), await kept());
seen = await reloadApp(app);
check('l\'app rechargée ne la retrouve plus', sameSpace(seen.contextes[0].stockage, { pp_page_zoom: '{"m1":120}' }), seen.contextes);

const countBefore = Object.keys(await kept()).length;
await write(app, 'pas valable', 'v', true);
await write(app, 'k', 12, true);
await write(app, 'k2', undefined, true);
await write(app, 'x'.repeat(65), 'v', true);
await write(app, 'sans-id', { a: 1 }); // sans id : aucune réponse, mais une phrase en console
await waitFor('les quatre erreurs', async () => (await probe(app)).erreurs.length === 4);
seen = await probe(app);
check('une clé ou une valeur hors règle reçoit GFS_REFUSE (clé trop longue ou avec une espace, valeur numérique ou absente)', seen.erreurs.length === 4 && seen.erreurs.every(error => error.code === 'GFS_REFUSE'), seen.erreurs);
check('rien n\'a été écrit par ces refus', Object.keys(await kept()).length === countBefore, await kept());
check('un refus sans `id` ne répond rien à l\'app, mais GFS le dit en console (avertissement, avec l\'app et le code)', warnings.filter(text => /sonde-s : stockage\.ecrire refusé \(GFS_REFUSE\)/.test(text)).length === 5, warnings.map(text => text.slice(0, 100)));

await writeBig(app, 'gros', QUOTA);
await waitFor('l\'erreur de quota', async () => (await probe(app)).erreurs.length === 5);
seen = await probe(app);
check('un espace qui dépasserait le mégaoctet est refusé (GFS_QUOTA) sans rien changer', seen.erreurs.at(-1).code === 'GFS_QUOTA' && !('gfs.stockage.sonde-s.gros' in await kept()), { erreur: seen.erreurs.at(-1), kept: await kept() });
const room = QUOTA - 'pp_page_zoom'.length - '{"m1":120}'.length - 'gros'.length;
await writeBig(app, 'gros', room);
await waitFor('la réponse pile au quota', async () => (await probe(app)).reponses.length === 1);
seen = await probe(app);
const keptNow = await kept();
check(`pile le quota (${QUOTA} caractères, clés comprises) passe : { retenu: true }, gardé chez GFS`, seen.reponses.at(-1).data.retenu === true && keptNow['gfs.stockage.sonde-s.gros'] === `(${room} caractères)`, { reponse: seen.reponses.at(-1), gros: keptNow['gfs.stockage.sonde-s.gros'] });
await write(app, 'un', 'x', true);
await waitFor('le refus au-delà du quota', async () => (await probe(app)).erreurs.length === 6);
check('un caractère de plus est refusé', (await probe(app)).erreurs.at(-1).code === 'GFS_QUOTA' && !('gfs.stockage.sonde-s.un' in await kept()));
seen = await reloadApp(app);
check('le contexte rend la grosse valeur en entier', seen.contextes[0].longueurs.gros === room && seen.contextes[0].total === QUOTA, { gros: seen.contextes[0].longueurs.gros, total: seen.contextes[0].total });
await write(app, 'gros', null, true);
await waitFor('le retrait de la grosse valeur', async () => (await probe(app)).reponses.length === 1);
check('retirer la grosse valeur libère la place', !('gfs.stockage.sonde-s.gros' in await kept()));

// ---------- 6. un navigateur qui refuse de garder ----------
await frame.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
await write(app, 'refus', 'vaut-pour-la-page', true);
await waitFor('la réponse du refus du navigateur', async () => (await probe(app)).reponses.length === 2);
seen = await probe(app);
check('si le navigateur refuse de garder, la réponse dit { retenu: false }', seen.reponses.at(-1).data.retenu === false && !('gfs.stockage.sonde-s.refus' in await kept()), seen.reponses.at(-1));
seen = await reloadApp(app);
check('la valeur vaut pour la page : l\'app rechargée la retrouve dans son contexte, avec le reste', sameSpace(seen.contextes[0].stockage, { pp_page_zoom: '{"m1":120}', refus: 'vaut-pour-la-page' }), seen.contextes[0]);
await reloadGfs();
app = await openProbe('sonde-s');
seen = await probe(app);
check('GFS rechargé, ce que le navigateur avait refusé a disparu ; le reste est là', sameSpace(seen.contextes[0].stockage, { pp_page_zoom: '{"m1":120}' }), seen.contextes[0]);

const unexpected = warnings.filter(text => !/stockage\.ecrire refusé/.test(text));
check('aucun autre avertissement de GFS pendant la passe', unexpected.length === 0, unexpected.map(text => text.slice(0, 120)));
await lab.browser.close();
