// L'identité de la personne donnée aux apps qui la déclarent (contrats 3.4 point 6 et 5.2 point 9 ; choix du porteur du 03/11, carte « Donner aux apps l'adresse e-mail de la personne connectée ? »,
// « Aux apps qui le déclarent »), dans un vrai Grist, à 700 × 400, à la vraie souris. grist-static ouvre le document sans compte : le labo donne au moteur de données de Grist la personne du moment
// (`lab.setUser`), et la formule déclenchée `user.Email` de la ligne-sonde de GFS (6.4, point 9) est celle de Grist.
// Trois sondes partagent le dossier labo/sondes/v-personne/ : V (page brute) déclare `permissions.identite`, W (même page) ne la déclare pas, X (page écrite avec le VRAI client du kit, `GfsLink.identity`
// et `onIdentity`) la déclare. Toutes trois sont « toujours là » comme Publipostage+ : elles s'ouvrent sans que la table du document existe, ce qu'il faut pour voir l'adresse arriver en cours de session.
//   1. Ana, sans la table GFS_Rangement : GFS ne la connaît pas, V reçoit `identite: null` ; aucun événement.
//   2. Ana épingle un fichier (la table naît avec son accord, GFS apprend son adresse) : V, sous l'explorateur, reçoit UN événement `identite` avec l'adresse, rien d'autre.
//   3. GFS rouvre (la table existe) : le contexte de V porte l'adresse dès le départ, telle que Grist la donne ; GFS n'écrit rien de plus que la sonde ; l'adresse n'est dans l'adresse d'aucun cadre.
//   4. W, qui ne l'a pas déclarée : `identite: null` alors que GFS connaît Ana ; nulle part dans son contexte ni dans ses événements.
//   5. X (kit) : `GfsLink.identity()` rend l'adresse, `onIdentity` est rappelé une fois à l'arrivée du contexte.
//   6. Une autre personne (Ben) ouvre le même document : V reçoit l'adresse de Ben, jamais celle d'Ana ; l'anonyme de Grist, une personne sans adresse et un document en lecture seule : `null`.
// LAB_LANG=fr|en, LAB_SCHEME=light|dark, KIT_DIR=<dossier du dépôt du kit>.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check, serveKit } from './lab-common.mjs';

const KIT = process.env.KIT_DIR || '/home/claude/grist-factory-kit';
if (!existsSync(join(KIT, 'js/gfs-link.js'))) {
  say(`le kit n'est pas là (${KIT}) : KIT_DIR=<dossier du dépôt grist-factory-kit>`);
  process.exit(1);
}
const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `personne-${lang}-${scheme}`;
const ANA = { Email: 'Ana@Exemple.org', Name: 'Ana', IsLoggedIn: true, UserID: 101 }; // la casse de Grist est gardée
const BEN = { Email: 'ben@exemple.org', Name: 'Ben', IsLoggedIn: true, UserID: 102 };
const ANONYMOUS = { Email: 'anon@getgrist.com', Name: 'Anonymous', IsLoggedIn: false, UserID: null };
const ALWAYS = {
  fichier: 'controller.js',
  de: "export const ALWAYS_ON = Object.freeze(['publipostage']);",
  vers: "export const ALWAYS_ON = Object.freeze(['publipostage', 'sonde-v', 'sonde-w', 'sonde-x']);",
};

const lab = await startLab({ lang, colorScheme: scheme, probes: true, user: ANA, patches: [ALWAYS] });
const { page } = lab;
const warnings = [];
page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && m.text().startsWith('GFS')) warnings.push(m.text()); });
page.on('pageerror', error => warnings.push(error.message));
// Le kit, servi sous /kit/ à l'adresse de GFS (lab-common.mjs : même origine que la page de la sonde, l'en-tête CORS ouvert comme celui de GitHub Pages).
await serveKit(page, KIT);
await lab.fitPanel(undefined, 700, 400);
say('semis :', await seedFiles(lab.frame));

let frame = lab.frame;
// Une ouverture du document par une personne : le widget se recharge, comme quand Grist l'ouvre pour quelqu'un d'autre. `query` : des paramètres de plus à l'adresse du widget.
const open = async (who, { query = '' } = {}) => {
  await lab.setUser(who);
  await lab.forgetActions();
  await frame.evaluate(extra => {
    const url = new URL(location.href);
    for (const [key, value] of new URLSearchParams(extra)) url.searchParams.set(key, value);
    location.href = url.href;
  }, query);
  await page.waitForTimeout(1000);
  frame = await lab.gfsFrame(/access=full/);
  await lab.gfsReady(frame);
  await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
  if (await frame.locator('.mod').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
};
const shot = name => lab.shotPanel(run, name, frame);
const until = async (probe, timeout = 8000) => {
  const end = Date.now() + timeout;
  let value;
  while (Date.now() < end) { value = await probe().catch(() => false); if (value) return value; await page.waitForTimeout(150); }
  return value;
};
// Une sonde ouverte par la fenêtre « Apps » (elles sont « toujours là » : pas de case à cocher, seulement « Ouvrir »), à la vraie souris.
const openProbe = async (id, pattern) => {
  await lab.openModules(frame);
  // V et W partagent la même page : la sonde qu'on remplace (GFS lui demande de se fermer, contrats 5.4 point 3) est encore là au premier regard. On attend le cadre de la nouvelle.
  const before = new Set(page.frames().filter(each => pattern.test(each.url()) && !each.isDetached()));
  await frame.locator(`[data-open="${id}"]`).click();
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    target = await lab.appFrame(pattern);
    if (target && before.has(target)) { target = null; await page.waitForTimeout(250); }
  }
  // La page publie un état vide dès son chargement : on attend que le contexte soit arrivé (V, W) ou que le client du kit ait dit `ready` (X : `arrivee` est alors écrit, même à null).
  const arrived = await until(() => target.evaluate(() => {
    const state = JSON.parse(document.body.dataset.sonde || '{}');
    return Boolean(state.contexte) || 'arrivee' in state;
  }), 15000);
  check('l\'app a reçu la réponse de GFS à son démarrage', Boolean(arrived));
  return target;
};
const seenBy = target => target.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}'));
const identityEvents = seen => (seen.evenements || []).filter(event => event.nom === 'identite');
const showExplorer = async () => { await frame.locator('#floater-files').click(); await frame.locator('.ex').waitFor({ state: 'visible' }); };
const row = text => frame.locator('.ls-row', { hasText: text }).first();
const starOn = async name => (await row(name).locator('.rb.pin').getAttribute('class')).includes(' on');
const frameUrls = () => page.frames().map(f => f.url());

// ----- 1. Ana, sans la table : GFS ne la connaît pas.
say('\n1. Ana ouvre un document sans la table GFS_Rangement ; V (qui déclare l\'identité) s\'ouvre');
await open(ANA);
check('au départ, le document n\'a pas de table GFS_Rangement', (await lab.rangement(frame)).table === false);
let v = await openProbe('sonde-v', /v-personne\/index\.html/);
let seen = await seenBy(v);
check('V a reçu son contexte', Boolean(seen.contexte), seen);
check('le contexte porte le champ `identite`, à null : GFS ne connaît pas encore la personne', 'identite' in seen.contexte && seen.contexte.identite === null, seen.contexte && seen.contexte.identite);
check('aucun événement `identite` pour l\'instant', identityEvents(seen).length === 0, seen.evenements);
const unknown = JSON.stringify(seen.contexte.identite);
await shot('1-v-sans-table');

// ----- 2. La table naît pendant la session : l'événement.
say('\n2. Ana épingle un fichier sous V : la table naît avec son accord, GFS apprend son adresse');
await lab.forgetActions();
await showExplorer();
await shot('2-explorateur-sur-v');
const contract = 'Contrat de prestation';
await row(contract).hover();
await row(contract).locator('.rb.pin').click();
await frame.locator('.ask').waitFor({ timeout: 5000 });
await frame.locator('[data-fk="ask-yes"]').click();
check('l\'étoile s\'allume après « Créer la table »', Boolean(await until(() => starOn(contract), 20000)));
const event = await until(async () => identityEvents(await seenBy(v)).length >= 1, 8000);
seen = await seenBy(v);
check('V reçoit un événement `identite` quand GFS apprend l\'adresse', Boolean(event), seen.evenements);
check('l\'événement porte l\'adresse d\'Ana telle que Grist la donne (casse gardée) et rien d\'autre', JSON.stringify(identityEvents(seen)[0] && identityEvents(seen)[0].data) === JSON.stringify({ identite: { email: ANA.Email } }), identityEvents(seen));
check('un seul événement à l\'arrivée', identityEvents(seen).length === 1, identityEvents(seen));
const gfsActions = (await lab.actions()).filter(action => / GFS_Rangement/.test(action));
check('GFS n\'a rien écrit de plus pour la donner : la table, la sonde, son retrait, la ligne d\'Ana', JSON.stringify(gfsActions) === JSON.stringify(['AddTable GFS_Rangement', 'AddRecord GFS_Rangement [@sonde]', 'RemoveRecord GFS_Rangement', `AddRecord GFS_Rangement [${ANA.Email}]`]), gfsActions);
await row(contract).hover();
await row(contract).locator('.rb.pin').click();
await until(async () => !(await starOn(contract)));
await page.waitForTimeout(600);
check('un geste de plus ne répète pas l\'événement : toujours un seul', identityEvents(await seenBy(v)).length === 1, identityEvents(await seenBy(v)));
await shot('3-apres-evenement');

// ----- 3. GFS rouvre : l'adresse est dans le contexte.
say('\n3. GFS rouvre (la table existe) : V reçoit l\'adresse dans son contexte');
await open(ANA);
v = await openProbe('sonde-v', /v-personne\/index\.html/);
seen = await seenBy(v);
check('le contexte de V porte l\'adresse d\'Ana, telle que Grist la donne', JSON.stringify(seen.contexte.identite) === JSON.stringify({ email: ANA.Email }), seen.contexte.identite);
check('aucun événement : elle était déjà dans le contexte', identityEvents(seen).length === 0, seen.evenements);
const written = await lab.actions();
check('à l\'ouverture GFS n\'écrit que la sonde (ajoutée puis retirée), rien pour donner l\'adresse', JSON.stringify(written) === JSON.stringify(['AddRecord GFS_Rangement [@sonde]', 'RemoveRecord GFS_Rangement']), written);
check('l\'adresse n\'est dans l\'adresse d\'aucun cadre (ni GFS, ni l\'app)', frameUrls().every(url => !/ana(@|%40)/i.test(url)), frameUrls());
const keys = Object.keys(seen.contexte);
check('le contexte garde tous ses autres champs (contrat 5.2) ; `identite` en plus', ['contrat', 'hote', 'acces', 'langue', 'barre', 'stockage', 'identite'].every(key => keys.includes(key)), keys);
await shot('4-v-avec-adresse');

// ----- 4. W ne l'a pas déclarée.
say('\n4. W (qui ne déclare pas l\'identité) s\'ouvre à la place de V');
const w = await openProbe('sonde-w', /v-personne\/index\.html/);
seen = await seenBy(w);
check('W reçoit son contexte, `identite` à null alors que GFS connaît Ana', Boolean(seen.contexte) && seen.contexte.identite === null, seen.contexte && seen.contexte.identite);
check('l\'adresse d\'Ana n\'est nulle part dans ce que W a reçu (contexte et événements)', !JSON.stringify(seen).toLowerCase().includes('ana@'), JSON.stringify(seen).slice(0, 300));
check('W ne peut pas distinguer « pas déclarée » de « GFS ne la connaît pas » : la même valeur que V avait sans la table', JSON.stringify(seen.contexte.identite) === unknown, { w: seen.contexte.identite, vSansTable: unknown });
check('W ne reçoit aucun événement `identite`', identityEvents(seen).length === 0, seen.evenements);

// ----- 5. X, écrite avec le kit.
say('\n5. X (écrite avec le client du kit) s\'ouvre');
const x = await openProbe('sonde-x', /v-personne\/kit\.html/);
await until(async () => (await seenBy(x)).arrivee !== undefined);
seen = await seenBy(x);
check('X est hébergée et `GfsLink.identity()` rend l\'adresse d\'Ana après `ready`', seen.hosted === true && JSON.stringify(seen.arrivee) === JSON.stringify({ email: ANA.Email }), seen);
check('`onIdentity` a été rappelé une fois, à l\'arrivée du contexte, avec la même valeur', JSON.stringify(seen.abonne) === JSON.stringify([{ email: ANA.Email }]), seen.abonne);
await shot('5-x-kit');

// ----- 6. Une autre personne, l'anonyme, personne, lecture seule.
say('\n6. Une autre personne ouvre le même document');
await open(BEN);
v = await openProbe('sonde-v', /v-personne\/index\.html/);
seen = await seenBy(v);
check('V reçoit l\'adresse de Ben, jamais celle d\'Ana (GFS ne garde rien dans le navigateur)', JSON.stringify(seen.contexte.identite) === JSON.stringify({ email: BEN.Email }) && !JSON.stringify(seen).toLowerCase().includes('ana@'), seen.contexte.identite);

say('\n   L\'anonyme de Grist, une personne sans adresse, un document en lecture seule');
await open(ANONYMOUS);
v = await openProbe('sonde-v', /v-personne\/index\.html/);
seen = await seenBy(v);
check('l\'anonyme de Grist n\'est pas une personne : `identite` à null', seen.contexte.identite === null, seen.contexte.identite);
await open(null);
v = await openProbe('sonde-v', /v-personne\/index\.html/);
seen = await seenBy(v);
check('une personne sans adresse : `identite` à null', seen.contexte.identite === null, seen.contexte.identite);
await open(ANA, { query: 'readonly=true' });
v = await openProbe('sonde-v', /v-personne\/index\.html/);
seen = await seenBy(v);
check('document en lecture seule : GFS n\'écrit pas de sonde, `identite` à null', seen.contexte.identite === null && seen.contexte.lectureSeule === true, { identite: seen.contexte.identite, lectureSeule: seen.contexte.lectureSeule });
say('avertissements GFS :', warnings);
check('aucun avertissement de GFS', warnings.length === 0, warnings);
await lab.browser.close();
