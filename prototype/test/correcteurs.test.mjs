// Le bouton « LanguageTool » de la barre (js/shell/correcteurs.js, contrats 5.2, point 13) : deux choix retenus sur le navigateur de GFS, dont la personne ne voit que l'effet : le bouton est dans
// la barre ou non (`shown`), et LanguageTool est coupé dans les apps ou non (`coupes`, jamais sans le bouton). La mise en page et la souris sont mesurées dans un vrai Grist
// (labo/run-correcteurs.mjs) et sous Firefox (test/interfaces-firefox.test.mjs) ; ici, ce que les deux choix font ensemble.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Correcteurs, SHOWN_KEY, CUT_KEY } from '../js/shell/correcteurs.js';

// Une page de pied : un `localStorage` en mémoire (qui peut refuser), et le suivi de l'événement `storage` d'un autre onglet.
function fakeWindow({ accepts = true, initial = {} } = {}) {
  const data = { ...initial };
  const listeners = [];
  return {
    data,
    localStorage: {
      getItem: key => (key in data ? data[key] : null),
      setItem(key, value) { if (!accepts) throw new Error('refusé'); data[key] = String(value); },
      removeItem(key) { if (!accepts) throw new Error('refusé'); delete data[key]; },
    },
    addEventListener: (name, handler) => { if (name === 'storage') listeners.push(handler); },
    removeEventListener() {},
    otherTab(key, value) { if (value === null) delete data[key]; else data[key] = value; for (const handler of listeners) handler({ key }); },
  };
}

test('au départ rien n\'est voulu : le bouton n\'est pas dans la barre et rien n\'est coupé', () => {
  const correcteurs = new Correcteurs({ win: fakeWindow() });
  assert.deepEqual(correcteurs.state, { shown: false, coupes: false });
  assert.deepEqual(correcteurs.message(), { coupes: false });
});

test('la ligne « Bouton LanguageTool » met le bouton dans la barre sans rien couper ; le bouton coupe, puis rallume', () => {
  const win = fakeWindow();
  const correcteurs = new Correcteurs({ win });
  assert.equal(correcteurs.setShown(true), true);
  assert.deepEqual(correcteurs.state, { shown: true, coupes: false }, 'le bouton est là, LanguageTool travaille encore');
  assert.equal(correcteurs.toggleCut(), true);
  assert.deepEqual(correcteurs.message(), { coupes: true });
  assert.equal(correcteurs.toggleCut(), true);
  assert.deepEqual(correcteurs.message(), { coupes: false });
  assert.equal(win.data[SHOWN_KEY], 'oui', 'le choix de voir le bouton est retenu');
  assert.equal(CUT_KEY in win.data, false, 'une clé « non » n\'est pas écrite : elle est retirée');
});

test('sans le bouton dans la barre rien n\'est coupé, mais le choix de couper est gardé et reprend quand le bouton revient', () => {
  const win = fakeWindow();
  const correcteurs = new Correcteurs({ win });
  correcteurs.setShown(true);
  correcteurs.toggleCut();
  assert.equal(correcteurs.state.coupes, true);
  correcteurs.setShown(false);
  assert.deepEqual(correcteurs.state, { shown: false, coupes: false }, 'le bouton retiré, LanguageTool revient dans les apps');
  assert.equal(win.data[CUT_KEY], 'oui');
  correcteurs.setShown(true);
  assert.deepEqual(correcteurs.state, { shown: true, coupes: true });
});

test('les choix retenus se retrouvent au rechargement, et une valeur étrangère est tenue pour absente', () => {
  const win = fakeWindow({ initial: { [SHOWN_KEY]: 'oui', [CUT_KEY]: 'oui' } });
  assert.deepEqual(new Correcteurs({ win }).state, { shown: true, coupes: true });
  const strange = fakeWindow({ initial: { [SHOWN_KEY]: 'peut-être', [CUT_KEY]: 'oui' } });
  assert.deepEqual(new Correcteurs({ win: strange }).state, { shown: false, coupes: false });
});

test('l\'écoute n\'est appelée que quand `shown` ou `coupes` change vraiment, avec l\'état d\'avant', () => {
  const correcteurs = new Correcteurs({ win: fakeWindow() });
  const heard = [];
  correcteurs.onChange((state, before) => heard.push([state, before]));
  correcteurs.toggleCut();
  assert.equal(heard.length, 0, 'couper sans le bouton ne change rien de ce que les apps doivent faire');
  correcteurs.setShown(true);
  assert.deepEqual(heard.map(([state]) => state), [{ shown: true, coupes: true }]);
  assert.deepEqual(heard[0][1], { shown: false, coupes: false });
  correcteurs.setShown(true);
  assert.equal(heard.length, 1, 'redire le même choix ne dit rien');
  correcteurs.toggleCut();
  assert.deepEqual(heard.at(-1)[0], { shown: true, coupes: false });
});

test('un navigateur qui refuse de retenir le dit, et le choix vaut pour la page', () => {
  const correcteurs = new Correcteurs({ win: fakeWindow({ accepts: false }) });
  assert.equal(correcteurs.setShown(true), false);
  assert.equal(correcteurs.toggleCut(), false);
  assert.deepEqual(correcteurs.state, { shown: true, coupes: true }, 'valable jusqu\'au rechargement');
});

test('un autre onglet qui change une clé est suivi, et les apps de celui-ci l\'apprennent', () => {
  const win = fakeWindow();
  const correcteurs = new Correcteurs({ win });
  const heard = [];
  correcteurs.onChange(state => heard.push(state));
  win.otherTab(SHOWN_KEY, 'oui');
  win.otherTab(CUT_KEY, 'oui');
  assert.deepEqual(heard, [{ shown: true, coupes: false }, { shown: true, coupes: true }]);
  win.otherTab(SHOWN_KEY, null);
  assert.deepEqual(correcteurs.state, { shown: false, coupes: false });
});
