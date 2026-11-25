// Les signatures du registre npm (outils/signatures-npm.mjs, choix du porteur du 25/11 : « CDN vérifié, secours chez GFS ») : le registre signe `<paquet>@<version>:<intégrité>` ;
// l'état de la signature se dit en un mot, et un registre qui ne répond pas n'est jamais pris pour une signature valide. Les clés d'essai sont fabriquées ici (aucun réseau).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { registrySignature } from '../outils/signatures-npm.mjs';

const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const spki = key => key.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const sign = (text, key) => createSign('SHA256').update(text).sign(key.privateKey, 'base64');
const KEYS = [{ keyid: 'SHA256:registre', key: spki(pair) }];
const INTEGRITY = 'sha512-abc==';
const manifest = (extra = {}) => ({ dist: { integrity: INTEGRITY, signatures: [{ keyid: 'SHA256:registre', sig: sign(`jszip@3.10.1:${INTEGRITY}`, pair) }], ...extra } });
const check = (made, keys = KEYS) => registrySignature({ paquet: 'jszip', version: '3.10.1', manifest: made, keys });

test('registrySignature : la signature que le registre a posée sur « paquet@version:intégrité » est valide', () => {
  assert.deepEqual(check(manifest()), { signature: 'valide', provenance: false });
});

test('registrySignature : une intégrité, une version ou un paquet changés après coup rendent la signature invalide', () => {
  assert.equal(check(manifest({ integrity: 'sha512-autre==' })).signature, 'invalide');
  assert.equal(registrySignature({ paquet: 'jszip', version: '3.10.2', manifest: manifest(), keys: KEYS }).signature, 'invalide');
  assert.equal(registrySignature({ paquet: 'autre', version: '3.10.1', manifest: manifest(), keys: KEYS }).signature, 'invalide');
});

test('registrySignature : une signature faite avec une autre clé que celle du registre est invalide, jamais valide', () => {
  const forged = { dist: { integrity: INTEGRITY, signatures: [{ keyid: 'SHA256:registre', sig: sign(`jszip@3.10.1:${INTEGRITY}`, other) }] } };
  assert.equal(check(forged).signature, 'invalide');
});

test('registrySignature : aucune signature, clé inconnue, clés illisibles : trois états distincts', () => {
  assert.equal(check({ dist: { integrity: INTEGRITY } }).signature, 'absente');
  assert.equal(check({}).signature, 'absente');
  assert.equal(check(null).signature, 'absente');
  assert.equal(check(manifest(), [{ keyid: 'SHA256:autre', key: spki(other) }]).signature, 'cle-inconnue');
  assert.equal(check(manifest(), null).signature, 'non-verifiee');
  assert.equal(check(manifest(), []).signature, 'non-verifiee');
  assert.equal(check(manifest(), [{ keyid: 'SHA256:registre', key: 'pas une clé' }]).signature, 'invalide', 'une clé illisible ne valide rien');
});

test('registrySignature : la preuve de publication (dist.attestations) se note à part de la signature', () => {
  assert.deepEqual(check(manifest({ attestations: { url: 'https://registry.npmjs.org/-/npm/v1/attestations/jszip@3.10.1' } })), { signature: 'valide', provenance: true });
  assert.equal(check({ dist: { attestations: {} } }).provenance, true);
});
