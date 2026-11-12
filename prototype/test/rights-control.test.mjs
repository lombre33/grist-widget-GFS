// Ce que le contrôleur fait des droits (js/rights/rights-control.js) : les règles ne se rendent qu'à un propriétaire prouvé (mesuré dans un vrai Grist 1.7.19 : dès qu'une règle refuse la lecture d'une table
// à une personne, les tables des règles lui arrivent vides), et le panneau relit tout à son ouverture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RightsControl } from '../js/rights/rights-control.js';
import { chipKey, leadKey } from '../js/rights/rights.js';

const columns = rows => { const keys = [...new Set(rows.flatMap(row => Object.keys(row)))]; return Object.fromEntries(keys.map(key => [key, rows.map(row => row[key])])); };
const BUILT_IN = { id: 1, resource: 1, permissions: 63, principals: '[1]', aclFormula: '', aclColumn: 0, permissionsText: '', memo: '' };
const TABLES = {
  _grist_Tables: [{ id: 1, tableId: 'GFS_Rangement' }],
  _grist_ACLResources: [{ id: 1, tableId: '', colIds: '' }], _grist_ACLRules: [BUILT_IN],
  _grist_Shares: [], _grist_Pages: [], _grist_Views: [], _grist_Views_section: [], _grist_Views_section_field: [], _grist_Tables_column: [],
};

function setup({ owner = true, full = true } = {}) {
  const read = [];
  const port = { doc: { fetchTable: async name => { read.push(name); return columns(TABLES[name] || []); } } };
  const control = new RightsControl({ port, transfer: { isOwner: async () => owner }, prefixes: () => [], now: () => 0, container: null, inertTargets: () => [], t: key => key, fullAccess: () => full });
  return { control, read };
}

test('rules : un propriétaire prouvé reçoit les règles lues', async () => {
  const { control } = setup({ owner: true });
  const rules = await control.rules();
  assert.equal(rules.readable, true);
  assert.equal(rules.word, 'pas');
});

test('rules : une personne qui n\'est pas propriétaire, ou non prouvée, ne reçoit rien — et ne lit même pas les tables des règles', async () => {
  const other = setup({ owner: false });
  assert.deepEqual(await other.control.rules(), { readable: false, reason: 'owner-only', tables: [], closed: false, hasRules: false, count: 0, word: null });
  assert.deepEqual(other.read, [], 'rien n\'est lu');
  const unsure = setup({ owner: null });
  assert.equal((await unsure.control.rules()).reason, 'unknown');
  const low = setup({ full: false });
  assert.equal((await low.control.rules()).reason, 'access');
  assert.deepEqual(low.read, []);
});

test('les mots et la phrase du panneau suivent la raison : propriétaire seul, non prouvé, accès trop bas, rien à juger', () => {
  assert.equal(chipKey({ readable: false, reason: 'owner-only' }), 'rights.chip.none', 'le mot du panneau reste « Permissions » : GFS ne dit ni protégé ni ouvert');
  assert.equal(leadKey({ readable: false, reason: 'owner-only' }), 'rights.lead.ownerOnly');
  assert.equal(leadKey({ readable: false, reason: 'unknown' }), 'rights.lead.unknown');
  assert.equal(leadKey({ readable: false, reason: 'access' }), 'rights.lead.unreadable');
  assert.equal(leadKey({ readable: true, word: null }), 'rights.lead.none');
  assert.equal(leadKey({ readable: true, word: 'protege' }), 'rights.lead.protege');
  assert.equal(chipKey({ readable: true, word: 'protege' }), 'rights.chip.protege');
});

test('le contrôleur ne lit plus les règles pour le pied : l\'explorateur n\'a plus de mot des droits (12/11), seule l\'ouverture du panneau les lit', () => {
  const { control } = setup({ owner: true });
  assert.equal(control.refresh, undefined, 'plus de `refresh` : rien ne lit les règles à chaque ouverture de l\'explorateur');
  assert.equal(typeof control.resume, 'function', 'la reprise après un rechargement reste');
});
