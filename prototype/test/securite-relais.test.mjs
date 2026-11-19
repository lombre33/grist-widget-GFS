// Le relais des appels bloqués (contrats 5.4, point 14 ; cahier 3.2.2, S8) côté GFS : ce que `js/broker/security-relay.js` garde de ce qu'une app dit, et ce que la fenêtre en tire (js/apps/
// dependencies-security.js). L'app est tenue pour non fiable : chaque champ est réduit à une forme fermée, rien n'est cru. Ce que le navigateur lève dans un vrai cadre d'app et ce que GFS en reçoit se
// mesurent dans un vrai Grist (labo/run-securite-relais.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SecurityRelay, readViolation, MAX_ALERTS, MAX_NOTICES, MAX_TIMES } from '../js/broker/security-relay.js';
import { securityOf } from '../js/apps/dependencies-security.js';
import { EnvelopePeer } from '../js/broker/envelope.js';
import { createI18n } from '../js/i18n/i18n.js';

function relay() {
  let tick = 0;
  const notices = [];
  const host = { appName: id => `App ${id}`, t: (key, vars) => `${key}:${JSON.stringify(vars)}`, notice: text => notices.push(text), now: () => new Date(Date.UTC(2026, 10, 18, 10, 0, tick++)) };
  return { relay: new SecurityRelay(host), notices };
}
const violation = (fields = {}) => ({ quoi: 'bloque', directive: 'connect-src', cible: 'evil.example', source: 'esm.sh', disposition: 'enforce', fois: 1, ...fields });

test('une violation est réduite à une forme fermée : directive connue, mot du navigateur ou nom d\'hôte, compte plafonné', () => {
  assert.deepEqual(readViolation(violation()), { directive: 'connect-src', cible: 'evil.example', source: 'esm.sh', disposition: 'enforce', fois: 1 });
  assert.equal(readViolation(violation({ directive: 'plugin-types' })).directive, 'autre');
  assert.equal(readViolation(violation({ directive: '<script>alert(1)</script>' })).directive, 'autre');
  for (const cible of ['inline', 'eval', 'data', 'blob', 'self']) assert.equal(readViolation(violation({ cible })).cible, cible);
  for (const cible of ['https://evil.example/steal?t=SECRET', 'evil.example/x', '<img src=x>', 'a b', '', 'é.example', 'x'.repeat(200), 42, null, {}, ['a']]) {
    assert.equal(readViolation(violation({ cible })).cible, 'autre', String(cible));
  }
  for (const source of ['app', 'inconnue', 'autre', 'cdnjs.cloudflare.com']) assert.equal(readViolation(violation({ source })).source, source);
  assert.equal(readViolation(violation({ source: 'https://x/y' })).source, 'autre');
  assert.equal(readViolation(violation({ disposition: 'report' })).disposition, 'report');
  assert.equal(readViolation(violation({ disposition: '<b>' })).disposition, 'enforce');
  assert.equal(readViolation(violation({ fois: 10 ** 9 })).fois, MAX_TIMES);
  for (const fois of [0, -4, 2.5, 'beaucoup', null, undefined]) assert.equal(readViolation(violation({ fois })).fois, 1, String(fois));
});

test('l\'app dit « relais » : GFS le note pour la session avec la version du kit, lue avec méfiance', () => {
  const { relay: seen } = relay();
  seen.receive('pp', { quoi: 'relais', kit: '0.25.0' });
  seen.receive('bi', { quoi: 'relais', kit: '<script>' });
  assert.equal(seen.snapshot().relays.pp.kit, '0.25.0');
  assert.equal(seen.snapshot().relays.bi.kit, null);
  assert.deepEqual(seen.snapshot().alerts, []);
});

test('une violation est gardée avec son compte ; la même ne fait pas une deuxième ligne ; la plus récente passe devant', () => {
  const { relay: seen } = relay();
  seen.receive('pp', violation());
  seen.receive('pp', violation({ fois: 10 }));
  seen.receive('pp', violation({ fois: 3 }));
  seen.receive('bi', violation({ cible: 'other.example' }));
  const { alerts } = seen.snapshot();
  assert.equal(alerts.length, 2);
  assert.deepEqual(alerts.map(alert => alert.cible).sort(), ['evil.example', 'other.example']);
  const first = alerts.find(alert => alert.app === 'pp');
  assert.equal(first.times, 10, 'le compte ne recule pas');
  assert.ok(first.last > first.first, 'la dernière fois suit la première');
  assert.equal(alerts[0].app, 'bi', 'la plus récente passe devant (le message de bi est le dernier)');
});

test('un code piraté ne peut pas noyer GFS : 50 alertes différentes par app, trois avis à la personne par app, rien pour un signalement sans blocage', () => {
  const { relay: seen, notices } = relay();
  for (let i = 0; i < MAX_ALERTS + 20; i += 1) seen.receive('pp', violation({ cible: `h${i}.example` }));
  assert.equal(seen.snapshot().alerts.length, MAX_ALERTS);
  assert.equal(notices.length, MAX_NOTICES);
  seen.receive('bi', violation({ disposition: 'report' }));
  assert.equal(notices.length, MAX_NOTICES, 'une simple remontée (report) n\'avertit pas la personne');
  seen.receive('bi', violation({ cible: 'x.example' }));
  assert.equal(notices.length, MAX_NOTICES + 1, 'une autre app a ses propres trois avis');
  assert.match(notices.at(-1), /sec\.alert\.notice.*App bi.*connect-src.*"target":"x\.example"/);
});

test('ce qui n\'est pas un message de relais est ignoré : pas un objet, `quoi` inconnu ou absent', () => {
  const { relay: seen, notices } = relay();
  for (const args of [null, undefined, 'x', 42, [], {}, { quoi: 'autre' }, { quoi: 'BLOQUE' }, { directive: 'connect-src' }]) seen.receive('pp', args);
  assert.deepEqual(seen.snapshot(), { relays: {}, alerts: [] });
  assert.deepEqual(notices, []);
});

test('par l\'enveloppe : l\'appel `securite` n\'a pas de réponse, et un refus n\'apprend rien à l\'app', async () => {
  const { relay: seen } = relay();
  const sent = [];
  const peer = new EnvelopePeer({ send: msg => sent.push(msg), handlers: seen.handlers({ id: 'pp' }) });
  peer.receive({ gfs: 0, type: 'appel', nom: 'securite', args: { quoi: 'relais', kit: '0.25.0' } });
  peer.receive({ gfs: 0, type: 'appel', id: 4, nom: 'securite', args: violation() });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(seen.snapshot().alerts.length, 1);
  assert.equal(seen.snapshot().relays.pp.kit, '0.25.0');
  assert.deepEqual(sent.map(msg => msg.type), ['reponse'], 'sans id, aucune réponse ; avec un id, une réponse vide');
  assert.equal(sent[0].data, null);
});

// ---------- ce que la fenêtre en tire ----------
const app = (id, nom, installed) => ({ kind: 'app', id, ok: true, installed, manifest: { nom: { fr: nom, en: nom } } });
const modules = { items: [app('pp', 'Publipostage+', true), app('bi', 'Grist-BI', false)] };
const report = { contrat: 0, controle: '2026-11-18T05:00:00.000Z', origine: 'actions', apps: {} };
const seenBy = () => { const { relay: seen } = relay(); seen.receive('pp', { quoi: 'relais', kit: '0.25.0' }); seen.receive('pp', violation()); seen.receive('zz', violation({ cible: 'inline' })); return seen.snapshot(); };

test('securityOf : les alertes de la session ont le nom de leur app, le relais est dans l\'app qui l\'a dit, `attention` compte tout', () => {
  const view = securityOf({ report: { ...report, apps: { pp: { regles: { S1: { etat: 'non-tenue', motifs: [] } } } } }, modules, lang: 'fr', relay: seenBy() });
  assert.deepEqual(view.alerts.map(alert => [alert.app, alert.name]).sort(), [['pp', 'Publipostage+'], ['zz', 'zz']], 'une app inconnue se nomme par son identifiant');
  assert.equal(view.apps.find(each => each.id === 'pp').relay.kit, '0.25.0');
  assert.equal(view.apps.find(each => each.id === 'bi').relay, null);
  assert.equal(view.problems, 1);
  assert.equal(view.attention, 3, 'une règle non tenue et deux alertes');
});

test('securityOf : sans fichier de contrôle, les alertes se montrent quand même ; sans fichier ni alerte, rien', () => {
  const view = securityOf({ report: null, modules, lang: 'fr', relay: seenBy() });
  assert.equal(view.controle, null);
  assert.deepEqual(view.apps, []);
  assert.equal(view.alerts.length, 2);
  assert.equal(securityOf({ report: null, modules, lang: 'fr', relay: { relays: {}, alerts: [] } }), null);
  assert.equal(securityOf({ report: null, modules, lang: 'fr' }), null);
  assert.equal(securityOf({ report, modules, lang: 'fr', relay: 'n\'importe quoi' }).alerts.length, 0, 'un relais mal formé ne fait rien');
});

test('l\'avis à la personne, avec les vrais textes : l\'app, la directive et la cible en mots, aucun modèle de phrase laissé tel quel', () => {
  for (const lang of ['fr', 'en']) {
    const { t } = createI18n(lang);
    const notices = [];
    const seen = new SecurityRelay({ appName: id => `App ${id}`, t, notice: text => notices.push(text), now: () => new Date(0) });
    seen.receive('pp', violation({ cible: 'evil.example' }));
    seen.receive('pp', violation({ cible: 'inline', directive: 'script-src-elem' }));
    seen.receive('pp', violation({ cible: '<x>', directive: 'img-src' }));
    assert.equal(notices.length, 3);
    for (const notice of notices) assert.doesNotMatch(notice, /[{}]|undefined|sec\.alert/, `${lang} : ${notice}`);
    assert.match(notices[0], /App pp.*connect-src.*evil\.example/);
    assert.match(notices[1], lang === 'fr' ? /du code écrit dans la page/ : /code written in the page/);
    assert.match(notices[2], lang === 'fr' ? /une adresse que GFS n’a pas pu lire/ : /an address GFS could not read/);
  }
});

test('les textes des alertes sont dans les deux langues, sans clé orpheline', () => {
  for (const lang of ['fr', 'en']) {
    const { t } = createI18n(lang);
    for (const key of ['sec.alerts.title', 'sec.alerts.none', 'sec.alert.chip', 'sec.alert.kw.autre', 'sec.alert.kw.eval', 'sec.relay.off', 'sec.intro.none']) assert.notEqual(t(key), key, `${lang} : ${key}`);
    assert.match(t('sec.alert.times', { n: 1, time: '10:00' }), lang === 'fr' ? /1 fois/ : /1 time,/);
    assert.match(t('sec.alert.notice', { app: 'PP', directive: 'connect-src', target: 'evil.example' }), /PP/);
  }
});
