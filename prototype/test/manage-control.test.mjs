// « Gérer les partages » en code pur (js/sharing/manage-control.js ; contrats 11.7, point 13, i) : ce que la fenêtre lit (groupes, droits sur tout le document, tables lisibles) et ce qu'elle écrit. La fenêtre à la
// souris se mesure sous Firefox (test/partager-firefox.mjs), les règles et les groupes dans un vrai Grist (labo/run-partager-groupes.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ManageControl } from '../js/sharing/manage-control.js';
import { createI18n } from '../js/i18n/i18n.js';

const { t } = createI18n('fr');
const table = columns => ({ id: Object.values(columns)[0].map((_, at) => at + 1), ...columns });
const raw = { tables: [{ id: 1, tableId: 'Contacts' }, { id: 2, tableId: 'GFS_Groupes' }, { id: 3, tableId: 'Notes' }, { id: 4, tableId: '_grist_X' }],
  columns: [{ parentId: 1, colId: 'Mail', type: 'Text' }, { parentId: 1, colId: 'Equipe', type: 'Choice' }, { parentId: 3, colId: 'Texte', type: 'Text' }, { parentId: 2, colId: 'Nom', type: 'Text' }] };
const plans = { close: { ok: true }, open: { ok: false, reason: 'none' }, shared: { ok: false }, 'remove-level': { ok: false }, sharing: { ok: false, reason: 'already' }, unsharing: { ok: true } };
const make = ({ owner = true, fetch, written = [], block = null, reads = [], extra = {} } = {}) => new ManageControl({
  t, fullAccess: () => true, writeBlock: () => block, container: null, inertTargets: () => [],
  reader: { owner: async () => owner, raw: async options => { reads.push(options); return raw; } },
  writer: { plansFrom: () => plans, plans: async () => plans },
  ...extra,
  port: { doc: { fetchTable: fetch || (async () => { throw new Error('absente'); }), applyUserActions: async actions => { written.push(actions); } } },
});
const fetchAll = async name => ({
  GFS_Partages: table({ Cible: ['*', '*', 'gfs-fichiers:a'], Personne: ['@editeurs', '@tous', 'x@y.fr'], Droit: ['lecture', 'ecriture', 'lecture'] }),
  GFS_Groupes: table({ Nom: ['Achats'], Nb: [2], Source: [''], PersonnesIci: ['a@x.fr\nb@x.fr'] }),
}[name]);

test('un non-propriétaire ne lit rien : seulement à qui s\'adresser ; le propriétaire lit les groupes, les droits de la racine et les tables lisibles (jamais GFS_ ni _grist_, ni une table à une seule colonne de texte)', async () => {
  assert.equal((await make({ owner: false }).load()).owner, false);
  const state = await make({ fetch: fetchAll }).load();
  assert.equal(state.active, true);
  assert.deepEqual(state.groups.map(group => [group.name, group.count]), [['Achats', 2]]);
  assert.deepEqual(state.root, { '@editeurs': { id: 1, right: 'lecture' }, '@tous': { id: 2, right: 'ecriture' } });
  assert.deepEqual(state.tables, [{ id: 'Contacts', emails: ['Mail', 'Equipe'], groups: ['Mail', 'Equipe'] }]);
  assert.equal(state.structure.kind, 'close');
});

test('partage pas activé : la fenêtre le sait (les groupes naissent avec le partage)', async () => {
  assert.equal((await make().load()).active, false);
});

test('écrire : un groupe tapé, ses adresses changées, le groupe supprimé ; un nom pris est refusé avec sa phrase, rien n\'est envoyé', async () => {
  const written = [];
  const control = make({ fetch: fetchAll, written });
  const state = await control.load();
  assert.equal((await control.addGroup(state, { name: 'Ventes', people: 'v@x.fr' })).ok, true);
  assert.deepEqual(written[0][0].slice(0, 3), ['AddRecord', 'GFS_Groupes', null]);
  assert.equal(written[0][0][3].Nom, 'Ventes');
  const taken = await control.addGroup(state, { name: 'achats', people: '' });
  assert.deepEqual([taken.ok, taken.message], [false, t('manage.groups.exists')]);
  assert.equal(written.length, 1);
  await control.updateGroup(1, ' z@x.fr ');
  assert.deepEqual(written[1], [['UpdateRecord', 'GFS_Groupes', 1, { PersonnesIci: 'z@x.fr' }]]);
  await control.removeGroup(1);
  assert.deepEqual(written[2], [['RemoveRecord', 'GFS_Groupes', 1]]);
});

test('un droit sur tout le document : ajouté à la racine, changé, retiré ; rien n\'est écrit pour retirer ce qui n\'existe pas', async () => {
  const written = [];
  const control = make({ fetch: async name => (name === 'GFS_Partages' ? table({ Cible: ['*'], Personne: ['@tous'], Droit: ['lecture'] }) : table({ Nom: [] })), written });
  const state = await control.load();
  await control.setRoot(state, '@editeurs', 'ecriture');
  assert.deepEqual(written[0][0].slice(0, 3), ['AddRecord', 'GFS_Partages', null]);
  assert.deepEqual([written[0][0][3].Cible, written[0][0][3].Personne, written[0][0][3].Droit], ['*', '@editeurs', 'ecriture']);
  await control.setRoot(state, '@tous', 'ecriture');
  assert.deepEqual(written[1], [['UpdateRecord', 'GFS_Partages', 1, { Droit: 'ecriture' }]]);
  await control.setRoot(state, '@tous', null);
  assert.deepEqual(written[2], [['RemoveRecord', 'GFS_Partages', 1]]);
  await control.setRoot(state, '@editeurs', null);
  assert.equal(written.length, 3);
});

test('une écriture bloquée (document en lecture, etc.) n\'envoie rien et dit pourquoi', async () => {
  const written = [];
  const control = make({ fetch: fetchAll, written, block: 'Le document est en lecture seule.' });
  const answer = await control.removeGroup(1);
  assert.deepEqual([answer.ok, answer.message, written.length], [false, 'Le document est en lecture seule.', 0]);
});

test('arrêter un lien d\'« Autres documents » : la question dit le document (annuler l\'invitation quand il attend sa réponse), « Annuler » n\'arrête rien, « Arrêter » demande l\'arrêt et rend sa réponse', async () => {
  const asked = [];
  const stopped = [];
  const control = (yes, extra = {}) => new ManageControl({ t, fullAccess: () => true, writeBlock: () => null, container: null, inertTargets: () => [], ask: async options => { asked.push(options); return yes; }, otherStop: async link => { stopped.push(link.id); return { ok: true }; }, ...extra });
  const active = { id: 'e1', name: 'Compta', state: 'active', doc: { name: 'Compta Nord', id: 'd' } };
  const pending = { id: 'e2', name: 'Direction', state: 'pending', doc: { name: '', id: '' } };
  assert.equal(await control(false).stopLink(active), null);
  assert.deepEqual(stopped, [], 'renoncer n\'arrête rien');
  assert.equal(asked[0].title, t('manage.other.stop.title', { name: 'Compta Nord' }));
  assert.equal(asked[0].safeFirst, true, 'le clavier est sur « Annuler » : un Entrée distrait n\'arrête pas un partage');
  assert.deepEqual(await control(true).stopLink(pending), { ok: true });
  assert.deepEqual(stopped, ['e2']);
  assert.equal(asked[1].title, t('manage.other.cancel.title', { name: 'Direction' }), 'sans document encore, le nom du lien');
  assert.equal(asked[1].confirmLabel, t('manage.other.cancel.confirm'));
});

test('les règles d\'accès se lisent une fois par ouverture, sans les tables de fichiers : un groupe ou un espace écrit ne les relit pas', async () => {
  const reads = [];
  const fetched = [];
  const control = make({ reads, fetch: async name => { fetched.push(name); return fetchAll(name); } });
  const first = await control.load();
  await control.load();
  assert.deepEqual(reads, [{ files: false }], 'raw() une seule fois, sans les fichiers');
  assert.equal(first.structure.kind, 'close');
  assert.equal(fetched.filter(name => name === 'GFS_Partages').length, 2, 'les tables du partage se relisent, chacune une fois par lecture');
  assert.equal(fetched.filter(name => name.startsWith('_grist_') || name === 'GFS_Fichiers').length, 0, 'ni tables internes ni fichiers par le contrôleur : tout passe par raw()');
});

test('à la fermeture, l\'explorateur relit ses fichiers si la fenêtre a écrit quelque chose (un espace créé s\'y voit sans recharger la page), et pas sinon', async () => {
  const closing = async (act) => {
    const refreshed = [];
    const control = make({ fetch: fetchAll, extra: { refresh: async () => { refreshed.push(true); },
      openWindow: async options => { await act(options); return null; } } });
    await control.open();
    return refreshed.length;
  };
  assert.equal(await closing(async () => {}), 0, 'rien d\'écrit : pas de relecture');
  assert.equal(await closing(async options => { await options.onAddGroup(await options.load(), { name: 'Ventes', people: '' }); }), 1, 'un groupe écrit : une relecture');
  assert.equal(await closing(async options => { await options.onRemoveGroup(1); }), 1, 'un groupe retiré : une relecture');
  const blocked = [];
  const control = make({ fetch: fetchAll, block: 'lecture seule', extra: { refresh: async () => { blocked.push(true); }, openWindow: async options => { await options.onRemoveGroup(1); return null; } } });
  await control.open();
  assert.equal(blocked.length, 0, 'une écriture refusée n\'a rien changé : pas de relecture');
});

test('créer un espace : la personne qui est connectée y entre dans la même écriture (l\'espace neuf n\'est pas un espace où personne n\'est) ; sans identité, seulement l\'espace', async () => {
  const written = [];
  const control = (identity) => make({ fetch: fetchAll, written, extra: { identity, askName: async () => 'Équipe UI' } });
  const state = await control(() => 'Moi@x.fr').load();
  assert.equal((await control(() => 'Moi@x.fr').addSpace(state)).ok, true);
  assert.deepEqual(written[0].map(action => action.slice(0, 2)), [['AddRecord', 'GFS_Espaces'], ['AddRecord', 'GFS_Partages']]);
  assert.deepEqual([written[0][1][3].Cible, written[0][1][3].Personne, written[0][1][3].Droit], ['espace:equipe-ui', 'moi@x.fr', 'ecriture']);
  await control(() => '').addSpace(state);
  assert.equal(written[1].length, 1);
});
