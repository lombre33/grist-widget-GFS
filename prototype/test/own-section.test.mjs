// L'appel `section` (contrats 5.4, point 15) : ce que GFS dit à l'app de sa section, par l'enveloppe, et seulement cela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnvelopePeer } from '../js/broker/envelope.js';
import { ownSectionHandlers } from '../js/broker/own-section.js';

const ask = async locate => {
  const sent = [];
  const peer = new EnvelopePeer({ send: msg => sent.push(msg), handlers: ownSectionHandlers({ locate }) });
  peer.receive({ gfs: 0, type: 'appel', id: 1, nom: 'section' });
  await new Promise(resolve => setTimeout(resolve, 5));
  return sent;
};

test('section : GFS sûr de sa section, l\'app reçoit l\'identifiant, rien d\'autre', async () => {
  assert.deepEqual(await ask(async () => ({ id: 6 })), [{ gfs: 0, type: 'reponse', id: 1, data: { id: 6 } }]);
});

test('section : GFS pas sûr, l\'app reçoit `id: null` et une raison en mots fermés (la raison interne ne sort pas)', async () => {
  const reason = async reasonText => (await ask(async () => ({ reason: reasonText })))[0].data;
  assert.deepEqual(await reason('access'), { id: null, raison: 'acces' });
  assert.deepEqual(await reason('read-only'), { id: null, raison: 'lecture-seule' });
  for (const inside of ['draft', 'no-section', 'refused', 'autre chose']) assert.deepEqual(await reason(inside), { id: null, raison: 'inconnue' }, inside);
});

test('section : un appel avec des arguments de l\'app n\'y change rien (l\'app ne choisit pas la section)', async () => {
  const sent = [];
  const peer = new EnvelopePeer({ send: msg => sent.push(msg), handlers: ownSectionHandlers({ locate: async (...args) => ({ id: args.length ? 99 : 6 }) }) });
  peer.receive({ gfs: 0, type: 'appel', id: 2, nom: 'section', args: { id: 99, table: 'X' } });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(sent[0].data, { id: 6 });
});
