// La fenêtre « Dépendances » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; demande du porteur du 18/11). La vraie fenêtre
// (js/apps/dependencies-window.js), le vrai catalogue et le vrai relevé de GFS, le vrai audit des copies (les fichiers de vendor/, relus par la page) s'ouvrent à la vraie souris, d'un clic sur
// « Réglages » puis « Dépendances… » (test/pages/explorateur.js, `window.__dependencies`). À mesurer : la fenêtre tient dans la page à 700 × 400, son titre, sa recherche, ses filtres et son pied
// restent en place (seule la liste défile), aucune ligne ne déborde ni ne coupe un mot, les lignes sont celles du modèle dans son ordre (les actives d'abord) ; les filtres comptent juste et la
// recherche prend les mots dans n'importe quel ordre ; le clavier va de la recherche aux lignes et revient ; le détail d'une ligne dit ce qui l'utilise, ses fichiers, l'intégrité, les
// adresses, l'avis, la licence ; ses liens s'ouvrent dans un nouvel onglet sans rien transmettre ; « Vérifier la copie » à la souris confirme la copie, et dit quand elle ne correspond pas ; Tab
// reste dans la fenêtre, Échap et « Fermer » la ferment et rendent le clavier à « Réglages ».
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createI18n } from '../js/i18n/i18n.js';
import { formatBytes } from '../js/weight/weight.js';
import { dependencyRows, summary, FILTERS } from '../js/apps/dependencies-model.js';
import { readCatalogue } from '../js/apps/libraries.js';
import { Run, centerOfSelector } from './corbeille-firefox.mjs';
import { centerOfMenuItem } from './copier-firefox.mjs';
import { ROOT } from './helpers.mjs';


// Ce que la page montre : le bouton « Réglages », les menus ouverts, et la fenêtre (null quand elle est fermée).
function state() {
  const t = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const settings = document.querySelector('button use[href="#i-sliders"]').closest('button');
  const out = { onSettings: document.activeElement === settings, asked: window.__dependenciesAsked || 0, menus: document.querySelectorAll('.menu').length };
  const modal = document.querySelector('.mod.dp');
  if (!modal) return { ...out, modal: null };
  const box = modal.getBoundingClientRect();
  const head = modal.querySelector('.mod-head').getBoundingClientRect();
  const foot = modal.querySelector('.mod-foot').getBoundingClientRect();
  const body = modal.querySelector('.dp-body');
  const active = document.activeElement;
  const over = node => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); };
  const link = a => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel, label: a.getAttribute('aria-label') });
  const rows = [...modal.querySelectorAll('.dp-item')].map(li => {
    const row = li.querySelector('.dp-row');
    const rect = row.getBoundingClientRect();
    const cell = node => node.closest('.dp-cell') || row;
    const clipped = [...row.querySelectorAll('.dp-name, .dp-sub')].filter(node => node.scrollWidth > node.clientWidth + 1).length +
      [...row.querySelectorAll('.dp-chip, .dp-tag, .dp-ver')].filter(node => node.getBoundingClientRect().right > cell(node).getBoundingClientRect().right + 1).length;
    const ext = li.querySelector('.dp-ext');
    const detail = li.querySelector('.dp-detail');
    return { key: li.dataset.key, name: t(row.querySelector('.dp-name')), sub: t(row.querySelector('.dp-lib .dp-sub')), users: t(row.querySelector('.dp-users')),
      version: t(row.querySelector('.dp-ver')), tags: [...row.querySelectorAll('.dp-tag')].map(t), latest: t(row.querySelector('.dp-cell:nth-child(4)')), dot: row.querySelector('.dp-dot').dataset.state,
      expanded: row.getAttribute('aria-expanded'), height: rect.height, clipped, wide: rect.right > box.right + 1, link: ext ? link(ext) : null, ext: ext ? ext.getBoundingClientRect().width : 0,
      detail: detail ? { facts: [...detail.querySelectorAll('.dp-fact')].map(fact => ({ title: t(fact.querySelector('dt')), body: t(fact.querySelector('dd')) })),
        links: [...detail.querySelectorAll('a')].map(link), integrity: t(detail.querySelector('.dp-integrity')), verify: detail.querySelector('.dp-verify').disabled,
        wide: over(detail) || detail.scrollWidth > detail.clientWidth + 1 } : null };
  });
  return { ...out, modal: { title: t(modal.querySelector('.mod-head h2')), count: t(modal.querySelector('.mod-count')), role: modal.getAttribute('role'), modalAttr: modal.getAttribute('aria-modal'),
    labelled: t(document.getElementById(modal.getAttribute('aria-labelledby'))), rows,
    chips: [...modal.querySelectorAll('.dp-filter')].map(chip => ({ filter: chip.dataset.filter, text: t(chip), pressed: chip.getAttribute('aria-pressed') })),
    cols: [...modal.querySelectorAll('.dp-cols > span')].filter(node => node.getBoundingClientRect().width > 0 && getComputedStyle(node).display !== 'none').length,
    empty: !modal.querySelector('.dp-empty').hidden, apps: t(modal.querySelector('.dp-apps')), foot: t(modal.querySelector('.mod-note')), search: modal.querySelector('input[type=search]').value,
    focus: active && active.dataset ? active.dataset.fk || null : null, inside: modal.contains(active),
    inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1, size: [Math.round(box.width), Math.round(box.height)],
    sticky: head.bottom <= foot.top + 1 && foot.bottom <= box.bottom + 1 && head.top >= box.top - 1, headHeight: Math.round(head.height), footHeight: Math.round(foot.height),
    outside: [...modal.querySelectorAll('.mod-head *, .mod-foot *, .dp-cols *')].filter(over).map(node => node.className || node.tagName).slice(0, 5),
    scrolls: body.scrollHeight > body.clientHeight + 1, hscroll: body.scrollWidth > body.clientWidth + 1 } };
}

const settingsAt = () => { const button = document.querySelector('button use[href="#i-sliders"]').closest('button'); const box = button.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };
const rowAt = key => { const node = document.querySelector(`.dp-row[data-fk="dep-${CSS.escape(key)}"], .dp-item[data-key="${key}"] .dp-row`); node.scrollIntoView({ block: 'nearest' }); const box = node.getBoundingClientRect(); return [box.left + 40, box.top + 12]; };
const buttonAt = selector => { const node = document.querySelector(selector); if (!node) return null; node.scrollIntoView({ block: 'nearest' }); const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };

// Les lignes que la fenêtre doit montrer : celles du modèle, avec le catalogue, le relevé et les apps de la page d'essai.
async function expectedRows(page, language) {
  const catalogue = readCatalogue(JSON.parse(readFileSync(join(ROOT, 'bibliotheques/catalogue.json'), 'utf8')));
  const releve = JSON.parse(readFileSync(join(ROOT, 'bibliotheques/releve.json'), 'utf8'));
  const modules = await page.run(() => window.__dependencyModules);
  return { rows: dependencyRows({ catalogue, releve, modules, lang: language }), releve };
}

export async function dependancesProblems(page, language, tag) {
  const found = [];
  const { t } = createI18n(language);
  const locale = language === 'en' ? 'en-GB' : 'fr-FR';
  const run = new Run(page, tag, found, 'fenêtre « Dépendances »');
  const snap = () => page.run(state);
  const expect = async (kind, what, test) => {
    let now = await snap();
    for (let i = 0; i < 60 && !test(now); i += 1) { await new Promise(resolve => setTimeout(resolve, 75)); now = await snap(); }
    if (!test(now)) run.note(kind, `${what} (état : ${JSON.stringify({ ...now, modal: now.modal && { ...now.modal, rows: now.modal.rows.length } }).slice(0, 500)})`);
    return now;
  };
  const closed = s => s.modal === null;
  const open = async () => {
    await page.click(...await page.run(settingsAt));
    await page.until(() => document.querySelector('.menu') !== null, [], 1500);
    await page.click(...await page.run(centerOfMenuItem, t('dep.menu')));
    return expect('ouverture', 'la fenêtre devait s\'ouvrir, le clavier sur la recherche', s => s.modal && s.modal.focus === 'dep-search');
  };
  try {
    await page.run(() => window.__resetSettings());
    await run.reset().catch(() => {});
    const { rows, releve } = await expectedRows(page, language);
    const sum = summary(rows);
    const asked = (await snap()).asked;

    // 1. La souris ouvre la fenêtre par « Réglages » puis « Dépendances… ».
    const start = await open();
    if (start.asked !== asked + 1) run.note('la ligne du menu', `« ${t('dep.menu')} » devait ouvrir la fenêtre une fois (${start.asked - asked})`);
    if (start.menus !== 0) run.note('le menu', 'le menu « Réglages » devait se fermer au clic sur la ligne');
    const modal = start.modal;
    if (!modal) return found;
    const date = new Date(releve.releve).toLocaleDateString(locale, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
    if (modal.title !== t('dep.title') || modal.labelled !== t('dep.title') || modal.role !== 'dialog' || modal.modalAttr !== 'true') run.note('titre', `le titre devait être « ${t('dep.title')} », la fenêtre un dialogue modal étiqueté par lui (${JSON.stringify([modal.title, modal.labelled, modal.role, modal.modalAttr])})`);
    if (modal.count !== t('dep.count', { n: rows.length, size: formatBytes(summary(rows).bytes, locale, t) })) run.note('le total', `le sous-titre devait dire « ${t('dep.count', { n: rows.length, size: formatBytes(sum.bytes, locale, t) })} » (il dit « ${modal.count} »)`);
    if (modal.foot !== t('dep.foot', { date })) run.note('le pied', `le pied devait dire « ${t('dep.foot', { date })} » (il dit « ${modal.foot} »)`);
    if (modal.apps !== t('dep.apps')) run.note('la note', `la note sous la liste devait dire « ${t('dep.apps')} » (elle dit « ${modal.apps} »)`);
    const names = modal.rows.map(row => row.name);
    if (names.join('|') !== rows.map(row => row.paquet).join('|')) run.note('les lignes', `les lignes devaient être celles du modèle dans son ordre, les actives d'abord (${names.join(' | ')})`);
    const dots = modal.rows.map(row => row.dot).join();
    if (dots !== rows.map(row => row.state).join()) run.note('les états', `les pastilles devaient suivre l'état des lignes (${dots})`);
    const chips = Object.fromEntries(modal.chips.map(chip => [chip.filter, chip]));
    for (const filter of FILTERS) if (!chips[filter] || chips[filter].text !== `${t(`dep.filter.${filter}`)}${sum.counts[filter]}`) run.note('les filtres', `le filtre « ${filter} » devait dire « ${t(`dep.filter.${filter}`)}${sum.counts[filter]} » (${chips[filter] && chips[filter].text})`);
    if (modal.chips.filter(chip => chip.pressed === 'true').map(chip => chip.filter).join() !== 'all') run.note('le filtre choisi', 'seul « Toutes » devait être enfoncé à l\'ouverture');

    // 2. La mise en page à 700 × 400 : dans la page, le titre et le pied en place, rien qui déborde, aucun mot coupé, des lignes de 40 px au moins.
    if (!modal.inPage) run.note('hors de la page', `la fenêtre (${modal.size.join(' × ')}) sort de la page`);
    if (!modal.sticky) run.note('base commune', 'le titre et le pied devaient rester en place, la liste seule défiler');
    if (modal.outside.length) run.note('déborde', `des éléments du titre ou du pied débordent de la fenêtre : ${modal.outside.join(', ')}`);
    if (modal.hscroll) run.note('défilement horizontal', 'la liste défile en largeur');
    if (!modal.scrolls) run.note('la liste défile', 'seize lignes devaient dépasser la hauteur de la liste à 400 px');
    if (modal.rows.some(row => row.height < 40)) run.note('hauteur des lignes', `une ligne mesure moins de 40 px (${modal.rows.filter(row => row.height < 40).map(row => `${row.name} ${row.height}`).join(', ')})`);
    if (modal.rows.some(row => row.clipped || row.wide)) run.note('texte coupé', `une ligne coupe ou fait déborder un mot : ${modal.rows.filter(row => row.clipped || row.wide).map(row => row.name).join(', ')}`);
    const wantCols = modal.size[0] >= 520 ? 5 : 4;
    if (modal.cols !== wantCols) run.note('les colonnes', `la fenêtre devait montrer ${wantCols} titres de colonne à ${modal.size[0]} px (${modal.cols})`);
    const linked = modal.rows.filter(row => row.link);
    if (linked.length !== modal.rows.length || linked.some(row => row.ext < 24 || row.link.target !== '_blank' || !/noopener/.test(row.link.rel) || !/^https:\/\//.test(row.link.href) || !row.link.label.includes(row.name))) run.note('le lien de la ligne', 'chaque ligne devait finir par un lien https de 24 px au moins, dans un nouvel onglet, noopener, nommé par la bibliothèque');
    const plotly = modal.rows.find(row => row.name === 'plotly.js-basic-dist-min');
    if (!plotly || !/critique|Critical/i.test(plotly.latest)) run.note('l\'avis', `la ligne de Plotly devait annoncer son avis critique (${plotly && plotly.latest})`);
    if (modal.rows.filter(row => /^(?:Active|Active)$/.test(row.sub)).length > 0 || modal.rows.some(row => !row.sub)) run.note('les mots d\'état', 'chaque ligne devait dire son état en mots');

    // 3. Les filtres à la souris : « Avis » n'a que Plotly, « Mises à jour » le compte du modèle, « Actives » les trois actives ; la recherche prend les mots dans n'importe quel ordre.
    for (const [filter, expected] of [['advisories', rows.filter(row => row.flagged).map(row => row.paquet)], ['active', rows.filter(row => row.state === 'active').map(row => row.paquet)],
      ['updates', rows.filter(row => row.updatable).map(row => row.paquet)], ['all', rows.map(row => row.paquet)]]) {
      await page.click(...await page.run(centerOfSelector, `.dp-filter[data-filter="${filter}"]`));
      const now = await expect(`filtre ${filter}`, `le filtre devait montrer ${expected.length} ligne(s)`, s => s.modal && s.modal.rows.map(row => row.name).join('|') === expected.join('|') && s.modal.chips.find(chip => chip.filter === filter).pressed === 'true');
      if (now.modal && now.modal.chips.filter(chip => chip.pressed === 'true').length !== 1) run.note('filtre enfoncé', 'un seul filtre devait être enfoncé');
    }
    await page.click(...await page.run(centerOfSelector, '.dp-search input'));
    await page.press(...'plotly'.split(''));
    await expect('recherche', 'chercher « plotly » devait laisser sa ligne', s => s.modal && s.modal.rows.map(row => row.name).join() === 'plotly.js-basic-dist-min');
    await page.press(...Array(6).fill('Backspace'));
    await page.press(...'basic plotly'.split(''));
    await expect('recherche : les mots dans l\'ordre qu\'on veut', 'chercher « basic plotly » devait trouver Plotly', s => s.modal && s.modal.rows.length === 1);
    await page.press(...Array(12).fill('Backspace'));
    await page.press(...'zzz'.split(''));
    const none = await expect('recherche : rien', 'chercher « zzz » devait n\'afficher aucune ligne et dire « Aucune bibliothèque ne correspond. »', s => s.modal && s.modal.rows.length === 0 && s.modal.empty);
    if (none.modal && none.modal.empty && none.modal.rows.length) run.note('vide', 'le message de liste vide ne devait pas s\'afficher avec des lignes');
    await page.press('Backspace', 'Backspace', 'Backspace');
    await expect('recherche effacée', 'effacer la recherche devait rendre toutes les lignes', s => s.modal && s.modal.rows.length === rows.length && !s.modal.empty);

    // 4. Le clavier : la flèche du bas va de la recherche à la première ligne, la flèche du haut revient à la recherche. Entrée et Espace sur un bouton ne se jouent pas sous ce Firefox sans écran
    // (voir test/interfaces-firefox.test.mjs, conflictProblems) : la ligne se déplie ici à la souris, Entrée se mesure dans le labo.
    await page.click(...await page.run(centerOfSelector, '.dp-search input'));
    await page.press('ArrowDown');
    const first = rows[0].key;
    await expect('clavier : la flèche du bas', 'la flèche du bas devait mener à la première ligne', s => s.modal && s.modal.focus === `dep-${first}`);
    await page.press('ArrowUp');
    await expect('clavier : la flèche du haut', 'la flèche du haut sur la première ligne devait revenir à la recherche', s => s.modal && s.modal.focus === 'dep-search');

    // 5. Le détail de Plotly à la souris : ce qui l'utilise, ses fichiers, l'avis, la licence, ses liens ; la copie se vérifie, et se dit différente quand les octets changent.
    const plotlyRow = rows.find(row => row.paquet === 'plotly.js-basic-dist-min');
    await page.click(...await page.run(rowAt, plotlyRow.key));
    const detail = await expect('détail', 'un clic sur la ligne de Plotly devait la déplier', s => s.modal && s.modal.rows.some(row => row.key === plotlyRow.key && row.expanded === 'true' && row.detail));
    const shown = detail.modal && detail.modal.rows.find(row => row.key === plotlyRow.key).detail;
    if (shown) {
      const titles = shown.facts.map(fact => fact.title).join('|');
      const wantTitles = ['dep.d.users', 'dep.d.files', 'dep.d.integrity', 'dep.d.addresses', 'dep.d.advisories', 'dep.d.licence', 'dep.d.links'].map(key => t(key)).join('|');
      if (titles !== wantTitles) run.note('le détail : les rubriques', `les rubriques devaient être « ${wantTitles} » (${titles})`);
      const body = key => (shown.facts.find(fact => fact.title === t(key)) || {}).body || '';
      if (!body('dep.d.users').includes('Publipostage+') && !body('dep.d.users').includes('Mail merge+')) run.note('le détail : l\'app', `« Utilisée par » devait nommer l'app (${body('dep.d.users')})`);
      if (!body('dep.d.files').includes('sha384-')) run.note('le détail : l\'empreinte', 'les fichiers devaient montrer leur empreinte sha384');
      if (!body('dep.d.addresses').includes('cdn.jsdelivr.net')) run.note('le détail : les adresses', `les adresses contactées en mode CDN devaient nommer jsDelivr (${body('dep.d.addresses')})`);
      if (!body('dep.d.advisories').includes(plotlyRow.advisories[0].id) || !body('dep.d.advisories').includes(plotlyRow.advisories[0].corrigeEn)) run.note('le détail : l\'avis', `l'avis devait dire son identifiant et la version qui corrige (${body('dep.d.advisories')})`);
      if (!body('dep.d.licence').includes('MIT')) run.note('le détail : la licence', `la licence devait être MIT (${body('dep.d.licence')})`);
      if (shown.links.length < 3 || shown.links.some(link => link.target !== '_blank' || !/noopener/.test(link.rel) || !/^https:\/\//.test(link.href))) run.note('le détail : les liens', `les liens (avis, site, dépôt) devaient s'ouvrir dans un nouvel onglet, noopener, en https (${JSON.stringify(shown.links)})`);
      if (shown.wide) run.note('le détail déborde', 'le détail de Plotly ne devait pas déborder');
    }
    await page.click(...await page.run(buttonAt, '.dp-verify'));
    await expect('vérifier', 'la vérification de la copie devait la dire intacte', s => s.modal && s.modal.rows.some(row => row.detail && row.detail.integrity === t('dep.d.ok')));
    await page.run(() => { window.__tamper = 'plotly-basic'; });
    await page.click(...await page.run(buttonAt, '.dp-verify'));
    await expect('vérifier : une copie changée', 'une copie dont les octets changent devait être dite différente', s => s.modal && s.modal.rows.some(row => row.detail && row.detail.integrity === t('dep.d.different', { file: 'plotly-basic.min.js' })));
    await page.run(() => { window.__tamper = null; });
    await page.click(...await page.run(buttonAt, '.dp-verify'));
    await expect('vérifier : de nouveau', 'la copie rétablie devait être dite intacte', s => s.modal && s.modal.rows.some(row => row.detail && row.detail.integrity === t('dep.d.ok')));
    // docx : deux fichiers, une seule ligne, « n copies intactes »
    await page.click(...await page.run(rowAt, rows.find(row => row.paquet === 'docx').key));
    await page.click(...await page.run(buttonAt, '.dp-item.is-open:last-of-type .dp-verify, .dp-item[data-key^="docx@"] .dp-verify'));
    await expect('vérifier : deux fichiers', 'docx (deux fichiers) devait dire ses deux copies intactes', s => s.modal && s.modal.rows.some(row => row.name === 'docx' && row.detail && row.detail.integrity === t('dep.d.ok.n', { n: 2 })));

    // 6. Tab reste dans la fenêtre ; Échap la ferme et rend le clavier à « Réglages » ; « Fermer » aussi, à la souris.
    for (let i = 0; i < 12; i += 1) {
      await page.press('Tab');
      const now = await snap();
      if (now.modal && !now.modal.inside) { run.note('Tab', 'Tab devait rester dans la fenêtre'); break; }
    }
    await page.press('Escape');
    const gone = await expect('Échap', 'Échap devait fermer la fenêtre et rendre le clavier à « Réglages »', s => closed(s) && s.onSettings);
    if (!closed(gone)) await page.click(...await page.run(centerOfSelector, '.dp-body ~ .mod-foot .btn'));
    await open();
    await page.click(...await page.run(centerOfSelector, '.mod.dp .mod-foot .btn'));
    await expect('Fermer', '« Fermer » devait fermer la fenêtre et rendre le clavier à « Réglages »', s => closed(s) && s.onSettings);
  } catch (error) {
    run.note('la mesure a échoué', error.message.slice(0, 300));
    await page.run(() => { for (const node of document.querySelectorAll('.mod-scrim')) node.remove(); }).catch(() => {});
  }
  return found;
}
