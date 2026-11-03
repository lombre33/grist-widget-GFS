// Ce que les essais sur un VRAI serveur Grist ont en commun (run-reel-serveur.mjs, run-pdf.mjs) : l'image officielle lancée par `bash vrai-serveur.sh` (Docker), une personne d'essai, un document avec
// une table « Clients », un widget personnalisé ajouté à la main (comme la personne le fait) avec l'accès complet. Ce que ni grist-static (pas d'API REST, pas de jeton) ni le répondeur de
// remplacement (écrit par nous) ne peuvent dire. Le cloud n'atteint pas docs.getgrist.com : le script de l'API des widgets vient du serveur local. Chromium seulement.
import { say } from './lab-common.mjs';
import { addCustomWidget, chooseFullAccess } from './lab-setup.mjs';

export const GRIST = process.env.GRIST_URL || 'http://127.0.0.1:8484';

// Ajoute l'adresse du serveur au `connect-src https:` des pages que `pattern` désigne (pour CET essai : le fichier du dépôt n'est pas touché) ; l'adresse d'une instance n'est connue qu'à
// l'exécution (le baseUrl du jeton), la vraie page la permet par `https:`, un serveur local est en http.
export const openConnectIn = pattern => (file, bytes) => (pattern.test(file) ? Buffer.from(bytes.toString('utf8').replace(/(content="[^"]*connect-src https:)/, `$1 ${GRIST}`)) : bytes);

// Le serveur répond-il ? Sinon on le dit et on s'arrête. Rend le script de l'API des widgets, tel que ce serveur le sert.
export async function requireServer() {
  const response = await fetch(`${GRIST}/status`).catch(() => null);
  if (!response || !response.ok) { say(`Le serveur Grist ne répond pas sur ${GRIST} : lance « bash vrai-serveur.sh » (voir LISEZ-MOI.md).`); process.exit(2); }
  return (await fetch(`${GRIST}/grist-plugin-api.js`)).text();
}

// Un contexte de navigateur dont la page de Grist reçoit le script de l'API des widgets du serveur local à la place de celui de docs.getgrist.com.
export async function newContext(browser, pluginApi, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...options });
  await context.route('https://docs.getgrist.com/grist-plugin-api.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: pluginApi }));
  return context;
}

// La personne d'essai crée un document avec une table « Clients » (une ligne) ; rend son adresse.
export async function createDocument(page) {
  await page.goto(`${GRIST}/`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  return page.evaluate(async () => {
    const call = async (path, method = 'GET', body) => (await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();
    const [org] = await call('/api/orgs');
    const spaces = await call(`/api/orgs/${org.id}/workspaces`);
    const space = spaces.length ? spaces[0].id : await call(`/api/orgs/${org.id}/workspaces`, 'POST', { name: 'Essais' });
    const id = await call(`/api/workspaces/${space}/docs`, 'POST', { name: `Essai ${new Date().toISOString()}` });
    await call(`/api/docs/${id}/apply`, 'POST', [['AddTable', 'Clients', [{ id: 'Nom', type: 'Text' }]], ['AddRecord', 'Clients', null, { Nom: 'Dupont' }]]);
    return `/o/${org.domain}/${id}/Essai`;
  });
}

// Le document s'ouvre (la visite guidée de Grist cache les pages : Échap la ferme), la personne ajoute le widget `address` à la page « Clients » et lui donne l'accès complet.
export async function addWidget(page, path, address) {
  await page.goto(`${GRIST}${path}`, { waitUntil: 'load' });
  await page.locator('.test-onboarding-popup').first().waitFor({ timeout: 15000 }).catch(() => {});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.getByText('Clients', { exact: true }).first().click();
  await page.waitForSelector('text=Dupont', { timeout: 60000 });
  await addCustomWidget(page, address);
  await page.waitForTimeout(2500);
  await chooseFullAccess(page);
  await page.waitForTimeout(1500);
}

// L'identifiant du document dans l'adresse que rend `createDocument`.
export const docIdOf = path => path.split('/')[3];
