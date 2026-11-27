// Les sorties des fenêtres de GFS sous Firefox (test/sorties-firefox.mjs) : « Annuler » ou « Fermer » à la vraie souris, la croix et Échap, sur chaque fenêtre de l'explorateur et de l'annuaire (demande du porteur du 27/11, après le
// bouton « Annuler » de « Déplacer » qui ne fermait pas sa fenêtre). Un essai à part, court : il se lance seul (`node --test test/sorties-firefox.test.mjs`). À 700 × 400, le panneau de référence ; la sortie d'une fenêtre ne dépend ni de la
// langue ni du mode, mais le texte des boutons oui (« Annuler », « Cancel ») : le français se joue en clair et l'anglais en sombre, de quoi voir chaque axe une fois.
// Firefox absent : l'essai est SAUTÉ, et le dit (`labo/installer-firefox.sh` le pose dans le cloud ; `GFS_FIREFOX=<fichier exécutable>` désigne celui de la machine).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { findFirefox, serveSite, startFirefox } from './firefox.mjs';
import { sortiesAnnuaireProblems, sortiesProblems } from './sorties-firefox.mjs';

const PAGE = '/essai-explorateur.html';
const ANNUAIRE_PAGE = '/essai-annuaire.html';
const RUNS = [{ language: 'fr', mode: 'light' }, { language: 'en', mode: 'dark' }];

const firefox = findFirefox();
const SKIP = firefox ? false : 'Firefox introuvable (labo/installer-firefox.sh, ou GFS_FIREFOX)';
if (!firefox) process.stderr.write('Firefox introuvable : les sorties des fenêtres ne sont PAS mesurées sous Firefox (labo/installer-firefox.sh, ou GFS_FIREFOX).\n');

// La page d'essai : les feuilles de style et la carte d'importation de index.html, dans son ordre ; le reste est `script`.
function essayPage(script) {
  const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const sheets = index.match(/<link rel="stylesheet"[^>]*>/g) || [];
  const importMap = (index.match(/<script type="importmap">[\s\S]*?<\/script>/) || [''])[0];
  assert.ok(sheets.length >= 3 && importMap, 'index.html : ses feuilles de style et sa carte d\'importation');
  return `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>essai</title>\n${sheets.join('\n')}\n${importMap}\n</head>\n`
    + `<body><main class="stage" id="stage"></main><script type="module" src="${script}"></script></body></html>`;
}

function report(problems) {
  return `${problems.length} sortie(s) de fenêtre à reprendre :\n${problems.map(({ text }) => `    ${text}`).join('\n')}`;
}

describe('les sorties des fenêtres sous Firefox', () => {
  let site;
  let browser;

  before(async () => {
    if (!firefox) return;
    site = await serveSite(ROOT, { [PAGE]: essayPage('/test/pages/explorateur.js'), [ANNUAIRE_PAGE]: essayPage('/test/pages/annuaire.js') });
    browser = await startFirefox(firefox);
  });

  after(async () => {
    if (browser) await browser.close();
    if (site) await site.close();
  });

  for (const { language, mode } of RUNS) {
    const label = `${language === 'fr' ? 'français' : 'anglais'}, ${mode === 'dark' ? 'sombre' : 'clair'}`;
    const tag = `${language}, 700 px, ${mode === 'dark' ? 'sombre' : 'clair'}`;

    test(`les fenêtres de l'explorateur se quittent par leur bouton et par Échap (${label})`, { skip: SKIP, timeout: 300000 }, async () => {
      const { page } = browser;
      await page.goto(`${site.url}${PAGE}?lang=${language}`);
      await page.run(() => window.__ready);
      await page.view({ width: 700, scale: 1, mode });
      const problems = await sortiesProblems(page, language, tag);
      assert.equal(problems.length, 0, report(problems));
    });

    test(`les fenêtres de l'annuaire se quittent par leur bouton, leur croix et Échap (${label})`, { skip: SKIP, timeout: 400000 }, async () => {
      const { page } = browser;
      const problems = await sortiesAnnuaireProblems(page, language, tag, { base: `${site.url}${ANNUAIRE_PAGE}`, width: 700, mode });
      assert.equal(problems.length, 0, report(problems));
    });
  }
});
