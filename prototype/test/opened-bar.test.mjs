// Le 5e bouton de la barre (js/explorer/opened-bar.js, contrats 5.2 point 7 et 6.4 point 14) : la liste du plus récent au plus ancien, les articles du menu et le lien avec la liste des ouverts, en code pur ;
// le bouton, la pastille et le menu à l'écran se mesurent dans un vrai Grist (labo/run-ouverts-barre.mjs) et sous Firefox (test/interfaces-firefox.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenedFiles } from '../js/explorer/opened-files.js';
import { OpenedBar, openedItems, openedList } from '../js/explorer/opened-bar.js';
import { createI18n } from '../js/i18n/i18n.js';

const file = (app, id, name, icon = 'doc') => ({ key: `${app}:${id}`, app, id, name, icon });
const FILES = [file('pp', 1, 'Convocation'), file('pp', 2, 'Émargement'), file('form', 3, 'Inscription', 'check'), file('pp', 4, 'Grille de suivi', 'grid')];
const names = { pp: 'Publipostage+', form: 'Form+' };

test('openedList : du plus récent au plus ancien, un fichier disparu n\'y est plus', () => {
  const list = openedList(['pp:1', 'pp:9', 'form:3', 'pp:2'], FILES);
  assert.deepEqual(list.map(item => item.name), ['Émargement', 'Inscription', 'Convocation']);
  assert.deepEqual(openedList([], FILES), []);
});

function items(overrides = {}) {
  const t = createI18n('fr').t;
  const calls = [];
  const list = openedList(['pp:1', 'form:3', 'pp:2'], FILES);
  const built = openedItems({
    t, list, shownKey: 'pp:2', appName: id => names[id], onOpen: item => calls.push(['open', item.key]), onDrop: (item, at) => calls.push(['drop', item.key, at]),
    onFind: () => calls.push(['find']), onMore: () => calls.push(['more']), notice: text => calls.push(['notice', text]), ...overrides,
  });
  return { built, calls, t };
}

test('openedItems : un titre, un article par fichier avec son app, un séparateur, « Ouvrir un autre fichier… »', () => {
  const { built, t } = items();
  assert.deepEqual(built[0], { heading: t('dock.opened') });
  assert.deepEqual(built.slice(1, 4).map(item => [item.label, item.hint, item.icon]), [['Émargement', 'Publipostage+', 'doc'], ['Inscription', 'Form+', 'check'], ['Convocation', 'Publipostage+', 'doc']]);
  assert.equal(built[4], '-');
  assert.equal(built[5].label, 'Rechercher un fichier…');
  assert.equal(built[5].icon, 'search');
  assert.equal(built[6].label, 'Ouvrir un autre fichier…');
  assert.equal(built.some(item => item && item.family), false, 'pas de couleur par type hors de l\'explorateur');
});

test('openedItems : le fichier que l\'app montre est marqué par un mot et ne se rouvre pas ; les autres s\'ouvrent ; la croix donne le fichier et son rang', () => {
  const { built, calls, t } = items();
  const [shown, other] = built.slice(1, 3);
  assert.equal(shown.current, t('ex.shown'));
  assert.equal(other.current, null);
  shown.run();
  assert.deepEqual(calls, [], 'le fichier affiché ne relance rien');
  other.run();
  other.drop.run();
  built[5].run();
  built[6].run();
  assert.deepEqual(calls, [['open', 'form:3'], ['drop', 'form:3', 1], ['find'], ['more']]);
  assert.match(other.drop.label, /Retirer des ouverts : Inscription/);
});

test('openedItems : la croix du fichier que l\'app montre est grisée et explique au lieu de retirer ; celle des autres retire', () => {
  const { built, calls, t } = items();
  const [shown, other] = built.slice(1, 3);
  assert.equal(shown.drop.greyed, true);
  assert.equal(other.drop.greyed, false);
  assert.match(shown.drop.label, /Retirer des ouverts : Émargement/, 'elle garde son nom');
  shown.drop.run();
  assert.deepEqual(calls, [['notice', t('dock.openedShownWhy')]], 'rien n\'est retiré : la phrase dit pourquoi');
  other.drop.run();
  assert.deepEqual(calls.slice(1), [['drop', 'form:3', 1]]);
});

test('openedItems : sans fichier affiché, aucune croix n\'est grisée', () => {
  const { built } = items({ shownKey: null });
  assert.deepEqual(built.slice(1, 4).map(item => item.drop.greyed), [false, false, false]);
});

test('openedItems : sans fichier ouvert, un article grisé le dit et son clic explique ; « Ouvrir un autre fichier… » reste', () => {
  const { built, calls, t } = items({ list: [], shownKey: null });
  assert.equal(built[1].greyed, true);
  assert.equal(built[1].label, t('dock.openedNone'));
  built[1].run();
  assert.deepEqual(calls, [['notice', t('dock.openedWhy')]]);
  assert.equal(built[built.length - 1].label, t('dock.openedMore'));
});

test('openedItems : un fichier sans nom porte le mot « sans titre » de l\'explorateur', () => {
  const { built, t } = items({ list: [file('pp', 5, '')] });
  assert.equal(built[1].label, t('ex.untitled'));
});

function bar(live = FILES, { adds = false, pick = null } = {}) {
  const opened = new OpenedFiles();
  const shown = [];
  const counts = [];
  const dock = { setOpened: count => counts.push(count), showOpened: (menu, start) => shown.push({ menu, start }) };
  const session = {};
  const opens = [];
  const picks = [];
  // `adds` : ouvrir un fichier le fait entrer dans la liste (comme `Openings`) ; sinon l'app refuse (rien n'entre) ; `pick` : la réponse de la recherche.
  const open = async item => { opens.push(item.key); if (adds) opened.add(item.key, session); return adds; };
  const component = new OpenedBar({
    opened, files: () => live, session: () => session, dock, t: createI18n('fr').t, appName: id => names[id], open, showExplorer: () => opens.push('explorer'), notice: () => {},
    container: () => 'stage', inertTargets: () => [], pick: async opts => { picks.push(opts); return pick; },
  });
  return { opened, shown, counts, session, opens, picks, component };
}

test('OpenedBar : le nombre du bouton suit la liste et les fichiers vivants ; un fichier disparu ne compte plus', () => {
  const live = [...FILES];
  const { opened, counts, session, component } = bar(live);
  opened.add('pp:1', session);
  opened.add('form:3', session);
  assert.deepEqual(counts, [1, 2], 'chaque ouverture recompte');
  live.splice(live.findIndex(item => item.key === 'pp:1'), 1);
  component.sync();
  assert.equal(counts.at(-1), 1);
  opened.remove('form:3');
  assert.equal(counts.at(-1), 0);
});

test('OpenedBar : le menu montre le fichier affiché de la session active ; la croix retire le fichier et rouvre le menu au rang de la ligne partie', () => {
  const { opened, shown, session, component, opens } = bar();
  opened.add('pp:1', session);
  opened.add('form:3', session);
  opened.add('pp:2', session);
  component.show();
  assert.equal(shown.length, 1);
  assert.equal(shown[0].start, null);
  const [, first, second] = shown[0].menu;
  assert.equal(first.current !== null, true, 'le dernier fichier ouvert est celui que l\'app montre');
  second.run();
  assert.deepEqual(opens, ['form:3']);
  second.drop.run();
  assert.deepEqual(opened.keys(), ['pp:1', 'pp:2']);
  assert.equal(shown.length, 2, 'le menu se rouvre');
  assert.equal(shown[1].start, 1, 'au rang de la ligne partie');
  assert.deepEqual(shown[1].menu.slice(1, 3).map(item => item.label), ['Émargement', 'Convocation']);
});

test('OpenedBar : une autre session d\'app ne montre plus aucun fichier affiché', () => {
  const { opened, shown, component } = bar();
  opened.add('pp:1', {});
  component.show();
  assert.equal(shown[0].menu[1].current, null);
});

// ---------- « Rechercher un fichier… » (demande du porteur, 23/11) ----------

test('OpenedBar.find : la liste avec recherche porte tous les fichiers vivants (nom, app, icône), le fichier affiché en coche, un second geste « nouvel onglet »', async () => {
  const { opened, session, component, picks } = bar(FILES, { adds: true });
  opened.add('pp:2', session);
  await component.find();
  const [opts] = picks;
  const t = createI18n('fr').t;
  assert.equal(opts.title, t('dock.findTitle'));
  assert.equal(opts.current, 'pp:2');
  assert.equal(opts.quick, true, 'Entrée dans la recherche ouvre le premier');
  assert.deepEqual(opts.items.map(item => [item.value, item.label, item.hint, item.glyph]), [
    ['pp:1', 'Convocation', 'Publipostage+', 'doc'], ['pp:2', 'Émargement', 'Publipostage+', 'doc'], ['form:3', 'Inscription', 'Form+', 'check'], ['pp:4', 'Grille de suivi', 'Publipostage+', 'grid']]);
  assert.equal(opts.alt.icon, 'tab-plus');
  assert.equal(opts.alt.label({ label: 'Convocation' }), t('dock.findNewTab', { name: 'Convocation' }));
});

test('OpenedBar.find : sans réponse, ou pour un fichier qui n\'existe plus, rien ne s\'ouvre', async () => {
  const none = bar(FILES, { adds: true, pick: null });
  await none.component.find();
  const gone = bar(FILES, { adds: true, pick: { value: 'pp:99', alt: false } });
  await gone.component.find();
  assert.deepEqual([none.opens, gone.opens], [[], []]);
});

test('OpenedBar.find : un fichier sans nom porte le mot « sans titre » de l\'explorateur', async () => {
  const { component, picks } = bar([file('pp', 5, '')], { adds: true });
  await component.find();
  assert.equal(picks[0].items[0].label, createI18n('fr').t('ex.untitled'));
});

test('openFound dans l\'onglet actif : le fichier prend la place du fichier affiché (celui-ci sort des ouverts) ; dans un nouvel onglet, il reste', async () => {
  const active = bar(FILES, { adds: true, pick: { value: 'pp:4', alt: false } });
  active.opened.add('pp:1', active.session);
  active.opened.add('form:3', active.session);
  await active.component.find();
  assert.deepEqual(active.opens, ['pp:4']);
  assert.deepEqual(active.opened.keys(), ['pp:1', 'pp:4'], 'form:3 (le fichier affiché) est remplacé, pp:1 reste');
  const tab = bar(FILES, { adds: true, pick: { value: 'pp:4', alt: true } });
  tab.opened.add('pp:1', tab.session);
  tab.opened.add('form:3', tab.session);
  await tab.component.find();
  assert.deepEqual(tab.opened.keys(), ['pp:1', 'form:3', 'pp:4'], 'le fichier affiché reste dans les ouverts');
});

test('openFound : un refus ou une annulation dans l\'app ne retire pas le fichier affiché', async () => {
  const { opened, session, component, opens } = bar(FILES, { adds: false });
  opened.add('form:3', session);
  await component.openFound(FILES[3], false);
  assert.deepEqual(opens, ['pp:4']);
  assert.deepEqual(opened.keys(), ['form:3']);
});

test('openFound : le fichier déjà affiché ne se rouvre pas ; sans fichier affiché rien ne sort de la liste ; un fichier déjà ouvert reprend la place du fichier affiché', async () => {
  const same = bar(FILES, { adds: true });
  same.opened.add('pp:1', same.session);
  await same.component.openFound(FILES[0], false);
  assert.deepEqual(same.opens, []);
  const nothing = bar(FILES, { adds: true });
  nothing.opened.add('pp:1', {});
  await nothing.component.openFound(FILES[3], false);
  assert.deepEqual(nothing.opened.keys(), ['pp:1', 'pp:4'], 'aucun fichier n\'est affiché dans cette session : rien à remplacer');
  const back = bar(FILES, { adds: true });
  back.opened.add('pp:1', back.session);
  back.opened.add('pp:4', back.session);
  back.opened.add('form:3', back.session);
  await back.component.openFound(FILES[0], false);
  assert.deepEqual(back.opened.keys(), ['pp:4', 'pp:1'], 'pp:1 est rouvert, form:3 (le fichier affiché) en sort');
});
