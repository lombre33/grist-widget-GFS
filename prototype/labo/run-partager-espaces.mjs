// Les espaces partagés et « le plus précis gagne » (contrats 11.7, point 13, lot 4a) dans un VRAI Grist (`bash vrai-serveur.sh`), à trois comptes en trois temps (un seul compte à la fois, GRIST_EMAIL ; l'état passe par
// /tmp/partager-espaces-etat.json). Les fichiers sont les modèles de Publipostage+ (la table et les colonnes que l'app crée, `seed.mjs`). L'écran des espaces n'existe pas encore (lot 4b) : le propriétaire écrit les lignes
// (espace, placement, partages) par l'API, comme le fera l'écran, et on mesure ce que Grist en fait.
//   Le décor : le groupe Achats (editor@), l'espace « achats » (le groupe Achats en lecture), cinq modèles privés du propriétaire :
//     A (espace, dossier Contrats)  B (espace, Contrats ; editor@ « Aucun accès » sur le fichier)  C (espace, racine ; groupe Achats « Aucun accès » sur le fichier)
//     D (espace, Contrats/Sous ; viewer@ lecture sur le fichier)  E (hors espace, non partagé)
//     dossier Contrats : editor@ écriture ; dossier Contrats/Sous : groupe Achats lecture.
//   (lot 4b : l'écran des espaces est mesuré à la vraie souris dans la phase propriétaire, étape 4)
//   PHASE=proprietaire  active le partage (les tables d'espaces naissent avec lui), pose le décor, vérifie les listes calculées de Grist.
//   PHASE=editeur       editor@ : lit A (et l'écrit : le dossier Contrats lui donne l'écriture), lit D sans l'écrire (le dossier Sous, plus précis, rend la lecture au groupe), ne lit ni B (fichier) ni C (fichier, groupe) ni E ;
//                       voit l'espace achats ; ne lit pas les groupes ; n'écrit ni espaces ni placement.
//   PHASE=lecteur       viewer@ : lit D seulement (partage direct, il n'est pas dans l'espace) ; ne voit pas l'espace achats.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { seedFiles } from './seed.mjs';
import { PAGE_PORT, openGfs, openRowMenu } from './lab-pdf.mjs';
import { gfsFrame, shareWithEditorAndViewer } from './lab-droits.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const phase = process.env.PHASE || 'proprietaire';
const STATE = process.env.PARTAGER_ESPACES_ETAT || '/tmp/partager-espaces-etat.json';
const { t } = createI18n(lang);
const MODELS = 'Publipostage_Modeles';
const OWNER = 'essai@example.com', EDITOR = 'editor@example.com', VIEWER = 'viewer@example.com';
const FIRST = 'Contrat de prestation';
const NAMES = { A: 'Esp A dossier Contrats', B: 'Esp B refus fichier', C: 'Esp C refus groupe', D: 'Esp D sous-dossier', E: 'Esp E hors espace', F: 'Esp F rangé depuis l\'explorateur' };
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const call = (page, method, path, body) => page.evaluate(async ([m, p, b]) => {
  const response = await fetch(p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const text = await response.text();
  let json = null; try { json = JSON.parse(text); } catch { /* texte */ }
  return { status: response.status, json, text: text.slice(0, 400) };
}, [method, path, body]);
const apply = (run, actions) => call(run.page, 'POST', `/api/docs/${run.docId}/apply`, actions);
const rows = async (run, table) => { const answer = await call(run.page, 'GET', `/api/docs/${run.docId}/tables/${table}/records`); return answer.status === 200 ? answer.json.records.map(row => ({ id: row.id, ...row.fields })) : []; };
const modelNames = async run => (await rows(run, MODELS)).filter(row => row.TypeModele !== 'reglages').map(row => row.Nom).sort();
const byName = async run => Object.fromEntries((await rows(run, MODELS)).map(row => [row.Nom, row]));
const has = (list, who) => JSON.stringify(list || []).includes(who);

async function waitReload(page, old) {
  for (let i = 0; i < 240 && !old.isDetached(); i++) await page.waitForTimeout(250);
  return gfsFrame(page, { keep: true });
}

// L'écran : créer un espace, y mettre un groupe en écriture, « Aucun accès » à une personne sur un fichier, supprimer l'espace, à la vraie souris.
async function playScreen(run, frame, keyA) {
  say('--- 4. l\'écran des espaces (vraie souris) ---');
  await openRowMenu(frame, FIRST);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('.mod.sh .rt-content').waitFor();
  // « Aucun accès » à une personne sur un fichier (la fenêtre de partage)
  await frame.locator('[data-fk="share-add"]').click();
  await frame.locator('[data-fk="share-add"]').fill(EDITOR);
  await frame.locator(`[data-fk="share-pick-${EDITOR}"]`).click();
  await frame.locator('[data-fk="share-new-level"]').click();
  await frame.getByRole('menuitemradio', { name: new RegExp(t('share.right.aucun')) }).first().click();
  await frame.locator('[data-fk="share-confirm"]').click();
  await frame.locator('.mod.sh .rr[data-share]').filter({ hasText: EDITOR }).waitFor({ timeout: 15000 });
  const first = (await byName(run))[FIRST];
  const mine = (await rows(run, 'GFS_Partages')).find(row => row.Cible === `publipostage:${first.id}` && row.Personne === EDITOR);
  check('« Aucun accès » à editor@ s\'écrit, et Grist le met dans la liste des refus', mine && mine.Droit === 'aucun' && has(first.GFS_Refus, EDITOR), mine);
  // l'onglet Espaces
  await frame.locator('[data-fk="share-manage"]').click();
  await frame.locator('.mod.mg .rt-content').waitFor();
  await frame.locator('[data-fk="manage-tab-spaces"]').click();
  check('l\'espace du décor est listé', await frame.locator('.mod.mg .rr[data-space="achats"]').count() === 1);
  await frame.locator('[data-fk="manage-space-new"]').click();
  await frame.locator('[data-fk="name-input"]').fill('Équipe UI');
  await frame.locator('[data-fk="name-ok"]').click();
  await frame.locator('.mod.mg .rr[data-space]').filter({ hasText: 'Équipe UI' }).waitFor({ timeout: 15000 });
  const made = (await rows(run, 'GFS_Espaces')).find(row => row.Nom === 'Équipe UI');
  check('l\'espace créé par l\'écran a une clé', made && /^[a-z0-9-]+$/.test(made.Cle), made);
  await frame.locator(`[data-fk="manage-space-${made.Cle}"]`).click();
  await frame.locator('[data-fk="manage-space-add-group"]').click();
  await frame.locator('[data-fk="pick-Achats"]').click();
  await frame.locator('.mod.mg .rr[data-space-group="Achats"]').waitFor({ timeout: 15000 });
  await frame.locator('[data-fk="manage-space-group-Achats"]').click();
  await frame.getByRole('menuitemradio', { name: new RegExp(`^${t('share.right.ecriture')}`) }).first().click();
  await frame.locator('[data-fk="manage-space-group-Achats"]').filter({ hasText: t('share.right.ecriture') }).waitFor({ timeout: 15000 });
  const given = (await rows(run, 'GFS_Partages')).filter(row => row.Cible === `espace:${made.Cle}`);
  check('le groupe Achats a l\'écriture sur l\'espace créé', given.length === 1 && given[0].Personne === '#Achats' && given[0].Droit === 'ecriture', given);
  const seenSpace = (await rows(run, 'GFS_Espaces')).find(row => row.Cle === made.Cle);
  check('l\'espace voit l\'éditeur (membre du groupe Achats), pas le lecteur', has(seenSpace.Voit, EDITOR) && !has(seenSpace.Voit, VIEWER), seenSpace);
  await frame.locator('[data-fk="manage-space-remove"]').click();
  await frame.locator('[data-fk="ask-yes"]').click();
  await frame.locator('.mod.mg .rr[data-space]').filter({ hasText: 'Équipe UI' }).waitFor({ state: 'detached', timeout: 15000 });
  const left = (await rows(run, 'GFS_Partages')).filter(row => row.Cible === `espace:${made.Cle}`);
  check('supprimer l\'espace retire sa ligne et ses partages', !(await rows(run, 'GFS_Espaces')).some(row => row.Cle === made.Cle) && left.length === 0, left);
  await frame.locator('.mod.mg [data-fk="manage-close"]').click();
  // l'état laissé au temps de l'éditeur : editor@ n'a plus « Aucun accès » sur le premier modèle
  await frame.locator('.mod.sh .rr[data-share]').filter({ hasText: EDITOR }).waitFor();
  await frame.locator('[data-fk="share-close"]').click();
  void keyA;
  return frame;
}

// L'explorateur : « Espaces » à côté de « Moi », ranger un modèle dans le dossier d'un espace (Déplacer vers…), le ressortir, le remettre ; le rangement de la personne ne reçoit jamais le chemin de l'espace.
async function playExplorer(run, frame) {
  say('--- 5. l\'explorateur : ranger dans un espace (vraie souris) ---');
  const { page } = run;
  await page.reload();
  frame = await gfsFrame(page);
  await frame.locator('.ls-row').first().waitFor();
  check('« Espaces » est une racine du volet, à côté de « Moi »', await frame.locator('.tr-row[data-path="Espaces"]').count() === 1 && await frame.locator('.tr-row[data-path=""]').count() === 1);
  check('« Moi » ne liste pas « Espaces » parmi ses dossiers', await frame.locator('.ls-row.folder[data-key="dir:Espaces"]').count() === 0);
  const move = async path => {
    await openRowMenu(frame, NAMES.F);
    await frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.move')}`) }).click();
    await frame.locator(`[data-fk="move-${path || 'root'}"]`).click();
  };
  const placed = async () => (await rows(run, 'GFS_Placement')).find(row => row.Cible === `publipostage:${models_F_id}`);
  const models_F_id = (await byName(run))[NAMES.F].id;
  await move('Espaces/Achats/Contrats');
  for (let i = 0; i < 40 && !(await placed()); i++) await page.waitForTimeout(250);
  const row = await placed();
  check('« Déplacer vers… » un dossier d\'espace écrit le placement', row && row.Espace === 'achats' && row.Dossier === 'Contrats', row);
  const mine = await rows(run, 'GFS_Rangement');
  check('le rangement de la personne ne reçoit jamais le chemin d\'un espace', mine.every(line => !String(line.Dossier || '').startsWith('Espaces')), mine.map(line => line.Dossier));
  await frame.locator('.tr-row[data-path="Espaces"]').click();
  await frame.locator('.ls-row.folder[data-key="dir:Espaces/Achats"]').waitFor();
  await frame.locator('.ls-row.folder[data-key="dir:Espaces/Achats"]').dblclick();
  await frame.locator('.ls-row.folder[data-key="dir:Espaces/Achats/Contrats"]').waitFor();
  await frame.locator('.ls-row.folder[data-key="dir:Espaces/Achats/Contrats"]').dblclick();
  await frame.locator('.ls-row:not(.folder)').filter({ hasText: NAMES.F }).waitFor();
  const crumbs = (await frame.locator('nav.crumbs').innerText()).replace(/\s+/g, ' ');
  check('le fil d\'Ariane part d\'« Espaces », pas de « Moi »', crumbs.includes(t('ex.spaces')) && crumbs.includes('Contrats') && !crumbs.includes(t('ex.me')), crumbs);
  await move('');
  for (let i = 0; i < 40 && (await placed()); i++) await page.waitForTimeout(250);
  check('le ressortir retire le placement', !(await placed()));
  await frame.locator('.tr-row[data-path=""]').click();
  await move('Espaces/Achats/Contrats');
  for (let i = 0; i < 40 && !(await placed()); i++) await page.waitForTimeout(250);
  check('et le remettre l\'écrit de nouveau (il reste dans l\'espace pour les autres comptes)', Boolean(await placed()));
  return frame;
}

async function playOwner(run) {
  const { page } = run;
  let { frame } = run;
  say('--- 0. les modèles de l\'app ---');
  await seedFiles(frame);
  await page.reload();
  frame = await gfsFrame(page);
  await frame.locator('.ls-row').first().waitFor();

  say('--- 1. activer le partage : les tables d\'espaces naissent avec lui ---');
  await openRowMenu(frame, FIRST);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('[data-fk="share-activate"]').click();
  await frame.locator('.mod.ask').waitFor();
  await Promise.all([waitReload(page, frame).then(next => { frame = next; }), frame.locator('[data-fk="ask-yes"]').click()]);
  await frame.locator('.mod.sh .rt-content').waitFor({ timeout: 40000 });
  const tables = ((await call(page, 'GET', `/api/docs/${run.docId}/tables`)).json.tables || []).map(table => table.id);
  check('GFS_Espaces et GFS_Placement sont créées avec le partage', tables.includes('GFS_Espaces') && tables.includes('GFS_Placement') && tables.includes('GFS_Groupes'), tables);
  const columns = ((await call(page, 'GET', `/api/docs/${run.docId}/tables/${MODELS}/columns`)).json.columns || []).map(column => column.id);
  check('la table de l\'app porte GFS_Calc, GFS_Refus et les listes d\'aide', ['GFS_Calc', 'GFS_Refus', 'GFS_Lecteurs', 'GFS_Ecrivains', 'GFS_Admins'].every(id => columns.includes(id)), columns);
  await frame.locator('[data-fk="share-close"]').click();

  say('--- 2. le décor : groupe, espace, placement, partages ---');
  const now = Math.floor(Date.now() / 1000);
  const keys = Object.values(NAMES);
  let answer = await apply(run, [['BulkAddRecord', MODELS, keys.map(() => null), { Nom: keys, TypeModele: keys.map(() => 'document'), DateModif: keys.map(() => now) }]]);
  check('six modèles privés créés par le propriétaire (F attend d\'être rangé depuis l\'explorateur)', answer.status === 200, answer.text);
  const models = await byName(run);
  const key = letter => `publipostage:${models[NAMES[letter]].id}`;
  answer = await apply(run, [
    ['AddRecord', 'GFS_Groupes', null, { Nom: 'Achats', PersonnesIci: EDITOR }],
    ['AddRecord', 'GFS_Espaces', null, { Cle: 'achats', Nom: 'Achats' }],
    ['BulkAddRecord', 'GFS_Placement', [null, null, null, null], { Cible: [key('A'), key('B'), key('C'), key('D')], Espace: ['achats', 'achats', 'achats', 'achats'], Dossier: ['Contrats', 'Contrats', '', 'Contrats/Sous'] }],
    ['BulkAddRecord', 'GFS_Partages', [null, null, null, null, null, null], {
      Cible: ['espace:achats', key('B'), 'dossier:achats/Contrats', 'dossier:achats/Contrats/Sous', key('D'), key('C')],
      Personne: ['#Achats', EDITOR, EDITOR, '#Achats', VIEWER, '#Achats'],
      Droit: ['lecture', 'aucun', 'ecriture', 'lecture', 'lecture', 'aucun'],
    }],
  ]);
  check('le décor s\'écrit en une opération', answer.status === 200, answer.text);
  const space = (await rows(run, 'GFS_Espaces'))[0];
  check('l\'espace « achats » voit l\'éditeur (le groupe Achats y est en lecture), pas le lecteur', space && has(space.Voit, EDITOR) && !has(space.Voit, VIEWER), space);

  say('--- 3. les listes que Grist calcule pour chaque fichier ---');
  const all = await byName(run);
  const calc = letter => all[NAMES[letter]];
  check('A : l\'éditeur écrit (dossier Contrats, personne), le lecteur ne voit rien', has(calc('A').GFS_Lecteurs, EDITOR) && has(calc('A').GFS_Ecrivains, EDITOR) && !has(calc('A').GFS_Lecteurs, VIEWER), calc('A').GFS_Calc);
  check('B : « Aucun accès » au fichier retire l\'éditeur, malgré l\'espace et le dossier', has(calc('B').GFS_Refus, EDITOR) && !has(calc('B').GFS_Lecteurs, EDITOR) && !has(calc('B').GFS_Ecrivains, EDITOR), calc('B').GFS_Calc);
  check('C : « Aucun accès » au groupe sur le fichier le retire à l\'éditeur (le fichier passe avant l\'espace)', has(calc('C').GFS_Refus, EDITOR) && !has(calc('C').GFS_Lecteurs, EDITOR), calc('C').GFS_Calc);
  check('D : le sous-dossier (groupe en lecture) est plus précis que Contrats (personne en écriture) : lecture seule', has(calc('D').GFS_Lecteurs, EDITOR) && !has(calc('D').GFS_Ecrivains, EDITOR), calc('D').GFS_Calc);
  check('D : le lecteur lit par son partage direct sur le fichier, sans être dans l\'espace', has(calc('D').GFS_Lecteurs, VIEWER) && !has(calc('D').GFS_Ecrivains, VIEWER), calc('D').GFS_Calc);
  check('E : hors espace, non partagé : le propriétaire seul', !has(calc('E').GFS_Lecteurs, EDITOR) && !has(calc('E').GFS_Lecteurs, VIEWER) && has(calc('E').GFS_Lecteurs, OWNER), calc('E').GFS_Calc);
  frame = await playScreen(run, frame, key('A'));
  frame = await playExplorer(run, frame);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
  writeFileSync(STATE, JSON.stringify({ path: run.path, docId: run.docId }));
}

async function playEditor(run) {
  const { page } = run;
  say('--- éditeur ---');
  const seen = await modelNames(run);
  check('il lit A, D et F (rangé depuis l\'explorateur dans le dossier Contrats), ni B (refus du fichier) ni C (refus du groupe) ni E (non partagé)', seen.includes(NAMES.A) && seen.includes(NAMES.D) && seen.includes(NAMES.F) && ![NAMES.B, NAMES.C, NAMES.E].some(name => seen.includes(name)), seen.filter(name => name.startsWith('Esp')));
  const models = await byName(run);
  let answer = await apply(run, [['UpdateRecord', MODELS, models[NAMES.A].id, { ModifiePar: 'editeur' }]]);
  check('il écrit A : le dossier Contrats lui donne l\'écriture', answer.status === 200, answer.text);
  answer = await apply(run, [['UpdateRecord', MODELS, models[NAMES.D].id, { ModifiePar: 'editeur' }]]);
  check('il n\'écrit pas D : le sous-dossier, plus précis, ne lui laisse que la lecture', answer.status !== 200, answer.text);
  check('« Aucun accès » posé par l\'écran cache le premier modèle à l\'éditeur', !seen.includes(FIRST), seen.filter(name => name === FIRST));
  const spaces = await rows(run, 'GFS_Espaces');
  check('il voit l\'espace achats', spaces.length === 1 && spaces[0].Nom === 'Achats', spaces);
  const groups = await call(page, 'GET', `/api/docs/${run.docId}/tables/GFS_Groupes/records`);
  check('il ne lit pas les adresses des groupes', !groups.text.includes('example.com'), groups.text.slice(0, 160));
  answer = await apply(run, [['AddRecord', 'GFS_Espaces', null, { Cle: 'pirate', Nom: 'Pirate' }]]);
  check('il ne crée pas d\'espace', answer.status !== 200, answer.text);
  answer = await apply(run, [['AddRecord', 'GFS_Placement', null, { Cible: 'publipostage:1', Espace: 'achats', Dossier: '' }]]);
  check('il ne place pas un fichier dans l\'espace', answer.status !== 200, answer.text);
  // l'explorateur de l'éditeur : « Espaces » est là, le fichier rangé par le propriétaire aussi ; ranger ailleurs est réservé au propriétaire
  const frame = run.frame;
  await frame.locator('.ls-row').first().waitFor();
  check('l\'éditeur voit « Espaces » dans le volet, avec l\'espace Achats', await frame.locator('.tr-row[data-path="Espaces"]').count() === 1);
  await frame.locator('.tr-row[data-path="Espaces"]').click();
  await frame.locator('.ls-row.folder[data-key="dir:Espaces/Achats"]').dblclick();
  await frame.locator('.ls-row.folder[data-key="dir:Espaces/Achats/Contrats"]').dblclick();
  await frame.locator('.ls-row:not(.folder)').filter({ hasText: NAMES.F }).waitFor({ timeout: 15000 });
  check('il y trouve le fichier que le propriétaire y a rangé', true);
  await openRowMenu(frame, NAMES.F);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('ex.move')}`) }).click();
  await frame.locator('[data-fk="move-root"]').click();
  await frame.getByText(t('ex.spaceOwnersOnly')).waitFor({ timeout: 15000 });
  check('l\'éditeur ne sort pas un fichier de l\'espace : seul un propriétaire range dans un espace', (await rows(run, 'GFS_Placement')).some(row => row.Dossier === 'Contrats' && row.Cible.startsWith('publipostage:')));
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

async function playViewer(run) {
  say('--- lecteur ---');
  const seen = await modelNames(run);
  check('il lit D (partage direct) et aucun autre fichier de l\'espace', seen.includes(NAMES.D) && ![NAMES.A, NAMES.B, NAMES.C, NAMES.E, NAMES.F].some(name => seen.includes(name)), seen.filter(name => name.startsWith('Esp')));
  const spaces = await rows(run, 'GFS_Espaces');
  check('il ne voit pas l\'espace achats (il n\'est dans aucun groupe de l\'espace)', spaces.length === 0, spaces);
  check('aucune erreur de GFS dans la console', unexpected(run).length === 0, unexpected(run));
}

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  if (phase === 'proprietaire') {
    const run = await openGfs(context, { lang });
    await shareWithEditorAndViewer(run.page, run.docId);
    await playOwner(run);
  } else {
    const { path } = JSON.parse(readFileSync(STATE, 'utf8'));
    const run = await openGfs(context, { lang, path });
    await (phase === 'editeur' ? playEditor : playViewer)(run);
  }
} finally {
  await browser.close();
  pages.close();
}
