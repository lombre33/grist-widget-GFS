// Les appels de GFS à l'app ouverte pour un fichier composite (js/app-calls.js, contrats 5.4, points 10 et 11) : seule l'app ouverte et prête répond ; une autre, ou aucune, est « pas ouverte ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeAppCalls } from '../js/app-calls.js';

const session = (id, over = {}) => ({ id, isReady: true, calls: [], deleteFile(body) { this.calls.push(['supprimer', body]); return Promise.resolve({ fait: true }); }, copyFile(body) { this.calls.push(['dupliquer', body]); return Promise.resolve({ id: '9' }); }, ...over });

test('prête : l\'app ouverte est celle du fichier et elle a demandé son contexte ; sinon l\'explorateur grise le geste', () => {
  assert.equal(activeAppCalls(() => session('form')).appReady('form'), true);
  assert.equal(activeAppCalls(() => session('publipostage')).appReady('form'), false, 'une autre app est ouverte');
  assert.equal(activeAppCalls(() => null).appReady('form'), false, 'aucune app n\'est ouverte');
  assert.equal(activeAppCalls(() => session('form', { isReady: false })).appReady('form'), false, 'l\'app n\'a pas encore demandé son contexte : elle ne répondrait pas');
});

test('l\'appel va à la session de l\'app ouverte, par son nom ; rejeté « pas ouverte » (GFS_INACTIF) quand l\'app est partie entre le clic et l\'appel', async () => {
  const open = session('form');
  const calls = activeAppCalls(() => open);
  assert.deepEqual(await calls.appCall('form', 'supprimer', { fichier: { id: '3', type: 'formulaire' } }), { fait: true });
  assert.deepEqual(await calls.appCall('form', 'dupliquer', { fichier: { id: '3', type: 'formulaire' }, nom: 'A (1)' }), { id: '9' });
  assert.deepEqual(open.calls, [['supprimer', { fichier: { id: '3', type: 'formulaire' } }], ['dupliquer', { fichier: { id: '3', type: 'formulaire' }, nom: 'A (1)' }]]);
  await assert.rejects(activeAppCalls(() => session('publipostage')).appCall('form', 'supprimer', {}), { code: 'GFS_INACTIF' });
  await assert.rejects(activeAppCalls(() => null).appCall('form', 'dupliquer', {}), { code: 'GFS_INACTIF' });
});
