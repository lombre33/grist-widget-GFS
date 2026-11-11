// La cloche Notifications (js/notifications.js) : les articles de son menu d'après les arrivées qui attendent une réponse. Le dessin (la pastille, le menu à 700 × 400) se mesure sous Firefox
// (test/partages-recus-firefox.mjs) et dans un vrai Grist (labo/run-partages-recus.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notificationItems, SHOWN } from '../js/notifications.js';
import { createI18n } from '../js/i18n.js';

const FR = createI18n('fr');
const EN = createI18n('en');
const arrival = (n, by = 'Compta <compta@exemple.fr>') => ({ key: `gfs-recus:GFS_Recus:f${n}`, id: `f${n}`, name: `Contrat ${n}.pdf`, by });

function setup(pending, i18n = FR) {
  const log = { asked: [], notices: [], opened: 0 };
  const items = notificationItems({ t: i18n.t, pending, notice: text => log.notices.push(text), ask: file => log.asked.push(file.id), openShared: () => { log.opened += 1; } });
  return { items, log };
}

test('sans arrivée à accepter, la ligne reste, grisée, et son clic dit ce qui s\'annonce ici', () => {
  const { items, log } = setup([]);
  assert.equal(items[0].label, 'Aucune notification');
  assert.equal(items[0].greyed, true);
  items[0].run();
  assert.match(log.notices[0], /Un fichier partagé depuis un autre document Grist s’annonce ici/);
  assert.equal(items[1], '-');
  assert.equal(items[2].label, 'Ouvrir « Partagés avec moi »', 'la vue reste atteignable, vide ou non');
});

test('chaque arrivée à accepter est une ligne : le fichier, celui qui partage, et le clic pose la question de CE fichier', () => {
  const { items, log } = setup([arrival(1), arrival(2)]);
  assert.deepEqual(items.slice(0, 2).map(item => item.label), ['« Contrat 1.pdf » de Compta, à accepter', '« Contrat 2.pdf » de Compta, à accepter']);
  assert.ok(items.slice(0, 2).every(item => !item.greyed && item.icon === 'users'));
  items[1].run();
  assert.deepEqual(log.asked, ['f2']);
  assert.equal(items.at(-1).label, 'Ouvrir « Partagés avec moi »');
  items.at(-1).run();
  assert.equal(log.opened, 1);
});

test('un envoyeur inconnu ne laisse pas de « de  » vide, et un fichier sans nom reste lisible', () => {
  const { items } = setup([{ ...arrival(1), by: '' }, { ...arrival(2), name: '' }]);
  assert.equal(items[0].label, '« Contrat 1.pdf », à accepter');
  assert.match(items[1].label, /^« .+ » de Compta, à accepter$/);
});

test('au-delà de la limite, le menu nomme les premières et compte les autres dans l\'article qui ouvre la vue', () => {
  const { items } = setup(Array.from({ length: SHOWN + 3 }, (_, i) => arrival(i + 1)));
  assert.equal(items.filter(item => item.icon === 'users').length, SHOWN);
  assert.equal(items.at(-1).label, 'Voir 3 autres dans « Partagés avec moi »');
});

test('l\'anglais dit la même chose', () => {
  const { items } = setup([arrival(1)], EN);
  assert.equal(items[0].label, '“Contrat 1.pdf” from Compta, to accept');
  assert.equal(items.at(-1).label, 'Open “Shared with me”');
  assert.equal(setup([], EN).items[0].label, 'No notifications');
});

test('les fichiers d\'un dossier reçu n\'ont qu\'une ligne, celle du dossier : un clic pose la question du dossier ; les fichiers sans dossier gardent leur ligne', () => {
  const inFolder = (n, folder) => ({ ...arrival(n), received: { table: 'GFS_Recus', row: n, state: 'pending', folder } });
  const asked = [];
  const items = notificationItems({ t: FR.t, pending: [inFolder(1, 'Contrats'), inFolder(2, 'Contrats'), inFolder(3, 'Contrats'), inFolder(4, ''), { ...inFolder(5, 'Devis'), by: '' }], notice() {}, ask: file => asked.push(file.id), askFolder: folder => asked.push(`dossier ${folder.name}`), openShared() {} });
  assert.deepEqual(items.slice(0, 3).map(item => item.label), ['Dossier « Contrats » de Compta : 3 fichiers à accepter', 'Dossier « Devis » : 1 fichier à accepter', '« Contrat 4.pdf » de Compta, à accepter']);
  items[0].run();
  items[1].run();
  items[2].run();
  assert.deepEqual(asked, ['dossier Contrats', 'dossier Devis', 'f4']);
  const en = notificationItems({ t: EN.t, pending: [inFolder(1, 'Contracts'), inFolder(2, 'Contracts')], notice() {}, ask() {}, askFolder() {}, openShared() {} });
  assert.equal(en[0].label, 'Folder “Contracts” from Compta: 2 files to accept');
});
