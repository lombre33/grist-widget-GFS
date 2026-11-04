// Les droits vus d'un widget plein accès dans un VRAI serveur Grist (permissions, étape 6) : qui est propriétaire, et que lit-on des règles. Deux temps, deux comptes (le serveur d'essai
// n'en connaît qu'un à la fois, GRIST_DEFAULT_EMAIL) : `PHASE=proprietaire` crée le document, le partage, y pose une règle et ajoute la sonde ; `PHASE=editeur` rouvre ce document sous un autre
// compte (relancer le serveur entre les deux : voir LISEZ-MOI.md, « Les droits »). L'état passe par un petit fichier.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say } from './lab-common.mjs';
import { GRIST, requireServer, newContext, createDocument, addWidget } from './lab-serveur.mjs';

const PORT = 8917;
const ADRESSE = `http://127.0.0.1:${PORT}/prototype/labo/droits/index.html`;
const ETAT = process.env.DROITS_ETAT || '/tmp/droits-etat.json';
const PHASE = process.env.PHASE || 'proprietaire';

const frameOf = page => page.frames().find(each => each.url().includes('/labo/droits/index.html'));
const rapport = async frame => { await frame.waitForFunction(() => document.getElementById('rapport').textContent.includes('"fin": true'), null, { timeout: 60000 }); return frame.locator('#rapport').innerText(); };

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR)).listen(PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi);
  const page = await context.newPage();
  if (PHASE === 'proprietaire') {
    const path = await createDocument(page);
    const id = path.split('/')[3];
    const call = (url, method, body) => page.evaluate(async ([url, method, body]) => (await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, [url, method, body]);
    say('partage', await call(`/api/docs/${id}/access`, 'PATCH', { delta: { users: { 'editor@example.com': 'editors', 'viewer@example.com': 'viewers' } } }));
    if (process.env.REGLE !== '0') say('règle', await call(`/api/docs/${id}/apply`, 'POST', [['AddRecord', '_grist_ACLResources', -1, { tableId: 'Clients', colIds: '*' }], ['AddRecord', '_grist_ACLRules', null, { resource: -1, aclFormula: 'user.Access == EDITOR', permissionsText: '-C', memo: 'GFS : Encadré' }]]));
    if (process.env.PARTAGE === '1') say('partage de page', await call(`/api/docs/${id}/apply`, 'POST', [['AddRecord', '_grist_Shares', null, { linkId: 'cle-secrete-0123456789', options: '{"publish":true}' }]]));
    await addWidget(page, path, ADRESSE);
    writeFileSync(ETAT, JSON.stringify({ path }));
  } else {
    const { path } = JSON.parse(readFileSync(ETAT, 'utf8'));
    await page.goto(`${GRIST}/`, { waitUntil: 'load' });
    await page.goto(`${GRIST}${path}`, { waitUntil: 'load' });
    await page.locator('.test-onboarding-popup').first().waitFor({ timeout: 8000 }).catch(() => {});
    await page.keyboard.press('Escape');
    await page.getByText('Clients', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    if (process.env.LISTE_PAGES) say(await page.locator('.test-treeview-itemHeader').allInnerTexts());
  }
  const frame = await (async () => { for (let i = 0; i < 60; i += 1) { const f = frameOf(page); if (f) return f; await page.waitForTimeout(500); } throw new Error('pas de cadre'); })();
  say(`--- ${PHASE} ---`, await page.evaluate(async () => (await (await fetch('/api/profile/user')).json()).email));
  say(await rapport(frame));
} finally {
  await browser.close();
  pages.close();
}
