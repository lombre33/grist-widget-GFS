// Le menu « Réglages » de l'explorateur (js/shell/settings-menu.js) et la fenêtre « À propos » (js/shell/about.js). Le 04/11, le porteur a dit « ok pour la capture 1 » : un seul bouton « Réglages » dans l'explorateur,
// qui rassemble la langue, le thème, les réglages avancés (où est le bouton « LanguageTool », 12/11), la position de la barre et « À propos » ; la barre flottante ne change pas. La mise en page et la souris sont mesurées sous Firefox
// (test/interfaces-firefox.test.mjs) et dans un vrai Grist (labo/run-langue.mjs, labo/run-theme.mjs) ; ici, ce que le menu contient et ce que chaque ligne fait.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createI18n } from '../js/i18n/i18n.js';
import { settingsItems } from '../js/shell/settings-menu.js';
import { aboutItems, CREDITS } from '../js/shell/about.js';
import { HOST } from '../js/broker/context.js';

// La ligne « Position de la barre » est celle du vrai Dock (js/shell/dock.js) : ici, une doublure que le menu doit laisser telle quelle.
const PLACE = Object.freeze({ label: 'Position de la barre', icon: 'dock-left', submenu: [] });

function build(lang = 'fr', { choice = 'auto', grist = 'fr', shown = false } = {}) {
  const calls = [];
  const { t } = createI18n(lang);
  const items = settingsItems({
    t, language: () => ({ choice, grist }), onLanguage: value => calls.push(['langue', value]), onTheme: () => calls.push(['theme']),
    langtool: () => ({ shown, toggle: () => calls.push(['langtool']) }), place: () => PLACE, onAbout: () => calls.push(['apropos']),
  });
  return { items, calls };
}
const rows = items => items.filter(item => item !== '-');

test('le menu a ses lignes dans l\'ordre : la langue, le thème, les réglages avancés, la position de la barre, un séparateur, « À propos »', () => {
  const fr = build('fr').items;
  assert.deepEqual(fr.map(item => (item === '-' ? '-' : item.label)), ['Langue', 'Thème…', 'Réglages avancés', 'Position de la barre', '-', 'À propos…']);
  const en = build('en').items;
  assert.deepEqual(en.map(item => (item === '-' ? '-' : item.label)), ['Language', 'Theme…', 'Advanced settings', PLACE.label, '-', 'About…']);
});

test('aucune ligne n\'est grisée ni sans icône : une fonction de GFS n\'est jamais cachée', () => {
  for (const lang of ['fr', 'en']) {
    for (const item of rows(build(lang).items)) {
      assert.ok(!item.greyed, `${lang} : ${item.label} est grisé`);
      assert.ok(item.icon, `${lang} : ${item.label} n'a pas d'icône`);
    }
  }
});

test('la langue : « Comme Grist » avec la langue de Grist, un séparateur, puis les deux langues, chacune dans la sienne', () => {
  const { submenu } = build('fr', { grist: 'en' }).items[0];
  assert.deepEqual(submenu.map(item => (item === '-' ? '-' : item.label)), ['Comme Grist (English)', '-', 'Français', 'English']);
  const english = build('en', { grist: 'fr' }).items[0].submenu;
  assert.deepEqual(english.map(item => (item === '-' ? '-' : item.label)), ['Same as Grist (Français)', '-', 'Français', 'English']);
});

test('la coche suit le choix : « Comme Grist », le français ou l\'anglais, jamais deux à la fois', () => {
  for (const [choice, wanted] of [['auto', 0], ['fr', 2], ['en', 3]]) {
    const { submenu } = build('fr', { choice }).items[0];
    assert.deepEqual(submenu.map(item => item !== '-' && item.check), submenu.map((item, index) => item !== '-' && index === wanted), `choix ${choice}`);
  }
});

test('« Bouton LanguageTool » n\'est pas au niveau des autres réglages (le porteur, 12/11) : il est dans « Réglages avancés », seul, et la ligne du menu ne le montre pas', () => {
  for (const lang of ['fr', 'en']) {
    const { items } = build(lang);
    const names = rows(items).map(item => item.label);
    assert.ok(!names.some(name => /LanguageTool/.test(name)), `${lang} : une ligne du menu nomme LanguageTool`);
    const advanced = items[2];
    assert.ok(Array.isArray(advanced.submenu), `${lang} : « Réglages avancés » n'ouvre pas de sous-menu`);
    assert.deepEqual(advanced.submenu.map(entry => (entry === '-' ? '-' : entry.label)), [lang === 'fr' ? 'Bouton LanguageTool' : 'LanguageTool button']);
  }
});

test('« Bouton LanguageTool » est un interrupteur à lui seul (case à cocher), non un choix parmi d\'autres comme les langues', () => {
  const { items } = build('fr');
  assert.equal(items[2].submenu[0].toggle, true);
  assert.equal(items[2].toggle, undefined);
  assert.equal(items[0].submenu.some(entry => entry !== '-' && entry.toggle), false);
});

test('chaque ligne fait ce qu\'elle dit : choisir une langue, ouvrir le thème, mettre le bouton LanguageTool dans la barre, ouvrir « À propos »', () => {
  const { items, calls } = build('fr');
  const [language, theme, advanced, , , about] = items;
  const [auto, , fr, en] = language.submenu;
  auto.run();
  fr.run();
  en.run();
  theme.run();
  advanced.submenu[0].run();
  about.run();
  assert.deepEqual(calls, [['langue', 'auto'], ['langue', 'fr'], ['langue', 'en'], ['theme'], ['langtool'], ['apropos']]);
});

test('la ligne de la barre est celle que le contrôleur donne, sans changement : le menu ne connaît pas la barre', () => {
  assert.equal(build('fr').items[3], PLACE);
});

test('« Bouton LanguageTool » : cochée quand le bouton est dans la barre, décochée sinon, et l\'infobulle dit ce que la ligne fait (le bouton coupe ou rallume LanguageTool dans l\'app)', () => {
  for (const shown of [false, true]) {
    const row = build('fr', { shown }).items[2].submenu[0];
    assert.equal(row.check, shown);
    assert.equal(row.icon, 'spell');
    assert.match(row.title, /bouton de la barre coupe ou rallume LanguageTool dans l’app ouverte/);
  }
  assert.match(build('en').items[2].submenu[0].title, /button in the bar turns LanguageTool off or back on in the open app/);
});

test('les lignes à fenêtre ou à sous-menu disent pourquoi à l\'infobulle : la langue et le thème valent pour la suite et ses apps', () => {
  const [language, theme] = build('fr').items;
  assert.equal(language.title, 'Langue de Grist Factory Suite et de ses apps');
  assert.equal(theme.title, 'Thème de Grist Factory Suite et de ses apps');
});

test('« À propos » : la version, l\'auteur, le site et la licence, dans les deux langues', () => {
  const fr = aboutItems(createI18n('fr').t);
  assert.deepEqual(fr, [`Version : ${HOST.version}`, 'Auteur : Grist Factory', 'Site : grist-factory.fr', 'Licence : GNU GPL v3.0']);
  const en = aboutItems(createI18n('en').t);
  assert.deepEqual(en, [`Version: ${HOST.version}`, 'Author: Grist Factory', 'Site: grist-factory.fr', 'License: GNU GPL v3.0']);
});

test('« À propos » dit la version que GFS donne déjà aux apps, et nomme l\'éditeur de la charte, jamais un compte personnel', () => {
  assert.match(HOST.version, /^\d+\.\d+\.\d+/);
  assert.deepEqual({ ...CREDITS }, { auteur: 'Grist Factory', site: 'grist-factory.fr', licence: 'GNU GPL v3.0' });
  for (const lang of ['fr', 'en']) {
    const { t } = createI18n(lang);
    const text = [...aboutItems(t), t('about.title'), t('about.text'), t('set.about')].join('\n');
    assert.doesNotMatch(text, /lombre33|github/i, lang);
  }
});
