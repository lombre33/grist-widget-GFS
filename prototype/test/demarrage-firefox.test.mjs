// La garde de démarrage sous Firefox (js/shell/boot-guard.js, 27/11) : « Loading module from …/list-signature.js?v=… was blocked because of a disallowed MIME type (text/html) », la page de GFS reste blanche.
// Le défaut, mesuré le 27/11 sur GitHub Pages : le CDN garde la réponse 404 (HTML) d'un fichier PAR CHEMIN, sans tenir compte de la `?v=`, et le serveur sert les mêmes fichiers sous un chemin à barres doublées
// (`prototype//js/…` : 200, mêmes octets, autre entrée du CDN). Ici un serveur local joue ce CDN : il rend un 404 HTML pour les chemins que l'essai dit « gardés » et fusionne les barres comme Pages.
// Mesuré : sans la garde la page reste « starting » et vide (le contrôle : l'essai mesure bien le défaut) ; avec elle, un module refusé est dit à l'écran, nommé, et la page repart sous une adresse à
// barre de plus jusqu'à charger ; si toutes les adresses sont gardées, la garde s'arrête après trois reprises sur une phrase et un bouton, sans boucle ; sur un hébergeur qui ne fusionne pas les barres,
// elle n'envoie pas la personne sur une page d'erreur. La page de l'essai porte la même politique de contenu que GFS pour `connect-src` et `script-src` ('self').
// Le français vient du paramètre `language` que Grist met dans l'adresse du widget (sans lui, la langue du navigateur : l'anglais ici).
// Firefox absent : l'essai est SAUTÉ et le dit (`labo/installer-firefox.sh` le pose dans le cloud).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { findFirefox, startFirefox } from './firefox.mjs';

const binary = findFirefox();
const GUARD = readFileSync(join(ROOT, 'js/shell/boot-guard.js'), 'utf8');
const CSS = readFileSync(join(ROOT, 'css/gfs.css'), 'utf8');
const NOT_FOUND = '<!doctype html><title>404 : File not found</title><p>There isn\'t a GitHub Pages site here.</p>';
const page = withGuard => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Essai</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'">
<link rel="stylesheet" href="css/gfs.css">
${withGuard ? '<script src="js/boot-guard.js"></script>' : ''}
<link rel="modulepreload" href="js/main.js"><link rel="modulepreload" href="js/a.js">
<script type="module" src="js/main.js"></script></head><body data-gfs="starting"></body></html>`;
const FILES = {
  '/site/index.html': ['text/html; charset=utf-8', page(true)],
  '/bare/index.html': ['text/html; charset=utf-8', page(false)],
  '/site/js/boot-guard.js': ['text/javascript; charset=utf-8', GUARD],
  '/site/css/gfs.css': ['text/css; charset=utf-8', CSS],
  '/bare/css/gfs.css': ['text/css; charset=utf-8', CSS],
  '/site/js/main.js': ['text/javascript; charset=utf-8', 'import \'./a.js\'; document.body.setAttribute(\'data-gfs\', \'ready\');'],
  '/bare/js/main.js': ['text/javascript; charset=utf-8', 'import \'./a.js\'; document.body.setAttribute(\'data-gfs\', \'ready\');'],
  '/site/js/a.js': ['text/javascript; charset=utf-8', 'window.__a = 1;'],
  '/bare/js/a.js': ['text/javascript; charset=utf-8', 'window.__a = 1;'],
};

// Un « Pages » local : `guarded(chemin brut)` dit les chemins dont le CDN garde un 404 ; `merge` : fusionne-t-il les barres doublées (Pages le fait ; un autre hébergeur peut ne pas le faire).
function startPages() {
  const state = { guarded: () => false, merge: true, asked: [] };
  const server = createServer((request, response) => {
    const raw = request.url.split('?')[0];
    state.asked.push(raw);
    const known = FILES[raw.replace(/\/{2,}/g, '/')];
    const refused = state.guarded(raw) || !known || (!state.merge && /\/\//.test(raw));
    response.writeHead(refused ? 404 : 200, { 'Content-Type': refused ? 'text/html; charset=utf-8' : known[0], 'Cache-Control': 'no-store' });
    response.end(refused ? NOT_FOUND : known[1]);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    state, base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(done => { server.close(done); server.closeAllConnections(); }),
  })));
}

describe('la garde de démarrage sous Firefox', { skip: !binary && 'Firefox absent : `bash prototype/labo/installer-firefox.sh` le pose dans le cloud' }, () => {
  let firefox;
  let pages;
  let page_;
  const readState = () => page_.run(() => ({
    gfs: document.body.getAttribute('data-gfs'), path: location.pathname, text: (document.body.textContent || '').trim(),
    box: Boolean(document.getElementById('boot-failure')),
    detail: (document.querySelector('.boot-failure__detail') || {}).textContent || '',
    button: (document.querySelector('#boot-failure button') || {}).textContent || '',
    sentence: (document.querySelector('#boot-failure p') || {}).textContent || '',
  }));
  const open = async (path, guarded, merge = true) => {
    pages.state.guarded = guarded;
    pages.state.merge = merge;
    pages.state.asked.length = 0;
    await page_.goto(`${pages.base}${path}`);
  };
  const waitUntil = (fn, args, timeout) => page_.until(fn, args, timeout);

  before(async () => {
    pages = await startPages();
    firefox = await startFirefox(binary);
    page_ = firefox.page;
    await page_.view({ width: 700, height: 400 });
  });
  after(async () => { if (firefox) await firefox.close(); if (pages) await pages.close(); });

  test('le contrôle : sans la garde, un module refusé laisse la page blanche (le défaut du 27/11)', async () => {
    await open('/bare/index.html', raw => raw === '/bare/js/a.js');
    await new Promise(resolve => setTimeout(resolve, 1200));
    const state = await readState();
    assert.equal(state.gfs, 'starting', 'rien ne démarre');
    assert.equal(state.text, '', 'et rien à l\'écran');
    assert.equal(state.box, false);
  });

  test('toutes les réponses bonnes : la page démarre à son adresse, sans phrase ni lecture en double', async () => {
    await open('/site/index.html', () => false);
    await waitUntil(() => document.body.getAttribute('data-gfs') === 'ready', [], 5000);
    const state = await readState();
    assert.equal(state.path, '/site/index.html');
    assert.equal(state.box, false);
    assert.deepEqual(pages.state.asked.filter(raw => raw.endsWith('/js/a.js')), ['/site/js/a.js'], 'le module n\'est lu qu\'une fois : la garde ne sonde rien quand tout va bien');
  });

  test('un module gardé en 404 : la phrase et le nom du fichier s\'affichent, puis la page repart sous « prototype//… » et démarre', async () => {
    await open('/site/index.html?language=fr', raw => raw === '/site/js/a.js');
    const shown = await waitUntil(() => { const box = document.getElementById('boot-failure'); return box && box.textContent.includes('a.js') ? box.textContent : null; }, [], 3000);
    assert.match(shown, /Nouvel essai automatique/);
    assert.match(shown, /Fichier refusé : a\.js \(404, text\/html\)/, 'le fichier, le code et le type que le serveur a rendus');
    await waitUntil(() => document.body.getAttribute('data-gfs') === 'ready', [], 8000);
    const state = await readState();
    assert.equal(state.path, '/site//index.html', 'une barre de plus avant le nom de la page');
    assert.equal(state.box, false, 'la phrase a disparu avec la page reprise');
    assert.ok(pages.state.asked.includes('/site//js/a.js'), 'le module est lu sous le chemin neuf');
    assert.ok(Boolean(await page_.run(() => window.__a === 1)), 'et il s\'est exécuté');
  });

  test('en anglais (paramètre `language` de Grist) : la phrase et le bouton suivent, la requête reste', async () => {
    await open('/site/index.html?language=en&access=full', raw => /\/js\/a\.js$/.test(raw), false);
    const state = await waitUntil(() => { const button = document.querySelector('#boot-failure button'); return button ? { text: document.getElementById('boot-failure').textContent, path: location.pathname + location.search } : null; }, [], 5000);
    assert.match(state.text, /could not load all of its files/);
    assert.match(state.text, /click "Reload"/);
    assert.equal(state.path, '/site/index.html?language=en&access=full', 'sans hébergeur qui fusionne les barres, la personne reste sur sa page (pas de page d\'erreur)');
  });

  test('l\'hébergeur ne fusionne pas les barres : phrase finale et bouton, aucune page d\'erreur ; le bouton relit la page', async () => {
    await open('/site/index.html?language=fr', raw => raw === '/site/js/a.js', false);
    const shown = await waitUntil(() => { const button = document.querySelector('#boot-failure button'); return button ? button.textContent : null; }, [], 5000);
    assert.equal(shown, 'Recharger');
    const state = await readState();
    assert.equal(state.path, '/site/index.html');
    assert.match(state.sentence, /Patientez deux ou trois minutes/);
    assert.match(state.detail, /a\.js \(404, text\/html\)/);
    assert.equal(state.gfs, 'starting');
    const before = pages.state.asked.filter(raw => raw === '/site/index.html').length;
    const box = await page_.run(() => { const r = document.querySelector('#boot-failure button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page_.click(box.x, box.y);
    await new Promise(resolve => setTimeout(resolve, 600));
    assert.ok(pages.state.asked.filter(raw => raw === '/site/index.html').length > before, 'un clic à la vraie souris relit la page');
  });

  test('toutes les adresses gardées : trois reprises, puis la phrase finale et le bouton, sans boucle', { timeout: 40000 }, async () => {
    await open('/site/index.html?language=fr', raw => /\/js\/a\.js$/.test(raw));
    const final = await waitUntil(() => { const button = document.querySelector('#boot-failure button'); return button && /\/{4}index\.html$/.test(location.pathname) ? location.pathname : null; }, [], 25000);
    assert.equal(final, '/site////index.html', 'l\'essai 0, puis 1, 2 et 3 : trois reprises d\'elle-même');
    const state = await readState();
    assert.match(state.sentence, /Patientez deux ou trois minutes/);
    assert.match(state.detail, /a\.js \(404, text\/html\)/);
    const asked = pages.state.asked.length;
    await new Promise(resolve => setTimeout(resolve, 2500));
    assert.equal(pages.state.asked.length, asked, 'plus rien ne se demande : la garde s\'est arrêtée');
    assert.equal((await readState()).path, '/site////index.html');
    // Le bouton essaie une adresse neuve : une barre de plus, même si trois reprises ont déjà eu lieu.
    const box = await page_.run(() => { const r = document.querySelector('#boot-failure button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page_.click(box.x, box.y);
    const next = await waitUntil(() => (/\/{5}index\.html$/.test(location.pathname) ? location.pathname : null), [], 5000);
    assert.equal(next, '/site/////index.html');
  });

  test('la phrase tient dans la page de 700 px, lisible : texte du jeton d\'erreur sur son fond, le bouton à la souris', async () => {
    await open('/site/index.html?language=fr', raw => /\/js\/a\.js$/.test(raw), false);
    await waitUntil(() => document.querySelector('#boot-failure button'), [], 5000);
    const look = await page_.run(() => {
      const box = document.getElementById('boot-failure').getBoundingClientRect();
      const style = getComputedStyle(document.getElementById('boot-failure'));
      const button = document.querySelector('#boot-failure button').getBoundingClientRect();
      return { left: box.left, right: box.right, width: innerWidth, color: style.color, background: style.backgroundColor, border: style.borderTopWidth, button: button.height, scroll: document.documentElement.scrollWidth };
    });
    assert.ok(look.left >= 0 && look.right <= look.width, 'dans la largeur');
    assert.ok(look.scroll <= look.width, 'sans défilement horizontal');
    assert.ok(look.button >= 28, 'un bouton d\'au moins 28 px de haut');
    assert.notEqual(look.color, look.background, 'un texte et un fond distincts');
    assert.equal(look.border, '1px');
  });
});
