// Les changements de rangement qui s'affichent avant d'être écrits (js/explorer/pending.js) : ce que chacun fait à la liste lue, et à quel moment il s'en va.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pending } from '../js/explorer/pending.js';

const file = (id, folder = '', extra = {}) => ({ key: `publipostage:${id}`, app: 'publipostage', id: String(id), name: `Modèle ${id}`, folder, pinned: false, search: `modele ${id} ${folder}`.trim(), ...extra });
const lists = () => ({ files: [file(1), file(2, 'A/B'), file(3, 'A/B/C'), file(4, 'X')], folders: ['Vide', 'A/B/Z'] });
const place = (id, pinned, folder) => ({ op: 'place', app: 'publipostage', id, pinned, folder });

test('sans changement en attente, la liste lue est rendue telle quelle, sans copie', () => {
  const pending = new Pending();
  const read = lists();
  assert.equal(pending.apply(read), read);
});

test('un dossier neuf s\'ajoute aux dossiers gardés sans fichier, une fois ; un dossier retiré s\'en va', () => {
  const pending = new Pending();
  pending.add({ op: 'addFolders', paths: ['Neuf'] });
  pending.add({ op: 'addFolders', paths: ['Vide', 'Neuf'] });
  assert.deepEqual(pending.apply(lists()).folders, ['Vide', 'A/B/Z', 'Neuf']);
  pending.add({ op: 'dropFolders', paths: ['Vide', 'Neuf'] });
  assert.deepEqual(pending.apply(lists()).folders, ['A/B/Z']);
});

test('le ★ et le nom ne touchent que le fichier visé, qui est recopié ; la recherche suit le nom', () => {
  const pending = new Pending();
  pending.add(place(2, true, 'A/B'));
  pending.add({ op: 'rename', key: 'publipostage:2', name: 'Convocation 2026' });
  const read = lists();
  const shown = pending.apply(read);
  assert.deepEqual([shown.files[1].pinned, shown.files[1].name], [true, 'Convocation 2026']);
  assert.equal(shown.files[1].search, 'convocation 2026 a b', 'le nom cherché est le nom affiché (accents, casse et ponctuation ignorés)');
  assert.equal(shown.files[0], read.files[0], 'les autres fichiers gardent leur objet');
  assert.equal(read.files[1].name, 'Modèle 2', 'la liste lue n\'est jamais modifiée');
});

test('un fichier rangé change de dossier et sa recherche suit ; un geste en plusieurs étapes se pose et s\'annule d\'un bloc', () => {
  const pending = new Pending();
  const change = pending.add([place('2', false, 'Neuf'), { op: 'addFolders', paths: ['Neuf'] }, { op: 'dropFolders', paths: ['Vide'] }]);
  const shown = pending.apply(lists());
  assert.equal(shown.files[1].folder, 'Neuf');
  assert.equal(shown.files[1].search, 'modele 2 neuf');
  assert.deepEqual(shown.folders, ['A/B/Z', 'Neuf']);
  pending.cancel(change);
  assert.deepEqual(pending.apply(lists()).folders, ['Vide', 'A/B/Z']);
  assert.equal(pending.apply(lists()).files[1].folder, 'A/B');
});

test('les changements se posent dans l\'ordre où ils ont été faits : le ★ allumé puis éteint', () => {
  const pending = new Pending();
  pending.add(place(1, true, ''));
  pending.add(place(1, false, ''));
  assert.equal(pending.apply(lists()).files[0].pinned, false);
});

test('un changement posé ou refusé redessine l\'explorateur ; un changement confirmé non (l\'affichage ne bouge pas)', () => {
  const pending = new Pending();
  let redraws = 0;
  pending.onChange = () => { redraws += 1; };
  const change = pending.add({ op: 'addFolders', paths: ['Neuf'] });
  assert.equal(redraws, 1);
  pending.confirm(change);
  assert.equal(redraws, 1);
  const refused = pending.add({ op: 'addFolders', paths: ['Autre'] });
  pending.cancel(refused);
  assert.equal(redraws, 3);
  assert.deepEqual(pending.apply(lists()).folders, ['Vide', 'A/B/Z', 'Neuf'], 'celui que Grist a refusé a disparu, l\'autre reste');
  pending.cancel(refused);
  assert.equal(redraws, 3, 'annuler deux fois ne redessine pas');
});

test('un changement confirmé reste posé tant qu\'une lecture partie avant sa confirmation n\'est pas remplacée par une lecture partie après', () => {
  const pending = new Pending();
  const change = pending.add({ op: 'addFolders', paths: ['Neuf'] });
  const early = pending.stamp(); // une lecture part avant que l'écriture n'ait abouti
  pending.confirm(change);
  pending.retire(early); // elle arrive : elle ne connaît pas le dossier, il reste affiché
  assert.equal(pending.size, 1);
  assert.deepEqual(pending.apply({ files: [], folders: [] }).folders, ['Neuf']);
  const late = pending.stamp(); // la lecture lancée après la confirmation
  pending.retire(late);
  assert.equal(pending.size, 0);
});

test('un changement qui n\'a pas abouti n\'est jamais retiré par une lecture', () => {
  const pending = new Pending();
  pending.add(place(1, true, ''));
  pending.retire(pending.stamp());
  assert.equal(pending.size, 1);
});

test('une sorte de changement inconnue est refusée tout de suite, même au milieu d\'une liste', () => {
  assert.throws(() => new Pending().add({ op: 'inconnu' }), /changement inconnu/);
  const pending = new Pending();
  assert.throws(() => pending.add([{ op: 'addFolders', paths: [] }, { op: 'inconnu' }]), /changement inconnu/);
  assert.equal(pending.size, 0, 'rien n\'est posé à moitié');
});
