// Le lecteur de vidéos que GFS pose par-dessus l'app (js/broker/player.js ; contrats 3.4 point 7, 5.2 point 11) : la lecture des quatre appels, l'adresse montée par GFS, le rognage, et la pose
// avec un faux DOM (ce que le navigateur en fait se mesure dans un vrai Grist : labo/run-lecteur.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player, readShow, readMove, readHide, readClose, playerUrl, visiblePart } from '../js/broker/player.js';
import { knownProviders } from '../js/broker/player-sites.js';

const BOX = { x: 10, y: 20, largeur: 300, hauteur: 200 };
const ZONE = { x: 0, y: 0, largeur: 600, hauteur: 400 };
const show = (over = {}) => ({ id: 'v1', fournisseur: 'youtube', video: 'dQw4w9WgXcQ', rect: BOX, zone: ZONE, ...over });
const refused = (run, pattern) => assert.throws(run, error => error.code === 'GFS_REFUSE' && pattern.test(error.message));

test('knownProviders : seuls les sites que GFS sait jouer, dans l\'ordre de la déclaration, sans doublon', () => {
  assert.deepEqual(knownProviders(['vimeo', 'dailymotion', 'youtube', 'vimeo']), ['vimeo', 'youtube']);
  assert.deepEqual(knownProviders(undefined), []);
  assert.deepEqual(knownProviders('youtube'), []);
});

test('lecteur.afficher : une demande bien formée est lue, avec un début à 0 par défaut', () => {
  assert.deepEqual(readShow(show(), ['youtube']), { id: 'v1', provider: 'youtube', video: 'dQw4w9WgXcQ', start: 0, rect: { x: 10, y: 20, width: 300, height: 200 }, zone: { x: 0, y: 0, width: 600, height: 400 } });
  assert.equal(readShow(show({ debut: 90 }), ['youtube']).start, 90);
  assert.equal(readShow(show({ fournisseur: 'vimeo', video: '76979871/8272103f6e' }), ['youtube', 'vimeo']).video, '76979871/8272103f6e');
});

test('lecteur.afficher : un site que l\'app n\'a pas déclaré, une adresse à la place d\'un identifiant, un id ou un début hors règle sont refusés', () => {
  refused(() => readShow(show({ fournisseur: 'vimeo', video: '123' }), ['youtube']), /fournisseur/);
  refused(() => readShow(show({ fournisseur: 'dailymotion' }), ['youtube']), /fournisseur/);
  refused(() => readShow(show({ video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }), ['youtube']), /jamais une adresse/);
  refused(() => readShow(show({ video: 'tropcourt' }), ['youtube']), /identifiant/);
  refused(() => readShow(show({ fournisseur: 'vimeo', video: 'abc' }), ['vimeo']), /identifiant/);
  refused(() => readShow(show({ id: 'V 1' }), ['youtube']), /id doit être/);
  refused(() => readShow(show({ id: undefined }), ['youtube']), /id doit être/);
  refused(() => readShow(show({ debut: -1 }), ['youtube']), /debut/);
  refused(() => readShow(show({ debut: 1.5 }), ['youtube']), /debut/);
  refused(() => readShow(show({ debut: '30' }), ['youtube']), /debut/);
});

test('lecteur.afficher et deplacer : un rectangle ou une zone mal formés sont refusés', () => {
  refused(() => readShow(show({ rect: undefined }), ['youtube']), /rect/);
  refused(() => readShow(show({ rect: { ...BOX, largeur: -1 } }), ['youtube']), /rect/);
  refused(() => readShow(show({ zone: { ...ZONE, x: NaN } }), ['youtube']), /zone/);
  refused(() => readShow(show({ zone: { ...ZONE, hauteur: '400' } }), ['youtube']), /zone/);
  refused(() => readMove({ id: 'v1', rect: BOX, zone: { ...ZONE, y: Infinity } }), /zone/);
  assert.deepEqual(readMove({ id: 'v1', rect: BOX, zone: ZONE }).rect, { x: 10, y: 20, width: 300, height: 200 });
});

test('lecteur.masquer et fermer : un booléen et un id', () => {
  assert.deepEqual(readHide({ id: 'v1', masque: true }), { id: 'v1', hidden: true });
  refused(() => readHide({ id: 'v1', masque: 'oui' }), /masque/);
  assert.deepEqual(readClose({ id: 'v1' }), { id: 'v1' });
  refused(() => readClose({}), /id doit être/);
});

test('l\'adresse du lecteur est montée par GFS d\'après le site et l\'identifiant : YouTube sans cookie, Vimeo avec sa clé', () => {
  assert.equal(playerUrl({ provider: 'youtube', video: 'dQw4w9WgXcQ', start: 0 }), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&autoplay=1');
  assert.equal(playerUrl({ provider: 'youtube', video: 'dQw4w9WgXcQ', start: 42 }), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&autoplay=1&start=42');
  assert.equal(playerUrl({ provider: 'vimeo', video: '76979871', start: 0 }), 'https://player.vimeo.com/video/76979871?autoplay=1');
  assert.equal(playerUrl({ provider: 'vimeo', video: '76979871/8272103f6e', start: 30 }), 'https://player.vimeo.com/video/76979871?h=8272103f6e&autoplay=1#t=30s');
});

test('visiblePart : le rectangle de l\'objet rogné à la zone et au cadre de l\'app, rien quand rien ne se voit', () => {
  const rect = { x: 10, y: 20, width: 300, height: 200 };
  const frame = { width: 700, height: 400 };
  assert.deepEqual(visiblePart(rect, { x: 0, y: 0, width: 600, height: 400 }, frame), { x: 10, y: 20, width: 300, height: 200, inner: { x: 0, y: 0, width: 300, height: 200 } });
  // La zone coupe le haut et la droite : la fenêtre se réduit, le cadre du fournisseur garde sa taille entière, décalé.
  assert.deepEqual(visiblePart(rect, { x: 0, y: 100, width: 150, height: 300 }, frame), { x: 10, y: 100, width: 140, height: 120, inner: { x: 0, y: -80, width: 300, height: 200 } });
  // Le cadre de l'app coupe le bas : l'objet sort du cadre.
  assert.equal(visiblePart(rect, { x: 0, y: 0, width: 600, height: 400 }, { width: 700, height: 120 }).height, 100);
  // Un rectangle qui sort à gauche et en haut du cadre : rogné à 0.
  assert.deepEqual(visiblePart({ x: -50, y: -10, width: 100, height: 100 }, { x: -100, y: -100, width: 500, height: 500 }, frame), { x: 0, y: 0, width: 50, height: 90, inner: { x: -50, y: -10, width: 100, height: 100 } });
  assert.equal(visiblePart(rect, { x: 400, y: 0, width: 100, height: 100 }, frame), null, 'hors de la zone');
  assert.equal(visiblePart(rect, { x: 0, y: 0, width: 0, height: 400 }, frame), null, 'une zone sans largeur');
});

// ----- La pose, avec un faux DOM.
function fakeElement(tag) {
  const element = {
    tag, attributes: {}, style: {}, children: [], className: '', hidden: false, removed: false,
    setAttribute(name, value) { this.attributes[name] = value; },
    append(child) { this.children.push(child); child.parent = this; },
    remove() { this.removed = true; if (this.parent) this.parent.children = this.parent.children.filter(each => each !== this); },
    getBoundingClientRect() { return this.box || { left: 0, top: 0 }; },
  };
  return element;
}
function setup() {
  const container = fakeElement('div');
  container.box = { left: 5, top: 7 };
  const frameElement = Object.assign(fakeElement('iframe'), { clientWidth: 700, clientHeight: 400, clientLeft: 0, clientTop: 0, box: { left: 5, top: 7 } });
  const session = { id: 'publipostage', policy: { lecteurs: ['youtube', 'vimeo'] }, frameElement };
  const warnings = [];
  const doc = { createElement: fakeElement, defaultView: null };
  const player = new Player({ container, doc, warn: text => warnings.push(text) });
  return { container, frameElement, session, warnings, player, handlers: player.handlers(session), doc };
}

test('afficher pose le lecteur à l\'endroit de la vignette, dans le repère des cadres ; deplacer le suit ; masquer le cache ; fermer le retire', () => {
  const { container, handlers, player } = setup();
  handlers['lecteur.afficher'](show());
  const [wrapper] = container.children;
  const [frame] = wrapper.children;
  assert.equal(wrapper.className, 'player');
  assert.equal(frame.src, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&autoplay=1');
  assert.match(frame.attributes.sandbox, /allow-scripts/);
  assert.doesNotMatch(frame.attributes.sandbox, /allow-top-navigation|allow-forms|allow-modals/);
  assert.equal(frame.attributes.referrerpolicy, 'strict-origin-when-cross-origin');
  assert.deepEqual([wrapper.style.left, wrapper.style.top, wrapper.style.width, wrapper.style.height], ['10px', '20px', '300px', '200px'], 'même repère : le cadre de l\'app et les cadres ont la même origine ici');
  assert.deepEqual([frame.style.left, frame.style.top], ['0px', '0px']);
  handlers['lecteur.deplacer']({ id: 'v1', rect: { x: 50, y: 60, largeur: 300, hauteur: 200 }, zone: { x: 0, y: 100, largeur: 600, hauteur: 300 } });
  assert.deepEqual([wrapper.style.left, wrapper.style.top, wrapper.style.width, wrapper.style.height], ['50px', '100px', '300px', '160px']);
  assert.equal(frame.style.top, '-40px');
  handlers['lecteur.masquer']({ id: 'v1', masque: true });
  assert.equal(wrapper.hidden, true);
  handlers['lecteur.masquer']({ id: 'v1', masque: false });
  assert.equal(wrapper.hidden, false);
  handlers['lecteur.fermer']({ id: 'v1' });
  assert.equal(wrapper.removed, true);
  assert.equal(container.children.length, 0);
  assert.equal(player.current, null);
});

test('le cadre de l\'app qui n\'est pas à l\'origine des cadres décale le lecteur du même écart', () => {
  const { container, frameElement, handlers } = setup();
  frameElement.box = { left: 65, top: 47 };
  handlers['lecteur.afficher'](show());
  assert.deepEqual([container.children[0].style.left, container.children[0].style.top], ['70px', '60px']);
});

test('un seul lecteur à la fois : un nouvel afficher remplace le précédent ; une app ne touche qu\'à son lecteur', () => {
  const { container, handlers, player, session } = setup();
  handlers['lecteur.afficher'](show());
  const first = container.children[0];
  handlers['lecteur.afficher'](show({ id: 'v2', video: 'aaaaaaaaaaa' }));
  assert.equal(first.removed, true);
  assert.equal(container.children.length, 1);
  assert.equal(player.current, 'v2');
  handlers['lecteur.fermer']({ id: 'v1' });
  assert.equal(container.children.length, 1, 'fermer un id qui n\'est pas le lecteur ne retire rien');
  handlers['lecteur.deplacer']({ id: 'v1', rect: BOX, zone: ZONE });
  assert.equal(player.current, 'v2');
  const other = player.handlers({ ...session, id: 'autre' });
  other['lecteur.fermer']({ id: 'v2' });
  assert.equal(container.children.length, 1, 'une autre app ne ferme pas le lecteur d\'une app');
});

test('un lecteur hors de la zone ou masqué n\'est pas montré ; closeFor retire le lecteur de l\'app qui part', () => {
  const { container, handlers, player, session } = setup();
  handlers['lecteur.afficher'](show({ zone: { x: 400, y: 0, largeur: 100, hauteur: 100 } }));
  assert.equal(container.children[0].hidden, true);
  handlers['lecteur.deplacer']({ id: 'v1', rect: BOX, zone: ZONE });
  assert.equal(container.children[0].hidden, false);
  player.closeFor({ ...session });
  assert.equal(container.children.length, 1, 'une autre session ne retire rien');
  player.closeFor(session);
  assert.equal(container.children.length, 0);
});

test('une demande hors règle est refusée et dite en console : rien n\'est posé ; un site non déclaré est refusé', () => {
  const { container, handlers, warnings, session, player } = setup();
  assert.throws(() => handlers['lecteur.afficher'](show({ video: 'https://exemple.test/x' })), error => error.code === 'GFS_REFUSE');
  assert.equal(container.children.length, 0);
  assert.match(warnings[0], /publipostage : lecteur\.afficher refusé \(GFS_REFUSE\)/);
  const mute = player.handlers({ ...session, policy: { lecteurs: [] } });
  assert.throws(() => mute['lecteur.afficher'](show()), error => error.code === 'GFS_REFUSE');
  assert.equal(container.children.length, 0, 'sans déclaration, aucun lecteur');
});

test('une app cachée derrière l\'explorateur ne pose pas de lecteur par-dessus lui', () => {
  const { container, session, player } = setup();
  const hidden = player.handlers({ ...session, shown: false });
  hidden['lecteur.afficher'](show());
  assert.equal(container.children.length, 0);
  assert.equal(player.current, null);
});
