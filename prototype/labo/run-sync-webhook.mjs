// Un webhook de Grist vers une adresse locale : refusé par un serveur Grist par défaut (403 « Provided url is forbidden »), livré quand l'instance l'autorise (ALLOWED_WEBHOOK_DOMAINS). Le moteur de Sync+ pose un
// webhook par destinataire vers l'adresse publique du formulaire du document qui reçoit : sur une même instance, c'est ce réglage de l'hébergeur qui décide (étude « Partager un dossier avec un autre document », mesure 3).
//   Sans le réglage : « bash vrai-serveur.sh » (refusé) ; avec : relancer le conteneur avec -e ALLOWED_WEBHOOK_DOMAINS='*' (livré).
import { createServer } from 'node:http';
import { chromium, say, check } from './lab-common.mjs';
import { requireServer, newContext, createDocument, docIdOf, GRIST } from './lab-serveur.mjs';
const got = [];
const server = createServer((req, res) => { let body = ''; req.on('data', c => { body += c; }); req.on('end', () => { got.push({ url: req.url, body: body.slice(0, 200) }); res.end('ok'); }); }).listen(9911, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await newContext(browser, await requireServer());
const page = await context.newPage();
const id = docIdOf(await createDocument(page));
const out = await page.evaluate(async ([doc, base]) => {
  const call = async (path, method = 'GET', body) => { const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, text: (await r.text()).slice(0, 300) }; };
  const made = await call(`/api/docs/${doc}/webhooks`, 'POST', { webhooks: [{ fields: { name: 'essai', url: 'http://127.0.0.1:9911/hook', eventTypes: ['add', 'update'], enabled: true, tableId: 'Clients' } }] });
  const added = await call(`/api/docs/${doc}/apply`, 'POST', [['AddRecord', 'Clients', null, { Nom: 'Martin' }]]);
  return { made, added };
}, [id, GRIST]);
say('création du webhook :', out.made.status, out.made.text);
for (let i = 0; i < 40 && !got.length; i++) await new Promise(r => setTimeout(r, 500));
check('le webhook vers 127.0.0.1 est livré (Grist lancé avec ALLOWED_WEBHOOK_DOMAINS=*)', got.length > 0, got);
const list = await page.evaluate(async doc => (await (await fetch(`/api/docs/${doc}/webhooks`)).json()), id);
say('état du webhook :', JSON.stringify(list).slice(0, 400));
server.close(); await browser.close();
