// Un répondeur REST de remplacement, POUR LA TUYAUTERIE seulement : il sert à vérifier que la sonde du vrai Grist (labo/reel/) envoie ses requêtes, lit les réponses, les
// range et ne laisse pas passer le jeton. Il ne mesure rien de Grist : grist-static ne délivre pas de jeton (« no access tokens ») et n'a pas d'API REST, d'où la
// nécessité de la vraie instance du porteur. Il suit ce que le code de Grist dit (docs/faits-verifies.md, section 4) : à une origine non reconnue, `Access-Control-Allow-Origin: *`
// sans identifiants, et une requête qui porte un en-tête `Authorization` n'est pas admise ; un envoi est un formulaire multipart dont le champ `upload` porte le fichier,
// la réponse est la liste des numéros de pièces jointes créées (DocApi.ts). Un second serveur sert les fichiers du dépôt sur un autre port,
// car la sonde interroge une AUTRE origine que la sienne (sur la même origine, Chromium n'envoie pas la demande préalable d'un cadre isolé : l'essai ne montrerait rien) ;
// les deux pages de la sonde y reçoivent, pour CET essai, l'adresse du répondeur dans leur `connect-src` (les fichiers du dépôt ne sont pas touchés).
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';

const TOKEN = 'JETON-DE-TUYAUTERIE';
const uploaded = new Map(); // numéro -> { name, bytes } : les fichiers reçus
let nextId = 8;
let maxUploadBytes = Infinity;
const ROUTES = {
  '/tables': () => ({ tables: [{ id: 'Clients' }, { id: 'Commandes' }] }),
  '/tables/Clients/records': () => ({ records: [{ id: 1, fields: {} }] }),
  '/sql': () => ({ records: [{ fields: { name: '_grist_ACLRules' } }, { fields: { name: '_grist_DocInfo' } }, { fields: { name: '_grist_Triggers' } }] }),
  '/attachments': () => ({
    records: [{ id: 7, fields: { fileName: 'a.txt', fileSize: 5 } },
      ...[...uploaded].map(([id, file]) => ({ id, fields: { fileName: file.name, fileSize: file.bytes.length, timeUploaded: '2026-11-03T10:00:00.000Z' } }))],
  }),
};

const openConnect = restOrigin => (file, bytes) => (/labo[/\\]reel[/\\][^/\\]*\.html$/.test(file)
  ? Buffer.from(bytes.toString('utf8').replace(/(content="[^"]*connect-src https:)/, `$1 ${restOrigin}`)) : bytes);

const readBody = request => new Promise(resolve => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => resolve(Buffer.concat(chunks)));
});

// Le fichier du champ `upload` d'un envoi multipart : { name, bytes }, ou null.
function uploadedFile(body, contentType) {
  const boundary = /boundary=([^;]+)/.exec(contentType || '');
  const start = body.indexOf('\r\n\r\n');
  if (!boundary || start < 0) return null;
  const name = /name="upload"; filename="([^"]*)"/.exec(body.subarray(0, start).toString('utf8'));
  const end = body.lastIndexOf(`\r\n--${boundary[1]}`);
  return name && end > start ? { name: name[1], bytes: body.subarray(start + 4, end) } : null;
}

async function receive(request, response, cors) {
  const body = await readBody(request);
  const json = { ...cors, 'Content-Type': 'application/json' };
  if (body.length > maxUploadBytes) { response.writeHead(413, json).end(JSON.stringify({ error: 'Request entity too large' })); return; }
  const file = uploadedFile(body, request.headers['content-type']);
  if (!file) { response.writeHead(400, json).end(JSON.stringify({ error: 'missing payload' })); return; }
  uploaded.set(nextId, file);
  response.writeHead(200, json).end(JSON.stringify([nextId]));
  nextId += 1;
}

async function answer(request, response) {
  const url = new URL(request.url, 'http://127.0.0.1');
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (process.env.STANDIN_LOG) process.stdout.write(`[répondeur] ${request.method} ${url.pathname.replace(/^.*\/docs\/[^/]+/, '')} origine=${request.headers.origin} authorization=${Boolean(request.headers.authorization)} demande=${request.headers['access-control-request-headers']}\n`);
  // La demande préalable (l'en-tête Authorization en provoque une) : admise sans l'en-tête demandé, donc refusée par le navigateur.
  if (request.method === 'OPTIONS') { response.writeHead(204, cors).end(); return; }
  const path = url.pathname.replace(/^\/o\/docs\/api\/docs\/[^/]+/, '');
  if (request.headers.authorization || url.searchParams.get('auth') !== TOKEN) { response.writeHead(403, cors).end('refusé'); return; }
  if (request.method === 'POST' && path === '/attachments') { await receive(request, response, cors); return; }
  const download = /^\/attachments\/(\d+)\/download$/.exec(path);
  if (download && Number(download[1]) === 7) { response.writeHead(200, { ...cors, 'Content-Type': 'text/plain' }).end('bonjour'); return; }
  if (download && uploaded.has(Number(download[1]))) { response.writeHead(200, { ...cors, 'Content-Type': 'application/pdf' }).end(uploaded.get(Number(download[1])).bytes); return; }
  const route = ROUTES[path];
  if (!route) { response.writeHead(404, cors).end('absent'); return; }
  response.writeHead(200, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(route()));
}

// Le répondeur sur `restPort`, les pages du dépôt sur `pagePort` ; `maxUploadBytes` : au-delà, un envoi reçoit 413 ; `uploads()` : les fichiers reçus ; `close()` arrête les deux serveurs.
export async function startStandIn({ restPort, pagePort, repoDir, maxUploadBytes: limit = Infinity }) {
  maxUploadBytes = limit;
  uploaded.clear();
  nextId = 8;
  const rest = createServer(answer);
  const pages = createServer(serve(repoDir, undefined, openConnect(`http://127.0.0.1:${restPort}`)));
  await Promise.all([rest, pages].map((server, index) => new Promise(resolve => server.listen([restPort, pagePort][index], '127.0.0.1', resolve))));
  return { close: () => { rest.close(); pages.close(); }, uploads: () => [...uploaded].map(([id, file]) => ({ id, name: file.name, size: file.bytes.length })) };
}

export const STANDIN_TOKEN = TOKEN;
