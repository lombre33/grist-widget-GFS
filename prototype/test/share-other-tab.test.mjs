// L'onglet « Dans un autre document Grist » de « Partager » (js/sharing/share-other-tab.js) : le bouton de niveau d'un lien pendant que son niveau s'écrit (retour du
// porteur du 25/11 : « Copie à jour » met 4 à 5 secondes à changer le statut, sans rien à l'écran). Un DOM de poche remplace celui du navigateur (le texte et les
// attributs seulement) ; la fenêtre à la souris se mesure sous Firefox (test/partager-autre-firefox.mjs) et dans un vrai Grist (labo/run-relier-document-neuf.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDocument } from './fake-dom.mjs';

installFakeDocument();

const { otherTab } = await import('../js/sharing/share-other-tab.js');
const { createI18n } = await import('../js/i18n/i18n.js');

const { t } = createI18n('fr');
const link = { id: 'e1', name: 'Compta', files: [], state: 'active', doc: { name: 'Comptabilité', id: 'd1' } };
const ctx = (extra = {}) => ({ t, container: {}, other: { why: null, fileId: 'abc', folder: false, limit: null }, links: [link], say() {}, setLevel() {}, newDocument() {}, ...extra });

// Le bouton du lien `id`, tel que la page le montre.
function levelButton(tab, id = 'e1') {
  const find = node => (node.dataset && node.dataset.fk === `other-level-${id}` ? node : (node.elements || []).map(find).find(Boolean));
  return find(tab);
}
const read = button => ({ text: button.children[0], busy: button.attrs['aria-busy'] || null, locked: button.attrs['aria-disabled'] || null, popup: button.attrs['aria-haspopup'] || null,
  glyph: button.elements[0].elements[0].attrs.href, cls: button.className });

test('un niveau qui s\'écrit : le bouton du lien dit « Mise à jour… » avec la flèche qui tourne, occupé et fermé ; sinon il garde son niveau et son menu', () => {
  const idle = read(levelButton(otherTab(ctx())));
  assert.deepEqual(idle, { text: t('so.level.none'), busy: null, locked: null, popup: 'menu', glyph: '#i-chev-down', cls: 'lvl' }, 'au repos : le niveau d\'avant, avec son menu');
  const busy = read(levelButton(otherTab(ctx({ busy: 'e1' }))));
  assert.deepEqual(busy, { text: t('so.level.working'), busy: 'true', locked: 'true', popup: null, glyph: '#i-refresh', cls: 'lvl is-busy' });
});

test('seul le lien dont le niveau s\'écrit est occupé ; un clic sur lui n\'ouvre aucun menu et ne dit rien', () => {
  const other = { id: 'e2', name: 'Direction', files: [], state: 'active', doc: { name: 'Direction', id: 'd2' } };
  const said = [];
  const tab = otherTab(ctx({ links: [link, other], busy: 'e1', say: text => said.push(text) }));
  assert.equal(read(levelButton(tab, 'e1')).busy, 'true');
  assert.equal(read(levelButton(tab, 'e2')).busy, null, 'l\'autre lien reste libre de s\'afficher');
  assert.equal(read(levelButton(tab, 'e2')).text, t('so.level.none'));
  for (const handler of levelButton(tab, 'e1').listeners.click) handler();
  assert.deepEqual(said, [], 'un lien occupé ne dit rien de plus que ce qu\'il montre');
});

test('les textes de l\'attente existent dans les deux langues, et le bas de la fenêtre nomme le document', () => {
  const en = createI18n('en').t;
  assert.equal(t('so.level.working'), 'Mise à jour…');
  assert.equal(en('so.level.working'), 'Updating…');
  assert.match(t('so.level.working.foot', { doc: 'Comptabilité' }), /« Comptabilité »/);
  assert.match(en('so.level.working.foot', { doc: 'Accounts' }), /“Accounts”/);
});
