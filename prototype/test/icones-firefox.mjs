// Les icônes des types de fichier sous Firefox (décision du porteur, 04/11 : elles suivent l'ambiance, et le PDF a sa couleur rouge ; règle du 03/11 : toute nouvelle interface ajoute ses mesures à
// test/interfaces-firefox.test.mjs). La page d'essai (test/pages/explorateur.js) pose l'ambiance comme GFS le fait (le vrai `ThemeSetting` et le vrai `ThemeHost`, le mode vient de `data-grist-appearance`) ; pour
// chacune des ambiances, en clair et en sombre, ce qui est LU est ce que Firefox calcule pour l'icône de chaque fichier, dans la liste, dans les vignettes et dans la barre d'information : sa couleur (celle du tableau
// de js/theme/ambiance-types.js), l'épaisseur de son trait, ses angles et ses bouts, son remplissage doux (Pop) et son halo (Enseigne) ; la lecture et le jugement sont ceux du labo (labo/mesures-icones.mjs, joués aussi dans
// un vrai Grist par labo/run-theme.mjs). Puis la fenêtre « Thème », ouverte quand la page porte Pop : chaque vignette garde les couleurs de type de SON ambiance (une vignette sous la page ne reprend pas celles
// de la page). Rien de cela ne dépend de la langue : la mesure ne passe qu'en français. Le 04/11, cette mesure a trouvé ce que Node et Chromium ne voyaient pas : Firefox refuse un NOMBRE calculé pour
// `stroke-width` (`calc(1.8 * var(--ic-k))` y tombe à 1 px sans rien dire) ; le trait s'écrit donc en longueur (`calc(1.8px * var(--ic-k))`).
import { AMBIANCES, DEFAULT_AMBIANCE } from '../js/theme/ambiance.js';
import { typeTokens } from '../js/theme/ambiance-types.js';
import { STROKE, infoProblems, readIcons, rgbOf, rowProblems } from '../labo/mesures-icones.mjs';

const MODES = [['light', 'clair'], ['dark', 'sombre']];
// Les fichiers de la page d'essai (test/pages/explorateur.js) : un par famille, un fichier grisé (son extension est éteinte), un dossier ; `fam` : la famille que le modèle doit leur donner.
const SAMPLES = [
  { name: 'Convocation', fam: 'doc' }, { name: 'Grille de suivi', fam: 'grid' }, { name: 'Main', fam: 'slides' }, { name: 'Attestation.pdf', fam: 'pdf' },
  { name: 'Autre format', fam: null, locked: true }, { name: 'Formation', fam: null, folder: true },
];

// ---------- ce qui s'exécute dans la page (rien du module n'y est visible) ----------

// Le centre du bouton de la page qui porte l'icône `glyph` (le choix de la liste ou des vignettes).
const glyphCenter = glyph => { const box = document.querySelector(`button use[href="#i-${glyph}"]`).closest('button').getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };

// Le centre du nom de la ligne `name` de la liste, amenée à l'écran (un clic la choisit : la barre d'information parle d'elle).
const rowCenter = name => {
  const row = [...document.querySelectorAll('.ls-row')].find(item => item.querySelector('.t').textContent === name);
  row.scrollIntoView({ block: 'nearest' });
  const box = row.querySelector('.t').getBoundingClientRect();
  return [box.left + Math.min(box.width / 2, 40), box.top + box.height / 2];
};

// Le centre du bouton « Réglages » de l'explorateur (depuis le 04/11 la fenêtre « Thème » s'ouvre par sa ligne), puis celui de la ligne « Thème… » du menu, la deuxième.
const settingsButtonCenter = () => { const box = document.querySelector('.ex-title-row .tb:not(.tb-bell)[aria-haspopup="menu"]').getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };
const themeRowCenter = () => { const row = document.querySelectorAll('.menu:not(.menu-sub) .menu-item')[1]; if (!row) return null; const box = row.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };

// L'ambiance posée sur la page, comme la lit la feuille de style : `data-ambiance`, ou null pour l'ambiance d'origine.
const posed = id => { window.__ambiance(id); return document.documentElement.getAttribute('data-ambiance'); };

// La fenêtre « Thème » : l'identifiant de chaque vignette et la couleur de fond de sa pastille « document ».
function readThemeWindow() {
  const tiles = [...document.querySelectorAll('.th-win label.amb')];
  if (tiles.length < 5) return null;
  return tiles.map(tile => ({ id: tile.querySelector('input').value, pill: getComputedStyle(tile.querySelector('.mn-p[data-fam="doc"]')).backgroundColor }));
}

// ---------- ce que l'essai constate : des écarts { kind, text } ----------

// Les fichiers de la page d'essai, lus : chacun est là, de la bonne famille, et son icône a la couleur et le trait de l'ambiance.
function readingProblems(read, ctx) {
  const found = [];
  for (const sample of SAMPLES) {
    const row = read.rows.find(item => item.name === sample.name);
    if (!row) { found.push({ kind: 'icône de type : fichier absent', text: `${ctx.tag}, « ${sample.name} » : la page ne montre pas ce fichier` }); continue; }
    if (row.fam !== sample.fam) found.push({ kind: 'icône de type : famille', text: `${ctx.tag}, « ${sample.name} » : famille ${row.fam} au lieu de ${sample.fam}` });
    found.push(...rowProblems(row, ctx));
  }
  return found;
}

// Pour chaque ambiance, en clair et en sombre : la liste (et la barre d'information du fichier choisi), puis les vignettes.
async function strokeProblems(page) {
  const found = [];
  const missing = AMBIANCES.filter(id => !STROKE[id]);
  if (missing.length) found.push({ kind: 'ambiance sans mesure', text: `labo/mesures-icones.mjs ne dit pas le trait de ${missing.join(', ')}` });
  for (const [appearance, mode] of MODES) {
    await page.view({ width: 700, scale: 1, mode: appearance });
    for (const display of ['list', 'tiles']) {
      if (display === 'tiles') {
        await page.click(...await page.run(glyphCenter, 'tiles'));
        await page.until(() => document.querySelector('.th'));
      } else {
        await page.click(...await page.run(rowCenter, 'Convocation'));
        await page.until(() => document.querySelector('.ls-row[aria-selected="true"]'));
      }
      for (const id of AMBIANCES.filter(item => STROKE[item])) {
        const shown = await page.run(posed, id);
        const tag = `${id}, ${mode}, ${display === 'tiles' ? 'vignettes' : 'liste'}`;
        if ((shown || DEFAULT_AMBIANCE) !== id) { found.push({ kind: 'ambiance non posée', text: `${tag} : la page porte « ${shown} »` }); continue; }
        const read = await page.run(readIcons, { display });
        found.push(...readingProblems(read, { id, mode, display, tag }));
        if (display === 'list') found.push(...infoProblems(read.info, 'doc', { id, mode, tag }));
      }
      await page.run(posed, DEFAULT_AMBIANCE);
      if (display === 'tiles') {
        await page.click(...await page.run(glyphCenter, 'list'));
        await page.until(() => !document.querySelector('.th-grid'));
      }
    }
  }
  return found;
}

// La fenêtre « Thème » ouverte quand la page porte Pop : ses vignettes d'origine, de Papier et de Brut (pastille « document » à fond doux) gardent les couleurs de type de leur ambiance, pas celles de la page.
async function themeWindowProblems(page) {
  const found = [];
  for (const [appearance, mode] of MODES) {
    await page.view({ width: 700, scale: 1, mode: appearance });
    await page.run(posed, 'pop');
    await page.click(...await page.run(settingsButtonCenter));
    await page.click(...await page.until(themeRowCenter));
    const tiles = await page.until(readThemeWindow);
    for (const tile of tiles.filter(item => ['defaut', 'papier', 'brut'].includes(item.id))) {
      const wanted = rgbOf(typeTokens(tile.id, mode)['--t-doc-soft']);
      if (tile.pill !== wanted) found.push({ kind: 'fenêtre « Thème » : couleurs de type', text: `page en Pop, ${mode} : la vignette « ${tile.id} » a une pastille ${tile.pill} au lieu de ${wanted}` });
    }
    await page.press('Escape');
    await page.until(() => !document.querySelector('.th-win'));
    await page.run(posed, DEFAULT_AMBIANCE);
  }
  return found;
}

export async function iconProblems(page) {
  await page.view({ width: 700, scale: 1, mode: 'light' });
  await page.run(() => { window.__reset(); window.__withPdf(); });
  const problems = [...await strokeProblems(page), ...await themeWindowProblems(page)];
  await page.run(() => window.__reset()); // le PDF, la sélection et l'ambiance repartent comme au début
  return problems;
}
