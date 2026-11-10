// La vue « Ouverts » (js/opened-files.js, js/explorer-view.js) : la liste des fichiers que GFS a ouverts dans une app, en code pur ; la liste à l'écran (la ligne du volet, le mot « affiché », le menu) se mesure
// dans un vrai Grist (labo/run-ouverts.mjs) et sous Firefox (test/interfaces-firefox.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenedFiles, OPENED_LIMIT, NO_OPENED } from '../js/opened-files.js';

class FakeNode {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.dataset = {}; this.style = { setProperty() {} }; this.className = ''; this.children = []; this.title = undefined; }
  setAttribute(name, value) { this.attrs[name] = value; }
  addEventListener() {}
  append(...nodes) { for (const node of nodes) this.children.push(node); }
  get elements() { return this.children.filter(node => typeof node !== 'string'); }
  get textContent() { return this.children.map(node => (typeof node === 'string' ? node : node.textContent)).join(''); }
}
globalThis.document = { createElement: tag => new FakeNode(tag), createElementNS: (ns, tag) => new FakeNode(tag) };
const { tree, crumbs, emptyMessage, fileRow } = await import('../js/explorer-view.js');
const { createI18n } = await import('../js/i18n.js');

const walk = (node, found = []) => { found.push(node); if (typeof node !== 'string') for (const child of node.children) walk(child, found); return found; };
const nodes = node => (Array.isArray(node) ? node : [node]).flatMap(entry => walk(entry)).filter(entry => typeof entry !== 'string');
const text = node => (typeof node === 'string' ? node : node.textContent);

test('add : le fichier passe en tête, sans doublon ; la liste garde les huit derniers ; keys() rend une copie', () => {
  const opened = new OpenedFiles();
  const session = {};
  opened.add('a:1', session);
  opened.add('a:2', session);
  opened.add('a:1', session);
  assert.deepEqual(opened.keys(), ['a:2', 'a:1'], 'un fichier rouvert passe en dernier, une seule fois');
  for (let i = 0; i < 10; i++) opened.add(`b:${i}`, session);
  assert.equal(opened.keys().length, OPENED_LIMIT);
  assert.deepEqual(opened.keys(), Array.from({ length: OPENED_LIMIT }, (_, i) => `b:${i + 2}`), 'les plus anciens sortent');
  opened.keys().push('x');
  assert.equal(opened.keys().includes('x'), false, 'la copie ne change pas la liste');
});

test('shown : le fichier que l\'app affiche, tant que c\'est la même session d\'app ; un fichier vierge, une autre session ou un retrait l\'effacent', () => {
  const opened = new OpenedFiles();
  const first = {};
  const second = {};
  opened.add('a:1', first);
  assert.equal(opened.shown(first), 'a:1');
  assert.equal(opened.shown(second), null, 'une autre session d\'app (l\'app a été remplacée puis rouverte) n\'affiche plus rien de la liste');
  assert.equal(opened.shown(null), null, 'sans app active, aucun fichier n\'est affiché');
  opened.add('a:2', first);
  assert.equal(opened.shown(first), 'a:2', 'c\'est le dernier ouvert qui est affiché');
  opened.none();
  assert.equal(opened.shown(first), null, 'un fichier vierge : plus aucun fichier de la liste n\'est affiché');
  assert.deepEqual(opened.keys(), ['a:1', 'a:2'], 'la liste garde ce qu\'elle avait');
  opened.add('a:1', first);
  opened.remove('a:1');
  assert.deepEqual(opened.keys(), ['a:2']);
  assert.equal(opened.shown(first), null, 'le fichier retiré n\'est plus « affiché » dans la liste');
  opened.remove('a:9');
  assert.deepEqual(opened.keys(), ['a:2'], 'retirer un fichier qui n\'y est pas ne change rien');
});

test('NO_OPENED (l\'explorateur seul) : rien d\'ouvert, rien à retirer', () => {
  assert.deepEqual([NO_OPENED.keys(), NO_OPENED.shown(), NO_OPENED.remove('a:1')], [[], null, undefined]);
});

const { t } = createI18n('fr');
const file = (extra = {}) => ({ key: 'publipostage:1', name: 'Convocation', type: 'document', icon: 'doc', app: 'publipostage', ts: 1762000000, by: 'paul@exemple.fr', family: 'doc', weight: 2048, folder: '', pinned: false, ...extra });
const ctx = (extra = {}) => ({
  t, locale: 'fr', now: new Date('2026-11-10T12:00:00Z'), state: { view: 'opened', path: '', sel: null }, lockOf: () => null, typeLabel: item => item.type, treeRows: [], favCount: 0, trashCount: 0, sharedPending: 0,
  filtering: false, choosing: false, totalFiles: 0, openedCount: 0, shownKey: null, ...extra,
});

test('le volet : « Ouverts » est la première ligne, avec le nombre de fichiers ouverts, et la vue courante porte aria-current', () => {
  const rows = nodes(tree(ctx({ openedCount: 3 }))).filter(node => node.tag === 'button' && node.dataset.view);
  assert.deepEqual(rows.map(row => row.dataset.view), ['opened', 'recent', 'fav', 'shared', 'trash']);
  assert.equal(text(rows[0]), `${t('ex.opened')}3`);
  assert.deepEqual(rows.map(row => row.attrs['aria-current']), ['true', 'false', 'false', 'false', 'false']);
  const none = nodes(tree(ctx({ state: { view: 'folder', path: '' } }))).find(node => node.dataset && node.dataset.view === 'opened');
  assert.equal(text(none), t('ex.opened'), 'rien d\'ouvert : pas de nombre');
  assert.equal(none.attrs['aria-current'], 'false');
});

test('le fil d\'Ariane et le message vide disent « Ouverts »', () => {
  assert.equal(text({ children: crumbs(ctx()), get textContent() { return this.children.map(text).join(''); } }), `${t('ex.me')}${t('ex.opened')}`);
  assert.equal(emptyMessage(ctx()), t('ex.emptyOpened'));
  assert.equal(emptyMessage(ctx({ filtering: true })), t('ex.emptySearch'), 'une recherche sans résultat garde sa phrase');
});

test('« affiché » : le mot sur la ligne du fichier que l\'app affiche, dans « Ouverts » seulement', () => {
  const marks = (extra, item = file()) => nodes(fileRow(ctx(extra), item, true)).filter(node => node.className === 'now' || node.attrs.class === 'now').map(text);
  assert.deepEqual(marks({ shownKey: 'publipostage:1' }), [t('ex.shown')]);
  assert.deepEqual(marks({ shownKey: 'publipostage:2' }), [], 'un autre fichier est affiché');
  assert.deepEqual(marks({ shownKey: null }), []);
  assert.deepEqual(marks({ shownKey: 'publipostage:1', state: { view: 'recent', path: '', sel: null } }), [], 'ailleurs que dans « Ouverts », le mot ne s\'écrit pas');
});
