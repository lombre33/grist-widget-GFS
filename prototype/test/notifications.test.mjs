// La cloche Notifications (js/sharing/notifications.js) : les articles de son menu d'après les arrivées qui attendent une réponse. Le dessin (la pastille, le menu à 700 × 400) se mesure sous Firefox
// (test/partages-recus-firefox.mjs) et dans un vrai Grist (labo/run-partages-recus.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notificationItems, SHOWN } from '../js/sharing/notifications.js';
import { createI18n } from '../js/i18n/i18n.js';

const FR = createI18n('fr');
const EN = createI18n('en');
const arrival = (n, by = 'Compta <compta@exemple.fr>') => ({ key: `gfs-recus:GFS_Received:f${n}`, id: `f${n}`, name: `Contrat ${n}.pdf`, by });

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
  assert.match(log.notices[0], /Ce que l’on vous donne dans ce document/);
  assert.match(log.notices[0], /un fichier partagé depuis un autre document Grist aussi/);
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
  const inFolder = (n, folder) => ({ ...arrival(n), received: { table: 'GFS_Received', row: n, state: 'pending', folder } });
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

// Ce qu'on a donné à la personne dans le document (js/sharing/notice-model.js, js/sharing/notice-store.js) : la cloche le nomme, le clic l'ouvre et le marque lu.
function withGiven(given, pending = [], i18n = FR) {
  const log = { opened: [], marked: 0, notices: [], shared: 0 };
  const items = notificationItems({ t: i18n.t, pending, notices: { items: given, unread: given.filter(item => !item.lu).length }, notice: text => log.notices.push(text),
    ask: () => {}, openNotice: item => log.opened.push(item.cle), markAll: () => { log.marked += 1; }, openShared: () => { log.shared += 1; } });
  return { items, log };
}
const given = (type, nom, par = 'chef@exemple.org', lu = false) => ({ cle: `${type}|${nom}`, type, cible: nom, nom, par, lu });

test('ce qui est donné : une ligne par chose non lue, avec qui l\'a donnée, dans la langue de la personne', () => {
  const { items } = withGiven([given('fichier', 'Contrat.pdf'), given('dossier', 'Formation'), given('espace', 'Finances'), given('espace', 'RH', ''), given('fichier', 'Vu.pdf', 'x@y.fr', true)]);
  assert.deepEqual(items.slice(0, 4).map(item => item.label), ['chef@exemple.org vous a donné « Contrat.pdf »', 'chef@exemple.org vous a donné le dossier « Formation »',
    'chef@exemple.org vous a ouvert l’espace « Finances »', 'L’espace « RH » vous est ouvert']);
  assert.ok(items.slice(0, 4).every(item => item.icon === 'users' && !item.greyed));
  assert.equal(items.some(item => /Vu\.pdf/.test(item.label || '')), false, 'ce qui est lu n\'est plus annoncé');
  const en = withGiven([given('fichier', 'Contrat.pdf'), given('espace', 'RH', '')], [], EN).items;
  assert.deepEqual(en.slice(0, 2).map(item => item.label), ['chef@exemple.org gave you “Contrat.pdf”', 'The space “RH” is open to you']);
});

test('le clic sur ce qui est donné l\'ouvre ; « Tout marquer comme lu » est là, grisé et expliqué quand tout est lu', () => {
  const { items, log } = withGiven([given('espace', 'Finances')]);
  items[0].run();
  assert.deepEqual(log.opened, ['espace|Finances']);
  const markAll = items.find(item => item.label === 'Tout marquer comme lu');
  assert.ok(markAll && !markAll.greyed);
  markAll.run();
  assert.equal(log.marked, 1);
  const none = withGiven([given('fichier', 'Lu.pdf', 'a@b.fr', true)]);
  const grey = none.items.find(item => item.label === 'Tout marquer comme lu');
  assert.equal(grey.greyed, true, 'grisé, jamais masqué');
  grey.run();
  assert.match(none.log.notices[0], /toutes les notifications sont lues/);
  assert.equal(none.items[0].label, 'Aucune notification');
});

test('les arrivées à accepter passent devant ce qui est donné, et six lignes au plus ; les autres sont comptées dans « Voir N autres »', () => {
  const { items } = withGiven([given('fichier', 'A'), given('fichier', 'B'), given('fichier', 'C'), given('fichier', 'D')], [arrival(1), arrival(2), arrival(3)]);
  assert.deepEqual(items.slice(0, 3).map(item => /à accepter/.test(item.label)), [true, true, true]);
  assert.equal(items.filter(item => item.icon === 'users').length, SHOWN);
  assert.equal(items.at(-1).label, 'Voir 1 autres dans « Partagés avec moi »');
});

test('sans magasin de notifications (les essais de l\'explorateur seul), la cloche ne montre que les arrivées, comme avant', () => {
  const { items } = setup([arrival(1)]);
  assert.equal(items.some(item => item.label === 'Tout marquer comme lu'), false);
  assert.equal(items.length, 3);
});
