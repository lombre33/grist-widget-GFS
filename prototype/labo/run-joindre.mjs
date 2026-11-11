// Joindre le PDF d'une ligne à sa cellule « Pièces jointes » (contrats 2.7 point 7, 5.4 point 12), joué dans un VRAI serveur Grist (l'image officielle, `bash vrai-serveur.sh`) : une app (la sonde J,
// `labo/sondes/j-joindre/`, qui fait ce que fera Publipostage+) fabrique ses PDF DANS SON CADRE ISOLÉ et les donne à GFS, qui les envoie à Grist et écrit la cellule. Ce que le serveur retient (cellules,
// pièces jointes, octets) est lu par l'API REST. Chromium seulement.
//   bash vrai-serveur.sh && REPO_DIR="$(realpath ../..)" node run-joindre.mjs        (LAB_LANG=fr|en, LAB_SCHEME=light|dark)
//   LAB_KIT=1 : la même mesure avec la sonde J kit (`kit.html`), qui parle à GFS par le VRAI client du kit (`GfsLink.attach`, le sous-module `prototype/kit`) au lieu d'une enveloppe écrite à la main.
//   1. Un PDF à une ligne : la cellule le cite, ses octets sont ceux de l'app (même empreinte), le nom est gardé, le rapport est sans problème.
//   2. Le mode « remplacer » (par défaut) retire de la cellule le fichier de même nom (il reste dans la liste des pièces jointes du document), « ajouter » garde tout.
//   3. Plusieurs fichiers dans une cellule, plusieurs lignes dans un appel : l'ordre est gardé.
//   4. Une ligne qui n'existe pas : échec de cette ligne, les autres sont jointes.
//   5. Une colonne absente, d'un autre type ou à formule : rien n'est envoyé.
//   6. Ce que GFS refuse avant d'envoyer : une table de GFS ou interne, un contenu qui n'est pas un PDF.
//   7. Le serveur refuse (413), le réseau tombe : le rapport le dit, rien n'est écrit, l'appel suivant réussit.
//   8. Une pièce jointe ajoutée dans Grist pendant l'envoi n'est pas perdue (la colonne est relue juste avant d'écrire).
//   9. Une règle d'accès de Grist qui refuse d'écrire la colonne : « refus », rien n'est écrit (ce que GFS dit, c'est ce que Grist a refusé).
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check, probeDeclares } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { makePdf } from './pdf-fixture.mjs';
import { PAGE_PORT, sha256, openGfs, settle, closeModules } from './lab-pdf.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const KIT = process.env.LAB_KIT === '1';
const ID = KIT ? 'sonde-jk' : 'sonde-j';
const GFS_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/index.html`;
const PROBE_URL = `http://127.0.0.1:${PAGE_PORT}/prototype/labo/sondes/j-joindre/`;
const ALWAYS = probeDeclares(ID, { permanente: true });

const pdfItem = (ligne, nom, title) => {
  const buffer = makePdf({ pages: 1, title });
  return { ligne, nom, b64: buffer.toString('base64'), hash: sha256(buffer) };
};
const probeFrame = page => page.frames().find(frame => frame.url().startsWith(PROBE_URL) && !frame.isDetached());
const joindre = (page, demande) => probeFrame(page).evaluate(request => window.sondeJ.joindre(request), demande);
const ask = (table, colonne, fichiers, over = {}) => ({ table, colonne, fichiers, ...over });
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Ce que la personne ou le serveur avait déjà, semé par l'API REST de Grist (la page de Grist est de l'origine du serveur : aucun jeton).
const apply = (page, docId, actions) => page.evaluate(async ([id, body]) => (await fetch(`/api/docs/${id}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify(body) })).json(), [docId, actions]);
const upload = (page, docId, name, b64) => page.evaluate(async ([id, fileName, data]) => {
  const form = new FormData();
  form.append('upload', new File([Uint8Array.from(atob(data), char => char.charCodeAt(0))], fileName, { type: 'application/pdf' }));
  return (await (await fetch(`/api/docs/${id}/attachments`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, body: form })).json())[0];
}, [docId, name, b64]);
// Une requête SQL en lecture sur le document (les tables internes de Grist ne passent pas par /tables) : la liste des `id` trouvés.
const sql = (page, docId, query) => page.evaluate(async ([id, q]) => (await (await fetch(`/api/docs/${id}/sql?q=${encodeURIComponent(q)}`)).json()).records.map(record => record.fields.id), [docId, query]);
const cell = async (rest, row, column = 'Pdf') => (await rest.rows('Clients')).find(each => each.id === row)[column];
const snapshot = async rest => ({ attachments: (await rest.attachments()).length, cells: (await rest.rows('Clients')).map(row => row.Pdf) });

async function setup(run) {
  const { page, frame, docId, rest } = run;
  say('--- 0. la sonde J et un document avec une colonne Pièces jointes ---');
  await apply(page, docId, [
    ['AddColumn', 'Clients', 'Pdf', { type: 'Attachments' }], ['AddColumn', 'Clients', 'Texte', { type: 'Text' }],
    ['AddColumn', 'Clients', 'Calcul', { type: 'Attachments', isFormula: true, formula: '$Pdf' }],
    ['BulkAddRecord', 'Clients', [null, null], { Nom: ['Martin', 'Durand'] }],
  ]);
  const old = pdfItem(2, 'Facture.pdf', 'Ancienne facture');
  const oldId = await upload(page, docId, 'Facture.pdf', old.b64);
  const other = pdfItem(2, 'Autre.pdf', 'Autre');
  const otherId = await upload(page, docId, 'Autre.pdf', other.b64);
  await apply(page, docId, [['UpdateRecord', 'Clients', 2, { Pdf: ['L', oldId, otherId] }]]);
  run.seed = { oldId, otherId };
  check('le document a trois lignes et la ligne 2 porte déjà deux pièces jointes', (await rest.rows('Clients')).length === 3 && sameJson(await cell(rest, 2), ['L', oldId, otherId]), await cell(rest, 2));
  check('la sonde J est ouverte dans son cadre isolé et a reçu son contexte', await openProbe(run));
}

// Ouvre la sonde J par la fenêtre « Apps » (comme la personne) et attend son contexte ; vrai quand elle l'a reçu.
const hasContext = page => probeFrame(page) && probeFrame(page).evaluate(() => JSON.parse(document.body.dataset.sonde || '{}').contexte === true).catch(() => false);
async function openProbe({ page, frame }) {
  await frame.locator('.tb', { hasText: t('gfs.apps') }).first().click();
  await frame.locator('.mod').waitFor();
  await frame.locator(`[data-open="${ID}"]`).click();
  for (let i = 0; i < 60 && !(await hasContext(page)); i++) await page.waitForTimeout(250);
  return Boolean(await hasContext(page));
}

async function playFirst(run) {
  const { page, rest } = run;
  say('--- 1. un PDF à une ligne ---');
  const item = pdfItem(1, 'Devis.pdf', 'Devis un');
  const answer = await joindre(page, ask('Clients', 'Pdf', [item]));
  check('la réponse : colonne, aucun problème, un fichier joint sans remplacement', answer.ok && sameJson(answer.data, { colonne: 'Pdf', probleme: null, joints: [{ index: 0, remplace: false }], echecs: [] }), answer);
  const joined = await cell(rest, 1);
  check('la cellule de la ligne 1 cite une pièce jointe', Array.isArray(joined) && joined[0] === 'L' && joined.length === 2, joined);
  const kept = await rest.attachment(joined[1]);
  check('Grist garde les octets de l\'app (le File fabriqué dans le cadre isolé), type PDF, même empreinte', kept.status === 200 && kept.hash === item.hash && /pdf/.test(kept.type), kept);
  check('le nom gardé est celui que l\'app a donné', (await rest.attachments()).some(each => each.id === joined[1] && each.name === 'Devis.pdf'));
  check('GFS ne touche ni la ligne 3 ni les autres colonnes', (await cell(rest, 3)) === null || (await cell(rest, 3)).length <= 1, await cell(rest, 3));
}

async function playModes(run) {
  const { page, rest } = run;
  const { oldId, otherId } = run.seed;
  say('--- 2. remplacer et ajouter ---');
  const before = (await rest.attachments()).length;
  const replaced = await joindre(page, ask('Clients', 'Pdf', [pdfItem(2, 'facture.PDF', 'Nouvelle facture')]));
  const row = await cell(rest, 2);
  check('« remplacer » : la facture de même nom (casse ignorée) sort de la cellule, l\'autre pièce reste, le nouveau est à la fin', replaced.ok && sameJson(replaced.data.joints, [{ index: 0, remplace: true }]) && row.length === 3 && row[1] === otherId && !row.includes(oldId), { replaced, row });
  check('l\'ancienne pièce jointe reste dans la liste des pièces jointes du document', (await rest.attachments()).some(each => each.id === oldId) && (await rest.attachments()).length === before + 1, (await rest.attachments()).length);
  const added = await joindre(page, ask('Clients', 'Pdf', [pdfItem(2, 'facture.PDF', 'Encore')], { mode: 'ajouter' }));
  const again = await cell(rest, 2);
  check('« ajouter » : le même nom s\'ajoute à la suite, rien ne sort', added.ok && sameJson(added.data.joints, [{ index: 0, remplace: false }]) && again.length === 4 && sameJson(again.slice(0, 3), row), { added, again });
}

async function playMany(run) {
  const { page, rest } = run;
  say('--- 3. plusieurs fichiers, plusieurs lignes ---');
  const answer = await joindre(page, ask('Clients', 'Pdf', [pdfItem(3, 'A.pdf', 'A'), pdfItem(1, 'B.pdf', 'B'), pdfItem(3, 'C.pdf', 'C')]));
  const [first, third] = [await cell(rest, 1), await cell(rest, 3)];
  const names = new Map((await rest.attachments()).map(each => [each.id, each.name]));
  check('trois fichiers joints, un par un dans la réponse', answer.ok && answer.data.joints.length === 3 && answer.data.echecs.length === 0 && answer.data.probleme === null, answer);
  check('la ligne 3 reçoit A puis C dans la même cellule, la ligne 1 reçoit B à la suite de son devis', sameJson(third.slice(1).map(id => names.get(id)), ['A.pdf', 'C.pdf']) && sameJson(first.slice(1).map(id => names.get(id)), ['Devis.pdf', 'B.pdf']), { first, third });
}

async function playMissingRow(run) {
  const { page, rest } = run;
  say('--- 4. une ligne qui n\'existe pas ---');
  const before = await cell(rest, 3);
  const answer = await joindre(page, ask('Clients', 'Pdf', [pdfItem(99, 'Perdu.pdf', 'Perdu'), pdfItem(3, 'D.pdf', 'D')]));
  const after = await cell(rest, 3);
  check('la ligne 99 est un échec de cette ligne, la ligne 3 est jointe', answer.ok && sameJson(answer.data.echecs, [{ index: 0, raison: 'ligne' }]) && sameJson(answer.data.joints, [{ index: 1, remplace: false }]) && answer.data.probleme === null, answer);
  check('la cellule de la ligne 3 a un fichier de plus', after.length === before.length + 1, { before, after });
}

async function playColumns(run) {
  const { page, rest } = run;
  say('--- 5. une colonne qui ne peut pas recevoir ---');
  const before = await snapshot(rest);
  for (const [column, problem] of [['Absente', 'absente'], ['Texte', 'inutilisable'], ['Calcul', 'inutilisable']]) {
    const answer = await joindre(page, ask('Clients', column, [pdfItem(1, 'X.pdf', 'X')]));
    check(`la colonne « ${column} » : « ${problem} », chaque fichier est un échec`, answer.ok && answer.data.probleme === problem && sameJson(answer.data.echecs, [{ index: 0, raison: problem }]) && answer.data.joints.length === 0, answer);
  }
  check('rien n\'a été envoyé ni écrit', sameJson(await snapshot(rest), before));
}

async function playRefusals(run) {
  const { page, rest } = run;
  say('--- 6. ce que GFS refuse avant d\'envoyer ---');
  const before = await snapshot(rest);
  const good = pdfItem(1, 'Y.pdf', 'Y');
  const refusedWith = async (label, demande, pattern) => {
    const answer = await joindre(page, demande);
    check(label, answer.ok === false && answer.code === 'GFS_REFUSE' && pattern.test(answer.message), answer);
  };
  await refusedWith('une table de GFS : refusée', ask('GFS_Fichiers', 'Contenu', [good]), /GFS_Fichiers|réservée à GFS/);
  await refusedWith('une table interne de Grist : refusée', ask('_grist_Attachments', 'fileName', [good]), /_grist_Attachments/);
  await refusedWith('un contenu qui n\'est pas un PDF : refusé', ask('Clients', 'Pdf', [{ ligne: 1, nom: 'Faux.pdf', b64: Buffer.from('ceci n\'est pas un PDF', 'latin1').toString('base64') }]), /pas un PDF/);
  await refusedWith('une ligne qui n\'est pas un numéro : refusée', { brut: { table: 'Clients', colonne: 'Pdf', fichiers: [{ ligne: 'un', fichier: new Blob(['x']), nom: 'a.pdf' }] } }, /ligne/);
  check('rien n\'a été envoyé ni écrit', sameJson(await snapshot(rest), before));
}

async function playFailures(run) {
  const { page, rest } = run;
  say('--- 7. le serveur refuse, le réseau tombe ---');
  const before = await snapshot(rest);
  const answer = (status, body) => route => (route.request().method() === 'POST' ? route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body }) : route.continue());
  await page.context().route(/\/attachments\?auth=/, answer(413, '{"error":"Payload Too Large"}'));
  const tooBig = await joindre(page, ask('Clients', 'Pdf', [pdfItem(1, 'Gros.pdf', 'Gros'), pdfItem(2, 'Gros2.pdf', 'Gros 2')]));
  await page.context().unroute(/\/attachments\?auth=/);
  check('le serveur refuse la taille (413) de chaque fichier : deux échecs « trop-gros », aucun joint, `probleme` reste null (la taille n\'arrête pas le lot)', tooBig.ok && tooBig.data.probleme === null && tooBig.data.joints.length === 0 && sameJson(tooBig.data.echecs, [{ index: 0, raison: 'trop-gros' }, { index: 1, raison: 'trop-gros' }]), tooBig);
  await page.context().route(/\/attachments\?auth=/, route => (route.request().method() === 'POST' ? route.abort('failed') : route.continue()));
  const down = await joindre(page, ask('Clients', 'Pdf', [pdfItem(1, 'Panne.pdf', 'Panne')]));
  await page.context().unroute(/\/attachments\?auth=/);
  check('le réseau tombe : « injoignable »', down.ok && down.data.probleme === 'injoignable' && sameJson(down.data.echecs, [{ index: 0, raison: 'injoignable' }]), down);
  check('rien n\'est écrit', sameJson(await snapshot(rest), before));
  const next = await joindre(page, ask('Clients', 'Pdf', [pdfItem(1, 'Reprise.pdf', 'Reprise')]));
  check('la panne passée, l\'appel suivant réussit (la file n\'est pas bloquée)', next.ok && next.data.probleme === null && next.data.joints.length === 1, next);
  // Un seul fichier trop gros au milieu d'un lot (question de Publipostage+ à sa 053) : le deuxième envoi reçoit 413, le premier et le troisième sont joints.
  const beforeMiddle = await snapshot(rest);
  let posts = 0;
  await page.context().route(/\/attachments\?auth=/, route => (route.request().method() === 'POST' && ++posts === 2 ? route.fulfill({ status: 413, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"Payload Too Large"}' }) : route.continue()));
  const middle = await joindre(page, ask('Clients', 'Pdf', [pdfItem(1, 'Avant.pdf', 'Avant'), pdfItem(2, 'Gros-au-milieu.pdf', 'Trop gros'), pdfItem(3, 'Apres.pdf', 'Après')]));
  await page.context().unroute(/\/attachments\?auth=/);
  check('un seul fichier trop gros au milieu : lui seul est un échec « trop-gros », le premier et le troisième sont joints, `probleme` reste null', middle.ok && middle.data.probleme === null && sameJson(middle.data.joints.map(joint => joint.index), [0, 2]) && sameJson(middle.data.echecs, [{ index: 1, raison: 'trop-gros' }]), middle);
  const count = cell => (Array.isArray(cell) ? cell.length - 1 : 0);
  const afterMiddle = await snapshot(rest);
  check('les lignes 1 et 3 gagnent chacune une pièce jointe, la ligne 2 (le fichier trop gros) n\'a pas bougé', count(afterMiddle.cells[0]) === count(beforeMiddle.cells[0]) + 1 && count(afterMiddle.cells[2]) === count(beforeMiddle.cells[2]) + 1 && sameJson(afterMiddle.cells[1], beforeMiddle.cells[1]), { avant: beforeMiddle.cells.slice(0, 3), apres: afterMiddle.cells.slice(0, 3) });
}

async function playConcurrent(run) {
  const { page, docId, rest } = run;
  say('--- 8. une pièce jointe ajoutée dans Grist pendant l\'envoi ---');
  const mine = pdfItem(1, 'Pendant.pdf', 'Pendant');
  const meanwhile = pdfItem(1, 'Ajoutee.pdf', 'Ajoutée dans Grist');
  const extra = await upload(page, docId, 'Ajoutee.pdf', meanwhile.b64);
  let injected = false;
  await page.context().route(/\/attachments\?auth=/, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    // La personne ajoute une pièce jointe à la cellule dans Grist PENDANT l'envoi : la demande part ensuite, intacte.
    if (!injected) { injected = true; const now = await cell(rest, 1); await apply(page, docId, [['UpdateRecord', 'Clients', 1, { Pdf: ['L', ...now.slice(1), extra] }]]); }
    return route.continue();
  });
  const answer = await joindre(page, ask('Clients', 'Pdf', [mine]));
  await page.context().unroute(/\/attachments\?auth=/);
  const final = await cell(rest, 1);
  const names = new Map((await rest.attachments()).map(each => [each.id, each.name]));
  check('le fichier est joint', answer.ok && answer.data.joints.length === 1 && answer.data.probleme === null, answer);
  check('la pièce jointe que la personne a ajoutée pendant l\'envoi est toujours dans la cellule, avant la nôtre', final.includes(extra) && names.get(final[final.length - 1]) === 'Pendant.pdf' && final.indexOf(extra) < final.length - 1, { final, extra });
}

// Grist reconstruit le cadre de GFS quand les règles d'accès changent : l'ancien cadre est détaché, la sonde n'est plus ouverte. On rouvre le nouveau et la sonde, comme la personne.
async function reconnect(run) {
  const { page } = run;
  for (let i = 0; i < 80 && !(run.frame.isDetached() && page.frames().some(f => f.url().startsWith(GFS_URL) && !f.isDetached() && f !== run.frame)); i++) await page.waitForTimeout(250);
  run.frame = page.frames().find(f => f.url().startsWith(GFS_URL) && !f.isDetached());
  await run.frame.waitForFunction(() => document.body.dataset.gfs === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(600);
  if (await run.frame.locator('.mod-scrim').count()) { await page.keyboard.press('Escape'); await run.frame.locator('.mod-scrim').waitFor({ state: 'detached' }); }
  if (!(await openProbe(run))) throw new Error('La sonde J ne s\'est pas rouverte.');
}

async function playAccessRule(run) {
  const { page, docId, rest } = run;
  say('--- 9. une règle d\'accès de Grist refuse d\'écrire la colonne ---');
  run.allow.push(/GFS : joindre : Grist n'a pas écrit la cellule/);
  const before = await snapshot(rest);
  const rule = await apply(page, docId, [['AddRecord', '_grist_ACLResources', -1, { tableId: 'Clients', colIds: 'Pdf' }], ['AddRecord', '_grist_ACLRules', null, { resource: -1, aclFormula: 'True', permissionsText: '-U', memo: 'GFS : essai joindre' }]]);
  await reconnect(run);
  const answer = await joindre(page, ask('Clients', 'Pdf', [pdfItem(3, 'Refusee.pdf', 'Refusée')]));
  const after = await snapshot(rest);
  say('message de Grist :', run.problems.filter(problem => /n'a pas écrit la cellule/.test(problem)).join(' | ').slice(0, 300));
  const ruleIds = await sql(page, docId, "SELECT id FROM _grist_ACLRules WHERE memo = 'GFS : essai joindre'");
  const resourceIds = await sql(page, docId, "SELECT r.id FROM _grist_ACLResources r WHERE r.tableId = 'Clients' AND r.colIds = 'Pdf'");
  await apply(page, docId, [['BulkRemoveRecord', '_grist_ACLRules', ruleIds], ['BulkRemoveRecord', '_grist_ACLResources', resourceIds]]);
  check('la règle est posée', Boolean(rule) && ruleIds.length === 1, { rule, ruleIds });
  check('Grist refuse l\'écriture : « refus », le fichier est un échec du même mot, rien n\'est joint', answer.ok && answer.data.probleme === 'refus' && answer.data.joints.length === 0 && answer.data.echecs.length === 1 && answer.data.echecs[0].raison === 'refus', answer);
  check('aucune cellule n\'a changé', sameJson(before.cells, after.cells), { before: before.cells, after: after.cells });
  await reconnect(run);
  const next = await joindre(page, ask('Clients', 'Pdf', [pdfItem(3, 'Apres.pdf', 'Après')]));
  check('la règle retirée, l\'appel suivant réussit', next.ok && next.data.probleme === null && next.data.joints.length === 1, next);
}

const server = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, server, { colorScheme: scheme });
  const run = await openGfs(context, { lang, probes: [KIT ? 'jk' : 'j'], patches: [ALWAYS] });
  check(`GFS est à 700 × 400 dans le vrai Grist (${lang}, ${scheme})`, Math.abs(run.box.width - 700) <= 1 && Math.abs(run.box.height - 400) <= 1, run.box);
  await setup(run);
  await closeModules(run.page, run.frame).catch(() => {});
  await settle(run.page, run.frame);
  await playFirst(run);
  await playModes(run);
  await playMany(run);
  await playMissingRow(run);
  await playColumns(run);
  await playRefusals(run);
  await playFailures(run);
  await playConcurrent(run);
  await playAccessRule(run);
  const unexpected = run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
  check('aucune erreur ni avertissement dans la console (GFS, la sonde), ni violation de politique', unexpected.length === 0, unexpected);
} finally {
  await browser.close();
  pages.close();
}
