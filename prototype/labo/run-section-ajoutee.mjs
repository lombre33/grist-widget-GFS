// Ajouter une section à la page recharge-t-il le cadre de la première ? Question de Publipostage+ à GFS (GFS-ETAT.md : « GFS peut-il garder le cadre de la première
// section en place quand on en ajoute une ? »), à la vraie souris, dans un vrai Grist (grist-static). LAB_LANG=fr|en.
//   1. Sans GFS : une sonde est la première section ; la personne en ajoute une seconde. Si le cadre de la sonde est rechargé, c'est Grist qui le fait.
//   2. Avec GFS : Publipostage+ est ouvert dans la première section de GFS ; la personne ajoute une seconde section GFS. On relève ce qu'elle voit ensuite.
// Ce qu'on relève, pour le cadre d'origine : sa page (une marque posée à la main, et le cadre qui se détache), son élément <iframe> (le même, ou un autre : une propriété
// posée à la main dessus survit ou non), et le cadre que l'élément porte ensuite.
import { startLab } from './lab-setup.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const PROBE = 'http://127.0.0.1:8911/prototype/labo/sondes/g-capacites/index.html';
const WIDGET = 'http://127.0.0.1:8911/prototype/index.html';
const query = `?language=${lang}&culture=${lang === 'en' ? 'en-GB' : 'fr-FR'}`;

// Pose une marque dans le cadre et sur son élément, ajoute la section, puis rend ce qui reste de la marque et le cadre que l'élément porte maintenant.
async function addSectionAndLook(lab, first, address) {
  const element = await first.frameElement();
  await first.evaluate(() => { window.__avant = 'ici'; });
  await element.evaluate(node => { node.__marque = 'premier'; });
  await lab.addSection(address);
  // Le nouveau document du cadre d'origine : l'élément rend le cadre qu'il porte maintenant.
  let now = null;
  for (let i = 0; i < 60 && (!now || now === first); i++) { await lab.page.waitForTimeout(500); now = await element.contentFrame(); }
  return {
    detached: first.isDetached(),
    sameElement: await element.evaluate(node => node.isConnected && node.__marque === 'premier'),
    changed: now !== null && now !== first,
    now,
    markKept: now ? await now.evaluate(() => window.__avant === 'ici').catch(() => false) : false,
  };
}

// ----- 1. Sans GFS : la sonde seule.
{
  const lab = await startLab({ lang, widget: PROBE, fullAccess: false });
  const seen = await addSectionAndLook(lab, lab.frame, `${PROBE}${query}`);
  check('sans GFS : le cadre d\'origine est rechargé (son ancien document est détaché, la marque posée dans la page a disparu)', seen.detached && seen.changed && !seen.markKept, { detached: seen.detached, changed: seen.changed, markKept: seen.markKept });
  check('sans GFS : c\'est le même élément <iframe>, déplacé par Grist (la propriété posée dessus survit)', seen.sameElement);
  say('Grist recharge donc lui-même le cadre de la première section quand on en ajoute une, sans que GFS soit là.');
  await lab.browser.close();
}

// ----- 2. Avec GFS : Publipostage+ ouvert dans la première section, une seconde section GFS est ajoutée.
{
  const lab = await startLab({ lang });
  const app = await lab.openApp('publipostage');
  check('Publipostage+ est ouvert dans la première section', Boolean(app) && lab.page.frames().filter(f => /\/apps\/publipostage\//.test(f.url())).length === 1);
  const seen = await addSectionAndLook(lab, lab.frame, `${WIDGET}${query}`);
  check('avec GFS : le cadre de GFS est rechargé (l\'ancien document est détaché, la marque a disparu)', seen.detached && seen.changed && !seen.markKept, { detached: seen.detached, changed: seen.changed, markKept: seen.markKept });
  check('avec GFS : c\'est le même élément <iframe>, déplacé par Grist', seen.sameElement);
  await seen.now.waitForFunction(() => document.body && document.body.dataset.gfs === 'ready', null, { timeout: 60000 }).catch(() => {});
  const facts = await seen.now.evaluate(() => ({ explorateurVisible: !document.querySelector('.ex').hidden, cadresDApp: document.querySelectorAll('.app-frame').length })).catch(() => null);
  say('ce que la personne voit ensuite :', facts);
  check('GFS repart de zéro : l\'explorateur est affiché et l\'app n\'est plus ouverte (contrats 3.1, point 6)', facts && facts.explorateurVisible && facts.cadresDApp === 0 && lab.page.frames().filter(f => /\/apps\/publipostage\//.test(f.url())).length === 0, facts);
  await lab.browser.close();
}
