// Deux documents ouverts dans le même navigateur : leurs widgets peuvent-ils se parler directement (BroadcastChannel) ? C'est ce qui permettrait de ne pas copier-coller les deux codes d'un partage entre
// deux documents (étude « Partager un dossier avec un autre document », mesure 4). VRAI serveur Grist (`bash vrai-serveur.sh`), une sonde de widget sans rien d'autre que le canal, deux documents, la même
// page de Grist au-dessus (le même site) : c'est le cas d'un partage entre deux documents d'une même instance. Une 3e sonde dans un autre contexte (autre profil) montre le cas où le canal ne passe pas.
//   node run-sync-canal.mjs          (LAB_BROWSER=chromium par défaut)
import { createServer } from 'node:http';
import { engine, engineName, say, check } from './lab-common.mjs';
import { requireServer, newContext, createDocument, docIdOf, GRIST } from './lab-serveur.mjs';
import { addCustomWidget } from './lab-setup.mjs';

const PORT = 8913;
const probe = `<!doctype html><meta charset="utf-8"><title>sonde</title>
<script src="https://docs.getgrist.com/grist-plugin-api.js"></script>
<script>
  const me = Math.random().toString(36).slice(2, 8);
  window.__me = me; window.__got = []; window.__error = null; window.__storage = [];
  let channel = null;
  try { channel = new BroadcastChannel('gfs-sonde'); channel.onmessage = event => window.__got.push(event.data); } catch (error) { window.__error = String(error); }
  try { addEventListener('storage', event => window.__storage.push(event.key)); } catch (error) { /* rien */ }
  window.__send = text => { if (channel) channel.postMessage({ from: me, text }); };
  window.__write = () => { try { localStorage.setItem('gfs-sonde', String(Math.random())); return true; } catch (error) { return String(error); } };
  grist.ready({ requiredAccess: 'none' });
</script><body>sonde</body>`;
const server = createServer((request, response) => { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(probe); }).listen(PORT, '127.0.0.1');

const probeFrame = async page => {
  for (let i = 0; i < 80; i++) {
    const frame = page.frames().find(each => each.url().includes(`:${PORT}/`));
    if (frame && await frame.evaluate(() => typeof window.__send === 'function').catch(() => false)) return frame;
    await page.waitForTimeout(500);
  }
  throw new Error('La sonde ne s\'est pas ouverte.');
};
async function documentWithProbe(context) {
  const page = await context.newPage();
  const path = await createDocument(page);
  await page.goto(`${GRIST}${path}`, { waitUntil: 'load' });
  await page.locator('.test-onboarding-popup').first().waitFor({ timeout: 15000 }).catch(() => {});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.getByText('Clients', { exact: true }).first().click();
  await page.waitForSelector('text=Dupont', { timeout: 60000 });
  await addCustomWidget(page, `http://127.0.0.1:${PORT}/probe.html`);
  return { page, id: docIdOf(path), frame: await probeFrame(page) };
}
const heard = async (frame, from) => frame.evaluate(sender => window.__got.some(message => message.from === sender), from);

const browser = await engine.launch(engineName === 'chromium' ? { args: ['--no-sandbox'] } : {});
try {
  const pluginApi = await requireServer();
  say(`Navigateur : ${engineName}`);
  const context = await newContext(browser, pluginApi);
  const first = await documentWithProbe(context);
  const second = await documentWithProbe(context);
  const [meFirst, meSecond] = await Promise.all([first.frame.evaluate(() => window.__me), second.frame.evaluate(() => window.__me)]);
  check('deux documents différents, deux sondes différentes', first.id !== second.id && meFirst !== meSecond, [first.id, second.id]);
  check('le canal existe dans le cadre du widget (aucune erreur)', (await first.frame.evaluate(() => window.__error)) === null && (await second.frame.evaluate(() => window.__error)) === null);
  await first.frame.evaluate(() => window.__send('de-un'));
  await second.frame.evaluate(() => window.__send('de-deux'));
  await first.page.waitForTimeout(1500);
  check('le 2e document entend le 1er (même navigateur, même profil)', await heard(second.frame, meFirst));
  check('le 1er document entend le 2e', await heard(first.frame, meSecond));
  // Les deux pages sont ouvertes en même temps, mais un cadre dont la page n'est pas devant peut être gelé : on regarde si le message arrive aussi quand on change d'onglet.
  await first.page.bringToFront();
  await first.frame.evaluate(() => window.__send('de-un-devant'));
  await second.page.waitForTimeout(1500);
  check('le message arrive aussi quand le 2e document est en arrière-plan', await second.frame.evaluate(() => window.__got.some(message => message.text === 'de-un-devant')));
  const writeStatus = await first.frame.evaluate(() => window.__write());
  await second.page.waitForTimeout(1000);
  say('Stockage local partagé (événement « storage » dans l\'autre document) :', writeStatus === true ? await second.frame.evaluate(() => window.__storage.length > 0) : writeStatus);
  // Un autre profil : le canal ne passe pas, il reste les deux codes.
  const apart = await newContext(browser, pluginApi);
  const third = await documentWithProbe(apart);
  await third.frame.evaluate(() => window.__send('de-trois'));
  await first.page.waitForTimeout(1500);
  const meThird = await third.frame.evaluate(() => window.__me);
  check('un autre profil du navigateur ne passe pas par le canal (les deux codes restent le repli)', !(await heard(first.frame, meThird)) && !(await heard(second.frame, meThird)));
  await context.close(); await apart.close();
} finally {
  server.close();
  await browser.close();
}
