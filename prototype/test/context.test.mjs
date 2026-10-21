// Le contexte que GFS rend à une app (contrats 5.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, instanceOf, pageOf, HOST } from '../js/context.js';

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
  assert.deepEqual(Object.keys(context), ['contrat', 'hote', 'instance', 'document', 'page', 'section', 'adresseWidget', 'langue', 'culture', 'fuseau', 'devise', 'lectureSeule', 'acces', 'extensions', 'bibliotheques', 'ouverture', 'stockage', 'barre']);
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
  const bar = { bord: 'gauche', epaisseur: 42, zone: { x: 0, y: 149, largeur: 42, hauteur: 102 } };
  assert.deepEqual(buildContext(facts, { ...session, bar }, { preferences: {}, readonly: false }).barre, bar, 'la barre que le contrôleur a mesurée, telle quelle');
  assert.equal(buildContext(facts, { ...session, opening: null }, { preferences: {}, readonly: true }).ouverture, null);
  assert.equal(buildContext(facts, session, { preferences: {}, readonly: true }).lectureSeule, true);
});
