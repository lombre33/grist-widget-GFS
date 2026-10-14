// Point 9 de la section 9 des contrats : le coût de la lecture des tables de fichiers (2.4) dans un document lourd.
// Le semis ajoute HEAVY_ROWS modèles de HEAVY_BYTES octets de contenu chacun ; GFS lit la table par sa propre connexion et n'en garde que les
// colonnes déclarées. Plusieurs lectures de suite (GFS rechargé), pour voir l'écart entre la première et les suivantes.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say } from './lab-common.mjs';

const rows = Number(process.env.HEAVY_ROWS || 300);
const bytes = Number(process.env.HEAVY_BYTES || 20000);
const lab = await startLab({ lang: 'fr' });
const started = Date.now();
say('semis :', await seedFiles(lab.frame, { heavy: { rows, bytes } }), `en ${Date.now() - started} ms`, `(~${Math.round((rows * bytes) / 1e6)} Mo de contenu)`);
for (let i = 1; i <= Number(process.env.READS || 3); i++) {
  await lab.frame.evaluate(() => location.reload());
  await lab.page.waitForTimeout(500);
  const frame = await lab.gfsFrame(/access=full/);
  const t0 = Date.now();
  await lab.gfsReady(frame);
  await frame.waitForFunction(() => document.body.dataset.explorerStats, null, { timeout: 120000 });
  const stats = JSON.parse(await frame.evaluate(() => document.body.dataset.explorerStats));
  const heap = await frame.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null));
  say(`lecture ${i} :`, stats, `prêt ${Date.now() - t0} ms après le démarrage`, `tas JS ${heap} Mo`);
}
await lab.browser.close();
