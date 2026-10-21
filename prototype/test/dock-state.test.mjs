// La barre de GFS vue de l'app (contrats 5.2, point 7) : ce qu'elle recouvre, quand l'app l'apprend, ce que l'app peut lui demander.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EDGES, DEFAULT_EDGE, GAP, barreOf, sameBarre, DockState, barHandlers } from '../js/dock-state.js';
import { StoredChoice } from '../js/stored-choice.js';

const FRAME = { largeur: 700, hauteur: 400 };
function fakeStore(initial = null, { accepts = true } = {}) {
  const store = { value: initial, read: () => store.value, write(value) { if (!accepts) return false; store.value = value; return true; } };
  return store;
}

// Une page de pied : la barre est posée au bord choisi, centrée, comme le fait la feuille de style (34 × 94 px à 4 px du bord, ou 94 × 34).
function fakePage({ store = fakeStore(), frame = FRAME } = {}) {
  const page = { frame, log: [], rendered: null, setting: new StoredChoice({ choices: EDGES, fallback: DEFAULT_EDGE, store }) };
  const place = edge => {
    const vertical = edge === 'gauche' || edge === 'droite';
    const [w, h] = vertical ? [34, 94] : [94, 34];
    const x = { gauche: 4, droite: page.frame.largeur - 4 - w }[edge] ?? Math.round((page.frame.largeur - w) / 2);
    const y = { haut: 4, bas: page.frame.hauteur - 4 - h }[edge] ?? Math.round((page.frame.hauteur - h) / 2);
    return { x, y, largeur: w, hauteur: h };
  };
  page.state = new DockState({
    setting: page.setting,
    measure: () => { page.log.push('mesure'); return { rect: place(page.state.edge), frame: page.frame }; },
    render: view => { page.log.push('rendu'); page.rendered = view; },
  });
  page.heard = [];
  page.state.onChange(barre => page.heard.push(barre));
  return page;
}

test('barreOf : le bord, l\'épaisseur de la bande et la zone à laisser libre (la barre et 4 px autour), aux quatre bords', () => {
  assert.equal(GAP, 4);
  assert.deepEqual(barreOf('gauche', { x: 4, y: 153, largeur: 34, hauteur: 94 }, FRAME), { bord: 'gauche', epaisseur: 42, zone: { x: 0, y: 149, largeur: 42, hauteur: 102 } });
  assert.deepEqual(barreOf('droite', { x: 662, y: 153, largeur: 34, hauteur: 94 }, FRAME), { bord: 'droite', epaisseur: 42, zone: { x: 658, y: 149, largeur: 42, hauteur: 102 } });
  assert.deepEqual(barreOf('haut', { x: 303, y: 4, largeur: 94, hauteur: 34 }, FRAME), { bord: 'haut', epaisseur: 42, zone: { x: 299, y: 0, largeur: 102, hauteur: 42 } });
  assert.deepEqual(barreOf('bas', { x: 303, y: 362, largeur: 94, hauteur: 34 }, FRAME), { bord: 'bas', epaisseur: 42, zone: { x: 299, y: 358, largeur: 102, hauteur: 42 } });
});

test('barreOf : des mesures fractionnaires s\'arrondissent, la zone reste dans le cadre même quand il est plus petit que la barre', () => {
  assert.deepEqual(barreOf('gauche', { x: 4, y: 152.5, largeur: 34, hauteur: 94 }, FRAME).zone, { x: 0, y: 149, largeur: 42, hauteur: 102 });
  const tiny = barreOf('gauche', { x: 4, y: 0, largeur: 34, hauteur: 94 }, { largeur: 30, hauteur: 60 });
  assert.deepEqual(tiny.zone, { x: 0, y: 0, largeur: 30, hauteur: 60 });
  assert.equal(tiny.epaisseur, 30);
  const outside = barreOf('droite', { x: 700, y: 10, largeur: 34, hauteur: 20 }, FRAME);
  assert.ok(outside.zone.largeur >= 0 && outside.zone.hauteur >= 0);
});

test('sameBarre : la même description (ou aucune des deux) ne dit rien de nouveau', () => {
  const left = barreOf('gauche', { x: 4, y: 153, largeur: 34, hauteur: 94 }, FRAME);
  assert.equal(sameBarre(null, null), true);
  assert.equal(sameBarre(left, null), false);
  assert.equal(sameBarre(null, left), false);
  assert.equal(sameBarre(left, structuredClone(left)), true);
  assert.equal(sameBarre(left, barreOf('droite', { x: 662, y: 153, largeur: 34, hauteur: 94 }, FRAME)), false);
  assert.equal(sameBarre(left, barreOf('gauche', { x: 4, y: 154, largeur: 34, hauteur: 94 }, FRAME)), false);
});

test('tant qu\'aucune app n\'est montrée, la barre ne recouvre rien : null, rien n\'est mesuré', () => {
  const page = fakePage();
  assert.equal(page.state.barre(), null);
  assert.equal(page.state.visible, false);
  assert.deepEqual(page.rendered, { edge: 'gauche', visible: false });
  assert.ok(!page.log.includes('mesure'));
});

test('une app montrée : la barre la recouvre, l\'app l\'apprend une fois ; l\'explorateur qui s\'ouvre la retire', () => {
  const page = fakePage();
  page.state.setPresent(true);
  assert.deepEqual(page.rendered, { edge: 'gauche', visible: true });
  assert.equal(page.heard.length, 1);
  assert.deepEqual(page.heard[0], { bord: 'gauche', epaisseur: 42, zone: { x: 0, y: 149, largeur: 42, hauteur: 102 } });
  page.state.setPresent(true);
  assert.equal(page.heard.length, 1, 'rien de nouveau');
  page.state.setPresent(false);
  assert.deepEqual(page.heard.at(-1), null);
  assert.equal(page.heard.length, 2);
});

test('le bord choisi : l\'affichage est mis à jour AVANT la mesure, l\'app apprend la nouvelle zone, le même bord ne dit rien', () => {
  const store = fakeStore();
  const page = fakePage({ store });
  page.state.setPresent(true);
  page.log.length = 0;
  assert.equal(page.state.choose('bas'), true);
  assert.deepEqual(page.log.slice(0, 2), ['rendu', 'mesure'], 'le bord est posé avant la mesure');
  assert.equal(store.value, 'bas', 'retenu sur le navigateur');
  assert.deepEqual(page.heard.at(-1), { bord: 'bas', epaisseur: 42, zone: { x: 299, y: 358, largeur: 102, hauteur: 42 } });
  const count = page.heard.length;
  page.state.choose('bas');
  assert.equal(page.heard.length, count);
  for (const edge of EDGES) {
    page.state.choose(edge);
    assert.equal(page.heard.at(-1).bord, edge);
    assert.equal(page.state.barre().epaisseur, 42);
  }
});

test('un bord choisi alors que l\'explorateur est ouvert : retenu, mais l\'app n\'apprend rien (rien ne la recouvre) ; elle l\'apprend au retour', () => {
  const page = fakePage();
  page.state.choose('droite');
  assert.deepEqual(page.heard, []);
  page.state.setPresent(true);
  assert.equal(page.heard.length, 1);
  assert.equal(page.heard[0].bord, 'droite');
});

test('un navigateur qui refuse de retenir le bord : choose le dit (false), le bord vaut pour la page et l\'app l\'apprend', () => {
  const page = fakePage({ store: fakeStore(null, { accepts: false }) });
  page.state.setPresent(true);
  assert.equal(page.state.choose('haut'), false);
  assert.equal(page.state.edge, 'haut');
  assert.equal(page.heard.at(-1).bord, 'haut');
});

test('un autre onglet change le bord : on suit, l\'app l\'apprend', () => {
  const store = fakeStore();
  const page = fakePage({ store });
  page.state.setPresent(true);
  store.value = 'droite';
  page.setting.reload();
  assert.equal(page.heard.at(-1).bord, 'droite');
  assert.equal(page.rendered.edge, 'droite');
});

test('mask : l\'app demande à ne pas avoir la barre (le diaporama) ; elle l\'apprend comme tout changement ; la rendre revient à la zone d\'avant', () => {
  const page = fakePage();
  page.state.setPresent(true);
  const before = page.heard.at(-1);
  page.state.mask(true);
  assert.equal(page.state.masked, true);
  assert.equal(page.state.visible, false);
  assert.deepEqual(page.rendered, { edge: 'gauche', visible: false });
  assert.equal(page.heard.at(-1), null);
  page.state.mask(true);
  assert.equal(page.heard.length, 2, 'redemander ne dit rien de nouveau');
  page.state.mask(false);
  assert.deepEqual(page.heard.at(-1), before);
  assert.deepEqual(page.rendered, { edge: 'gauche', visible: true });
});

test('la demande de l\'app ne tient que pendant qu\'elle est montrée : l\'explorateur qui s\'ouvre la défait, une app cachée ne peut pas retirer la barre', () => {
  const page = fakePage();
  page.state.setPresent(true);
  page.state.mask(true);
  page.state.setPresent(false);
  assert.equal(page.state.masked, false);
  page.state.setPresent(true);
  assert.equal(page.state.visible, true, 'la personne revient : la barre est là');
  page.state.setPresent(false);
  page.state.mask(true); // une app cachée derrière l'explorateur
  assert.equal(page.state.masked, false);
  page.state.setPresent(true);
  assert.equal(page.state.visible, true);
});

test('refresh : la barre est centrée sur son bord, un cadre qui change de taille déplace la zone ; sans changement, rien', () => {
  const page = fakePage();
  page.state.setPresent(true);
  const count = page.heard.length;
  page.state.refresh();
  assert.equal(page.heard.length, count);
  page.frame = { largeur: 700, hauteur: 600 };
  page.state.refresh();
  assert.equal(page.heard.length, count + 1);
  assert.deepEqual(page.heard.at(-1).zone, { x: 0, y: 249, largeur: 42, hauteur: 102 });
});

test('une barre sans taille (pas à l\'écran) ne recouvre rien', () => {
  const state = new DockState({ setting: new StoredChoice({ choices: EDGES, fallback: DEFAULT_EDGE, store: fakeStore() }), measure: () => ({ rect: { x: 0, y: 0, largeur: 0, hauteur: 0 }, frame: FRAME }), render: () => {} });
  state.setPresent(true);
  assert.equal(state.barre(), null);
  const lost = new DockState({ setting: new StoredChoice({ choices: EDGES, fallback: DEFAULT_EDGE, store: fakeStore() }), measure: () => null, render: () => {} });
  lost.setPresent(true);
  assert.equal(lost.barre(), null);
});

test('barre.masquer : montre ou cache la barre, répond l\'état qui vaut ; un argument hors règle reçoit GFS_REFUSE et la console le dit', () => {
  const page = fakePage();
  page.state.setPresent(true);
  const warnings = [];
  const handlers = barHandlers(page.state, 'publipostage', text => warnings.push(text));
  assert.deepEqual(Object.keys(handlers), ['barre.masquer']);
  assert.deepEqual(handlers['barre.masquer']({ masquee: true }), { masquee: true });
  assert.equal(page.state.visible, false);
  assert.deepEqual(handlers['barre.masquer']({ masquee: false }), { masquee: false });
  assert.equal(page.state.visible, true);
  for (const odd of [{}, { masquee: 'oui' }, { masquee: 1 }, { masquee: null }, { masque: true }]) {
    assert.throws(() => handlers['barre.masquer'](odd), error => error.code === 'GFS_REFUSE', JSON.stringify(odd));
  }
  assert.equal(page.state.visible, true, 'un appel refusé ne change rien');
  assert.equal(warnings.length, 5);
  assert.match(warnings[0], /publipostage : barre\.masquer refusé \(GFS_REFUSE\)/);
});
