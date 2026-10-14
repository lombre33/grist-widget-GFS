import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const LAB = dirname(fileURLToPath(import.meta.url));
const DIST = join(LAB, 'node_modules/grist-static/dist');
const REPO = process.env.REPO_DIR || '/home/user/publipostageGrist';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.csv': 'text/csv', '.map': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
function serve(root, mapPrefix) {
  return async (req, res) => {
    try {
      let p = decodeURIComponent(req.url.split('?')[0]);
      let base = root;
      if (mapPrefix && p.startsWith(mapPrefix.prefix)) { p = p.slice(mapPrefix.prefix.length - 1); base = mapPrefix.root; }
      const f = join(base, normalize(p).replace(/^(\.\.[/\\])+/, ''));
      const info = await stat(f);
      const t = info.isDirectory() ? join(f, 'index.html') : f;
      const body = await readFile(t);
      res.writeHead(200, { 'Content-Type': MIME[extname(t)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      res.end(body);
    } catch { res.writeHead(404).end('not found'); }
  };
}
createServer(serve(join(LAB, 'site'), { prefix: '/dist/', root: DIST })).listen(8910, '127.0.0.1');
createServer(serve(REPO)).listen(Number(process.env.WPORT) || 8911, '127.0.0.1');
process.stdout.write('lab server up: 8910 (grist-static), 8911 (widget)\n');
