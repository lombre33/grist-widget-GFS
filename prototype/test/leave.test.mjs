// Quitter l'app active pour une autre (contrats 5.4, point 3, appel `fermer`) : la réponse de l'app, ce que GFS ne ferme jamais tout seul, et la décision de la personne quand l'app se tait ou échoue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askToClose, leaveApp, leaveQuestion, PATIENCE_MS, tellToStay } from '../js/broker/leave.js';
import { createI18n } from '../js/i18n/i18n.js';
import { ERR } from '../js/broker/filter.js';

const coded = (code, message = 'non') => Object.assign(new Error(message), { code });
const later = ms => new Promise(resolve => setTimeout(resolve, ms));

// Une app qui répond comme on le lui dit : `answer(reason)` rend la promesse de sa réponse. `asked` garde les raisons reçues.
const appThat = answer => {
  const session = { asked: [], closeApp(reason) { this.asked.push(reason); return answer(reason); } };
  return session;
};
// La question à la personne : `says` est sa réponse ; `shown` garde ce qu'on lui a montré (l'erreur, ou null quand l'app se tait).
const person = says => {
  const offer = { shown: [], fn: async fault => { offer.shown.push(fault); return says; } };
  return offer;
};
const FAST = 30;

test('la durée d\'attente avant « Fermer quand même » est de dix secondes (contrats 5.4, point 3)', () => {
  assert.equal(PATIENCE_MS, 10000);
});

test('l\'app répond oui : elle part, sans que la personne soit dérangée', async () => {
  const session = appThat(async () => ({ ferme: true }));
  const you = person(false);
  assert.equal(await askToClose(session, 'ouvrir', { offer: you.fn, patience: FAST }), true);
  assert.deepEqual(session.asked, ['ouvrir'], 'la raison part avec l\'appel');
  assert.deepEqual(you.shown, []);
});

test('l\'app répond non (la personne a annulé dans l\'app) : elle reste, sans autre question', async () => {
  const session = appThat(async () => ({ ferme: false }));
  const you = person(true);
  assert.equal(await askToClose(session, 'lien', { offer: you.fn, patience: FAST }), false);
  assert.deepEqual(you.shown, []);
});

test('une app qui ne connaît pas `fermer` (GFS_INCONNU) part comme avant, sans question', async () => {
  const session = appThat(async () => { throw coded(ERR.INCONNU, 'inconnu'); });
  const you = person(false);
  assert.equal(await askToClose(session, 'ouvrir', { offer: you.fn, patience: FAST }), true);
  assert.deepEqual(you.shown, []);
});

test('l\'app n\'est plus là (GFS_INACTIF) : rien à fermer, la demande n\'ouvre rien', async () => {
  const session = appThat(async () => { throw coded(ERR.INACTIF, 'plus active'); });
  const you = person(true);
  assert.equal(await askToClose(session, 'ouvrir', { offer: you.fn, patience: FAST }), false);
  assert.deepEqual(you.shown, []);
});

test('une app qui se tait : au bout de l\'attente la personne décide, et « Fermer quand même » ferme sans réponse', async () => {
  const session = appThat(() => new Promise(() => {}));
  const you = person(true);
  const started = Date.now();
  assert.equal(await askToClose(session, 'ouvrir', { offer: you.fn, patience: FAST }), true);
  assert.ok(Date.now() - started >= FAST - 5, 'GFS n\'a pas demandé avant la fin de l\'attente');
  assert.deepEqual(you.shown, [null], 'null : l\'app n\'a pas répondu (le texte « ne répond pas »)');
});

test('une app qui se tait et « Attendre » : GFS ne ferme rien, puis suit la réponse de l\'app, oui', async () => {
  let answer;
  const session = appThat(() => new Promise(resolve => { answer = resolve; }));
  const you = person(false);
  const running = askToClose(session, 'ouvrir', { offer: you.fn, patience: FAST });
  let settled = false;
  running.then(() => { settled = true; });
  await later(FAST * 3);
  assert.equal(settled, false, 'la personne a dit d\'attendre : rien ne se ferme tant que l\'app ne répond pas');
  answer({ ferme: true });
  assert.equal(await running, true);
});

test('une app qui se tait et « Attendre » : la réponse de l\'app peut aussi être non', async () => {
  let answer;
  const session = appThat(() => new Promise(resolve => { answer = resolve; }));
  const running = askToClose(session, 'ouvrir', { offer: person(false).fn, patience: FAST });
  await later(FAST * 3);
  answer({ ferme: false });
  assert.equal(await running, false);
});

test('une erreur de l\'app : la personne voit l\'erreur ; « Rester » garde l\'app, « Fermer quand même » la ferme', async () => {
  const failing = () => appThat(async () => { throw coded('GFS_ERREUR', 'écriture refusée'); });
  const stay = person(false);
  assert.equal(await askToClose(failing(), 'ouvrir', { offer: stay.fn, patience: FAST }), false);
  assert.equal(stay.shown.length, 1);
  assert.equal(stay.shown[0].message, 'écriture refusée');
  const force = person(true);
  assert.equal(await askToClose(failing(), 'ouvrir', { offer: force.fn, patience: FAST }), true);
});

test('une réponse sans `ferme` n\'est ni un oui ni un non : la personne décide, et rester ne ferme rien', async () => {
  for (const reply of [null, {}, { ferme: 'oui' }, { ouvert: true }]) {
    const you = person(false);
    assert.equal(await askToClose(appThat(async () => reply), 'ouvrir', { offer: you.fn, patience: FAST }), false, JSON.stringify(reply));
    assert.equal(you.shown.length, 1, JSON.stringify(reply));
    assert.equal(you.shown[0].message, '', 'aucun texte de l\'app : GFS dit « réponse inattendue »');
  }
});

test('l\'app qui répond avant la fin de l\'attente n\'est jamais interrompue par la question', async () => {
  const session = appThat(async () => { await later(FAST / 3); return { ferme: true }; });
  const you = person(false);
  assert.equal(await askToClose(session, 'ouvrir', { offer: you.fn, patience: FAST * 4 }), true);
  await later(FAST * 5);
  assert.deepEqual(you.shown, [], 'le délai est arrêté dès la réponse');
});

test('un appel qui échoue avant de partir (pas de messagerie) est une erreur de l\'app, pas un plantage', async () => {
  const session = { closeApp() { throw new TypeError('pas d\'enveloppe'); } };
  const you = person(false);
  assert.equal(await askToClose(session, 'ouvrir', { offer: you.fn, patience: FAST }), false);
  assert.equal(you.shown[0].message, 'pas d\'enveloppe');
});

// ---------- ce que la personne lit quand l'app se tait ou échoue (la fenêtre d'accord du widget, en français et en anglais) ----------

// ---------- « tu restes » : l'app a répondu oui, la personne est revenue (contrats 5.4, point 3, appel `rester`) ----------

// Une app qui répond à `fermer` et à `rester` : `closed` et `stayed` gardent les raisons reçues.
const appThatStays = ({ close = async () => ({ ferme: true }), stay = async () => ({ repris: true }) } = {}) => ({
  closed: [], stayed: [],
  closeApp(reason) { this.closed.push(reason); return close(reason); },
  stayApp(reason) { this.stayed.push(reason); return stay(reason); },
});
const warnings = async run => {
  const kept = [];
  const original = console.warn;
  console.warn = (...args) => kept.push(args.map(String).join(' '));
  try { await run(); } finally { console.warn = original; }
  return kept;
};

test('« rester » : la raison part avec l\'appel ; vrai seulement quand l\'app dit `repris: true`', async () => {
  for (const [reply, expected] of [[{ repris: true }, true], [{ repris: false }, false], [{ repris: 'oui' }, false], [{}, false], [null, false]]) {
    const session = appThatStays({ stay: async () => reply });
    assert.equal(await tellToStay(session, 'explorateur'), expected, JSON.stringify(reply));
    assert.deepEqual(session.stayed, ['explorateur']);
  }
});

test('« rester » : une app qui ne connaît pas l\'appel (GFS_INCONNU) ou qui est déjà partie (GFS_INACTIF) ne déclenche aucun avertissement ; toute autre erreur en déclenche un', async () => {
  for (const code of [ERR.INCONNU, ERR.INACTIF]) {
    const session = appThatStays({ stay: async () => { throw coded(code); } });
    const kept = await warnings(async () => assert.equal(await tellToStay(session, 'app'), false));
    assert.deepEqual(kept, [], code);
  }
  const broken = appThatStays({ stay: async () => { throw coded('GFS_ERREUR', 'Reprise refusée'); } });
  const kept = await warnings(async () => assert.equal(await tellToStay(broken, 'app'), false));
  assert.equal(kept.length, 1);
  assert.match(kept[0], /rester/);
});

test('l\'app dit oui et la personne n\'a rien changé : elle part, et on ne lui dit pas de rester', async () => {
  const session = appThatStays();
  assert.equal(await leaveApp(session, 'ouvrir', { offer: person(false).fn, where: () => 'now', patience: FAST }), true);
  await later(0);
  assert.deepEqual(session.stayed, []);
});

test('l\'app dit oui, puis la personne est revenue (l\'app est toujours là) : elle reste et reçoit « rester » avec la raison de son « fermer »', async () => {
  let place = 'now';
  const session = appThatStays({ close: async () => { place = 'moved'; return { ferme: true }; } });
  assert.equal(await leaveApp(session, 'lien', { offer: person(false).fn, where: () => place, patience: FAST }), false);
  await later(0);
  assert.deepEqual(session.closed, ['lien']);
  assert.deepEqual(session.stayed, ['lien'], 'la même raison que le « fermer » qu\'elle a reçu');
});

test('« rester » ne part que pour une app qui avait dit oui et qui est toujours là', async () => {
  const noAnswer = appThatStays({ close: async () => ({ ferme: false }) });
  assert.equal(await leaveApp(noAnswer, 'app', { offer: person(false).fn, where: () => 'moved', patience: FAST }), false);
  const replaced = appThatStays();
  assert.equal(await leaveApp(replaced, 'app', { offer: person(false).fn, where: () => 'gone', patience: FAST }), false);
  await later(0);
  assert.deepEqual([noAnswer.stayed, replaced.stayed], [[], []], 'une app qui a dit non n\'a rien arrêté ; une app remplacée n\'est plus là');
});

test('« Fermer quand même » puis retour : l\'app qui s\'était tue reçoit aussi « rester » ; une app qui ne connaît pas « fermer » ni « rester » reste sans avertissement', async () => {
  const silent = appThatStays({ close: () => new Promise(() => {}) });
  assert.equal(await leaveApp(silent, 'app', { offer: person(true).fn, where: () => 'moved', patience: FAST }), false);
  await later(0);
  assert.deepEqual(silent.stayed, ['app']);
  const old = appThatStays({ close: async () => { throw coded(ERR.INCONNU); }, stay: async () => { throw coded(ERR.INCONNU); } });
  const kept = await warnings(async () => {
    assert.equal(await leaveApp(old, 'app', { offer: person(false).fn, where: () => 'moved', patience: FAST }), false);
    await later(0);
  });
  assert.deepEqual(kept, []);
});

const WORDS = {
  fr: { silent: 'Publipostage+ ne répond pas', fault: 'Publipostage+ n’a pas pu se fermer', force: 'Fermer quand même', wait: 'Attendre', stay: 'Rester', unexpected: 'réponse inattendue' },
  en: { silent: 'Publipostage+ is not responding', fault: 'Publipostage+ could not close', force: 'Close anyway', wait: 'Wait', stay: 'Stay', unexpected: 'unexpected answer' },
};

test('l\'app se tait : le titre nomme l\'app, « Fermer quand même » contre « Attendre », et le clavier va au choix sûr', () => {
  for (const [lang, words] of Object.entries(WORDS)) {
    const question = leaveQuestion({ t: createI18n(lang).t, app: 'Publipostage+', fault: null });
    assert.equal(question.title, words.silent, lang);
    assert.equal(question.confirmLabel, words.force, lang);
    assert.equal(question.cancelLabel, words.wait, lang);
    assert.equal(question.safeFirst, true, `${lang} : Entrée ne ferme pas une app dont les modifications ne sont pas enregistrées`);
    assert.ok(question.message.includes('Publipostage+'), lang);
  }
});

test('l\'app répond par une erreur : sa phrase est dite (cent vingt signes au plus), « Rester » remplace « Attendre »', () => {
  for (const [lang, words] of Object.entries(WORDS)) {
    const t = createI18n(lang).t;
    const refused = leaveQuestion({ t, app: 'Publipostage+', fault: new Error('Enregistrement refusé par Grist.') });
    assert.equal(refused.title, words.fault, lang);
    assert.equal(refused.cancelLabel, words.stay, lang);
    assert.ok(refused.message.includes('Enregistrement refusé par Grist.'), lang);
    const long = leaveQuestion({ t, app: 'Publipostage+', fault: new Error('x'.repeat(500)) });
    assert.ok(long.message.includes('x'.repeat(120)) && !long.message.includes('x'.repeat(121)), `${lang} : la phrase de l'app est coupée à 120 signes`);
    const blank = leaveQuestion({ t, app: 'Publipostage+', fault: new Error('') });
    assert.ok(blank.message.includes(words.unexpected), `${lang} : sans phrase, GFS dit « ${words.unexpected} »`);
  }
});
