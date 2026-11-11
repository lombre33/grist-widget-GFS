// La clé d'un lien de formulaire, vue de dehors (demande du porteur, 11/11 : « récupérer le lien du formulaire directement, sans que la personne aille le copier ? »). Dans un VRAI Grist (`bash vrai-serveur.sh`),
// sans widget : la personne d'essai publie deux formulaires comme le fait le bouton « Publier » de Form+ (`AddRecord _grist_Shares`, `UpdateRecord _grist_Pages.shareRef`, `UpdateRecord shareOptions`), puis on
// regarde, en visiteur anonyme (aucun cookie), ce que chaque adresse ouvre :
//   1. la clé de l'adresse (celle de `home.sqlite3`, que ni un widget ni le document ne voient) n'est pas le `linkId` que le document garde : l'adresse bâtie avec le `linkId` ne marche pas ;
//   2. la route publique `/api/s/<clé>/forms/<n>` répond pour le formulaire publié, et pas pour un autre que la clé ne couvre pas ;
//   3. deux pages qui portent la MÊME `shareRef` partagent la même clé : un seul « Copier le lien » pour les deux formulaires (ce que la règle 4a des contrats interdit à Form+ depuis le 04/11 : jamais deux formulaires sur le même partage).
//   REPO_DIR="$(realpath ../..)" node run-cle-partage.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, say, check } from './lab-common.mjs';
import { GRIST, requireServer, newContext, createDocument, docIdOf } from './lab-serveur.mjs';

const pluginApi = await requireServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi);
  const page = await context.newPage();
  const path = await createDocument(page);
  const docId = docIdOf(path);
  const call = (apply) => page.evaluate(async ([id, actions]) => {
    const response = await fetch(`/api/docs/${id}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(actions) });
    return response.json();
  }, [docId, apply]);
  const read = (table) => page.evaluate(async ([id, name]) => (await fetch(`/api/docs/${id}/sql`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: `select * from ${name}` }) })).json(), [docId, table]);

  await call([['AddTable', 'Reponses', [{ id: 'Nom', type: 'Text' }]], ['AddTable', 'Autres', [{ id: 'Nom', type: 'Text' }]]]);
  const tables = (await read('_grist_Tables')).records.map(row => row.fields);
  const refOf = id => tables.find(table => table.tableId === id).id;
  const first = (await call([['CreateViewSection', refOf('Reponses'), 0, 'form', null, 'Reponses']])).retValues[0];
  const second = (await call([['CreateViewSection', refOf('Autres'), 0, 'form', null, 'Autres']])).retValues[0];
  const pages = (await read('_grist_Pages')).records.map(row => ({ id: row.id, ...row.fields }));
  const pageOf = viewRef => pages.find(candidate => candidate.viewRef === viewRef);
  say('sections', JSON.stringify({ first, second }));

  // Publier la première comme le bouton de Form+.
  const linkId = 'a1b2c3d4-0000-4000-8000-000000000001';
  const share = (await call([['AddRecord', '_grist_Shares', null, { linkId, options: JSON.stringify({ publish: true }) }]])).retValues[0];
  await call([['UpdateRecord', '_grist_Pages', pageOf(first.viewRef).id, { shareRef: share }]]);
  await call([['UpdateRecord', '_grist_Views_section', first.sectionRef, { shareOptions: JSON.stringify({ publish: true, form: true }) }]]);
  await page.waitForTimeout(2500);

  // La clé que le serveur a tirée : dans sa base d'accueil (hors de portée d'un widget).
  const work = mkdtempSync(join(tmpdir(), 'cle-'));
  execFileSync('docker', ['cp', 'grist:/persist/home.sqlite3', join(work, 'home.sqlite3')]);
  const keyOf = id => execFileSync('python3', ['-c', 'import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);print(c.execute("select key from shares where link_id=?",(sys.argv[2],)).fetchone()[0])', join(work, 'home.sqlite3'), id]).toString().trim();
  const key = keyOf(linkId);
  say('clé du serveur :', key.length, 'caractères (jamais écrite dans le document)');
  const anonymous = async (route) => { const response = await fetch(`${GRIST}${route}`); return { status: response.status, ok: response.ok }; };

  check('le serveur tire la clé lui-même : elle n\'est pas le `linkId` du document', key !== linkId && !key.includes(linkId.slice(0, 8)), { linkId, key: `${key.slice(0, 3)}…` });
  check('la clé ouvre le formulaire publié en visiteur anonyme (`/api/s/<clé>/forms/<n>`)', (await anonymous(`/api/s/${key}/forms/${first.sectionRef}`)).ok, await anonymous(`/api/s/${key}/forms/${first.sectionRef}`));
  const withLinkId = await anonymous(`/api/s/${linkId}/forms/${first.sectionRef}`);
  check('l\'adresse bâtie avec le `linkId` que le document connaît ne marche pas', !withLinkId.ok, withLinkId);
  const documentTables = JSON.stringify(await read('_grist_Shares'));
  check('aucune table du document ne contient la clé (le `linkId` seul)', !documentTables.includes(key) && documentTables.includes(linkId), documentTables.slice(0, 160));
  const other = await anonymous(`/api/s/${key}/forms/${second.sectionRef}`);
  check('la même clé n\'ouvre pas un second formulaire non publié, d\'une autre page', !other.ok, other);

  // Le second formulaire sur le MÊME partage (la page porte la même `shareRef`) : une seule clé pour les deux.
  await call([['UpdateRecord', '_grist_Pages', pageOf(second.viewRef).id, { shareRef: share }]]);
  await call([['UpdateRecord', '_grist_Views_section', second.sectionRef, { shareOptions: JSON.stringify({ publish: true, form: true }) }]]);
  await page.waitForTimeout(2500);
  const sharedSecond = await anonymous(`/api/s/${key}/forms/${second.sectionRef}`);
  check('deux pages sur le même partage : la même clé ouvre aussi le second formulaire (un seul « Copier le lien » pour les deux)', sharedSecond.ok, sharedSecond);
  const post = await fetch(`${GRIST}/api/s/${key}/tables/Autres/records`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ records: [{ fields: { Nom: 'Visiteur' } }] }) });
  check('et la même clé laisse un visiteur ajouter une ligne dans la table du second (le coût : un lien qui fuit ouvre tous les formulaires du partage)', post.ok, { status: post.status });
} finally {
  await browser.close();
}
