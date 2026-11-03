// Les pièces jointes pour GFS (étude PDF, lot 1) : ce que GFS fera pour garder un PDF dans le document, joué dans un vrai Grist. Ce que seule une instance réelle peut dire :
//   - l'envoi d'un fichier avec le jeton (POST /attachments, champ `upload`) depuis la page de la sonde, qui est de l'origine de GFS : c'est GFS qui enverra, jamais une app ;
//   - une colonne de type Attachments : la cellule écrite, relue, le fichier téléchargé avant et après son rattachement ;
//   - le remplacement d'un fichier : un second envoi, la cellule mise à jour, l'ancienne pièce jointe laissée à Grist ;
//   - la taille maximale d'un envoi : un palier après l'autre, jusqu'au premier refus.
// Un fichier envoyé qui ne tient plus à aucune cellule est effacé par Grist au bout de 7 jours (DocStorage.ts, ATTACHMENTS_EXPIRY_DAYS) ; la table d'essai, elle, est supprimée
// tout de suite. Le jeton ne sort jamais d'ici : seuls des états, des nombres et des noms sont rendus.
//
// `env` : { grist, cut, redact, attempt, outcome, progress } (ce que la sonde donne) ; `add(nom, valeur)` ajoute une ligne au compte rendu de la section.

const TABLE = 'Sonde_GFS_pj';
const NAME = 'Facture été (1).pdf';
const SIZES_MB = [0.1, 0.5, 1, 5, 20, 50];
const DOWNLOAD_UP_TO_MB = 20;
const STEP_TIMEOUT_MS = 180000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const french = number => String(number).replace('.', ',');

// ----- Les octets d'essai.
// Un PDF d'une page, valide (la table des références est calculée) ; `label` (ASCII, sans parenthèse) change les octets d'un essai à l'autre.
export function miniPdf(label) {
  const content = `BT /F1 14 Tf 16 40 Td (${label}) Tj ET`;
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 220 80]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  ];
  let text = '%PDF-1.4\n';
  const offsets = objects.map((body, index) => {
    const at = text.length;
    text += `${index + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = text.length;
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(at => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}`;
  text += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(text);
}

// `megabytes` Mo d'octets variés qui commencent comme un PDF (la taille seule compte ici).
function filler(megabytes) {
  const bytes = new Uint8Array(Math.round(megabytes * 1024 * 1024));
  const block = new Uint8Array(65536);
  crypto.getRandomValues(block);
  for (let at = 0; at < bytes.length; at += block.length) bytes.set(block.subarray(0, Math.min(block.length, bytes.length - at)), at);
  bytes.set(encoder.encode('%PDF-1.4\n% sonde GFS\n'));
  return bytes;
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let at = 0; at < a.length; at += 1) if (a[at] !== b[at]) return false;
  return true;
}

// ----- Les requêtes REST. Le délai court jusqu'à la fin de la lecture de la réponse.
const url = ({ baseUrl, token }, path) => `${baseUrl}${path}?auth=${encodeURIComponent(token)}`;

async function request(address, options, as) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS);
  try {
    const response = await fetch(address, { ...options, signal: controller.signal });
    const body = as === 'bytes' ? new Uint8Array(await response.arrayBuffer()) : await response.text();
    return { statut: response.status, ok: response.ok, type: response.headers.get('content-type'), body };
  } finally {
    clearTimeout(timer);
  }
}

function parseIds(text) {
  try {
    const data = JSON.parse(text);
    return Array.isArray(data) && data.length && data.every(Number.isInteger) ? data : null;
  } catch (error) {
    return null;
  }
}

// Un envoi comme GFS le fera : un formulaire multipart dont le champ `upload` porte le fichier. Rend { statut, ids, ms } ou { statut, message, ms }.
async function upload(env, token, name, bytes) {
  const form = new FormData();
  form.append('upload', new Blob([bytes], { type: 'application/pdf' }), name);
  const started = performance.now();
  const answer = await request(url(token, '/attachments'), { method: 'POST', body: form }, 'text');
  const ms = Math.round(performance.now() - started);
  const ids = answer.ok ? parseIds(answer.body) : null;
  return ids ? { statut: answer.statut, ids, ms } : { statut: answer.statut, message: env.cut(answer.body || 'réponse vide', 80), ms };
}

// Le téléchargement d'une pièce jointe, comparé aux octets envoyés.
async function download(env, token, id, sent) {
  const started = performance.now();
  const answer = await request(url(token, `/attachments/${id}/download`), {}, 'bytes');
  const ms = Math.round(performance.now() - started);
  if (!answer.ok) return { statut: answer.statut, message: env.cut(decoder.decode(answer.body), 80), ms };
  return { statut: answer.statut, octets: answer.body.length, type: answer.type, identique: sameBytes(answer.body, sent), ms };
}

const listed = async token => JSON.parse((await request(url(token, '/attachments'), {}, 'text')).body).records || [];
const freshToken = env => env.grist.docApi.getAccessToken({ readOnly: false });

// Le jeton qui écrit : son adresse (sans l'identifiant du document) et sa durée, ou l'erreur de Grist.
async function reportToken(env, add) {
  const result = await env.attempt(() => freshToken(env));
  if (!result.ok) { add('jeton en écriture', env.outcome(result)); return null; }
  add('jeton en écriture', { adresse: env.redact(result.value.baseUrl), dureeMs: result.value.ttlMsecs });
  return result.value;
}

// ----- 3. Un PDF envoyé, rangé dans une cellule, relu, téléchargé, remplacé.
async function applyActions(env, actions) {
  const result = await env.grist.docApi.applyUserActions(actions);
  return Array.isArray(result) ? result : (result && result.retValues) || [];
}
const rawDoc = env => env.grist.rpc.getStub('GristDocAPI@grist');

async function sendFirst(env, ctx) {
  ctx.first = { bytes: miniPdf('Essai GFS 1') };
  const sent = await upload(env, ctx.token, NAME, ctx.first.bytes);
  if (sent.ids) ctx.first.id = sent.ids[0]; else ctx.stop = true;
  return sent;
}

async function readCard(env, ctx) {
  const record = (await listed(ctx.token)).find(each => each.id === ctx.first.id);
  if (!record) return { message: 'absente de la liste des pièces jointes' };
  const { fileName, fileSize } = record.fields;
  return { nom: fileName, nomIdentique: fileName === NAME, octets: fileSize, octetsIdentiques: fileSize === ctx.first.bytes.length };
}

async function createTable(env, ctx) {
  const values = await applyActions(env, [['AddTable', TABLE, [{ id: 'Nom', type: 'Text' }, { id: 'Contenu', type: 'Attachments' }]]]);
  ctx.table = values[0].table_id;
  return `ok : ${ctx.table}`;
}

async function attachFirst(env, ctx) {
  const values = await applyActions(env, [['AddRecord', ctx.table, null, { Nom: 'essai', Contenu: ['L', ctx.first.id] }]]);
  ctx.row = values[0];
  const decoded = (await env.grist.docApi.fetchTable(ctx.table)).Contenu;
  const raw = (await rawDoc(env).fetchTable(ctx.table)).Contenu;
  return { ecrit: ['L', ctx.first.id], relueDecodee: decoded[0], relueBrute: raw[0] };
}

async function replaceFile(env, ctx) {
  ctx.second = { bytes: miniPdf('Essai GFS 2 remplacant') };
  const sent = await upload(env, ctx.token, NAME, ctx.second.bytes);
  if (!sent.ids) return sent;
  ctx.second.id = sent.ids[0];
  await applyActions(env, [['UpdateRecord', ctx.table, ctx.row, { Contenu: ['L', ctx.second.id] }]]);
  const cell = (await rawDoc(env).fetchTable(ctx.table)).Contenu[0];
  return { envoi: sent, celluleRelue: cell, attendue: ['L', ctx.second.id] };
}

async function oldOneStillListed(env, ctx) {
  const ids = (await listed(ctx.token)).map(each => each.id);
  return { premiereToujoursListee: ids.includes(ctx.first.id), secondeListee: ids.includes(ctx.second.id) };
}

// [nom de la ligne, étape, critique ?] : une étape critique qui échoue arrête l'essai.
const STEPS = [
  ['envoi d\'un PDF d\'une page (nom « Facture été (1).pdf »)', sendFirst, true],
  ['fiche dans la liste des pièces jointes', readCard, false],
  ['téléchargement avant le rattachement à une cellule', (env, ctx) => download(env, ctx.token, ctx.first.id, ctx.first.bytes), false],
  ['table d\'essai avec une colonne de type Attachments', createTable, true],
  ['une ligne avec la pièce jointe, cellule relue', attachFirst, true],
  ['téléchargement après le rattachement', (env, ctx) => download(env, ctx.token, ctx.first.id, ctx.first.bytes), false],
  ['remplacement par un second envoi, cellule mise à jour', replaceFile, true],
  ['téléchargement du fichier qui remplace', (env, ctx) => download(env, ctx.token, ctx.second.id, ctx.second.bytes), false],
  ['l\'ancienne pièce jointe reste dans la liste (Grist l\'efface seul)', oldOneStillListed, false],
];

async function cleanup(env, ctx, before, add) {
  if (ctx.table) {
    add(`RemoveTable ${ctx.table}`, env.outcome(await env.attempt(async () => { await applyActions(env, [['RemoveTable', ctx.table]]); return 'ok'; })));
  }
  const after = await env.grist.docApi.listTables();
  add('tables du document après le nettoyage', { avant: before.length, apres: after.length, identiques: JSON.stringify([...before].sort()) === JSON.stringify([...after].sort()) });
}

export async function playAttachments(env, add) {
  const before = await env.grist.docApi.listTables();
  const ctx = { token: null, table: null, row: null, stop: false };
  try {
    ctx.token = await reportToken(env, add);
    if (!ctx.token) return;
    for (const [label, step, critical] of STEPS) {
      const result = await env.attempt(() => step(env, ctx));
      add(label, env.outcome(result));
      if (ctx.stop || (critical && !result.ok)) break;
    }
  } finally {
    await cleanup(env, ctx, before, add);
  }
}

// ----- 4. La taille maximale d'un envoi : un palier après l'autre, jusqu'au premier refus.
async function sizeStep(env, megabytes) {
  env.progress(`Envoi de ${french(megabytes)} Mo en cours…`);
  const token = await freshToken(env);
  const bytes = filler(megabytes);
  const envoi = await upload(env, token, `Taille essai ${french(megabytes)} Mo.pdf`, bytes);
  if (!envoi.ids || megabytes > DOWNLOAD_UP_TO_MB) return { envoi };
  env.progress(`Téléchargement de ${french(megabytes)} Mo en cours…`);
  return { envoi, retour: await download(env, token, envoi.ids[0], bytes) };
}

export async function playSizes(env, add) {
  if (!await reportToken(env, add)) return;
  let accepted = 0;
  let refused = 0;
  for (const megabytes of SIZES_MB) {
    const result = await env.attempt(() => sizeStep(env, megabytes));
    add(`${french(megabytes)} Mo`, env.outcome(result));
    if (!result.ok || !result.value.envoi.ids) { refused = megabytes; break; }
    accepted = megabytes;
  }
  env.progress('');
  add('plus grand envoi accepté', accepted ? `${french(accepted)} Mo` : 'aucun');
  add('premier envoi refusé', refused ? `${french(refused)} Mo` : `aucun (les ${french(SIZES_MB[SIZES_MB.length - 1])} Mo sont passés)`);
}
