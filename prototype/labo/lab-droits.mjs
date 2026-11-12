// ATTENTION (12/11) : la pastille du pied (« Pas protégé ») est retirée, choix du porteur : le panneau « Permissions » n'a plus de porte dans l'explorateur et ce banc, qui l'ouvrait par elle, ne
// se rejoue plus tel quel. Une carte propose de supprimer le panneau ou de lui rendre une porte.
// Les gestes communs des essais de droits dans un VRAI Grist (labo/run-droits.mjs, labo/run-poser.mjs) : le cadre de GFS prêt après un rechargement, le mot du pied, le panneau « Permissions »,
// une action envoyée à l'API du document. Un seul endroit, pour que les essais ne se recopient pas.

import { contrastProblems } from './lab-pdf.mjs';

// Le cadre de GFS (accès complet) prêt, après une ouverture ou un rechargement de la page par Grist. Une fenêtre déjà ouverte est fermée, sauf avec `keep` (le panneau que GFS rouvre après une pose).
export async function gfsFrame(page, { keep = false } = {}) {
  for (let i = 0; i < 120; i++) {
    const frame = page.frames().find(each => /\/prototype\/index\.html/.test(each.url()) && /access=full/.test(each.url()));
    if (frame) {
      const ready = await frame.evaluate(() => document.body.dataset.gfs === 'ready' && document.body.dataset.gfsFirstRun === 'done').catch(() => false);
      if (ready) { await page.waitForTimeout(600); if (!keep && await frame.locator('.mod-scrim').count()) await page.keyboard.press('Escape'); return frame; }
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Le cadre de GFS ne s\'est pas rouvert.');
}

export const chip = frame => frame.locator('.rights-chip');
// Le mot du pied, une fois la lecture faite.
export async function chipWord(frame, word) {
  await frame.waitForFunction(expected => document.querySelector('.rights-chip') && document.querySelector('.rights-chip').dataset.word === expected, word, { timeout: 20000 }).catch(() => {});
  return chip(frame).innerText();
}
export async function openPanel(page, frame) {
  await chip(frame).click();
  await frame.locator('.mod.rt .rt-content').waitFor({ timeout: 20000 });
  await page.waitForTimeout(300);
}
export const closePanel = async (page, frame) => { await page.keyboard.press('Escape'); await frame.locator('.mod.rt').waitFor({ state: 'detached' }); };
export const apply = (page, id, actions) => page.evaluate(async ([doc, list]) => (await fetch(`/api/docs/${doc}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(list) })).status, [id, actions]);


// Le propriétaire partage le document à un éditeur et à un lecteur (les comptes d'essai de labo/vrai-serveur.sh) ; rend le code de la réponse.
export const shareWithEditorAndViewer = (page, id) => page.evaluate(async doc => (await fetch(`/api/docs/${doc}/access`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ delta: { users: { 'editor@example.com': 'editors', 'viewer@example.com': 'viewers' } } }) })).status, id);

// Les lignes d'une table du document, par l'API REST (la session de la page) : [{ id, fields }].
export const records = (page, id, table) => page.evaluate(async ([doc, name]) => {
  const response = await fetch(`/api/docs/${doc}/tables/${name}/records`);
  return response.ok ? (await response.json()).records : { status: response.status };
}, [id, table]);

// La fenêtre du dessus tient dans la page, son titre et son pied restent en place (le contenu défile), rien n'en sort de côté, et ses textes tiennent le contraste de la charte.
export const fits = async (frame, selector) => (await contrastProblems(frame, selector)).length === 0 && JSON.stringify(await frame.evaluate(sel => {
  const mod = document.querySelector(sel);
  const box = mod.getBoundingClientRect();
  const head = mod.querySelector('.mod-head').getBoundingClientRect();
  const foot = mod.querySelector('.mod-foot').getBoundingClientRect();
  const aside = [...mod.querySelectorAll('.mod-head *, .mod-foot *, .ask-body *, .rt-body *')].filter(node => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); }).length;
  return { inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight, sticky: head.bottom <= foot.top + 1, aside };
}, selector)) === '{"inPage":true,"sticky":true,"aside":0}';

