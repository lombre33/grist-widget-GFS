// « Mots-clés des publications » de Grist-BI avec la VRAIE app (référence 92da65c), dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`), à 700 × 400 : ce que l'app
// demandait à GFS dans « Demandes à GFS » (`jeton` et `ecrit`) et n'avait « jamais rejoué contre un vrai document ». Les gestes sont ceux de js/grist-api.js de l'app (`GristBI.api`),
// appelés dans son sous-cadre isolé (origine « null »), après « Apps > Grist-BI » et « Nouveau > Rapport BI » à la vraie souris.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-bi-jeton.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   1. Le document porte une table « Publications » (un titre, un PDF joint) : le PDF est celui d'un envoi de la personne dans Grist.
//   2. `getAccessToken({ readOnly: true })` : la forme de la réponse (`token`, `baseUrl`, `ttlMsecs`), et `checkAttachmentAccess` de l'app dit « accès donné ».
//   3. `getAttachmentBytes` : les octets du PDF, octet pour octet, par `GET <baseUrl>/attachments/<id>/download?auth=<jeton>` depuis le sous-cadre ; un numéro qui n'existe pas dit son code HTTP.
//   4. L'écriture : `AddColumn` d'une colonne de texte dans la table de la personne (sans formule), l'identifiant RÉEL relu quand le nom est pris, puis `UpdateRecord` ; la colonne et les
//      valeurs sont dans le document ; GFS refuse `ModifyColumn` et une colonne dans une table de GFS, sans rien écrire.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { PAGE_PORT, sha256, openGfs, pdfFile, waitFor, settle, closeModules } from './lab-pdf.mjs';
import { installApp } from './lab-gestes.mjs';
import { apply, rowsOf } from './lab-rest.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const APP_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/apps/bi/`;
const NEW = lang === 'fr' ? /^Rapport BI/ : /^BI report/;
const TABLE = 'Publications';
const appFrame = page => page.frames().find(frame => frame.url().startsWith(APP_URL) && !frame.isDetached());

// ----- 1. Une table de la personne, avec une pièce jointe (l'envoi est celui de Grist : GFS n'y touche pas).
async function prepare(run) {
  const { page, docId } = run;
  say('--- 1. une table « Publications » avec un PDF joint ---');
  run.pdf = pdfFile('Rapport.pdf', 2, 'Rapport annuel');
  const answered = await apply(run, [['AddTable', TABLE, [{ id: 'Titre', type: 'Text' }, { id: 'Fichier', type: 'Attachments' }]]]);
  check('Grist crée la table de la personne', answered.status === 200, answered.text);
  run.attachment = await page.evaluate(async ([id, bytes]) => {
    const form = new FormData();
    form.append('upload', new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), 'Rapport.pdf');
    return (await (await fetch(`/api/docs/${id}/attachments`, { method: 'POST', body: form, headers: { 'X-Requested-With': 'XMLHttpRequest' } })).json())[0];
  }, [docId, [...run.pdf.file.buffer]]);
  await apply(run, [['AddRecord', TABLE, null, { Titre: 'Rapport annuel', Fichier: ['L', run.attachment] }], ['AddRecord', TABLE, null, { Titre: 'Sans fichier' }]]);
  const rows = await rowsOf(run, TABLE);
  check('la ligne porte la pièce jointe', rows.length === 2 && Array.isArray(rows[0].Fichier) && rows[0].Fichier.includes(run.attachment), rows);
  return rows;
}

// ----- l'app, installée puis ouverte comme la personne le fait.
async function openBi(run) {
  const { page, frame } = run;
  if (await frame.locator('#floater-apps').isVisible()) await frame.locator('#floater-apps').click();
  else await frame.locator('.ex-title-row .tb', { hasText: /Apps/ }).click();
  await frame.locator('.mod').waitFor();
  await installApp(frame, 'bi');
  await settle(page, frame);
  await closeModules(page, frame);
  await frame.locator('.btn.primary').click();
  await frame.locator('.menu').waitFor();
  await frame.locator('.menu-item', { hasText: NEW }).first().click();
  await waitFor(page, 'Grist-BI démarre', async () => {
    const each = appFrame(page);
    return Boolean(each) && await each.evaluate(() => typeof GristBI !== 'undefined' && Boolean(GristBI.api) && typeof grist !== 'undefined');
  }, 60000);
  return appFrame(page);
}

// ----- 2 et 3. Le jeton de lecture et le téléchargement, depuis le sous-cadre.
async function playToken(run, app) {
  say('--- 2. le jeton de lecture ---');
  const access = await app.evaluate(async () => {
    const answer = await grist.docApi.getAccessToken({ readOnly: true });
    return { keys: Object.keys(answer).sort(), token: typeof answer.token, base: String(answer.baseUrl), ttl: answer.ttlMsecs, origin: window.origin };
  });
  console.log('MESURE  getAccessToken :', JSON.stringify({ ...access, base: access.base.replace(/\/o\/docs\/api\/docs\/.*/, '/o/docs/api/docs/…') }));
  check('la réponse porte `token`, `baseUrl` et `ttlMsecs`, comme l\'app l\'écrit (le sous-cadre est d\'origine « null »)', access.keys.join() === 'baseUrl,token,ttlMsecs' && access.token === 'string' &&
    /\/api\/docs\//.test(access.base) && Number(access.ttl) > 0 && access.origin === 'null', access);
  const check1 = await app.evaluate(() => GristBI.api.checkAttachmentAccess());
  check('`checkAttachmentAccess` de l\'app dit « accès donné » (le manifeste de GFS déclare `jeton`)', check1.ok === true, check1);
  say('--- 3. le PDF joint, octet pour octet ---');
  const bytes = await app.evaluate(async id => Array.from(new Uint8Array(await GristBI.api.getAttachmentBytes(id))), run.attachment);
  const buffer = Buffer.from(bytes);
  check('`getAttachmentBytes` rend les octets du PDF joint, octet pour octet', buffer.length === run.pdf.size && sha256(buffer) === run.pdf.hash, { taille: buffer.length, attendu: run.pdf.size });
  const missing = await app.evaluate(() => GristBI.api.getAttachmentBytes(99999).then(() => null, error => ({ code: error.code, message: error.message })));
  check('un numéro qui n\'existe pas lève une erreur qui dit le code HTTP (404 chez Grist)', Boolean(missing) && missing.code === 'ATTACHMENT_HTTP' && /404/.test(missing.message), missing);
}

// ----- 4. L'écriture dans la table de la personne.
async function playWrite(run, app, rows) {
  say('--- 4. une colonne de texte dans la table de la personne ---');
  const colId = await app.evaluate(table => GristBI.api.addTextColumn(table, 'MotsCles'), TABLE);
  check('`AddColumn` : la colonne naît sous son nom', colId === 'MotsCles', colId);
  const again = await app.evaluate(table => GristBI.api.addTextColumn(table, 'MotsCles'), TABLE);
  check('un nom déjà pris : l\'app relit l\'identifiant RÉEL que Grist rend (jamais le nom demandé)', again !== 'MotsCles' && /^MotsCles/.test(again), again);
  await app.evaluate(([table, col, id]) => GristBI.api.writeColumnValues(table, col, [{ id, value: 'budget, rapport, 2026' }]), [TABLE, colId, rows[0].id]);
  const after = await rowsOf(run, TABLE);
  check('`UpdateRecord` : la valeur est dans la cellule de la ligne, l\'autre ligne n\'a pas bougé', after[0][colId] === 'budget, rapport, 2026' && !after[1][colId], after.map(row => row[colId]));
  const refused = await app.evaluate(async table => {
    const attempt = actions => grist.docApi.applyUserActions(actions).then(() => 'passé', error => String((error && error.message) || error).slice(0, 160));
    return { modify: await attempt([['ModifyColumn', table, 'MotsCles', { type: 'Int' }]]), gfs: await attempt([['AddColumn', 'GFS_Fichiers', 'Intrus', { type: 'Text' }]]) };
  }, TABLE);
  check('GFS refuse `ModifyColumn` et une colonne dans une table de GFS (GFS_REFUSE), sans rien écrire', /GFS_REFUSE|refus|Verbe|réservée/i.test(refused.modify) && /GFS_REFUSE|refus|réservée/i.test(refused.gfs), refused);
  const gfsRows = await rowsOf(run, 'GFS_Fichiers');
  check('GFS_Fichiers n\'a pas de colonne en plus (rien n\'a été écrit)', gfsRows === null || gfsRows.every(row => !Object.keys(row).includes('Intrus')), gfsRows && gfsRows.length);
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, mirrors: true });
  check(`GFS est à 700 × 400 dans le vrai Grist (${lang}, ${scheme})`, Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  const rows = await prepare(run);
  const app = await openBi(run);
  check('Grist-BI s\'ouvre dans le sous-cadre isolé', Boolean(app) && await app.evaluate(() => window.origin) === 'null');
  await playToken(run, app);
  await playWrite(run, app, rows);
  // Les deux refus que l'essai a provoqués lui-même (ModifyColumn, une table de GFS) sont dits dans la console de GFS : ils sont attendus, pas les autres.
  const provoked = /GFS : bi : GristDocAPI\.applyUserActions refusé \(GFS_REFUSE\) : Action 1 refusée : (Le verbe ModifyColumn|La table GFS_Fichiers est réservée)/;
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)) && !provoked.test(problem));
  check('aucune erreur ni avertissement de GFS dans la console (hors les deux refus que l\'essai a provoqués), ni violation de politique', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
