// L'événement `extensions` (contrats 5.2, points 2 et 14) : GFS le pousse à l'app active seulement quand ce qu'elle doit charger a vraiment changé, et le secours en fait partie (une copie
// de GFS qui change seule, parce qu'une fonction passe du CDN à la copie, doit arriver à l'app : elle la lit au moment où son CDN échoue).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppContext } from '../js/broker/app-context.js';

const copy = id => ({ version: '1.0.0', src: `https://gfs.example/vendor/${id}.js`, integrite: `sha384-${id}`, forme: 'script' });

function setup(initial) {
  let given = initial;
  const sent = [];
  const c = { session: { id: 'publipostage', sendExtensions: body => sent.push(structuredClone(body)) }, registry: { extensionsFor: () => given }, doc: { baseURI: 'https://gfs.example/' } };
  return { context: new AppContext(c), sent, give: next => { given = next; } };
}

test('pushExtensions : le secours part avec les extensions, et un secours qui change seul est envoyé', () => {
  const base = { extensions: ['graphique'], bibliotheques: { plotly: { src: 'https://cdn.example/p.js', integrite: 'sha384-c', forme: 'script' } }, natives: {}, secours: { plotly: copy('plotly') } };
  const { context, sent, give } = setup(base);
  context.pushExtensions();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].secours, { plotly: copy('plotly') });
  context.pushExtensions();
  assert.equal(sent.length, 1, 'rien n\'a changé : pas de second événement');
  give({ ...base, secours: { plotly: copy('plotly'), docx: copy('docx') } });
  context.pushExtensions();
  assert.equal(sent.length, 2, 'seul le secours a changé (une fonction native est revenue au CDN) : l\'app doit le savoir');
  assert.deepEqual(Object.keys(sent[1].secours), ['plotly', 'docx']);
  give({ ...base, secours: {} });
  context.pushExtensions();
  assert.equal(sent.length, 3);
  assert.deepEqual(sent[2].secours, {}, 'plus de secours : un objet vide, jamais l\'ancien');
});
