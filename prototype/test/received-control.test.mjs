// « Partagés avec moi », ce que l'explorateur demande (js/received-control.js) : le grisé et le mot d'une arrivée en attente, le geste principal, le menu, la question et ce qui s'écrit ensuite. La fenêtre de la question
// est une doublure (elle se mesure sous Firefox, test/partager-recevoir-firefox.mjs, et dans un vrai Grist, labo/run-partages-recus.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReceivedControl } from '../js/received-control.js';
import { PENDING, ACCEPTED } from '../js/received-files.js';
import { createI18n } from '../js/i18n.js';
import { KeptFiles } from '../js/kept-files.js';

const FR = createI18n('fr');
const EN = createI18n('en');
const file = (state = PENDING, extra = {}) => ({ key: 'gfs-recus:GFS_Recus:f1', app: 'gfs-recus', id: 'f1', name: 'Contrat.pdf', type: 'pdf', by: 'Compta <compta@exemple.fr>', weight: 2150, received: { table: 'GFS_Recus', row: 4, state, gone: false, ...extra } });

function setup({ i18n = FR, blocked = null, answers = 'accept', written = true } = {}) {
  const log = { notices: [], windows: [], written: [], refreshed: 0, opened: [] };
  const control = new ReceivedControl({
    port: { doc: {} }, t: i18n.t, locale: () => 'fr', container: {}, inertTargets: () => [], typeLabel: () => 'PDF', notice: text => log.notices.push(text), blocked: () => blocked,
    refresh: async () => { log.refreshed += 1; }, open: opened => log.opened.push(opened.key),
    answerFile: async (port, answered, accepted) => { log.written.push([answered.key, accepted]); return written; },
    window: async ctx => { log.windows.push(ctx); if (answers === 'accept' || answers === 'refuse') await ctx.answer(answers === 'accept'); return answers === 'escape' ? null : answers; },
  });
  return { control, log };
}

test('une arrivée en attente est grisée avec sa raison et porte le mot « À accepter » ; une arrivée acceptée n\'est ni grisée ni renommée', () => {
  const { control } = setup();
  assert.match(control.lockOf(file()).text, /acceptez-le pour le lire/);
  assert.equal(control.lockOf(file(ACCEPTED)), null);
  assert.equal(control.typeLabel(file()), 'À accepter');
  assert.equal(control.typeLabel(file(ACCEPTED)), 'PDF');
  assert.equal(control.typeLabel(file(ACCEPTED, { gone: true })), 'PDF', 'un fichier que l\'envoyeur ne partage plus garde son type : le mot et la couleur du type vont ensemble');
  assert.equal(setup({ i18n: EN }).control.typeLabel(file()), 'To accept');
});

test('le geste principal d\'une arrivée en attente est « Accepter ou refuser… » ; celui d\'une arrivée acceptée est laissé à kept-files (lire)', () => {
  const { control } = setup();
  assert.deepEqual(control.openAs(file()), { label: 'Accepter ou refuser…', icon: 'open', greyed: false });
  assert.equal(control.openAs(file(ACCEPTED)), null);
  assert.equal(control.menu(file(ACCEPTED)), null);
  const [item, ...rest] = control.menu(file());
  assert.deepEqual([item.label, rest.length, item.hint], ['Accepter ou refuser…', 0, 'Entrée']);
});

test('GFS lit une arrivée acceptée comme un PDF qu\'il garde, sans en devenir le gardien (ni corbeille ni copie : la table est celle du partage)', () => {
  const kept = new KeptFiles({ store: {}, t: FR.t, lang: () => 'fr', locale: () => 'fr', readonly: () => false });
  assert.equal(kept.has(file(ACCEPTED)), true);
  assert.equal(kept.has(file()), false);
  assert.equal(kept.manages(file(ACCEPTED)), false);
  assert.equal(kept.copies(file(ACCEPTED)), false);
  assert.equal(kept.has({ app: 'gfs-fichiers' }), true);
  assert.equal(kept.manages({ app: 'gfs-fichiers' }), true);
});

test('Entrée sur une arrivée acceptée la lit ; sur une arrivée en attente, la question est posée', async () => {
  const { control, log } = setup({ answers: 'escape' });
  control.activate(file(ACCEPTED));
  assert.deepEqual(log.opened, ['gfs-recus:GFS_Recus:f1']);
  control.activate(file());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(log.windows.length, 1);
});

test('la question dit le nom, qui partage et le poids ; « Accepter » écrit la marque, dit la phrase et relit la liste', async () => {
  const { control, log } = setup({ answers: 'accept' });
  assert.equal(await control.ask(file()), 'accept');
  const [ctx] = log.windows;
  assert.equal(ctx.title, 'Accepter « Contrat.pdf » ?');
  assert.equal(ctx.sub, 'Partagé par Compta');
  assert.equal(ctx.who, 'Compta');
  assert.match(ctx.size, /Ko/);
  assert.deepEqual(log.written, [['gfs-recus:GFS_Recus:f1', true]]);
  assert.deepEqual(log.notices, ['« Contrat.pdf » est accepté.']);
  assert.equal(log.refreshed, 1);
});

test('« Refuser » écrit la marque de refus et le dit', async () => {
  const { control, log } = setup({ answers: 'refuse' });
  assert.equal(await control.ask(file()), 'refuse');
  assert.deepEqual(log.written, [['gfs-recus:GFS_Recus:f1', false]]);
  assert.match(log.notices[0], /refusé : il ne reviendra pas/);
});

test('Échap : rien n\'est écrit, rien n\'est dit, la liste n\'est pas relue', async () => {
  const { control, log } = setup({ answers: 'escape' });
  assert.equal(await control.ask(file()), null);
  assert.deepEqual([log.written, log.notices, log.refreshed], [[], [], 0]);
});

test('sans nom d\'auteur : « Un autre document » ; document en lecture seule : la phrase, pas de fenêtre', async () => {
  const { control, log } = setup({ answers: 'escape' });
  await control.ask({ ...file(), by: '' });
  assert.equal(log.windows[0].who, 'Un autre document');
  assert.equal(log.windows[0].sub, 'Partagé depuis un autre document Grist');
  const blocked = setup({ blocked: 'Document en lecture seule.' });
  assert.equal(await blocked.control.ask(file()), null);
  assert.deepEqual([blocked.log.windows.length, blocked.log.notices], [0, ['Document en lecture seule.']]);
});

test('une ligne qui n\'est plus dans la table : la réponse échoue avec la phrase (dite dans la fenêtre), rien n\'est dit ni relu', async () => {
  const { control, log } = setup({ answers: 'accept', written: false });
  await assert.rejects(control.ask(file()), /n’est plus dans le document/);
  assert.deepEqual([log.notices, log.refreshed], [[], 0]);
});
