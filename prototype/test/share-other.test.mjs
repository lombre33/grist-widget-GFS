// Le changement de niveau d'un lien dans l'onglet de « Partager » (js/share-other.js, `levelChanger`) : ce qui le bloque, ce qui l'échoue. Le chemin qui réussit passe par le moteur de partage du kit : il se mesure dans le labo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOtherDocuments } from '../js/share-other.js';
import { FILES_APP } from '../js/gfs-files.js';

const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);
const make = (over = {}) => createOtherDocuments({
  t, container: null, inertTargets: () => [], docApi: () => { throw new Error('pas de document'); }, transfer: {}, language: () => 'fr', notice: () => {}, writeBlock: () => null, ...over,
});
const file = { id: 'f1', name: 'Fichier', app: FILES_APP };
const link = { doc: { name: 'Autre' }, name: 'lien' };

test('un blocage d\'écriture dit pourquoi et ne touche à rien', async () => {
  const tab = make({ writeBlock: () => 'lecture seule' }).tab(file, { owner: true });
  assert.deepEqual(await tab.onLevel(link, 'edit'), { ok: false, message: 'lecture seule' });
});

test('une erreur du moteur rend un message, pas une exception', async () => {
  const reply = await make().tab(file, { owner: true }).onLevel(link, 'edit');
  assert.equal(reply.ok, false);
  assert.match(reply.message, /^so\.failed .*pas de document/);
});

test('la raison qui grise l\'onglet passe avant le blocage d\'écriture', async () => {
  const tab = make({ writeBlock: () => 'autre raison' }).tab(file, { owner: false });
  const reply = await tab.onLevel(link, 'edit');
  assert.equal(reply.ok, false);
  assert.equal(reply.message, tab.why || 'autre raison');
});
