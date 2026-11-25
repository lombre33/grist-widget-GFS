// Le contrôle de ce que GFS sert lui-même (outils/controle-catalogue.mjs, choix du porteur du 25/11) : chaque adresse de CDN du catalogue relue et comparée à l'empreinte que
// GFS garde, et les signatures du registre npm lues dans le relevé. Un environnement fabriqué : aucun réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { controlCatalogue, checkCatalogue } from '../outils/controle-catalogue.mjs';
import { checkSecurite } from '../outils/controle-securite.mjs';
import { ROOT } from '../outils/bibliotheques.mjs';

const catalogue = [
  { id: 'jszip', cdn: { src: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', integrite: 'sha384-AAA' } },
  { id: 'ace', cdn: { src: 'https://cdn.jsdelivr.net/npm/ace@1.0.0/ace.js', integrite: 'sha384-BBB' } },
  { id: 'interne', cdn: null },
  { id: 'dompurify', cdn: { src: 'https://cdn.jsdelivr.net/npm/dompurify@3.0.0/dist/purify.min.js', integrite: 'sha384-CCC' } },
];
const reads = { 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js': { sha384: 'sha384-AAA', octets: 90 }, 'https://cdn.jsdelivr.net/npm/ace@1.0.0/ace.js': { sha384: 'sha384-ZZZ', octets: 12 } };
const releve = { releve: '2026-11-25', paquets: {
  jszip: { version: '3.10.1', signature: 'valide', provenance: true }, ace: { version: '1.0.0', signature: 'valide', provenance: false },
  dompurify: { version: '3.0.0', signature: 'invalide', provenance: false }, vieux: { version: '1.0.0', signature: 'absente', provenance: false },
  muet: { version: '1.0.0', signature: 'non-verifiee', provenance: false },
} };
const environment = over => ({ catalogue, releve, withFingerprints: true, now: '2026-11-25T10:00:00.000Z', fingerprint: async url => reads[url] || null, ...over });

test('controlCatalogue : chaque adresse du catalogue est relue ; identique, différente ou non lue ; une bibliothèque sans CDN n\'a pas d\'adresse', async () => {
  const { cdn } = await controlCatalogue(environment());
  assert.equal(cdn.lu, '2026-11-25');
  assert.deepEqual(cdn.entrees.map(entry => [entry.id, entry.etat]), [['ace', 'different'], ['dompurify', 'non-lu'], ['jszip', 'identique']]);
  assert.deepEqual(cdn.entrees[0], { id: 'ace', url: catalogue[1].cdn.src, attendu: 'sha384-BBB', vu: 'sha384-ZZZ', octets: 12, etat: 'different' });
  assert.deepEqual([cdn.entrees[1].vu, cdn.entrees[1].octets], [null, null], 'une adresse non lue ne garde aucune empreinte inventée');
});

test('controlCatalogue : sans lecture demandée, la dernière lecture reste avec sa date ; sans dernière lecture, rien n\'est inventé', async () => {
  const first = await controlCatalogue(environment());
  const later = await controlCatalogue(environment({ withFingerprints: false, now: '2026-12-02T10:00:00.000Z' }), first);
  assert.deepEqual(later.cdn, first.cdn);
  assert.deepEqual((await controlCatalogue(environment({ withFingerprints: false }))).cdn, { lu: null, entrees: [] });
});

test('controlCatalogue : les signatures npm se comptent d\'après le relevé ; invalide, absente et clé inconnue sont des problèmes, non vérifiée n\'en est pas un', async () => {
  const { npm } = await controlCatalogue(environment());
  assert.deepEqual([npm.releve, npm.paquets, npm.valides, npm.nonVerifiees, npm.provenance], ['2026-11-25', 5, 2, 1, 1]);
  assert.deepEqual(npm.problemes, [{ paquet: 'dompurify', version: '3.0.0', signature: 'invalide' }, { paquet: 'vieux', version: '1.0.0', signature: 'absente' }]);
  const none = (await controlCatalogue(environment({ releve: null }))).npm;
  assert.deepEqual([none.releve, none.paquets, none.problemes], [null, 0, []]);
});

test('checkCatalogue : un morceau absent passe (fichier d\'avant), un morceau mal formé ou un état inconnu sont refusés', async () => {
  assert.deepEqual(checkCatalogue(undefined), []);
  assert.deepEqual(checkCatalogue(await controlCatalogue(environment())), []);
  assert.equal(checkCatalogue(null).length, 1);
  assert.equal(checkCatalogue({ cdn: { entrees: [] } }).length, 1);
  assert.match(checkCatalogue({ cdn: { entrees: [{ id: 'x', etat: 'bof' }] }, npm: { problemes: [] } })[0], /x : état de l'adresse inconnu/);
});

test('le fichier commité : la partie catalogue a la forme attendue et chaque paquet du relevé porte une signature valide', () => {
  const report = JSON.parse(readFileSync(join(ROOT, 'bibliotheques/securite.json'), 'utf8'));
  assert.deepEqual(checkCatalogue(report.catalogue), []);
  assert.deepEqual(checkSecurite(report), []);
  assert.deepEqual(report.catalogue.npm.problemes, [], 'une signature du registre invalide ou absente dans le fichier commité doit se lire avant le push');
  const releveFile = JSON.parse(readFileSync(join(ROOT, 'bibliotheques/releve.json'), 'utf8'));
  for (const [paquet, found] of Object.entries(releveFile.paquets)) assert.ok(['valide', 'invalide', 'absente', 'cle-inconnue', 'non-verifiee'].includes(found.signature), `${paquet} : ${found.signature}`);
});
