// « Nouveau > Depuis un modèle » (contrats 5.4, point 13 ; décision du porteur du 18/11 : « Une galerie commune »), dans un vrai Grist, à 700 × 400, à la vraie souris : la personne choisit
// « Depuis un modèle… » dans le menu « Nouveau », la galerie réunit les modèles des apps, « Créer » ouvre l'app sur le modèle. La sonde O (labo/sondes/o-ouvrir/) fait ce que fera une app qui
// a lu la consigne : elle déclare `ouverture.modele` et un catalogue (celui de Publipostage+, dont elle ne garde que les documents : les types qu'elle ouvre), répond à `ouvrir` et garde
// l'ouverture qu'on lui rend. À mesurer : l'article du menu ; la galerie (les modèles de la sonde libres, ceux de Publipostage+ grisés « pas encore », l'app sans catalogue « bientôt ») ;
// « Créer » envoie `ouvrir` à la sonde déjà ouverte avec `raison: 'modele'` et `modele: { id }` (et rien d'un fichier) ; la sonde qui démarre sur un modèle le reçoit à son premier
// `contexte`, une seule fois ; un modèle grisé n'ouvre rien et dit pourquoi ; une app retirée : ses modèles restent, grisés, avec « Voir dans Apps » qui ouvre sa ligne, et la galerie
// revient avec la recherche. LAB_LANG=fr|en.
import { startLab } from './lab-setup.mjs';
import { say, check, probeDeclares } from './lab-common.mjs';
import { isGfsWarning } from './sondes-muettes.mjs';
import { installApp, removeApp } from './lab-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const NAME = lang === 'fr' ? 'Sonde O' : 'Probe O';
const TEXT = lang === 'fr'
  ? { menu: 'Depuis un modèle…', title: 'Créer à partir d’un modèle', notYet: /ne sait pas encore ouvrir un modèle de départ/, lockedApp: /Demande l’app Sonde O/, seeApps: 'Voir dans Apps', create: 'Créer', invoice: 'Facture, devis ou avoir', word: 'facture' }
  : { menu: 'From a template…', title: 'Create from a template', notYet: /cannot open a starter template/, lockedApp: /Needs the Probe O app/, seeApps: 'See in Apps', create: 'Create', invoice: 'Invoice, quote or credit note', word: 'invoice' };
const ACCEPTS = probeDeclares('sonde-o', { ouverture: { fichier: true, nouveau: true, modele: true }, modeles: { catalogue: 'publipostage/modeles.json' } });
// Le manifeste que GFS livre le 18/11 dit que Publipostage+ sait ouvrir un modèle ; pour mesurer le grisé « pas encore » (une app qui a son catalogue sans savoir l'ouvrir), le labo retire ce mot à Publipostage+.
const NOT_YET = { chemin: '/prototype/manifestes/publipostage.json', de: '"lire": true, "modele": true }', vers: '"lire": true }' };
const lab = await startLab({ lang, probes: true, patches: [ACCEPTS, NOT_YET] });
await lab.fitPanel(undefined, 700, 400);
const { page } = lab;
const warnings = [];
page.on('console', m => { if (m.type() === 'warning' && isGfsWarning(m.text())) warnings.push(m.text()); });
const frame = await lab.gfsFrame(/access=full/);
await lab.gfsReady(frame);
await page.waitForTimeout(800);

const app = await lab.openApp('sonde-o', /o-ouvrir\//, frame);
const probe = () => app.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}'));
const waitFor = async (label, test) => {
  for (let i = 0; i < 50; i++) {
    if (await test()) return true;
    await page.waitForTimeout(100);
  }
  say(`(pas arrivé : ${label})`);
  return false;
};
await waitFor('la sonde a reçu son contexte', async () => (await probe()).contexte);
const gallery = frame.locator('.mod.tp');
const toast = () => frame.locator('#toast');
const showFiles = async () => { await frame.locator('#floater-files').click(); await frame.locator('.ex').waitFor({ state: 'visible' }); };
const openGallery = async () => {
  await frame.locator('.btn.primary').click();
  await frame.locator('.menu-item', { hasText: TEXT.menu }).click();
  await gallery.waitFor({ state: 'visible' });
  await page.waitForTimeout(500); // les vignettes se chargent à l'écran
};
const card = (appName, text) => gallery.locator('.tp-card', { hasText: text }).filter({ has: frame.locator('.tp-app', { hasText: appName }) }).first();
const chip = appName => gallery.locator('.tp-chip', { hasText: appName });
const foot = () => gallery.locator('.mod-note').innerText();

// 1. L'article du menu « Nouveau » et la galerie.
await showFiles();
await frame.locator('.btn.primary').click();
const names = await frame.locator('.menu-item .menu-label').allInnerTexts();
check('le menu « Nouveau » a « Depuis un modèle… » après « Nouveau dossier » et les types, avant « Importer »', names[0] && names.includes(TEXT.menu) && names.indexOf(TEXT.menu) > 0 && names.indexOf(TEXT.menu) < names.length, names);
await page.keyboard.press('Escape');
await openGallery();
check('la galerie s\'ouvre : son titre, dans la page de 700 × 400', (await gallery.locator('h2').innerText()) === TEXT.title && (await gallery.boundingBox()).height <= 400 && (await gallery.boundingBox()).width <= 700, await gallery.locator('h2').innerText());
const appsCount = await gallery.locator('.tp-chip').count();
const probeCards = await gallery.locator('.tp-card', { has: frame.locator('.tp-app', { hasText: NAME }) }).count();
const ppCards = await gallery.locator('.tp-card', { has: frame.locator('.tp-app', { hasText: 'Publipostage+' }) }).count();
say('pastilles :', await gallery.locator('.tp-chip').allInnerTexts(), ' cartes de la sonde :', probeCards, ' de Publipostage+ :', ppCards);
check('une pastille par app du catalogue, la première « toutes les apps »', appsCount >= 6, appsCount);
check('la sonde propose les 18 documents du catalogue de Publipostage+ (ses types : document et macro), Publipostage+ ses 22 modèles', probeCards === 18 && ppCards === 22, { probeCards, ppCards });
check('les modèles de la sonde sont libres, ceux de Publipostage+ grisés « pas encore » (son manifeste ne déclare pas `ouverture.modele`)',
  (await card(NAME, TEXT.invoice).getAttribute('aria-disabled')) === null && (await card('Publipostage+', TEXT.invoice).getAttribute('aria-disabled')) === 'true');
check('Automation+, sans catalogue, garde sa pastille grisée (« bientôt ») ; Form+ (5 modèles) et Grist-BI (3) montrent la leur, avec leur nombre',
  (await chip('Automation+').getAttribute('aria-disabled')) === 'true' && (await chip('Form+').getAttribute('aria-disabled')) === null && (await chip('Form+').innerText()).includes('5')
  && (await chip('Grist-BI').getAttribute('aria-disabled')) === null && (await chip('Grist-BI').innerText()).includes('3'));
await lab.shot(`modeles-${lang}`, '1-galerie');

// 2. Un modèle grisé n'ouvre rien : sa raison est dans le pied, « Créer » reste éteint.
await card('Publipostage+', TEXT.invoice).click({ force: true });
check('un modèle de Publipostage+ (pas encore) : la raison est dite dans le pied, sans « Voir dans Apps »', TEXT.notYet.test(await foot()) && (await gallery.locator('[data-act="see"]').isHidden()), await foot());
await gallery.locator('[data-act="create"]').click({ force: true });
await page.waitForTimeout(400);
check('« Créer » éteint n\'ouvre rien : la galerie reste, la sonde n\'a reçu aucun appel', (await gallery.isVisible()) && (await probe()).appels.length === 0, await probe());

// 3. « Créer » sur un modèle de la sonde déjà ouverte : GFS lui envoie `ouvrir` avec le modèle.
await chip(NAME).click();
await card(NAME, TEXT.invoice).click();
check('la pastille de la sonde ne laisse que ses cartes, le pied dit que l\'app demande l\'accord avant de créer des tables', (await gallery.locator('.tp-card').count()) === 18 && /accord|consent/.test(await foot()), await foot());
await gallery.locator('[data-act="create"]').click();
await waitFor('l\'appel « modèle »', async () => (await probe()).appels.length === 1);
const seen = await probe();
say('appel « modèle » :', seen.appels[0]);
check('« Créer » envoie « ouvrir » sans fichier, avec le type du modèle, le dossier, la raison « modele » et l\'identifiant du modèle',
  seen.appels.length === 1 && JSON.stringify(seen.appels[0]) === JSON.stringify({ fichier: null, type: 'document', dossier: '', raison: 'modele', modele: { id: 'facture' } }), seen.appels[0]);
check('la galerie et l\'explorateur sont refermés, l\'app garde son cadre et GFS n\'ajoute aucune phrase', (await gallery.isHidden()) && (await frame.locator('.ex').isHidden()) && (await toast().isHidden()), await toast().innerText());

// 4. Échap ferme la galerie sans rien créer.
await showFiles();
await openGallery();
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Échap ferme la galerie sans rien envoyer à l\'app', (await gallery.isHidden()) && (await probe()).appels.length === 1, (await probe()).appels.length);

// 5. L'app retirée : ses modèles restent, grisés, « Voir dans Apps » ouvre sa ligne, la galerie revient avec la recherche.
await lab.openModules(frame);
await removeApp(frame, 'sonde-o');
await lab.settle(frame);
await page.keyboard.press('Escape');
await frame.locator('.ex').waitFor({ state: 'visible' });
await openGallery();
await gallery.locator('input[type="search"]').fill(TEXT.word);
await card(NAME, TEXT.invoice).click({ force: true });
check('l\'app retirée : son modèle reste, grisé, avec « Voir dans Apps »', (await card(NAME, TEXT.invoice).getAttribute('aria-disabled')) === 'true' && TEXT.lockedApp.test(await foot()) && (await gallery.locator('[data-act="see"]').isVisible()), await foot());
await gallery.locator('[data-act="see"]').click();
await frame.locator('.mod.ap-win, .mod.fp-win, .mod [data-open], .mod [data-app]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
check('« Voir dans Apps » ferme la galerie et ouvre la fenêtre « Apps et extensions »', (await gallery.isHidden()) && (await frame.locator('.mod-scrim').count()) === 1);
await installApp(frame, 'sonde-o');
await lab.settle(frame);
await page.keyboard.press('Escape');
await gallery.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
check('à la fermeture de la fenêtre des apps la galerie revient avec la recherche', (await gallery.isVisible()) && (await gallery.locator('input[type="search"]').inputValue()) === TEXT.word, await gallery.locator('input[type="search"]').inputValue());

// 6. L'app qui démarre sur un modèle le reçoit à son premier contexte, une seule fois.
await card(NAME, TEXT.invoice).click();
await gallery.locator('[data-act="create"]').click();
const again = await lab.appFrame(/o-ouvrir\//);
await waitFor('la sonde relancée a reçu son contexte', async () => (await again.evaluate(() => JSON.parse(document.body.dataset.sonde || '{}'))).contexte);
const started = await again.evaluate(() => JSON.parse(document.body.dataset.sonde));
say('contexte au démarrage :', started.ouverture);
check('l\'app qui démarre sur un modèle reçoit l\'ouverture « modele » à son premier contexte', JSON.stringify(started.ouverture) === JSON.stringify({ fichier: null, type: 'document', dossier: '', raison: 'modele', modele: { id: 'facture' } }) && started.appels.length === 0, started);
await again.evaluate(() => { window.__avant = true; });
await again.evaluate(() => location.reload()).catch(() => {});
await waitFor('le cadre rechargé a reçu son contexte', () => again.evaluate(() => !window.__avant && JSON.parse(document.body.dataset.sonde || '{}').contexte).catch(() => false));
const reloaded = await again.evaluate(() => JSON.parse(document.body.dataset.sonde));
check('le cadre rechargé sur place n\'y retrouve pas le modèle (l\'ouverture n\'est rendue qu\'une fois)', reloaded.contexte && reloaded.ouverture === null, reloaded);
say('avertissements GFS :', warnings);
// La sonde ne garde que les documents du catalogue de Publipostage+ : les quatre autres (une grille deux fois, un e-mail, une présentation) sont écartés, chacun avec son avertissement, une seule fois.
const expected = warnings.filter(text => /un modèle de sonde-o est écarté \(modèle \d+ : type « (email|grille|presentation) » que l'app ne sait pas ouvrir\)/.test(text));
check('GFS écarte les quatre modèles que la sonde ne sait pas ouvrir, chacun avec son avertissement, une fois, et n\'avertit de rien d\'autre', expected.length === 4 && warnings.length === 4, warnings);
await lab.browser.close();
