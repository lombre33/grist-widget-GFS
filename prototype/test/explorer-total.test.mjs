// Le total du pied de l'explorateur (js/explorer/explorer-view.js, `totalBar` et `totalTip`) avec la case « + pièces jointes » cochée de départ (demande du porteur du 25/11) : la part de la liste et celle des
// pièces jointes ne se disent que s'il y a des pièces jointes à ajouter. Cochée sur un document sans autre pièce jointe, le pied dit « Total : 18,1 Mo », pas « + 0 o pour 0 pièce jointe ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDocument } from './fake-dom.mjs';

installFakeDocument();
const { totalBar, totalTip } = await import('../js/explorer/explorer-view.js');
const { createI18n } = await import('../js/i18n/i18n.js');

const { t } = createI18n('fr');
const ctx = pj => ({ t, locale: 'fr-FR', total: 18971940, pj: { on: true, ready: true, busy: false, grey: '', bytes: 0, count: 0, ...pj } });
const said = pj => totalBar(ctx(pj)).map(node => (typeof node === 'string' ? node : node.textContent)).join('');

test('cochée sur un document sans autre pièce jointe : le total est celui de la liste, sans « + 0 o pour 0 pièce jointe » (ni dit, ni en infobulle)', () => {
  assert.equal(said({}), 'Total : 18,1 Mo');
  assert.equal(totalTip(ctx({})).includes('pour la liste'), false, totalTip(ctx({})));
});

test('cochée, avec des pièces jointes à ajouter : le total les compte et dit la part de chacun, en lecture et en infobulle', () => {
  const adds = { bytes: 7140000, count: 4 };
  assert.equal(said(adds), 'Total : 24,9 Mo, 18,1 Mo pour la liste + 6,8 Mo pour 4 pièces jointes du document.');
  assert.equal(totalTip(ctx(adds)).includes('18,1 Mo pour la liste + 6,8 Mo pour 4 pièces jointes du document.'), true);
});

test('pas encore lue ou décochée : le total est celui de la liste, aucune part', () => {
  assert.equal(said({ ready: false, bytes: 7140000, count: 4 }), 'Total : 18,1 Mo');
  assert.equal(said({ on: false, bytes: 7140000, count: 4 }), 'Total : 18,1 Mo');
});
