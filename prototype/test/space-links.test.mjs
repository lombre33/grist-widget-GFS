// Les liens entre espaces (js/sharing/space-links.js, js/sharing/link-control.js ; contrats 11.7, point 13.o) en code pur : ce que le lien écrit (le lien et les droits des
// groupes de l'espace B), ce qu'il retire, les copies que l'explorateur montre, et ce qu'il refuse. Ce que Grist en fait (qui lit, qui écrit, ce qu'un éditeur peut
// forger) se mesure dans un vrai Grist : labo/run-liens-espaces.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyLinks, groupsOfSpace, linkAt, linkWithin, planLink, planLinkRemove } from '../js/sharing/space-links.js';
import { readSpaces, splitWrites, writePlacement } from '../js/sharing/spaces-filing.js';
import { LinkControl } from '../js/sharing/link-control.js';
import { createI18n } from '../js/i18n/i18n.js';

const { t } = createI18n('fr');
const table = columns => ({ id: Object.values(columns)[0].map((_, at) => at + 1), ...columns });
const SPACES = table({ Cle: ['achats', 'ventes'], Nom: ['Achats', 'Ventes'] });
const space = { id: 2, key: 'ventes', name: 'Ventes', groups: [{ id: 5, group: 'Commerciaux', right: 'lecture' }, { id: 6, group: 'Stagiaires', right: 'aucun' }] };
const SOURCE = 'dossier:achats/Contrats';

test('les groupes d\'un espace qui y ont un droit : « Aucun accès » ne compte pas, sans doublon', () => {
  assert.deepEqual(groupsOfSpace(space), ['Commerciaux']);
  assert.deepEqual(groupsOfSpace({ groups: [{ group: 'A', right: 'ecriture' }, { group: 'A', right: 'lecture' }] }), ['A']);
  assert.deepEqual(groupsOfSpace(null), []);
});

test('créer un lien : une ligne de partage par groupe de l\'espace, puis la ligne du lien (sans Cible) qui garde les groupes ajoutés', () => {
  const plan = planLink({ source: SOURCE, space, folder: ' Contrats d\'achat / ', right: 'ecriture' });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.actions.map(action => [action[0], action[1]]), [['AddRecord', 'GFS_Partages'], ['AddRecord', 'GFS_Placement']]);
  const [share, place] = plan.actions.map(action => action[3]);
  assert.deepEqual([share.Cible, share.Personne, share.Droit], [SOURCE, '#Commerciaux', 'ecriture']);
  assert.deepEqual(place, { Cible: '', Espace: 'ventes', Dossier: 'Contrats d\'achat', Lien: SOURCE, Partages: '#Commerciaux' });
});

test('créer un lien : un droit déjà plus large est gardé, un plus étroit est élargi (et le lien ne le retirera pas), un droit absent est ajouté', () => {
  const two = { ...space, groups: [{ group: 'A', right: 'lecture' }, { group: 'B', right: 'lecture' }, { group: 'C', right: 'lecture' }] };
  const shareRows = [{ id: 1, Cible: SOURCE, Personne: '#A', Droit: 'admin' }, { id: 2, Cible: SOURCE, Personne: '#B', Droit: 'lecture' }, { id: 3, Cible: 'autre', Personne: '#C', Droit: 'lecture' }];
  const plan = planLink({ source: SOURCE, space: two, folder: 'X', right: 'ecriture', shareRows });
  assert.deepEqual(plan.actions.filter(action => action[1] === 'GFS_Partages').map(action => [action[0], action[2], action[3].Personne || action[3].Droit]),
    [['UpdateRecord', 2, 'ecriture'], ['AddRecord', null, '#C']]);
  assert.equal(plan.actions.at(-1)[3].Partages, '#C', 'seule la ligne ajoutée est retirée avec le lien');
});

test('créer un lien : refusé avec sa raison (nom vide, droit inconnu, espace sans groupe, même espace, lien déjà là) ; un fichier peut aller à la racine', () => {
  const reason = options => planLink({ source: SOURCE, space, folder: 'X', right: 'lecture', ...options }).reason;
  assert.equal(reason({ folder: ' / ' }), 'invalid');
  assert.equal(reason({ right: 'admin' }), 'invalid');
  assert.equal(reason({ source: '' }), 'invalid');
  assert.equal(reason({ space: { ...space, groups: [] } }), 'noGroup');
  assert.equal(reason({ space: { ...space, key: 'achats' } }), 'sameSpace');
  assert.equal(reason({ placeRows: [{ Lien: SOURCE, Espace: 'ventes', Dossier: 'X' }] }), 'exists');
  const file = planLink({ source: 'gfs-fichiers:3', space, folder: '', right: 'lecture', kind: 'file' });
  assert.equal(file.ok, true);
  assert.equal(file.actions.at(-1)[3].Dossier, '');
});

test('retirer un lien : sa ligne et seulement les lignes de partage qu\'il avait ajoutées, jamais un fichier', () => {
  const link = { id: 9, source: SOURCE, groups: '#Commerciaux, #Autres' };
  const shareRows = [{ id: 1, Cible: SOURCE, Personne: '#Commerciaux' }, { id: 2, Cible: SOURCE, Personne: '#Stagiaires' }, { id: 3, Cible: 'gfs-fichiers:1', Personne: '#Commerciaux' }];
  assert.deepEqual(planLinkRemove(link, shareRows).actions, [['BulkRemoveRecord', 'GFS_Partages', [1]], ['RemoveRecord', 'GFS_Placement', 9]]);
  assert.deepEqual(planLinkRemove({ id: 9, source: SOURCE, groups: '' }, shareRows).actions, [['RemoveRecord', 'GFS_Placement', 9]]);
  assert.equal(planLinkRemove(null).ok, false);
});

const PLACE = table({ Cible: ['gfs-fichiers:1', '', ''], Espace: ['achats', 'ventes', 'ventes'], Dossier: ['Contrats', 'Contrats achats', 'Divers'],
  Lien: ['', SOURCE, 'gfs-fichiers:7'], Partages: ['', '#Commerciaux', ''] });
const info = () => readSpaces(SPACES, PLACE);

test('lire les liens : le dossier d\'un lien est un dossier de l\'espace, un lien de fichier rend son dossier d\'accueil ; linkAt et linkWithin ne voient que les dossiers liés', () => {
  const { links, folders } = info();
  assert.deepEqual(links.map(link => [link.id, link.source, link.space.key, link.folder, link.path]),
    [[2, SOURCE, 'ventes', 'Contrats achats', 'Espaces/Ventes/Contrats achats'], [3, 'gfs-fichiers:7', 'ventes', 'Divers', 'Espaces/Ventes/Divers']]);
  assert.ok(folders.includes('Espaces/Ventes/Contrats achats'));
  assert.equal(linkAt(info(), 'Espaces/Ventes/Contrats achats').id, 2);
  assert.equal(linkAt(info(), 'Espaces/Ventes/Divers'), null, 'le dossier d\'accueil d\'un fichier n\'est pas un lien de dossier');
  assert.equal(linkWithin(info(), 'Espaces/Ventes/Contrats achats/Sous').id, 2);
  assert.equal(linkWithin(info(), 'Espaces/Ventes/Contrats achats 2'), null);
  assert.equal(linkAt(null, 'x'), null);
});

const file = (id, extra = {}) => ({ key: `gfs-fichiers:${id}`, row: id, name: `F${id}.pdf`, folder: '', space: null, ...extra });
const data = { id: [1, 2, 3], GFS_Auteur: ['marie@x.fr', 'marie@x.fr', 'marie@x.fr'],
  GFS_Vus: [['L', 'ventes/Contrats achats'], ['L', 'ventes/Contrats achats/Sous', 'ventes/Divers'], []] };

test('les copies : un fichier lié se montre aussi sous son lien (même clé, même ligne), sans espace propre ; Grist donne le chemin, l\'espace doit être lu', () => {
  const files = [file(1), file(2), file(3)];
  applyLinks(files, data, info(), 'luc@x.fr');
  const copies = files.filter(item => item.linked);
  assert.deepEqual(copies.map(item => [item.key, item.folder, item.space, item.linked.space]),
    [['gfs-fichiers:1', 'Espaces/Ventes/Contrats achats', null, 'ventes'], ['gfs-fichiers:2', 'Espaces/Ventes/Contrats achats/Sous', null, 'ventes'],
      ['gfs-fichiers:2', 'Espaces/Ventes/Divers', null, 'ventes']]);
  assert.ok(copies.every(item => item.row === Number(item.key.split(':')[1])), 'même ligne : c\'est le même fichier');
  assert.ok(copies.every(item => item.search.includes('espaces')), 'la recherche suit le nouveau chemin');
  const root = [file(7)];
  applyLinks(root, { id: [7], GFS_Auteur: ['marie@x.fr'], GFS_Vus: [['L', 'ventes/']] }, info(), 'luc@x.fr');
  assert.equal(root.find(item => item.linked).folder, 'Espaces/Ventes', 'un fichier lié à la racine de l\'espace : pas de barre en trop');
  const unread = [file(1)];
  applyLinks(unread, data, { ...info(), spaces: info().spaces.filter(item => item.key !== 'ventes') }, 'luc@x.fr');
  assert.equal(unread.length, 1, 'un espace que la personne ne lit pas ne montre rien');
});

test('l\'original d\'un fichier lié disparaît de la racine de « Moi » de qui ne le voit nulle part ailleurs ; il reste pour l\'auteur, dans un espace lu, rangé ou donné', () => {
  const kept = (extra, me = 'luc@x.fr') => { const files = [file(1, extra)]; applyLinks(files, data, info(), me); return files.some(item => !item.linked); };
  assert.equal(kept({}), false, 'ni espace, ni dossier, ni auteur : seule la copie reste');
  assert.equal(kept({}, 'marie@x.fr'), true, 'l\'auteur garde le sien');
  assert.equal(kept({ space: { key: 'achats', folder: 'Contrats' } }), true, 'dans un espace lu');
  assert.equal(kept({ folder: 'Perso' }), true, 'rangé par la personne');
  assert.equal(kept({ direct: { by: 'marie@x.fr' } }), true, 'donné par son adresse');
  const files = [file(1)];
  applyLinks(files, { ...data, GFS_Auteur: undefined }, info(), 'luc@x.fr');
  assert.equal(files.some(item => !item.linked), true, 'sans auteur connu, rien ne disparaît');
});

test('sans lien, sans colonne GFS_Vus ou sans espaces : la liste ne change pas', () => {
  const same = () => [file(1), file(2)];
  for (const [rows, spaces] of [[data, null], [{ id: [1, 2] }, info()], [data, readSpaces(SPACES, table({ Cible: [], Espace: [], Dossier: [] }))]]) {
    const files = same();
    applyLinks(files, rows, spaces, 'luc@x.fr');
    assert.equal(files.length, 2);
  }
});

test('on ne range rien dans un lien et on n\'y crée rien (la phrase le dit) ; sans lien rien ne change', () => {
  const entry = { app: 'gfs-fichiers', file: '1', pinned: false, folder: 'Espaces/Ventes/Contrats achats' };
  assert.equal(splitWrites([entry], {}, [file(1)], info()).error, 'ex.linkTarget');
  assert.equal(splitWrites([{ ...entry, folder: 'Espaces/Ventes/Contrats achats/Sous' }], {}, [file(1)], info()).error, 'ex.linkTarget');
  assert.equal(splitWrites([], { add: ['Espaces/Ventes/Contrats achats/Neuf'] }, [], info()).error, 'ex.linkTarget');
  assert.equal(splitWrites([{ ...entry, folder: 'Espaces/Ventes/Autre' }], {}, [file(1)], info()).error, undefined);
  assert.equal(splitWrites([entry], {}, [file(1)], readSpaces(SPACES, table({ Cible: [], Espace: [], Dossier: [] }))).error, undefined);
});

test('un dossier vide qu\'on retire ne retire jamais la ligne d\'un lien qui porte le même nom', async () => {
  const written = [];
  const doc = { fetchTable: async () => PLACE, applyUserActions: async actions => { written.push(...actions); } };
  const plan = { ops: [], markers: { add: [], drop: [{ space: 'ventes', folder: 'Contrats achats' }] } };
  assert.equal(await writePlacement(doc, plan), false);
  assert.deepEqual(written, []);
});

const control = ({ owner = true, spaces = info(), answers = [], written = [], files = [], extra = {}, shares = table({ Cible: ['espace:ventes'], Personne: ['#Commerciaux'], Droit: ['lecture'] }) } = {}) => {
  const rows = { GFS_Espaces: SPACES, GFS_Partages: shares, GFS_Placement: PLACE };
  const notes = [];
  const picks = [];
  const made = new LinkControl({ t, fullAccess: () => true, writeBlock: () => null, container: null, inertTargets: () => [], spaces: () => spaces, files: () => files,
    notice: text => notes.push(text), reader: { owner: async () => owner },
    pick: async options => { picks.push(options); return answers.shift(); }, askName: async () => answers.shift(),
    port: { doc: { fetchTable: async name => rows[name], applyUserActions: async actions => { written.push(...actions); } } }, ...extra });
  return { made, notes, picks, written };
};

test('l\'assistant : l\'espace, le nom du lien, puis le droit ; les lignes sont écrites en une fois, la phrase dit ce que les groupes ont', async () => {
  const run = control({ answers: ['ventes', 'Nouveau lien', 'lecture'] });
  assert.equal(await run.made.open({ target: 'dossier:achats/Autres', name: 'Autres', kind: 'folder' }), true);
  assert.deepEqual(run.picks.map(item => item.items.map(entry => entry.value)), [['achats', 'ventes'], ['lecture', 'ecriture']]);
  assert.match(run.picks[1].text, /Commerciaux/);
  assert.deepEqual(run.written.map(action => action[1]), ['GFS_Partages', 'GFS_Placement']);
  assert.match(run.notes[0], /Lien créé dans « Ventes » : les groupes de l’espace ont la lecture sur « Autres »/);
});

test('l\'assistant pour un fichier : le dossier d\'accueil se choisit dans la liste (la racine d\'abord), « renoncer » à une étape n\'écrit rien', async () => {
  const run = control({ answers: ['ventes', '', 'ecriture'] });
  assert.equal(await run.made.open({ target: 'gfs-fichiers:3', name: 'Devis.pdf', kind: 'file' }), true);
  assert.deepEqual(run.picks[1].items.map(item => item.value), ['', 'Contrats achats', 'Divers']);
  assert.equal(run.written.at(-1)[3].Dossier, '');
  for (const answers of [[null], ['ventes', null], ['ventes', 'Neuf', null]]) {
    const cancelled = control({ answers });
    assert.equal(await cancelled.made.open({ target: SOURCE, name: 'C', kind: 'folder' }), false);
    assert.deepEqual(cancelled.written, []);
  }
});

test('l\'assistant refuse avec sa phrase : pas propriétaire, espace sans groupe, partage inactif, aucun espace ; rien n\'est écrit', async () => {
  const notOwner = control({ owner: false });
  assert.equal(await notOwner.made.open({ target: SOURCE, name: 'C', kind: 'folder' }), false);
  assert.match(notOwner.notes[0], /Seul un propriétaire/);
  const bare = control({ answers: ['achats'] });
  assert.equal(await bare.made.open({ target: 'dossier:ventes/X', name: 'X', kind: 'folder' }), false);
  assert.match(bare.notes[0], /n’a aucun groupe/);
  assert.match(control({ spaces: null }).made.whyNot(), /pas activé/);
  assert.match(control({ spaces: readSpaces(table({ Cle: [], Nom: [] }), null) }).made.whyNot(), /Aucun espace/);
  assert.equal(control().made.whyNot(), null);
});

test('lier un dossier dans son propre espace est refusé dès le choix de l\'espace, avant la fenêtre du nom et celle du droit', async () => {
  const run = control({ answers: ['ventes'], spaces: info() });
  assert.equal(await run.made.open({ target: 'dossier:ventes/X', name: 'X', kind: 'folder' }), false);
  assert.match(run.notes[0], /déjà dans cet espace/);
  assert.equal(run.picks.length, 1, 'une seule fenêtre : le droit n\'est pas demandé');
  assert.deepEqual(run.written, []);
});

test('un nom de lien déjà pris dans l\'espace (dossier, lien ou fichier rangé dedans) est refusé par la fenêtre du nom', async () => {
  const seen = [];
  const run = control({ answers: ['ventes', 'Neuf', 'lecture'], files: [file(5, { folder: 'Espaces/Ventes/Rangés/Sous' })],
    extra: { askName: async options => { seen.push(['Contrats achats', 'Divers', 'Rangés', 'Libre', ''].map(name => options.refuse(name))); return 'Libre'; } } });
  await run.made.open({ target: SOURCE, name: 'C', kind: 'folder' });
  assert.deepEqual(seen[0].map(message => (message ? message.slice(0, 12) : null)), ['Ce nom est d', 'Ce nom est d', 'Ce nom est d', null, 'Ce lien ne p']);
});

test('retirer un lien : la question, puis la ligne et les droits qu\'il avait posés ; renoncer n\'écrit rien ; seul un propriétaire', async () => {
  const link = info().links[0];
  const shares = table({ Cible: [SOURCE, SOURCE], Personne: ['#Commerciaux', '#Stagiaires'], Droit: ['lecture', 'lecture'] });
  const asked = [];
  const yes = control({ shares, extra: { ask: async options => { asked.push(options); return true; } } });
  assert.equal(await yes.made.remove(link), true);
  assert.deepEqual(yes.written, [['BulkRemoveRecord', 'GFS_Partages', [1]], ['RemoveRecord', 'GFS_Placement', 2]]);
  assert.match(asked[0].message, /Rien n’est supprimé/);
  assert.match(yes.notes[0], /est retiré/);
  const no = control({ shares, extra: { ask: async () => false } });
  assert.equal(await no.made.remove(link), false);
  assert.deepEqual(no.written, []);
  const notOwner = control({ owner: false });
  assert.equal(await notOwner.made.remove(link), false);
  assert.match(notOwner.notes[0], /Seul un propriétaire/);
});
