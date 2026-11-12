// Combien de temps « Lecture des partages… » reste-t-elle à l'écran, au clic sur « Partager… » ? Mesuré dans GFS lui-même, dans un VRAI Grist (`bash vrai-serveur.sh`), à 700 × 400, à la vraie souris, sur un document dont le
// partage est activé (une ligne « tous » par fichier, comme à l'activation). Chaque `fetchTable` du cadre est chronométré (le nom de la table, la durée, le nombre de lignes), ainsi que chaque requête réseau du
// navigateur pendant l'attente : on voit d'où vient le temps (la preuve de propriété, les lectures de tables, la fenêtre).
//   FILES=n     nombre de fichiers de plus dans GFS_Fichiers avant l'activation (300 par défaut ; 0 = les deux fichiers d'essai) ;
//   LAB_LANG=fr|en, LAB_SCHEME=light|dark.
// REPO_DIR="$(realpath ../..)" FILES=2000 node run-partager-vitesse.mjs
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n/i18n.js';
import { PAGE_PORT, openGfs, importSamples, openRowMenu } from './lab-pdf.mjs';
import { gfsFrame } from './lab-droits.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const FILES = Number(process.env.FILES ?? 300);
const { t } = createI18n(lang);

// Des fichiers de plus dans la table de GFS (des lignes, sans pièce jointe : la liste et le partage ne lisent que les lignes), par l'API REST de la session de la page.
async function addFiles(run, count) {
  const stamp = new Date().toISOString();
  for (let from = 0; from < count; from += 500) {
    const records = Array.from({ length: Math.min(500, count - from) }, (_, i) => ({ fields: {
      Identifiant: `lab-${from + i}`, Nom: `Zz Essai ${String(from + i).padStart(5, "0")}.pdf`, Type: 'application/pdf', Auteur: 'owner@example.com', Taille: 1000, Origine: 'import' } }));
    const status = await run.page.evaluate(async ([doc, rows]) => (await fetch(`/api/docs/${doc}/tables/GFS_Fichiers/records`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ records: rows }) })).status, [run.docId, records]);
    if (status !== 200) throw new Error(`ajout de fichiers refusé : ${status}`);
  }
  return stamp;
}

// Ce que Grist échange avec la page pendant une attente : chaque requête du document (la méthode, la table, la durée jusqu'à la réponse, les octets reçus), lue sur les messages de la connexion de Grist.
// Ni le navigateur ni la distance n'y changent le nombre de requêtes ni leurs octets : c'est ce qui se multiplie par le temps d'aller-retour de l'instance de la personne.
const wire = [];
const watch = page => page.on('websocket', socket => {
  const open = new Map();
  socket.on('framesent', ({ payload }) => {
    try { const message = JSON.parse(String(payload)); if (message.method) open.set(message.reqId, { at: Date.now(), method: message.method, arg: typeof message.args?.[1] === 'string' ? message.args[1] : '' }); } catch (error) { /* pas du JSON */ }
  });
  socket.on('framereceived', ({ payload }) => {
    try { const message = JSON.parse(String(payload)); const sent = open.get(message.reqId); if (sent) { open.delete(message.reqId); wire.push({ ...sent, ms: Date.now() - sent.at, bytes: String(payload).length }); } } catch (error) { /* pas du JSON */ }
  });
});
// Les allers-retours que la personne attend l'un après l'autre : des requêtes qui partent avant que la précédente soit revenue sont dans le même.
const roundTrips = calls => {
  let trips = 0;
  let until = -Infinity;
  for (const call of [...calls].sort((a, b) => a.at - b.at)) {
    if (call.at >= until) { trips += 1; until = call.at + call.ms; } else until = Math.max(until, call.at + call.ms);
  }
  return trips;
};
const sentSince = since => wire.filter(call => call.at >= since && !/^(openDoc|getPluginUrl)/.test(call.method));
const summary = calls => calls.map(call => `${call.method}${call.arg ? `(${call.arg})` : ''} ${call.ms} ms ${Math.round(call.bytes / 1024)} Ko`);

// Une action de l'écran, chronométrée jusqu'à ce que `until` se montre, avec les requêtes du document vues pendant l'attente.
async function timed(label, act, until) {
  const begin = Date.now();
  await act();
  await until();
  const total = Date.now() - begin;
  const calls = sentSince(begin);
  const trips = roundTrips(calls);
  say(`${label} : ${total} ms ; ${calls.length} requêtes en ${trips} aller(s)-retour(s) l'un après l'autre, ${Math.round(calls.reduce((sum, call) => sum + call.bytes, 0) / 1024)} Ko : ${JSON.stringify(summary(calls))}`);
  return { total, calls, trips };
}

// Une ouverture de « Partager… » sur `name` : le temps jusqu'au contenu de la fenêtre.
async function timedOpen(frame, name) {
  await openRowMenu(frame, name);
  const entry = frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) });
  return timed(`« Partager… » sur ${name}`, () => entry.click(), () => frame.locator('.mod.sh .rt-content').waitFor({ timeout: 60000 }));
}

const closeShare = async frame => { await frame.locator('[data-fk="share-close"]').click(); await frame.locator('.mod.sh').waitFor({ state: 'detached' }); };

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  const run = await openGfs(context, { lang });
  watch(run.page);
  let { frame } = run;
  await importSamples(run);
  if (FILES > 0) await addFiles(run, FILES);
  await run.page.reload();
  frame = await gfsFrame(run.page);

  say(`--- activation du partage (${FILES + 2} fichiers) ---`);
  await openRowMenu(frame, 'Facture.pdf');
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('[data-fk="share-activate"]').click();
  await frame.locator('.mod.ask').waitFor();
  const wait = async old => { for (let i = 0; i < 480 && !old.isDetached(); i++) await run.page.waitForTimeout(250); return gfsFrame(run.page, { keep: true }); };
  const [reloaded] = await Promise.all([wait(frame), frame.locator('[data-fk="ask-yes"]').click()]);
  frame = reloaded;
  await frame.locator('.mod.sh .rt-content').waitFor({ timeout: 120000 });
  await closeShare(frame);
  const partages = (await run.rest.rows('GFS_Partages')).length;
  check('le partage est activé, une ligne de partage par fichier', partages >= FILES + 2, partages);

  say('--- 1. première ouverture de « Partager… » après le chargement de la page ---');
  await run.page.reload();
  frame = await gfsFrame(run.page);
  const first = await timedOpen(frame, 'Facture.pdf');
  await closeShare(frame);
  say('--- 2. seconde ouverture, même page ---');
  const second = await timedOpen(frame, 'Devis.pdf');
  say('--- 3. « Gérer les partages… » ---');
  const manage = await timed('« Gérer les partages… »', () => frame.locator('[data-fk="share-manage"]').click(), () => frame.locator('.mod.mg .rt-content').waitFor({ timeout: 60000 }));
  say('--- 4. créer un groupe ---');
  await frame.locator('[data-fk="manage-tab-groups"]').click();
  await frame.locator('[data-fk="manage-group-new"]').click();
  await frame.locator('[data-fk="manage-group-name"]').fill('Achats');
  await frame.locator('[data-fk="manage-group-people"]').fill('equipe@example.com\n');
  const group = await timed('créer le groupe « Achats »', () => frame.locator('[data-fk="manage-group-save"]').click(), () => frame.locator('.rr[data-group="Achats"]').waitFor({ timeout: 60000 }));
  say('--- 5. créer un espace ---');
  await frame.locator('[data-fk="manage-tab-spaces"]').click();
  await frame.locator('[data-fk="manage-space-new"]').click();
  await frame.locator('[data-fk="name-input"]').fill('Équipe UI');
  const space = await timed('créer l\'espace « Équipe UI »', () => frame.locator('[data-fk="name-ok"]').click(),
    () => frame.locator('.mod.mg .rr[data-space]').filter({ hasText: 'Équipe UI' }).waitFor({ timeout: 60000 }));
  say('--- 6. l\'espace créé est-il visible dans l\'explorateur, sans recharger la page ? ---');
  await frame.locator('[data-fk="manage-close"]').click();
  await frame.locator('.mod.mg').waitFor({ state: 'detached' });
  await closeShare(frame); // la fenêtre « Partager » revient à la fermeture de « Gérer les partages »
  await run.page.waitForTimeout(1500);
  const seen = async () => frame.evaluate(() => [...document.querySelectorAll('.tr-row, .ls-row.folder .nm .t')].map(node => node.textContent.replace(/\s+/g, ' ').trim()));
  const before = await seen();
  check('« Espaces » est dans l\'arbre dès la fermeture de la fenêtre, sans recharger la page', before.includes('Espaces'), before);
  await frame.locator('.tr-row', { hasText: /^Espaces$/ }).click();
  await run.page.waitForTimeout(500);
  const inside = await seen();
  check('l\'espace « Équipe UI » est dans la liste d\'« Espaces »', inside.includes('Équipe UI'), inside);
  await run.page.reload();
  frame = await gfsFrame(run.page);
  const after = await seen();
  say(`après rechargement : ${JSON.stringify(after)}`);
  say(`RÉSULTAT fichiers=${FILES + 2} partager=${first.calls.length} requêtes/${first.trips} aller-retour, gérer=${manage.calls.length}/${manage.trips}, groupe=${group.calls.length}/${group.trips}, espace=${space.calls.length}/${space.trips}`);
  check('aucune erreur de GFS dans la console', run.problems.filter(problem => !run.allow.some(known => known.test(problem))).length === 0, run.problems.slice(0, 3));
} finally {
  await browser.close();
  pages.close();
}
