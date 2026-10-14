// Un répondeur REST de remplacement, POUR LA TUYAUTERIE seulement : il sert à vérifier que la sonde du vrai Grist (labo/reel/) envoie ses requêtes, lit les réponses, les
// range et ne laisse pas passer le jeton. Il ne mesure rien de Grist : grist-static ne délivre pas de jeton (« no access tokens ») et n'a pas d'API REST, d'où la
// nécessité de la vraie instance du porteur. Il suit ce que le code de Grist dit (docs/faits-verifies.md, section 4) : à une origine non reconnue, `Access-Control-Allow-Origin: *`
// sans identifiants, et une requête qui porte un en-tête `Authorization` n'est pas admise. Un second serveur sert les fichiers du dépôt sur un autre port,
// car la sonde interroge une AUTRE origine que la sienne (sur la même origine, Chromium n'envoie pas la demande préalable d'un cadre isolé : l'essai ne montrerait rien) ;
// les deux pages de la sonde y reçoivent, pour CET essai, l'adresse du répondeur dans leur `connect-src` (les fichiers du dépôt ne sont pas touchés).
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';

const TOKEN = 'JETON-DE-TUYAUTERIE';
const ROUTES = {
  '/tables': () => ({ tables: [{ id: 'Clients' }, { id: 'Commandes' }] }),
  '/tables/Clients/records': () => ({ records: [{ id: 1, fields: {} }] }),
  '/sql': () => ({ records: [{ fields: { name: '_grist_ACLRules' } }, { fields: { name: '_grist_DocInfo' } }, { fields: { name: '_grist_Triggers' } }] }),
  '/attachments': () => ({ records: [{ id: 7, fields: { fileName: 'a.txt', fileSize: 5 } }] }),
};

const openConnect = restOrigin => (file, bytes) => (/labo[/\\]reel[/\\][^/\\]*\.html$/.test(file)
  ? Buffer.from(bytes.toString('utf8').replace(/(content="[^"]*connect-src https:)/, `$1 ${restOrigin}`)) : bytes);

function answer(request, response) {
  const url = new URL(request.url, 'http://127.0.0.1');
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (process.env.STANDIN_LOG) process.stdout.write(`[répondeur] ${request.method} ${url.pathname.replace(/^.*\/docs\/[^/]+/, '')} origine=${request.headers.origin} authorization=${Boolean(request.headers.authorization)} demande=${request.headers['access-control-request-headers']}\n`);
  // La demande préalable (l'en-tête Authorization en provoque une) : admise sans l'en-tête demandé, donc refusée par le navigateur.
  if (request.method === 'OPTIONS') { response.writeHead(204, cors).end(); return; }
  const path = url.pathname.replace(/^\/o\/docs\/api\/docs\/[^/]+/, '');
  if (request.headers.authorization || url.searchParams.get('auth') !== TOKEN) { response.writeHead(403, cors).end('refusé'); return; }
  if (path === '/attachments/7/download') { response.writeHead(200, { ...cors, 'Content-Type': 'text/plain' }).end('bonjour'); return; }
  const route = ROUTES[path];
  if (!route) { response.writeHead(404, cors).end('absent'); return; }
  response.writeHead(200, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(route()));
}

// Le répondeur sur `restPort`, les pages du dépôt sur `pagePort` ; `close()` arrête les deux.
export async function startStandIn({ restPort, pagePort, repoDir }) {
  const rest = createServer(answer);
  const pages = createServer(serve(repoDir, undefined, openConnect(`http://127.0.0.1:${restPort}`)));
  await Promise.all([rest, pages].map((server, index) => new Promise(resolve => server.listen([restPort, pagePort][index], '127.0.0.1', resolve))));
  return { close: () => { rest.close(); pages.close(); } };
}

export const STANDIN_TOKEN = TOKEN;
