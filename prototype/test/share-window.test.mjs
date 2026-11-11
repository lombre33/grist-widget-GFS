// Ce que la zone d'ajout de « Partager » propose et les articles du menu des droits (js/sharing/share-window.js ; contrats 11.7, point 13), en code pur. La fenêtre elle-même, à la souris et au clavier, à 700 × 400,
// se mesure sous Firefox (test/partager-firefox.mjs) et dans un vrai Grist (labo/run-partager-fenetre.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestions, levelItems, whoLabel } from '../js/sharing/share-window.js';
import { createOtherDocuments, documentName, whyNot } from '../js/sharing/share-other.js';
import { createI18n } from '../js/i18n/i18n.js';
import { SHARE_OTHER_STRINGS } from '../js/i18n/i18n-share-other.js';

const { t } = createI18n('fr');
const state = (extra = {}) => ({ me: 'moi@x.fr', author: 'moi@x.fr', people: ['ann@x.fr', 'marc.petit@x.fr', 'moi@x.fr'], shares: [], ...extra });

test('sans texte : les personnes connues (jamais soi-même) et les deux catégories', () => {
  const found = suggestions(t, state(), '');
  assert.deepEqual(found.people.map(item => item.who), ['ann@x.fr', 'marc.petit@x.fr']);
  assert.deepEqual(found.categories.map(item => item.who), ['@editeurs', '@tous']);
  assert.equal(found.invite, null);
});

test('la recherche : mots dans n\'importe quel ordre, accents et casse ignorés ; une catégorie se trouve par son nom', () => {
  assert.deepEqual(suggestions(t, state(), 'PETIT marc').people.map(item => item.who), ['marc.petit@x.fr']);
  assert.deepEqual(suggestions(t, state(), 'éditeurs').categories.map(item => item.who), ['@editeurs']);
  assert.deepEqual(suggestions(t, state(), 'zzz').people, []);
});

test('une adresse tapée en entier, que GFS ne connaît pas, devient « Ajouter … » avec la phrase sur l\'invitation ; jamais pour une personne déjà connue ou déjà dans la liste', () => {
  const found = suggestions(t, state(), '  Nouveau@Societe.fr ');
  assert.equal(found.invite.who, 'nouveau@societe.fr');
  assert.match(found.invite.hint, /propriétaire/);
  assert.equal(suggestions(t, state(), 'ann@x.fr').invite, null);
  const listed = state({ shares: [{ who: 'new@x.fr', inherited: false }] });
  assert.equal(suggestions(t, listed, 'new@x.fr').invite, null);
  assert.equal(suggestions(t, state(), 'pas une adresse').invite, null);
});

test('ce qui est déjà dans la liste (personne ou catégorie) n\'est plus proposé ; une ligne héritée ne compte pas', () => {
  const listed = state({ shares: [{ who: 'ann@x.fr', inherited: false }, { who: '@tous', inherited: false }, { who: '@editeurs', inherited: true }] });
  const found = suggestions(t, listed, '');
  assert.deepEqual(found.people.map(item => item.who), ['marc.petit@x.fr']);
  assert.deepEqual(found.categories.map(item => item.who), ['@editeurs']);
});

test('le menu des droits : cinq droits et « Aucun accès », le courant coché, commentaires et dépôt seul grisés avec leur raison, administration refusée à une catégorie, « Retirer » en dernier', () => {
  const said = [];
  const items = levelItems(t, { current: 'ecriture', category: false, onPick: key => said.push(`pick:${key}`), onRemove: () => said.push('remove'), onWhy: why => said.push(why) });
  assert.deepEqual(items.filter(item => item !== '-').map(item => item.label), ['Lecture seule', 'Lecture + commentaires', 'Dépôt seul', 'Écriture', 'Administration', 'Aucun accès', 'Retirer l’accès']);
  assert.deepEqual(items.filter(item => item.check).map(item => item.label), ['Écriture']);
  assert.deepEqual(items.filter(item => item.greyed).map(item => item.label), ['Lecture + commentaires', 'Dépôt seul']);
  items[1].run(); items[3].run(); items.at(-1).run();
  assert.deepEqual(said, [t('share.right.commentaire.why'), 'pick:ecriture', 'remove']);
  const forCategory = levelItems(t, { current: 'lecture', category: true, onPick: () => {}, onWhy: () => {} });
  assert.ok(forCategory.find(item => item.label === 'Administration').greyed);
  assert.ok(forCategory.find(item => item.label === 'Aucun accès').greyed, '« Aucun accès » se donne à une personne ou à un groupe, pas à une catégorie');
  assert.ok(!items.find(item => item.label === 'Aucun accès').greyed);
  assert.ok(!forCategory.some(item => item.label === 'Retirer l’accès'), 'un nouveau partage, pas encore écrit, n\'a rien à retirer');
});

test('le nom d\'une catégorie se lit dans la langue de la personne ; une adresse reste telle quelle', () => {
  assert.equal(whoLabel(t, '@tous'), 'Tout le document');
  assert.equal(whoLabel(createI18n('en').t, '@editeurs'), 'All editors');
  assert.equal(whoLabel(t, 'a@b.fr'), 'a@b.fr');
});

test('les groupes : proposés par leur nom avec leur effectif, jamais ceux déjà dans la liste ; « #nom » se lit « Groupe · nom » ; pas d\'administration pour un groupe', () => {
  const groups = [{ name: 'Achats', count: 3 }, { name: 'Compta', count: 1 }];
  const found = suggestions(t, state({ groups, shares: [{ who: '#Compta', inherited: false }] }), '');
  assert.deepEqual(found.groups.map(item => [item.who, item.glyph]), [['#Achats', 'users']]);
  assert.match(found.groups[0].hint, /3/);
  assert.deepEqual(suggestions(t, state({ groups }), 'compta').groups.map(item => item.who), ['#Compta']);
  assert.match(whoLabel(t, '#Achats'), /Achats/);
  assert.notEqual(whoLabel(t, '#Achats'), '#Achats');
  const admin = levelItems(t, { current: 'lecture', category: true, onPick() {}, onWhy() {} }).find(item => item.label === t('share.right.admin'));
  assert.equal(admin.greyed, true);
});

test('l\'onglet « Dans un autre document Grist » : libre pour un PDF de GFS quand la personne est propriétaire, grisé avec sa raison sinon (autre fichier, dossier, pas propriétaire)', () => {
  const pdf = { key: 'gfs-fichiers:abc', app: 'gfs-fichiers', id: 'abc', name: 'Facture.pdf' };
  assert.equal(whyNot(t, { file: pdf, state: { owner: true } }), null);
  assert.equal(whyNot(t, { file: { ...pdf, app: 'publipostage' }, state: { owner: true } }), t('share.other.why.pdf'));
  assert.equal(whyNot(t, { file: { ...pdf, folder: { path: 'Espaces/A/B' } }, state: { owner: true } }), t('share.other.why.pdf'));
  assert.equal(whyNot(t, { file: null, state: { owner: true } }), t('share.other.why.pdf'));
  assert.equal(whyNot(t, { file: pdf, state: { owner: false } }), t('share.other.why.owner'));
  assert.equal(whyNot(t, { file: pdf, state: { owner: null } }), t('share.other.why.owner'));
  assert.equal(whyNot(t, { file: pdf, state: null }), t('share.other.why.owner'));
});

test('l\'onglet du contrôleur : sa raison et le fichier, et un document en lecture seule ou sans l\'accès complet n\'écrit rien (le geste rend la raison du blocage)', async () => {
  const notices = [];
  const pdf = { key: 'gfs-fichiers:abc', app: 'gfs-fichiers', id: 'abc', name: 'Facture.pdf' };
  const make = writeBlock => createOtherDocuments({ t, container: null, inertTargets: () => [], docApi: () => null, transfer: null, language: () => 'fr', notice: text => notices.push(text), writeBlock: () => writeBlock });
  const free = make(null).tab(pdf, { owner: true });
  assert.equal(free.why, null);
  assert.equal(free.fileId, 'abc');
  assert.equal(make(null).tab({ ...pdf, app: 'autre' }, { owner: true }).why, t('share.other.why.pdf'));
  const readonly = make(t('mod.readonly'));
  assert.deepEqual(await readonly.tab(pdf, { owner: true }).onLevel({ id: 'e1', files: [] }, 'live'), { ok: false, message: t('mod.readonly') });
  assert.deepEqual(await readonly.stop({ id: 'e1' }), { ok: false, message: t('mod.readonly') });
  assert.deepEqual(await make(null).tab(pdf, { owner: false }).onLevel({ id: 'e1', files: [] }, 'live'), { ok: false, message: t('share.other.why.owner') });
  await readonly.tab(pdf, { owner: true }).onNew();
  assert.deepEqual(notices, [t('mod.readonly')], 'la fenêtre du premier envoi ne s\'ouvre pas : un avis dit pourquoi');
});

test('« D\'un autre document Grist… » : l\'article du sous-menu « Importer » est grisé avec sa raison quand rien ne peut s\'écrire ; recevoir sans être propriétaire dit pourquoi, sans rien ouvrir', async () => {
  const notices = [];
  const make = (writeBlock, owner) => createOtherDocuments({ t, container: null, inertTargets: () => [], docApi: () => null, transfer: { isOwner: async () => owner }, language: () => 'fr', notice: text => notices.push(text), writeBlock: () => writeBlock });
  const free = make(null, true).entry();
  assert.deepEqual([free.action, free.greyed, free.label, free.hint], ['receive', false, t('sr.entry'), t('sr.entry.hint')]);
  const locked = make(t('mod.readonly'), true).entry();
  assert.deepEqual([locked.greyed, locked.reason], [true, t('mod.readonly')], 'grisé, jamais masqué : un clic dit pourquoi');
  await make(t('mod.readonly'), true).receive();
  await make(null, false).receive();
  await make(null, null).receive();
  assert.deepEqual(notices, [t('mod.readonly'), t('sr.why.owner'), t('sr.why.owner')], 'ni la fenêtre ni le moteur ne se chargent : un avis dit pourquoi (propriétaire non établi = pas propriétaire)');
});

test('les textes de la fenêtre d\'envoi sont les mêmes en français et en anglais, et aucun n\'est resté une clé', () => {
  const fr = createI18n('fr').t;
  const en = createI18n('en').t;
  for (const key of ['share.other.sec', 'so.title', 'so.sub', 'so.foot', 'so.continue', 'so.cancel', 'so.close', 'so.accord.lead', 'so.accord.adds', 'so.accord.table', 'so.accord.columns', 'so.accord.hook', 'so.accord.other', 'so.accord.keep',
    'so.preparing', 'so.code.step', 'so.code.hint', 'so.code.label', 'so.code.copy', 'so.code.copied', 'so.code.select', 'so.reply.step', 'so.reply.hint', 'so.reply.label', 'so.check', 'so.verify.lead',
    'so.verify.doc', 'so.verify.personal', 'so.verify.in', 'so.verify.control', 'so.verify.hint', 'so.send', 'so.sending', 'so.sending.hint', 'so.done', 'so.done.hint', 'so.stop', 'so.failed',
    'so.error.blocked', 'so.error.timeout', 'so.error.hint', 'so.toast.done', 'share.other.why.pdf', 'share.other.why.owner']) {
    const vars = { name: 'F.pdf', doc: 'D', table: 'T', columns: 'a, b', n: 7, folder: 'Dossier', team: 'Équipe', message: 'm' };
    assert.ok(fr(key, vars) && fr(key, vars) !== key, `fr ${key}`);
    assert.ok(en(key, vars) && en(key, vars) !== key, `en ${key}`);
    assert.notEqual(fr(key, vars), en(key, vars), `${key} : traduit`);
  }
  assert.match(fr('so.code.hint', { n: 1 }), /1 jour\./);
  assert.match(fr('so.code.hint', { n: 7 }), /7 jours\./);
  assert.match(en('so.code.hint', { n: 1 }), /1 day\./);
});

test('tous les textes du partage vers un autre document existent en français et en anglais, traduits, et gardent les mêmes variables', () => {
  const { fr, en } = SHARE_OTHER_STRINGS;
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort(), 'les mêmes clés dans les deux langues');
  const vars = text => [...text.matchAll(/\{(\w+)[|}]/g)].map(match => match[1]).sort().join();
  for (const key of Object.keys(fr)) {
    assert.ok(fr[key] && en[key], key);
    assert.equal(vars(fr[key]), vars(en[key]), `${key} : mêmes variables`);
    if (fr[key].length > 12) assert.notEqual(fr[key], en[key], `${key} : traduit`);
  }
});

test('le nom du document, pour nommer le lien chez l\'autre : celui que Grist donne (espaces retirés) ; sinon, ou si la lecture échoue, le nom neutre', async () => {
  const asks = [];
  const reply = body => ({ rest: async (...args) => { asks.push(args); return body === 'throw' ? Promise.reject(new Error('x')) : { body }; } });
  assert.equal(await documentName(reply({ name: '  Achats 2026 ' }), t), 'Achats 2026');
  assert.deepEqual(asks[0], ['GET', '', { writable: false }], 'une lecture, sans droit d\'écrire');
  for (const body of [{ name: '   ' }, { name: 3 }, {}, null, 'throw']) assert.equal(await documentName(reply(body), t), t('so.link.default'));
  assert.equal(await documentName({ rest: async () => null }, t), t('so.link.default'));
});
