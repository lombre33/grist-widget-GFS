// Ce que le labo relève des lectures SQL d'une page de GFS (faits vérifiés 173) : les requêtes `/sql` parties et leur réponse, les fichiers que l'explorateur montre.
// Partagé par `run-sql-refuse.mjs` et `run-sql-compte.mjs`.
import { say } from './lab-common.mjs';
import { reopened } from './lab-poids.mjs';

// Ce que la page demande à `/sql`, et ce qu'elle en reçoit : `answer` vaut « 200 », « 403 Grist » (réponse lue, en-têtes CORS de Grist) ou « bloquée » (le pare-feu : pas d'en-tête CORS, la page ne lit rien).
export const net = [];
export const kindOf = q => (/COUNT\(\*\)/.test(q) ? 'compte' : /_grist_Tables_column/.test(q) ? 'structure' : /pragma_page_count/.test(q) ? 'poids' : /gfs_octets/.test(q) ? 'lignes' : 'autre');

// `delay` : de combien la réponse de `/sql` est retardée ; `blocks(q)` : vrai pour une lecture que la doublure du pare-feu refuse.
export async function install(context, { delay = 0, blocks = () => false } = {}) {
  context.on('response', response => {
    if (/\/api\/docs\/[^/]+\/sql\?/.test(response.url())) net.push({ q: new URL(response.url()).searchParams.get('q'), answer: response.status() === 200 ? '200' : `${response.status()} Grist` });
  });
  context.on('requestfailed', request => {
    if (/\/api\/docs\/[^/]+\/sql\?/.test(request.url())) net.push({ q: new URL(request.url()).searchParams.get('q'), answer: 'bloquée' });
  });
  // La doublure du pare-feu : la requête n'arrive pas à Grist et la page n'en lit rien (un 403 sans en-tête CORS ne lui rend qu'une erreur de réseau : `route.fulfill` de Playwright ajoute lui-même l'en-tête CORS, donc
  // c'est `abort` qui rend ce que la page voit).
  await context.route(/\/api\/docs\/[^/]+\/sql\?/, async route => {
    const q = new URL(route.request().url()).searchParams.get('q') || '';
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (blocks(q)) await route.abort('failed');
    else await route.continue();
  });
}

export const summary = () => {
  const out = {};
  for (const { q, answer } of net) { const key = `${kindOf(q)} ${answer}`; out[key] = (out[key] || 0) + 1; }
  return out;
};
export const names = frame => frame.locator('.ls-row:not(.folder) .t').allInnerTexts().then(list => [...list].sort());

// Trois chargements de la page : ce que chacun envoie à `/sql`, ce que l'explorateur montre, ce que GFS dit.
export async function loads(run, label, { count = 3, wait = 9000 } = {}) {
  const seen = [];
  for (let i = 1; i <= count; i++) {
    net.length = 0;
    const started = Date.now();
    await run.page.reload();
    const frame = await reopened(run.page);
    await frame.waitForFunction(() => document.body.dataset.explorerStats, null, { timeout: 60000 });
    const listed = Date.now() - started; // du rechargement à la liste lue (la mesure de `explorerStats` : la fin de la lecture des fichiers)
    await run.page.waitForTimeout(wait);
    const shown = await names(frame);
    seen.push({ load: i, listed, sent: summary(), total: net.length, refused: net.filter(entry => entry.answer !== '200').length, shown });
    say(`  ${label} chargement ${i} :`, { listeMs: listed, demandes: net.length, refusées: seen[i - 1].refused, détail: seen[i - 1].sent, fichiers: shown });
  }
  return seen;
}

