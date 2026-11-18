// Le sous-menu « Nouveau > Importer » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; 17/11 : HTML et OpenDocument
// rejoignent Excel, Markdown, PowerPoint et Word, soit huit lignes avec le PDF de GFS et « D'un autre document Grist… »). Le vrai explorateur (test/pages/explorateur.js) reçoit
// les articles que le vrai contrôleur lui donnerait : ceux du manifeste de Publipostage+ (test/helpers.mjs), avec la mention d'une app parmi plusieurs (« Document · Publipostage+ »,
// le cas le plus long), puis le PDF et « D'un autre document Grist… ». À mesurer, à 700 px (le panneau de référence) à la vraie souris et au vrai clavier : « Nouveau » ouvre « Nouveau
// dossier », « Depuis un modèle… » et « Importer » ; « Importer » ouvre ses huit lignes dans l'ordre, chacune de 28 px, aucun nom coupé, tout dans la page, sans recouvrir la ligne qui l'ouvre ; un clic sur
// « HTML » puis sur « OpenDocument » rend à l'explorateur le format choisi ; Échap ferme le sous-menu, puis le menu.
import { createI18n } from '../js/i18n/i18n.js';
import { importFormats } from '../js/files/import-file.js';
import { label } from '../js/apps/manifest.js';
import { familyOf } from '../js/explorer/explorer-model.js';
import { FILES_MANIFEST } from '../js/files/gfs-files.js';
import { publipostage } from './helpers.mjs';
import { Run } from './corbeille-firefox.mjs';

// Les huit lignes dans l'ordre : les six formats de Publipostage+ (dans l'ordre de son manifeste), le PDF que GFS garde, puis le partage reçu.
const ROWS = {
  fr: ['Excel', 'Markdown', 'PowerPoint', 'Word', 'HTML', 'OpenDocument', 'PDF', 'D’un autre document Grist…'],
  en: ['Excel', 'Markdown', 'PowerPoint', 'Word', 'HTML', 'OpenDocument', 'PDF', 'From another Grist document…'],
};

// Les articles que `Entries.importTypes` (js/broker/entries.js) rendrait ; la page d'essai les prend dans `window.__importTypes`.
function importEntries(language) {
  const { t } = createI18n(language);
  const manifest = publipostage();
  const asEntry = (app, { item, type }, hint) => ({
    app, type: type.valeur, icon: type.icone || 'doc', family: familyOf(type.couleur) || null, greyed: false, focus: null, reason: '',
    valeur: item.valeur, extensions: item.extensions, label: label(item.nom, language), hint,
  });
  return [
    ...importFormats(manifest).map(format => asEntry(manifest.id, format, `${label(format.type.nom, language)} · ${label(manifest.nom, language)}`)),
    ...importFormats(FILES_MANIFEST).map(format => asEntry('gfs-files', format, t('files.import.hint'))),
    { action: 'receive', icon: 'download', family: null, greyed: false, reason: '', focus: null, label: t('sr.entry'), hint: t('sr.entry.hint') },
  ];
}

function measureNewMenu() {
  const menu = document.querySelector('.menu:not(.menu-sub)');
  const sub = document.querySelector('.menu-sub');
  if (!menu) return null;
  const describe = node => {
    const frame = node.getBoundingClientRect();
    const items = [...node.querySelectorAll('.menu-item')].map(item => {
      const rect = item.getBoundingClientRect();
      const name = item.querySelector('.menu-label');
      const hint = item.querySelector('.menu-hint');
      return {
        label: name.textContent, popup: item.getAttribute('aria-haspopup') === 'menu', height: rect.height, cut: name.scrollWidth > name.clientWidth + 1,
        hintCut: Boolean(hint && hint.scrollWidth > hint.clientWidth + 1), hint: hint ? hint.textContent : '',
        frame: [rect.left, rect.top, rect.right, rect.bottom], center: [rect.left + rect.width / 2, rect.top + rect.height / 2],
      };
    });
    return { frame: [frame.left, frame.top, frame.right, frame.bottom], items, scrolls: node.scrollHeight > node.clientHeight + 1 };
  };
  return { view: [document.documentElement.clientWidth, document.documentElement.clientHeight], menu: describe(menu), sub: sub ? describe(sub) : null };
}

const inside = (frame, [width, height]) => frame[0] >= -0.5 && frame[1] >= -0.5 && frame[2] <= width + 0.5 && frame[3] <= height + 0.5;
const overlaps = (a, b) => a[0] < b[2] - 0.5 && a[2] > b[0] + 0.5 && a[1] < b[3] - 0.5 && a[3] > b[1] + 0.5;
const openMenus = () => ({ menus: document.querySelectorAll('.menu').length, imported: window.__imported || null });

export async function importerProblems(page, language, tag) {
  const found = [];
  const run = new Run(page, tag, found, 'menu « Nouveau > Importer »');
  const centerOfNew = () => {
    const button = document.querySelector('button use[href="#i-plus"]').closest('button');
    const box = button.getBoundingClientRect();
    return [box.left + box.width / 2, box.top + box.height / 2];
  };
  await page.run(entries => { window.__importTypes = entries; window.__imported = null; }, importEntries(language));
  await page.click(...await page.run(centerOfNew));
  const shown = await page.until(measureNewMenu, [], 1500).catch(() => null);
  if (!shown) { run.note('sans menu', 'le clic sur « Nouveau » n\'ouvre aucun menu'); await page.run(() => { window.__importTypes = []; }); return found; }
  const names = shown.menu.items.map(item => item.label);
  if (names.length !== 3 || !shown.menu.items[2].popup) run.note('le menu', `« Nouveau » montre « ${names.join(' | ')} » au lieu de « Nouveau dossier », « Depuis un modèle… » et du sous-menu « Importer »`);
  await page.click(...shown.menu.items[2].center);
  const sub = await page.until(measureNewMenu, [], 1500).then(state => (state.sub ? state : null)).catch(() => null);
  if (!sub) {
    run.note('sans sous-menu', 'la ligne « Importer » n\'ouvre aucun sous-menu');
  } else {
    const rows = sub.sub.items.map(item => item.label);
    if (rows.join('|') !== ROWS[language].join('|')) run.note('les lignes', `le sous-menu a « ${rows.join(' | ')} » au lieu de « ${ROWS[language].join(' | ')} »`);
    for (const item of sub.sub.items) {
      if (Math.abs(item.height - 28) > 0.5) run.note('hauteur d\'une ligne', `« ${item.label} » mesure ${item.height} px au lieu de 28`);
      if (item.cut) run.note('nom coupé', `le nom de « ${item.label} » est coupé`);
      if (!inside(item.frame, sub.view)) run.note('ligne hors de la page', `la ligne « ${item.label} » sort de la page de ${sub.view.join(' × ')} px`);
    }
    if (sub.sub.scrolls) run.note('défilement', 'le sous-menu défile : ses huit lignes devaient tenir dans la page');
    if (!inside(sub.sub.frame, sub.view)) run.note('hors de la page', `le sous-menu (${sub.sub.frame.map(Math.round).join(', ')}) sort de la page de ${sub.view.join(' × ')} px`);
    if (overlaps(sub.sub.frame, sub.menu.items[2].frame)) run.note('recouvre sa ligne', 'le sous-menu « Importer » recouvre la ligne qui l\'ouvre');
    for (const wanted of ['HTML', 'OpenDocument']) {
      const row = sub.sub.items.find(item => item.label === wanted);
      if (!row) continue;
      if (!/Document · Publipostage\+$|document · Publipostage\+$/i.test(row.hint)) run.note(`« ${wanted} » : la mention`, `la mention est « ${row.hint} » au lieu de « Document · Publipostage+ »`);
    }
    // Un clic de la vraie souris sur « HTML » rend le format à l'explorateur et ferme les menus ; puis « OpenDocument » de même.
    for (const [wanted, valeur] of [['HTML', 'html'], ['OpenDocument', 'opendocument']]) {
      await page.click(...await page.run(centerOfNew));
      const again = await page.until(measureNewMenu, [], 1500).catch(() => null);
      if (!again) { run.note(`« ${wanted} » : sans menu`, 'le menu « Nouveau » ne se rouvre pas'); break; }
      await page.click(...again.menu.items[2].center);
      const list = await page.until(measureNewMenu, [], 1500).then(state => (state.sub ? state : null)).catch(() => null);
      const row = list && list.sub.items.find(item => item.label === wanted);
      if (!row) { run.note(`« ${wanted} » : sans ligne`, 'la ligne manque au sous-menu'); break; }
      await page.click(...row.center);
      const after = await page.run(openMenus);
      if (after.imported !== valeur) run.note(`« ${wanted} » : le clic`, `un clic sur « ${wanted} » rend « ${after.imported} » à l'explorateur au lieu de « ${valeur} »`);
      if (after.menus !== 0) run.note(`« ${wanted} » : les menus se ferment`, `${after.menus} menu(s) restent ouverts après le choix`);
      await page.run(() => { window.__imported = null; });
    }
  }
  // Échap : un premier ferme le sous-menu, un second le menu (clavier de Grist Factory).
  await page.click(...await page.run(centerOfNew));
  const last = await page.until(measureNewMenu, [], 1500).catch(() => null);
  if (last) {
    await page.click(...last.menu.items[2].center);
    await page.until(measureNewMenu, [], 1500).catch(() => null);
    await page.press('Escape');
    let now = await page.run(() => ({ main: document.querySelectorAll('.menu:not(.menu-sub)').length, sub: document.querySelectorAll('.menu-sub').length }));
    if (now.sub !== 0 || now.main !== 1) run.note('Échap : le sous-menu d\'abord', `un premier Échap laisse ${now.main} menu et ${now.sub} sous-menu au lieu d'un menu seul`);
    await page.press('Escape');
    now = await page.run(openMenus);
    if (now.menus !== 0) run.note('Échap : puis le menu', `un second Échap laisse ${now.menus} menu(s) ouverts`);
  } else {
    run.note('sans menu', 'le menu « Nouveau » ne se rouvre pas pour essayer Échap');
  }
  await page.run(() => { for (const menu of document.querySelectorAll('.menu')) menu.remove(); window.__importTypes = []; window.__imported = null; });
  return found;
}
