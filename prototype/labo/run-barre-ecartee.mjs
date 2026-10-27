// La barre de GFS devant la vraie Publipostage+ une fois sa consigne 025 faite (l'app à 727c083 ou après : c'est là que sa barre d'outils laisse un vide à la barre), dans un vrai Grist (grist-static), à la vraie souris : « rien ne doit passer sous la barre » aux quatre bords,
// à 700 × 400 puis dans un cadre plus petit (560 × 300) et un cadre bas (700 × 180, pour le logo et la sortie de la Lecture épurée). La zone est celle que GFS envoie à l'app (`contexte.barre`, lue par `GfsBar.zone()`) ;
// pour chaque taille et chaque bord on vérifie d'abord que cette zone est la barre que GFS dessine, agrandie de 4 px, puis, dans la page de l'app et à chaque scénario (barre-ecartee-scenarios.mjs), qu'aucune partie de
// l'app n'en recouvre un pixel : la page au repos, les menus de la barre d'outils, les info-bulles, les listes et panneaux, les fenêtres, les barres flottantes d'un tableau et d'une image, la liste des variables, la Lecture épurée ;
// puis, dans une présentation (barre-ecartee-presentation.mjs), la bande des diapositives, ses menus, les fenêtres Transition, Fond et Notes, le volet « Importer », le ▶ et la pastille du zoom, et « Présenter », qui masque
// la barre et la rend à chaque sortie (barre-ecartee-diaporama.mjs).
// La barre d'outils est jugée contre la barre elle-même (le vide qu'elle lui laisse aux quatre bords, le choix du porteur du 22/10) ; ce qui n'entre que dans la marge de 4 px de la zone est dit à part, jamais compté en
// échec. LAB_LANG=fr|en, LAB_SCHEME=light|dark ;
// SIZES=700x400,560x300 EDGES=gauche,haut ONLY=menus,infobulles pour une mise au point (les parties ne tournent alors que pour ce qu'on nomme) :
// repos, menus, infobulles, listes, fenetres, flottantes, variables, lecture, puis presentation (toutes ses parties) ou l'une d'elles : diapos-repos, diapos-menus, diapos-fenetres, diapos-volet, presenter.
// Le cadre de Grist est « ordinaire » (sans le `credentialless` de grist-static, lab-setup.mjs) : « Présenter » ouvre une fenêtre à part, dont le `window.opener` est coupé par cet attribut sous Chromium.
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { stands, judge, asked } from './barre-ecartee-lab.mjs';
import * as S from './barre-ecartee-scenarios.mjs';
import { PARTS, seedDeck, runPresentation } from './barre-ecartee-presentation.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `barre-ecartee-${lang}-${scheme}`;
const list = name => (process.env[name] ? process.env[name].split(',').map(item => item.trim()) : null);
const onlySizes = list('SIZES');
const onlyEdges = list('EDGES');
const onlyParts = list('ONLY');
const wanted = name => !onlyParts || onlyParts.includes(name);
const OPEN = 'Contrat de prestation';

const lab = await startLab({ lang, colorScheme: scheme, ordinaryFrame: true });
const { page } = lab;
const errors = [];
page.on('pageerror', error => errors.push(String(error && error.message).slice(0, 160)));
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
await seedDeck(lab.frame);
const frame = lab.frame;
await frame.locator('.ls-row', { hasText: OPEN }).first().waitFor({ timeout: 30000 }).catch(() => {});
const app = await lab.openApp('publipostage', /\/apps\/publipostage\//, frame);
await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const base = await app.evaluate(() => Editor.getHTML());
const ctx = { lab, page, frame, app, lang, run, onlySizes, onlyEdges, wanted };

const inMargin = [];
if (['repos', 'menus', 'infobulles', 'listes', 'fenetres', 'flottantes', 'variables', 'lecture'].some(wanted)) {
  for await (const { tag, edge, r } of stands(ctx)) {
    if (wanted('repos')) {
      const rest = await S.atRest(r);
      judge(tag, 'la page au repos', rest, asked(r.size, 'repos'));
      if (rest.barreDOutils.length) { inMargin.push({ tag, boutons: rest.barreDOutils }); say(`   ${tag} : la barre d'outils entre dans la marge de la zone (la barre n'est pas touchée) : ${rest.barreDOutils.length} bouton(s)`, rest.barreDOutils); }
      await lab.shotPanel(run, `${r.size[0]}x${r.size[1]}-${edge}`, frame);
    }
    if (wanted('menus')) judge(tag, 'les menus de la barre d\'outils', await S.menus(r), asked(r.size, 'menus'));
    if (wanted('infobulles')) judge(tag, 'les info-bulles', await S.tooltips(r), asked(r.size, 'infobulles'));
    if (wanted('listes')) judge(tag, 'les listes et panneaux', await S.lists(r), asked(r.size, 'listes'));
    if (wanted('fenetres')) judge(tag, 'les fenêtres', await S.windows(r), asked(r.size, 'fenetres'));
    if (wanted('flottantes')) judge(tag, 'les barres flottantes', await S.floating(r, base), asked(r.size, 'flottantes'));
    if (wanted('variables')) judge(tag, 'la liste des variables', await S.variableList(r, base), asked(r.size, 'variables'));
    if (wanted('lecture')) judge(tag, 'la Lecture épurée', await S.cleanReading(r), asked(r.size, 'lecture'));
  }
}
say(`barre d'outils : ${inMargin.length} cas (taille, bord) où des boutons entrent dans la marge de 4 px de la zone, sans toucher la barre`, inMargin.map(item => `${item.tag} : ${item.boutons.length}`));

if (['presentation', ...PARTS].some(wanted)) await runPresentation(ctx);

check('aucune erreur de page pendant la passe', errors.length === 0, errors);
await lab.browser.close();
