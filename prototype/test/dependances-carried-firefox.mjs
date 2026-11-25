// « Portées par l'app » dans la fenêtre « Dépendances » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; demande du porteur du 18/11 :
// « Oui, déclaré par chaque app »). La vraie fenêtre, ouverte à la vraie souris par « Réglages » puis « Dépendances… » (test/pages/explorateur.js, `window.__carried`) : le vrai manifeste de
// Publipostage+ déclare ses neuf bibliothèques, Automation+ (installée) déclare n'en charger aucune, Form+ (pas installée) déclare Leaflet. À mesurer : le bloc est sous l'app, noté « déclarée par l'app »,
// avec ses colonnes ; le sous-titre compte les déclarées ; chaque ligne dit son moment, ce qu'elle contient, sa version et son hôte, sans mot coupé ni débordement à 700 × 400 ; un clic déplie
// l'origine, la version, ce qu'elle contient, l'adresse, le moment, la précision ; aucun lien n'y est offert ; les filtres autres que « Toutes » les écartent ; la recherche les trouve par ce
// qu'elles contiennent ; l'app qui n'en charge aucune le dit ; celles d'une app non installée sont dans le panneau refermé ; l'export les garde ; le clavier va du dernier réglage de GFS aux lignes déclarées.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createI18n } from '../js/i18n/i18n.js';
import { Run, centerOfSelector, closeLeftOpen } from './corbeille-firefox.mjs';
import { centerOfMenuItem } from './copier-firefox.mjs';
import { ROOT } from './helpers.mjs';
import { expectedRows } from './dependances-firefox.mjs';

// Ce que la page montre du bloc « Portées par l'app » de chaque app, et de la fenêtre autour.
function state() {
  const t = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const modal = document.querySelector('.mod.dp');
  if (!modal) return { modal: null, saved: (window.__saved || []).map(file => ({ name: file.name, text: file.text })) };
  const box = modal.getBoundingClientRect();
  const body = modal.querySelector('.dp-body');
  const over = node => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); };
  const item = li => {
    const row = li.querySelector('.dp-row');
    const cells = [...row.querySelectorAll(':scope > .dp-cell')];
    const detail = li.querySelector('.dp-detail');
    return { key: li.dataset.key, fk: row.dataset.fk, name: t(row.querySelector('.dp-name')), sub: t(row.querySelector('.dp-sub')), version: t(cells[1]), host: t(cells[2]),
      expanded: row.getAttribute('aria-expanded'), height: Math.round(row.getBoundingClientRect().height), wide: over(row),
      clipped: [...row.querySelectorAll('.dp-name, .dp-sub, .dp-ver, .dp-host')].filter(node => node.scrollWidth > node.clientWidth + 1).length,
      detail: detail ? { facts: [...detail.querySelectorAll('.dp-fact')].map(fact => ({ title: t(fact.querySelector('dt')), body: t(fact.querySelector('dd')) })),
        wide: over(detail) || detail.scrollWidth > detail.clientWidth + 1, links: detail.querySelectorAll('a').length } : null };
  };
  const blocks = [...modal.querySelectorAll('.dp-carried')].map(block => {
    const group = block.closest('.dp-group');
    return { group: group.dataset.group, inMore: Boolean(group.closest('.dp-more')), title: t(block.querySelector('h4')), count: t(block.querySelector('.dp-carried-head > .dp-sub')),
      chip: t(block.querySelector('.dp-carried-head .dp-chip')), note: t(block.querySelector('.dp-carried-note')), role: block.getAttribute('role'),
      labelled: t(document.getElementById(block.getAttribute('aria-labelledby'))), cols: [...block.querySelectorAll('.dp-carried-cols > span')].map(t).filter(Boolean),
      colsOver: [...block.querySelectorAll('.dp-carried-cols *')].filter(over).length, links: block.querySelectorAll('.dp-ext, a:not(.dp-link)').length,
      items: [...block.querySelectorAll('.dp-item')].map(item) };
  });
  const active = document.activeElement;
  return { modal: { count: t(modal.querySelector('.mod-count')), apps: t(modal.querySelector('.dp-apps')), blocks, focus: active && active.dataset ? active.dataset.fk || null : null,
    groups: [...modal.querySelectorAll('.dp-group')].map(group => ({ id: group.dataset.group, name: t(group.querySelector('h3')), count: t(group.querySelector('.dp-group-head > .dp-sub')),
      chip: t(group.querySelector('.dp-group-head .dp-chip')), inMore: Boolean(group.closest('.dp-more')), rows: group.querySelectorAll('.dp-list > .dp-item:not(.dp-carried .dp-item)').length })),
    more: (() => { const button = modal.querySelector('.dp-more-btn'); return button ? { text: t(button), expanded: button.getAttribute('aria-expanded') } : null; })(),
    empty: !modal.querySelector('.dp-empty').hidden, gfsRows: [...modal.querySelectorAll('.dp-item')].filter(li => !li.closest('.dp-carried')).map(li => li.dataset.key),
    chips: [...modal.querySelectorAll('.dp-filter')].map(chip => ({ filter: chip.dataset.filter, pressed: chip.getAttribute('aria-pressed') })),
    inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1, hscroll: body.scrollWidth > body.clientWidth + 1 },
  saved: (window.__saved || []).map(file => ({ name: file.name, text: file.text })) };
}

const settingsAt = () => { const button = document.querySelector('button use[href="#i-sliders"]').closest('button'); const box = button.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };
const buttonAt = selector => { const node = document.querySelector(selector); if (!node) return null; node.scrollIntoView({ block: 'center' }); const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };

const WHEN_RANK = { demarrage: 0, usage: 1, option: 2 };

export async function carriedProblems(page, language, tag) {
  const found = [];
  const { t } = createI18n(language);
  const run = new Run(page, tag, found, '« Portées par l\'app »');
  const snap = () => page.run(state);
  const expect = async (kind, what, test) => {
    let now = await snap();
    for (let i = 0; i < 60 && !test(now); i += 1) { await new Promise(resolve => setTimeout(resolve, 75)); now = await snap(); }
    if (!test(now)) run.note(kind, `${what} (état : ${JSON.stringify(now).slice(0, 600)})`);
    return now;
  };
  const block = (now, group) => now.modal && now.modal.blocks.find(each => each.group === group);
  const declared = JSON.parse(readFileSync(join(ROOT, 'manifestes/publipostage.json'), 'utf8')).portees;
  const pick = key => declared.find(entry => entry.id === key);
  // Ce que le bloc montre : une entrée dont le paquet est déjà servi par GFS à Publipostage+ est ôtée, sa ligne est celle de GFS (js/apps/dependencies-carried.js, `carriedOf`) ; l'export, lui, les garde toutes.
  let shown = declared;
  try {
    await page.run(() => { window.__resetSettings(); window.__saved = []; window.__dependencyBlocked = null; window.__carried = true; });
    const served = new Set((await expectedRows(page, language)).rows.filter(row => row.uses.some(use => use.app === 'publipostage')).map(row => row.paquet));
    shown = declared.filter(entry => !(entry.paquet && served.has(entry.paquet)));
    await run.reset().catch(() => {});
    await page.click(...await page.run(settingsAt));
    await page.until(() => document.querySelector('.menu') !== null, [], 1500);
    await page.click(...await page.run(centerOfMenuItem, t('dep.menu')));
    const start = await expect('ouverture', 'la fenêtre devait s\'ouvrir avec le bloc de Publipostage+', s => s.modal && block(s, 'publipostage'));
    if (!start.modal) return found;

    // 1. Le bloc de Publipostage+ : sous l'app, noté « déclarée par l'app », ses colonnes, le sous-titre qui compte les déclarées, la note du bas.
    const pp = block(start, 'publipostage');
    if (!pp) return found;
    if (pp.title !== t('dep.c.title') || pp.chip !== t('dep.c.chip') || pp.note !== t('dep.c.note.top') || pp.role !== 'group' || pp.labelled !== t('dep.c.title')) run.note('le bloc', `le bloc devait dire « ${t('dep.c.title')} », « ${t('dep.c.chip')} » et sa note, étiqueté par son titre (${pp.title} | ${pp.chip} | ${pp.note})`);
    if (pp.count !== t('dep.group.count', { n: shown.length })) run.note('le compte du bloc', `le bloc devait compter ${shown.length} bibliothèques (${pp.count})`);
    if (pp.cols.join('|') !== ['lib', 'version', 'address'].map(key => t(`dep.c.col.${key}`)).join('|') || pp.colsOver) run.note('les colonnes du bloc', `les trois titres de colonne devaient tenir dans la fenêtre (${pp.cols.join(' | ')})`);
    if (!start.modal.count.endsWith(t('dep.count.carried', { n: shown.length + 1 }))) run.note('le sous-titre', `le sous-titre devait compter les déclarées « ${t('dep.count.carried', { n: shown.length + 1 })} » (${start.modal.count})`);
    if (start.modal.apps !== t('dep.apps')) run.note('la note du bas', `la note sous la liste devait dire « ${t('dep.apps')} » (${start.modal.apps})`);
    const ppGroup = start.modal.groups.find(group => group.id === 'publipostage');
    if (!ppGroup || ppGroup.count !== t('dep.group.count', { n: ppGroup.rows + shown.length })) run.note('le compte de l\'app', `l'app devait compter ses bibliothèques de GFS et celles qu'elle déclare (${ppGroup && ppGroup.count}, ${ppGroup && ppGroup.rows} + ${declared.length})`);

    // 2. Les lignes : toutes celles que l'app déclare, au démarrage d'abord ; le moment, le contenu, la version et l'hôte ; 40 px au moins, rien de coupé ni qui déborde, aucun lien.
    if (pp.items.map(item => item.key).sort().join() !== shown.map(entry => `publipostage|portee|${entry.id}`).sort().join()) run.note('les lignes', `le bloc devait montrer les ${shown.length} bibliothèques déclarées (${pp.items.map(item => item.name).join(', ')})`);
    const ranks = pp.items.map(item => WHEN_RANK[pick(item.key.split('|')[2]).quand]);
    if (ranks.some((rank, index) => index && rank < ranks[index - 1])) run.note('l\'ordre', 'le démarrage devait passer avant le premier usage');
    for (const item of pp.items) {
      const entry = pick(item.key.split('|')[2]);
      const wantSub = [t(`dep.c.when.${entry.quand}`), entry.contient ? t('dep.c.with', { names: entry.contient.join(', ') }) : ''].filter(Boolean).join(' · ');
      const host = new URL(entry.adresse).hostname;
      if (item.name !== entry.nom || item.sub !== wantSub || item.host !== host || item.version !== (entry.version || t('dep.c.version.none'))) run.note('une ligne', `${entry.nom} devait dire « ${wantSub} », ${entry.version || t('dep.c.version.none')} et ${host} (${item.sub} | ${item.version} | ${item.host})`);
      if (item.height < 40) run.note('hauteur', `la ligne de ${entry.nom} mesure ${item.height} px (40 au moins)`);
      if (item.clipped || item.wide) run.note('texte coupé', `la ligne de ${entry.nom} coupe ou fait déborder un mot`);
    }
    if (pp.links) run.note('les liens', 'une adresse déclarée par l\'app ne devait pas s\'offrir en lien');
    if (!start.modal.inPage || start.modal.hscroll) run.note('déborde', 'la fenêtre ne devait ni sortir de la page ni défiler en largeur');

    // 3. Un clic sur TipTap déplie son détail : origine, version, ce qu'il contient, adresse, moment, précision de l'app ; rien ne déborde.
    await page.click(...await page.run(buttonAt, '[data-fk="dep-publipostage|portee|tiptap"]'));
    const opened = await expect('le détail', 'un clic sur TipTap devait déplier son détail', s => block(s, 'publipostage') && block(s, 'publipostage').items.some(item => item.key === 'publipostage|portee|tiptap' && item.expanded === 'true' && item.detail));
    const tip = opened.modal && block(opened, 'publipostage').items.find(item => item.key === 'publipostage|portee|tiptap');
    if (tip && tip.detail) {
      const titles = tip.detail.facts.map(fact => fact.title).join('|');
      const want = ['dep.c.origin', 'dep.c.version', 'dep.c.contains', 'dep.c.address', 'dep.c.when', 'dep.c.note'].map(key => t(key)).join('|');
      if (titles !== want) run.note('le détail : les rubriques', `les rubriques devaient être « ${want} » (${titles})`);
      const body = key => (tip.detail.facts.find(fact => fact.title === t(key)) || {}).body || '';
      if (!body('dep.c.origin').includes(t('dep.c.chip')) || !body('dep.c.origin').includes(t('dep.c.origin.text'))) run.note('le détail : l\'origine', `l'origine devait dire « déclarée par l'app » et que GFS ne vérifie rien (${body('dep.c.origin')})`);
      if (body('dep.c.version') !== '3.31.3' || body('dep.c.address') !== 'https://esm.sh/' || body('dep.c.when') !== t('dep.c.when.demarrage.long')) run.note('le détail : les faits', `version, adresse et moment devaient être ceux de la déclaration (${body('dep.c.version')} | ${body('dep.c.address')} | ${body('dep.c.when')})`);
      if (!['ProseMirror', 'floating-ui', 'prosemirror-suggest-changes', 'linkifyjs'].every(name => body('dep.c.contains').includes(name))) run.note('le détail : le contenu', `le détail devait nommer ce que TipTap contient (${body('dep.c.contains')})`);
      if (!body('dep.c.note').includes(language === 'en' ? 'Offline editor' : 'Éditeur hors ligne')) run.note('le détail : la précision', `la précision devait être dans la langue de la personne (${body('dep.c.note')})`);
      if (tip.detail.links || tip.detail.wide) run.note('le détail déborde', 'le détail ne devait ni déborder ni offrir de lien');
    }
    // Une bibliothèque que GFS garde aussi (le détail « GFS en garde aussi une copie ») n'a plus de ligne ici depuis le 19/11 : toutes celles que Publipostage+ déclare avec un paquet sont servies par GFS à l'app et prennent la ligne de GFS. Le calcul reste gardé par test/dependances-carried.test.mjs (`carriedOf`) ; l'affichage de ce détail n'a plus de cas réel dans la page d'essai.
    await page.click(...await page.run(buttonAt, '[data-fk="dep-publipostage|portee|tiptap"]'));
    await expect('le détail : refermer', 'un second clic devait refermer les détails', s => block(s, 'publipostage').items.every(item => item.expanded === 'false' && !item.detail));

    // 4. Une app qui déclare n'en charger aucune le dit ; celle d'une app non installée est dans le panneau refermé.
    const auto = block(opened, 'automation');
    if (!auto || auto.note !== t('dep.c.none') || auto.count !== t('dep.group.count', { n: 0 }) || auto.items.length) run.note('l\'app sans bibliothèque', `Automation+ devait dire « ${t('dep.c.none')} » (${auto && auto.note})`);
    if (block(opened, 'form')) run.note('le panneau cache', 'Form+ (pas installée) ne devait pas être montrée avant d\'ouvrir le panneau');
    await page.click(...await page.run(buttonAt, '[data-fk="dep-more"]'));
    const more = await expect('le panneau', 'le panneau devait montrer Form+ avec Leaflet', s => block(s, 'form') && block(s, 'form').inMore && block(s, 'form').items.length === 1);
    const leaflet = more.modal && block(more, 'form') && block(more, 'form').items[0];
    if (leaflet && (leaflet.name !== 'Leaflet' || leaflet.version !== '1.9.4' || leaflet.host !== 'unpkg.com' || leaflet.sub !== t('dep.c.when.option'))) run.note('Leaflet', `Leaflet devait dire « ${t('dep.c.when.option')} », 1.9.4 et unpkg.com (${leaflet.sub} | ${leaflet.version} | ${leaflet.host})`);
    await page.click(...await page.run(buttonAt, '[data-fk="dep-more"]'));

    // 5. Les filtres autres que « Toutes » écartent ce que GFS ne connaît pas ; « Toutes » les rend.
    await page.click(...await page.run(centerOfSelector, '.dp-filter[data-filter="active"]'));
    await expect('filtre « Actives »', 'les déclarées ne devaient pas se montrer sous « Actives » (GFS n\'en connaît ni l\'état ni les avis)', s => s.modal && s.modal.blocks.length === 0);
    await page.click(...await page.run(centerOfSelector, '.dp-filter[data-filter="all"]'));
    await expect('filtre « Toutes »', '« Toutes » devait rendre le bloc', s => block(s, 'publipostage') && s.modal.blocks.length >= 2);

    // 6. La recherche les trouve par ce qu'elles contiennent (« prosemirror » : TipTap), par l'hôte (« jsdelivr »), et dit le vide quand rien ne correspond.
    await page.click(...await page.run(centerOfSelector, '.dp-search input'));
    await page.press(...'prosemirror'.split(''));
    await expect('recherche : le contenu', 'chercher « prosemirror » devait laisser TipTap seul', s => s.modal && s.modal.blocks.length === 1 && s.modal.blocks[0].items.map(item => item.name).join() === 'TipTap' && s.modal.gfsRows.length === 0);
    await page.press(...Array(11).fill('Backspace'));
    await page.press(...'jsdelivr'.split(''));
    await expect('recherche : l\'hôte', 'chercher « jsdelivr » devait laisser les bibliothèques que le bloc montre et qui sont chez jsDelivr', s => s.modal && s.modal.blocks.length === 1 && s.modal.blocks[0].items.length === shown.filter(entry => /jsdelivr/.test(entry.adresse)).length);
    await page.press(...Array(8).fill('Backspace'));
    await page.press(...'zzz'.split(''));
    await expect('recherche : rien', 'chercher « zzz » devait ne rien montrer et le dire', s => s.modal && s.modal.blocks.length === 0 && s.modal.empty);
    await page.press('Backspace', 'Backspace', 'Backspace');
    await expect('recherche effacée', 'effacer la recherche devait rendre le bloc, sans message de vide', s => block(s, 'publipostage') && !s.modal.empty);

    // 7. Le clavier : de la recherche, la flèche du bas parcourt les lignes de GFS puis celles du bloc ; la flèche du haut revient.
    await page.click(...await page.run(centerOfSelector, '.dp-search input'));
    const order = (await snap()).modal;
    const firstCarried = `dep-${block({ modal: order }, 'publipostage').items[0].key}`;
    const gfsCount = order.gfsRows.filter(key => !key.startsWith('publipostage|portee')).length;
    await page.press(...Array(gfsCount + 1).fill('ArrowDown'));
    await expect('clavier : jusqu\'au bloc', 'la flèche du bas devait atteindre la première ligne déclarée après les lignes de GFS', s => s.modal && s.modal.focus === firstCarried);
    await page.press('ArrowUp');
    await expect('clavier : un cran en arrière', 'la flèche du haut devait revenir à la dernière ligne de GFS', s => s.modal && s.modal.focus && !s.modal.focus.includes('portee'));
    await page.click(...await page.run(centerOfSelector, '.dp-search input'));

    // 8. L'export garde ce que les apps déclarent : le rapport de GFS et l'inventaire CycloneDX.
    await page.click(...await page.run(buttonAt, '[data-fk="dep-export"]'));
    await page.click(...await page.run(centerOfSelector, '[data-fk="dep-export-json"]'));
    await page.click(...await page.run(buttonAt, '[data-fk="dep-export"]'));
    await page.click(...await page.run(centerOfSelector, '[data-fk="dep-export-cdx"]'));
    const saved = await expect('export', 'les deux rapports devaient s\'enregistrer', s => s.saved.length === 2);
    if (saved.saved.length === 2) {
      const report = JSON.parse(saved.saved[0].text);
      const entry = report.declarees.find(group => group.app === 'publipostage');
      if (!entry || entry.nombre !== declared.length || entry.bibliotheques.length !== shown.length || entry.bibliotheques.some(item => item.verifiee !== false || item.declaree_par !== 'app')) run.note('export : le rapport', 'le rapport devait garder les bibliothèques déclarées par Publipostage+, marquées non vérifiées');
      if (!report.declarees.some(group => group.app === 'automation' && group.nombre === 0)) run.note('export : aucune', 'le rapport devait dire qu\'Automation+ déclare n\'en charger aucune');
      const bom = JSON.parse(saved.saved[1].text);
      const component = bom.components.find(each => each['bom-ref'] === 'gfs:declared:publipostage:tiptap');
      if (!component || component.version !== '3.31.3' || !component.properties.some(property => property.name === 'gfs:verified' && property.value === 'false')) run.note('export : CycloneDX', 'l\'inventaire devait garder TipTap, version déclarée, marqué non vérifié');
    }
    await page.press('Escape');
    await expect('Échap', 'Échap devait fermer la fenêtre', s => s.modal === null);
  } catch (error) {
    run.note('la mesure a échoué', error.message.slice(0, 300));
    await closeLeftOpen(page);
  } finally {
    await page.run(() => { window.__carried = false; }).catch(() => {});
  }
  return found;
}
