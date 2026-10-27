// Mise en place commune des essais dans un VRAI Grist (grist-static 0.1.6) : ajoute le widget GFS par son adresse, lui donne l'accès complet
// et rend le cadre de GFS, ou celui d'une app (sous-cadre de GFS) quand on le demande.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { engine, engineName, newLabPage, SHOTS } from './lab-common.mjs';

const WIDGET = 'http://127.0.0.1:8911/prototype/index.html';

// La personne ouvre le document de test.
async function openDocument(page) {
  await page.goto('http://127.0.0.1:8910/lab.html', { waitUntil: 'load' });
  await page.waitForSelector('text=Dupont', { timeout: 60000 });
}

// La personne ajoute un widget personnalisé à la page par son adresse et accepte l'avertissement de Grist.
async function addCustomWidget(page, address) {
  await page.locator('.test-dp-add-new').first().click();
  await page.locator('.test-dp-add-widget-to-page').click();
  await page.waitForTimeout(500);
  await page.locator('.test-wselect-type').filter({ hasText: /^Custom$/ }).click();
  await page.locator('.test-wselect-table-label').filter({ hasText: /^clients$/ }).first().click().catch(() => {});
  await page.getByText('Add to page', { exact: true }).click();
  await page.waitForTimeout(1500);
  await page.locator('.test-custom-widget-gallery-widget-name').filter({ hasText: 'Custom URL' }).click();
  await page.getByPlaceholder('Widget URL').click();
  await page.getByPlaceholder('Widget URL').pressSequentially(address, { delay: 5 });
  await page.locator('.test-custom-widget-gallery-save').click();
  await page.waitForTimeout(800);
  await page.getByText('I confirm that I understand these warnings and accept the risks').click();
  await page.getByRole('button', { name: 'Confirm' }).click();
}

// La personne règle la section sur « Full document access » dans le panneau de droite.
async function chooseFullAccess(page) {
  await page.mouse.click(1263, 24);
  await page.waitForTimeout(800);
  await page.getByText('CLIENTS Custom', { exact: false }).first().click({ position: { x: 20, y: 5 } }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('.test-right-panel').getByText('No document access', { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByText('Full document access', { exact: true }).last().click();
  await page.waitForTimeout(500);
}

// Le site en ligne de chaque app (js/catalogue.js, `site`) et le dossier de sa copie dans le dépôt : GFS ouvre l'app sur son site, le labo rend les fichiers de la copie à cette adresse.
const SITES = { publipostageGrist: 'publipostage', GRIST_automation: 'automation', FormPlus: 'form' };

// grist-static donne `credentialless` au cadre que Grist ouvre pour un widget (`iframeAttributes` de ses réglages, `main.bundle.js`) ; le Grist ordinaire n'ajoute rien à ce cadre (`WidgetFrame`
// ne lit ce réglage que s'il existe). Sous Chromium, cet attribut coupe `window.opener` et le nom des fenêtres ouvertes depuis le cadre (`window.open` rend `null`), ce que le Grist de la personne ne fait pas :
// `ordinaryFrame: true` le retire, pour toute mesure qui dépend d'une fenêtre ouverte par une app. Firefox ne connaît pas l'attribut (faits-verifies.md, section 1).
const ORDINARY_FRAME = { chemin: '/dist/main.bundle.js', de: 'iframeAttributes:{credentialless:!0}', vers: 'iframeAttributes:{}' };

// `widget` : l'adresse de la page que Grist reçoit comme widget personnalisé (GFS par défaut ; une sonde, pour la mesurer SANS GFS, dans le cadre même de Grist).
// `live` : GFS sert les apps sur leur site en ligne (le défaut de GFS depuis le 22/10) ; le labo mesure la copie figée du sous-module (`live=0`) sauf `LAB_LIVE=1` ou `live: true`.
// `liveAbsent` : les sites (`FormPlus`…) qui ne répondent pas, pour mesurer le repli sur la copie.
// `ordinaryFrame` : le cadre de Grist sans le `credentialless` de grist-static (voir ORDINARY_FRAME) ; faux par défaut, pour ne pas changer les passes déjà mesurées.
const DEFAULTS = { lang: 'fr', colorScheme: 'light', width: 1280, height: 800, query: '', fullAccess: true, probes: false, frameAttributes: null, patches: [], ordinaryFrame: false, widget: WIDGET, newsSeen: true, user: null, live: process.env.LAB_LIVE === '1', liveAbsent: [] };

// Les sites en ligne des apps, vus du labo : `/<site>/…` rend le fichier de la copie de l'app (même serveur, même origine que GFS), ou 404 pour un site « hors ligne ».
async function routeLiveSites(page, absent) {
  await page.route(new RegExp(`^http://127\\.0\\.0\\.1:8911/(${Object.keys(SITES).join('|')})/`), async route => {
    const url = new URL(route.request().url());
    const [, site, rest] = /^\/([^/]+)\/(.*)$/.exec(url.pathname);
    if (absent.includes(site)) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
    url.pathname = `/prototype/apps/${SITES[site]}/${rest}`;
    return route.continue({ url: url.href });
  });
}

export async function startLab(options = {}) {
  const { lang, colorScheme, width, height, query, fullAccess, probes, frameAttributes, patches, ordinaryFrame, widget, newsSeen, user, live, liveAbsent } = { ...DEFAULTS, ...options };
  await mkdir(SHOTS, { recursive: true });
  const browser = await engine.launch(engineName === 'chromium' ? { args: ['--no-sandbox', '--font-render-hinting=none'] } : {});
  const { page, context } = await newLabPage(browser, { lang, colorScheme, width, height, probes, frameAttributes, patches: ordinaryFrame ? [...patches, ORDINARY_FRAME] : patches, newsSeen, user });
  if (live) await routeLiveSites(page, liveAbsent);
  const gfsFrame = async (re = /./) => {
    for (let i = 0; i < 80; i++) {
      const f = page.frames().find(f => f.url().startsWith(widget) && re.test(f.url()));
      if (f) return f;
      await page.waitForTimeout(500);
    }
    return null;
  };
  const appFrame = async (re = /./) => {
    for (let i = 0; i < 120; i++) {
      const f = page.frames().find(f => /^http:\/\/127\.0\.0\.1:8911\/(prototype\/(apps|labo\/sondes)|publipostageGrist|GRIST_automation|FormPlus)\//.test(f.url()) && re.test(f.url()));
      if (f) return f;
      await page.waitForTimeout(500);
    }
    return null;
  };
  const gfsReady = async frame => {
    await frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(500);
  };
  // Grist ajoute ses propres paramètres après ceux de l'adresse (searchParams.append) : le premier `language` gagne, c'est celui du labo.
  await openDocument(page);
  const liveParam = widget === WIDGET && !live ? '&live=0' : '';
  await addCustomWidget(page, `${widget}?language=${lang}&culture=${lang === 'en' ? 'en-GB' : 'fr-FR'}${liveParam}${query ? '&' + query.replace(/^\?/, '') : ''}`);
  let frame = await gfsFrame(/access=none/);
  await page.waitForTimeout(1500);
  if (fullAccess) {
    await chooseFullAccess(page);
    frame = await gfsFrame(/access=full/);
  }
  // Une sonde posée comme widget n'est pas GFS : rien à attendre de plus que son chargement.
  if (widget === WIDGET) await gfsReady(frame);
  else await page.waitForTimeout(1500);
  // Le panneau de référence : 700 × 400 (charte). On ajuste la fenêtre du navigateur jusqu'à ce que le cadre de GFS mesure cela dans la vraie page de
  // Grist ; le protocole entre Grist et le widget n'est pas touché.
  const fitPanel = async (target = frame, width = 700, height = 400) => {
    const element = await target.frameElement();
    // Le widget partage la page avec une autre section : la largeur ne suit qu'à moitié la fenêtre, d'où le gain de 2 (la hauteur suit 1 pour 1).
    for (let i = 0; i < 12; i++) {
      const box = await element.boundingBox();
      const dw = Math.round(width - box.width);
      const dh = Math.round(height - box.height);
      if (Math.abs(dw) <= 1 && Math.abs(dh) <= 1) return box;
      const size = page.viewportSize();
      await page.setViewportSize({ width: size.width + (Math.abs(dw) > 1 ? dw * 2 : 0), height: size.height + dh });
      await page.waitForTimeout(500);
    }
    return element.boundingBox();
  };
  // La fenêtre « Apps et extensions » : le bouton « Apps » de l'explorateur, ou le repère au-dessus d'une app.
  const openModules = async (target = frame) => {
    if (await target.locator('.mod').count()) return;
    if (await target.locator('#floater-apps').isVisible()) await target.locator('#floater-apps').click();
    else await target.locator('.ex-title-row .tb', { hasText: /Apps/ }).click();
    await target.locator('.mod').waitFor();
  };
  // L'enregistrement d'un choix de la fenêtre « Apps » : tant qu'il dure (`data-registry="busy"`), et si GFS demande de créer la table du document (contrats 7.4,
  // point 4), la personne répond avec la vraie souris : « accept » (par défaut) ou « decline ».
  const settle = async (target = frame, answer = 'accept') => {
    for (let i = 0; i < 100; i++) {
      if (await target.locator('.ask').count()) await target.locator(`[data-fk="ask-${answer === 'accept' ? 'yes' : 'no'}"]`).click();
      else if (await target.evaluate(() => document.body.dataset.registry !== 'busy')) return;
      await page.waitForTimeout(100);
    }
  };
  // Installe une app par la fenêtre (une personne : la case, puis « Ouvrir ») et rend son cadre.
  // `target` : le cadre de GFS à utiliser quand il a été reconstruit (le cadre de départ n'existe plus).
  const openApp = async (id, pattern = /./, target = frame) => {
    await target.waitForFunction(() => Boolean(document.body) && document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});
    await openModules(target);
    await target.locator(`[data-fk="app:${id}"]`).check();
    await settle(target);
    await target.locator(`[data-open="${id}"]`).click();
    return appFrame(pattern);
  };
  // Ce que le document retient : la table `GFS_Rangement` (si elle existe) et la valeur de sa ligne réservée `@document` / `gfs` / `apps` (contrats 7.4).
  const rangement = (target = frame) => target.evaluate(async () => {
    const tables = await grist.docApi.listTables();
    const pages = (await grist.docApi.fetchTable('_grist_Pages')).id.length;
    if (!tables.includes('GFS_Rangement')) return { table: false, pages, tables: tables.length };
    const data = await grist.docApi.fetchTable('GFS_Rangement');
    const at = data.id.findIndex((id, i) => data.Utilisateur[i] === '@document' && data.App[i] === 'gfs' && data.Fichier[i] === 'apps');
    const columns = Object.keys(data).filter(name => /^[A-Z]/.test(name));
    // `lines` : toutes les lignes, avec leurs colonnes (celles d'un autre auteur comprises), pour vérifier qu'une écriture n'y a pas touché.
    const lines = data.id.map((id, i) => ({ id, ...Object.fromEntries(columns.map(name => [name, data[name][i]])) }));
    return { table: true, pages, tables: tables.length, rows: data.id.length, columns, lines, reservedId: at >= 0 ? data.id[at] : null, value: at >= 0 && data.Valeur ? JSON.parse(data.Valeur[at]) : null };
  });
  // Une section de plus sur la page, par la même suite de gestes que la première (accès « aucun », comme Grist le donne à un widget qu'on ajoute).
  const addSection = address => addCustomWidget(page, address);
  // La personne devant l'écran (lab-common.mjs : le moteur de Grist reçoit son adresse) : { Email, Name, IsLoggedIn, UserID }, ou null (grist-static : une personne sans adresse). Un widget déjà
  // ouvert garde ce qu'il a lu : pour une autre personne, il se recharge (c'est ce que fait Grist quand quelqu'un d'autre ouvre le document).
  const setUser = who => page.evaluate(next => { window.__labUser = next; }, who);
  // Ce que le moteur a reçu depuis le début (ou depuis le dernier `forgetActions`) : « Verbe Table [Utilisateur de la ligne ajoutée] ».
  const actions = () => page.evaluate(() => window.__labActions.slice());
  const forgetActions = () => page.evaluate(() => { window.__labActions.length = 0; });
  return { browser, context, page, frame, gfsFrame, appFrame, openModules, openApp, settle, gfsReady, fitPanel, rangement, addSection, setUser, actions, forgetActions, shot: (run, name) => page.screenshot({ path: join(SHOTS, `${run}-${name}.png`) }),
    // La capture du cadre de GFS seul (le panneau), pas de la page de Grist.
    shotPanel: async (run, name, target = frame) => (await target.frameElement()).screenshot({ path: join(SHOTS, `${run}-${name}.png`) }) };
}
