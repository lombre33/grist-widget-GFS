// Mesure (06/11) : un widget propriétaire peut-il lire la liste des personnes invitées au document ? Les points d'accès essayés avec le jeton que rend `getAccessToken` (le courtier de GFS le relaie) :
// `/access` (déjà 403 le 04/11), `/usersForViewAs` (la liste qui alimente « Voir en tant que »), et les mêmes avec un jeton en lecture seule. Jouée dans un VRAI Grist (`bash vrai-serveur.sh`).
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, openGfs } from './lab-pdf.mjs';
import { shareWithEditorAndViewer } from './lab-droits.mjs';

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, {});
  const run = await openGfs(context, { lang: 'fr' });
  await shareWithEditorAndViewer(run.page, run.docId);
  for (const readOnly of [false, true]) {
    const tokenInfo = await run.frame.evaluate(async flag => { try { return { ok: true, info: await grist.docApi.getAccessToken({ readOnly: flag }) }; } catch (error) { return { ok: false, message: String(error && error.message || error) }; } }, readOnly);
    say(`jeton (readOnly=${readOnly}) :`, tokenInfo.ok ? 'obtenu' : tokenInfo.message);
    if (!tokenInfo.ok) continue;
    const { baseUrl, token } = tokenInfo.info;
    for (const path of ['/access', '/usersForViewAs']) {
      const url = `${baseUrl}${path}?auth=${encodeURIComponent(token)}`;
      const response = await fetch(url).catch(error => ({ status: 0, text: async () => String(error) }));
      const body = (await response.text()).slice(0, 400);
      say(`readOnly=${readOnly} ${path} : ${response.status}`, body.replace(/\s+/g, ' '));
      if (path === '/usersForViewAs' && !readOnly) check('la liste des personnes du document se lit avec le jeton du widget', response.status === 200, { status: response.status, body });
    }
  }
} finally {
  await browser.close();
  pages.close();
}
