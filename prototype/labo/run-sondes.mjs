// Point 11 des contrats (section 9) : une bibliothèque d'extension reçue de GFS, par adresse et empreinte, dans un sous-cadre isolé, en CDN comme
// en copie de GFS, sous six politiques de sécurité du contenu d'app (labo/sondes/). Tout le chemin est celui d'une personne : la fenêtre « Apps et
// extensions » à la vraie souris, les réglages de la vue dans Grist, l'événement `extensions`, le chargement par la sonde, un vrai graphique.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lab = await startLab({ lang: 'fr', probes: true });
const { page } = lab;
await lab.fitPanel(undefined, 700, 400);
const frame = lab.frame;
await frame.waitForFunction(() => document.body.dataset.gfsFirstRun === 'done', null, { timeout: 30000 }).catch(() => {});

const windowOpen = () => lab.openModules();
const probeOf = async app => JSON.parse(await app.evaluate(() => document.body.dataset.probe || '{}'));
const waitLoads = (app, n) => app.waitForFunction(count => { const d = document.body.dataset.probe; return d && JSON.parse(d).chargements.length >= count; }, n, { timeout: 40000 });
const modeOf = record => (/cdn\.jsdelivr\.net/.test(record.src) ? 'CDN' : 'copie de GFS');
const rows = [];

const CSPS = {
  a: "script-src 'self'", b: "script-src 'self' https://cdn.jsdelivr.net", c: "script-src 'self' 'sha384-…' (empreinte de Plotly)",
  d: "script-src 'self' 'unsafe-eval' (texte + eval)", f: "script-src 'self' 'unsafe-eval'; connect-src 'self' (texte + eval)", e: "script-src 'self' blob: (blob)",
};

for (const key of ['a', 'b', 'c', 'd', 'f', 'e']) {
  const id = `sonde-${key}`;
  await windowOpen();
  await frame.locator(`[data-fk="app:${id}"]`).check();
  const staged = key === 'a'; // la sonde A : app installée seule d'abord, l'extension ensuite (l'événement `extensions` arrive en cours de vie)
  if (!staged) await frame.locator(`[data-fk="ext:${id}/graphique"]`).check();
  await frame.locator(`[data-open="${id}"]`).click();
  const app = await lab.appFrame(new RegExp(`sondes/`));
  check(`${id} : l'app est ouverte`, Boolean(app) && app.url().includes('sondes/'));
  await page.waitForTimeout(1500);
  let probe = await probeOf(app);
  say(`${id} contexte :`, probe.contexte);
  if (staged) {
    check(`${id} : sans extension, aucune bibliothèque dans le contexte`, probe.contexte && probe.contexte.extensions.length === 0 && probe.contexte.bibliotheques.length === 0 && probe.chargements.length === 0);
    await windowOpen();
    await frame.locator(`[data-fk="ext:${id}/graphique"]`).check();
    await page.keyboard.press('Escape');
  }
  await waitLoads(app, 1);
  probe = await probeOf(app);
  const first = probe.chargements[0];
  await windowOpen();
  await frame.locator(`[data-fk="mode:${id}/graphique/vendorise"]`).check();
  await page.keyboard.press('Escape');
  await waitLoads(app, 2);
  probe = await probeOf(app);
  const second = probe.chargements[1];
  rows.push({ key, csp: CSPS[key], first, second, control: probe.controle, events: probe.evenements.length });
  say(`${id} :`, { [modeOf(first)]: first.resultat, violations: first.violations, [modeOf(second)]: second.resultat, moteur: second.moteur, evenements: probe.evenements.length });
}

say('\n=== Matrice (point 11) ===');
for (const { key, csp, first, second, control, events } of rows) {
  const cell = r => `${modeOf(r)} : ${r.resultat}${r.violations.length ? ` [${r.violations.map(v => v.directive).join(', ')}]` : ''}${r.moteur ? ` ; moteur ${r.moteur.version}, SVG ${r.moteur.svg} octets` : ''}`;
  say(`sonde ${key.toUpperCase()} | ${csp}\n   ${cell(first)}\n   ${cell(second)}\n   contrôle (empreinte fausse) : ${control ? control.resultat : 'non mesuré'}${control && control.violations.length ? ` [${control.violations.map(v => v.directive).join(', ')}]` : ''} ; événements reçus : ${events}`);
}
await lab.browser.close();
