// Le même canal direct entre deux documents (voir run-sync-canal.mjs), mesuré sous FIREFOX, le navigateur du porteur. Firefox se pilote sans Playwright (test/firefox.mjs) et Grist ne s'y pilote pas : on rejoue
// donc la forme du cas. Deux pages d'un même site, chacune avec un cadre d'un autre site (le widget) : c'est ce que sont deux documents d'une même instance. La 2e page est ouverte par la 1re
// (`window.open`, un autre onglet du même profil) ; son cadre répond « pong » sur le canal au « ping » du cadre de la 1re, qui le dit à sa page. Firefox partitionne le stockage par site de la page du
// dessus : les deux ont le même, le canal doit passer.
//   bash installer-firefox.sh puis node run-sync-canal-firefox.mjs
import { say, check } from './lab-common.mjs';
import { findFirefox, serveSite, startFirefox } from '../test/firefox.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const binary = findFirefox();
if (!binary) { say('Firefox est absent : bash installer-firefox.sh'); process.exit(2); }
const empty = mkdtempSync(`${tmpdir()}/canal-`);
const probe = `<!doctype html><meta charset="utf-8"><title>sonde</title><script>
const me = Math.random().toString(36).slice(2, 8);
let channel = null;
const tell = data => parent.postMessage({ kind: 'canal', data }, '*');
try {
  channel = new BroadcastChannel('gfs-sonde');
  channel.onmessage = event => { tell(event.data); if (event.data.type === 'ping') channel.postMessage({ type: 'pong', from: me }); };
  tell({ type: 'pret', from: me });
} catch (error) { tell({ type: 'erreur', text: String(error) }); }
addEventListener('message', event => { if (event.data === 'ping' && channel) channel.postMessage({ type: 'ping', from: me }); });
</script>`;
const widgets = await serveSite(empty, { '/probe.html': probe });
const top = frame => `<!doctype html><title>document</title><script>window.__bc = []; addEventListener('message', event => { if (event.data && event.data.kind === 'canal') window.__bc.push(event.data.data); });</script>`
  + `<iframe id="w" src="${frame}/probe.html" sandbox="allow-scripts allow-same-origin" style="width:300px;height:100px"></iframe>`;
const site = await serveSite(empty, { '/a.html': top(widgets.url), '/b.html': top(widgets.url) });
const firefox = await startFirefox(binary);
try {
  const { page } = firefox;
  await page.goto(`${site.url}/a.html`);
  await page.until(() => window.__bc.some(item => item.type === 'pret'), [], 8000);
  const opened = await page.run(url => Boolean(window.open(url, '_blank')), `${site.url}/b.html`);
  check('Firefox : la 2e page s\'ouvre (autre onglet, même profil)', opened === true);
  await new Promise(resolve => setTimeout(resolve, 3000));
  await page.run(() => document.getElementById('w').contentWindow.postMessage('ping', '*'));
  await new Promise(resolve => setTimeout(resolve, 2500));
  const heard = await page.run(() => window.__bc);
  say('Ce que le cadre de la page A a entendu sur le canal :', JSON.stringify(heard));
  check('Firefox : le cadre du 2e document répond au ping du 1er (« pong » d\'un autre cadre)', heard.some(item => item.type === 'pong'), heard);
} finally {
  await firefox.close();
  await site.close(); await widgets.close();
}
