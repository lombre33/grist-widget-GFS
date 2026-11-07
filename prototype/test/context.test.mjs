// Le contexte que GFS rend à une app (contrats 5.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, identityFor, instanceOf, pageOf, HOST } from '../js/context.js';
import { policyOf, publipostage } from './helpers.mjs';

test('instanceOf : l\'origine de la page de Grist, ou rien', () => {
  assert.equal(instanceOf('https://docs.getgrist.com/o/docs/abc123/Mon-doc/p/4'), 'https://docs.getgrist.com');
  assert.equal(instanceOf('http://127.0.0.1:8910/lab.html'), 'http://127.0.0.1:8910');
  assert.equal(instanceOf(''), null);
  assert.equal(instanceOf('pas une adresse'), null);
});

test('pageOf : le numéro après /p/, au mieux', () => {
  assert.equal(pageOf('https://docs.getgrist.com/o/docs/abc123/Mon-doc/p/4'), 4);
  assert.equal(pageOf('https://docs.getgrist.com/abc123/Mon-doc/p/12/'), 12);
  assert.equal(pageOf('https://docs.getgrist.com/abc123/Mon-doc'), null);
  assert.equal(pageOf('https://exemple.test/p/abc'), null);
  assert.equal(pageOf(''), null);
});

test('buildContext : tous les champs du contrat, les paramètres de l\'adresse de GFS, le niveau de CETTE app', () => {
  const facts = { instance: 'https://docs.getgrist.com', document: 'abc123', page: 4, widgetAddress: 'https://exemple.test/gfs/index.html' };
  const session = { access: 'read table', extensions: ['graphique'], libraries: { plotly: { src: 'https://x/p.js', integrite: 'sha384-X' } }, opening: { fichier: null, type: 'modele', dossier: '', raison: 'nouveau' } };
  const context = buildContext(facts, session, { preferences: { language: 'fr', timeZone: 'Europe/Paris' }, readonly: false });
  assert.deepEqual(Object.keys(context), ['contrat', 'hote', 'instance', 'document', 'page', 'section', 'adresseWidget', 'langue', 'culture', 'fuseau', 'devise', 'lectureSeule', 'acces', 'extensions', 'bibliotheques', 'ouverture', 'stockage', 'barre', 'lecteurs', 'identite', 'ambiance', 'role']);
  assert.equal(context.contrat, 0);
  assert.deepEqual(context.hote, HOST);
  assert.equal(context.acces, 'read table');
  assert.deepEqual(context.extensions, ['graphique']);
  assert.equal(context.langue, 'fr');
  assert.equal(context.culture, null);
  assert.equal(context.fuseau, 'Europe/Paris');
  assert.equal(context.lectureSeule, false);
  assert.equal(context.section, null);
  assert.deepEqual(context.stockage, {}, 'sans espace donné : vide');
  const kept = buildContext(facts, { ...session, storage: { pp_theme: 'dark', pp_page_zoom: '{"m1":120}' } }, { preferences: {}, readonly: false });
  assert.deepEqual(kept.stockage, { pp_theme: 'dark', pp_page_zoom: '{"m1":120}' }, 'la copie de l\'espace de l\'app, telle que le courtier la lit');
  assert.equal(context.barre, null, 'sans barre qui la recouvre : null');
  assert.equal(context.identite, null, 'sans identité donnée : null');
  assert.deepEqual(buildContext(facts, { ...session, identity: { email: 'ana@exemple.org' } }, { preferences: {}, readonly: false }).identite, { email: 'ana@exemple.org' }, 'l\'identité que le contrôleur a donnée, telle quelle');
  const bar = { bord: 'gauche', epaisseur: 42, zone: { x: 0, y: 149, largeur: 42, hauteur: 102 } };
  assert.deepEqual(buildContext(facts, { ...session, bar }, { preferences: {}, readonly: false }).barre, bar, 'la barre que le contrôleur a mesurée, telle quelle');
  assert.equal(context.ambiance, null, 'rien de choisi : null (l\'app garde ses couleurs)');
  const ambiance = { id: 'pop', couleur: null, ajustee: false, clair: { '--accent': '#5b3fd6' }, sombre: { '--accent': '#9b86f0' }, forme: { '--radius-md': '14px' } };
  assert.deepEqual(buildContext(facts, { ...session, ambiance }, { preferences: {}, readonly: false }).ambiance, ambiance, 'le message d\'ambiance de GFS, tel quel');
  assert.deepEqual(context.role, { proprietaire: null, responsableDe: [] }, 'rien de prouvé : la personne n\'est ni dite propriétaire ni dite autre chose');
  assert.deepEqual(buildContext(facts, { ...session, role: { proprietaire: false, responsableDe: ['compta'] } }, { preferences: {}, readonly: false }).role, { proprietaire: false, responsableDe: ['compta'] }, 'le rôle que le contrôleur a prouvé, tel quel');
  assert.equal(buildContext(facts, { ...session, opening: null }, { preferences: {}, readonly: true }).ouverture, null);
  assert.equal(buildContext(facts, session, { preferences: {}, readonly: true }).lectureSeule, true);
});

// L'adresse e-mail de la personne n'est donnée qu'à l'app qui l'a déclarée (contrats 3.4, point 6 ; 5.2, point 9).
const declaring = () => policyOf({ ...publipostage(), permissions: { ...publipostage().permissions, identite: { pourquoi: { fr: 'Pour « Mes tâches »', en: 'For “My tasks”' } } } });

test('identityFor : seulement à l\'app qui a déclaré l\'identité, et quand GFS connaît l\'adresse', () => {
  assert.deepEqual(identityFor(declaring(), 'ana@exemple.org'), { email: 'ana@exemple.org' });
  assert.deepEqual(identityFor(declaring(), '  Ana@Exemple.org '), { email: 'Ana@Exemple.org' }, 'la casse de Grist est gardée, les blancs de bord partent');
  assert.equal(identityFor(policyOf(publipostage()), 'ana@exemple.org'), null, 'une app qui ne l\'a pas déclarée n\'en reçoit rien');
  assert.equal(identityFor(declaring(), ''), null, 'GFS ne la connaît pas : null');
  assert.equal(identityFor(declaring(), undefined), null);
  assert.equal(identityFor(declaring(), 42), null, 'ce qui n\'est pas un texte n\'est pas une adresse');
  assert.equal(identityFor(null, 'ana@exemple.org'), null);
});

test('identityFor : l\'app ne distingue pas « pas déclarée » de « GFS ne la connaît pas »', () => {
  const undeclared = identityFor(policyOf(publipostage()), 'ana@exemple.org');
  const unknown = identityFor(declaring(), '');
  assert.deepEqual(undeclared, unknown);
});

test('buildContext : `lecteurs` dit les sites de vidéos dont GFS pose le lecteur pour cette app, `[]` quand elle n\'en a pas déclaré (contrats 5.2, point 11)', () => {
  const facts = { instance: null, document: null, page: null, widgetAddress: null };
  const params = { preferences: {}, readonly: false };
  assert.deepEqual(buildContext(facts, { access: 'full' }, params).lecteurs, []);
  assert.deepEqual(buildContext(facts, { access: 'full', players: ['youtube', 'vimeo'] }, params).lecteurs, ['youtube', 'vimeo']);
  assert.deepEqual(policyOf(publipostage()).lecteurs, ['youtube', 'vimeo'], 'Publipostage+ a déclaré les deux sites (le lecteur de Slides+)');
});
