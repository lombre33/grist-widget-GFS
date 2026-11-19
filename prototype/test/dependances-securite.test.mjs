// La vue « Sécurité » de la fenêtre « Dépendances » (cahier 3.2.2) : ce que js/apps/dependencies-security.js tire du contrôle daté (bibliotheques/securite.json)
// et la phrase de chaque motif (js/apps/dependencies-security-view.js, js/i18n/i18n-security.js). La fenêtre elle-même se mesure sous Firefox
// (test/dependances-securite-firefox.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isReport, securityOf, carriedCheck } from '../js/apps/dependencies-security.js';
import { RULES } from '../js/apps/security-rules.js';
import { ROOT } from '../outils/bibliotheques.mjs';
import { SECURITY_STRINGS as TEXTS } from '../js/i18n/i18n-security.js';

const committed = JSON.parse(readFileSync(join(ROOT, 'bibliotheques/securite.json'), 'utf8'));
const app = (id, nom, installed) => ({ kind: 'app', id, ok: true, installed, manifest: { nom: { fr: nom, en: nom } } });
const modules = { items: [app('bi', 'Grist-BI', false), app('publipostage', 'Publipostage+', true), app('form', 'Form+', false), { kind: 'extension', id: 'x', ok: true }] };
const rule = (etat, motifs = []) => ({ etat, motifs });
const reportWith = apps => ({ contrat: 0, controle: '2026-11-18T05:00:00.000Z', origine: 'actions', apps });
const full = etat => Object.fromEntries(RULES.map(id => [id, rule(etat)]));

test('isReport : la forme du fichier, rien de plus ; un fichier qui ne l\'a pas se traite comme absent', () => {
  assert.equal(isReport(committed), true);
  for (const bad of [null, [], 'x', {}, { contrat: 1, controle: '2026-11-18', apps: {} }, { contrat: 0, controle: 'hier', apps: {} }, { contrat: 0, controle: '2026-11-18', apps: [] }]) {
    assert.equal(isReport(bad), false, JSON.stringify(bad));
  }
});

test('securityOf : sans fichier, rien ; avec, les apps installées d\'abord puis par nom, jamais une extension', () => {
  assert.equal(securityOf({ report: null, modules, lang: 'fr' }), null);
  const view = securityOf({ report: reportWith({}), modules, lang: 'fr' });
  assert.deepEqual(view.apps.map(each => each.id), ['publipostage', 'form', 'bi']);
  assert.equal(view.origine, 'actions');
});

test('securityOf : une app sans contrôle se dit « pas contrôlée », jamais « tenue » ; ses neuf règles se lisent une à une', () => {
  const view = securityOf({ report: reportWith({ publipostage: { reference: 'b32f450abc', regles: full('tenue') } }), modules, lang: 'fr' });
  const [checked, ...others] = view.apps;
  assert.equal(checked.checked, true);
  assert.equal(checked.reference, 'b32f450');
  assert.deepEqual(checked.rules.map(each => each.id), RULES);
  assert.equal(checked.policy, 'tenue');
  for (const other of others) { assert.equal(other.checked, false); assert.equal(other.policy, 'non-verifiable'); assert.deepEqual(other.rules, []); }
});

test('securityOf : le verdict de la politique est le pire de S1 à S4 ; les règles qui manquent ou ont un état inconnu sont non vérifiables ; problems compte les non tenues', () => {
  const regles = { ...full('tenue'), S3: rule('non-tenue', [{ code: 'appels-ouverts', gravite: 'non-tenue', directives: ['connect-src'] }]), S5: rule('magique'), S8: undefined };
  delete regles.S8;
  const view = securityOf({ report: reportWith({ publipostage: { regles }, bi: { regles: { ...full('tenue'), S9: rule('non-tenue') } } }), modules, lang: 'fr' });
  const pp = view.apps.find(each => each.id === 'publipostage');
  assert.equal(pp.policy, 'non-tenue');
  assert.equal(pp.rules.find(each => each.id === 'S5').etat, 'non-verifiable', 'état inconnu');
  assert.equal(pp.rules.find(each => each.id === 'S8').etat, 'non-verifiable', 'règle absente');
  assert.equal(pp.counts['non-tenue'], 1);
  assert.equal(view.apps.find(each => each.id === 'bi').policy, 'tenue', 'S9 ne compte pas dans la politique');
  assert.equal(view.problems, 2);
});

test('securityOf : l\'origine du jugement : GFS l\'a lu (S1 à S5, S7 à S9), l\'app le dit seule (S6), personne ne l\'a pu (non vérifiable)', () => {
  const regles = { ...full('tenue'), S7: rule('non-verifiable') };
  const view = securityOf({ report: reportWith({ publipostage: { regles, declaration: { S6: { texte: 'Rien ne sort sans geste.' } } } }), modules, lang: 'fr' });
  const rules = Object.fromEntries(view.apps[0].rules.map(each => [each.id, each]));
  assert.equal(rules.S1.source, 'gfs');
  assert.equal(rules.S6.source, 'declared');
  assert.equal(rules.S6.says.texte, 'Rien ne sort sans geste.');
  assert.equal(rules.S7.source, 'none');
});

test('securityOf : le site en ligne n\'est jamais supposé identique : non lu, identique ou différent avec son verdict', () => {
  const live = enLigne => securityOf({ report: reportWith({ publipostage: { regles: full('tenue'), enLigne } }), modules, lang: 'fr' }).apps[0].live;
  assert.deepEqual(live(undefined), { etat: 'non-lue' });
  assert.deepEqual(live({ lue: false }), { etat: 'non-lue' });
  assert.deepEqual(live({ lue: true, identique: true }), { etat: 'identique' });
  assert.deepEqual(live({ lue: true, identique: false, regles: { S1: rule('tenue'), S2: rule('non-tenue'), S3: rule('tenue'), S4: rule('tenue') } }), { etat: 'differe', verdict: 'non-tenue' });
});

test('carriedCheck : l\'adresse retrouvée, la dernière version et les avis, les empreintes de ce CDN ; null quand l\'app n\'a pas été lue', () => {
  const report = reportWith({ publipostage: { lecture: { page: true, code: false }, adressesTrouvees: ['cdnjs.cloudflare.com'], empreintesLe: '2026-11-17T05:00:00.000Z',
    bibliotheques: [{ id: 'pdfmake', paquet: 'pdfmake', version: '0.2.7', derniere: '0.3.14', avis: [] }],
    empreintes: [{ url: 'https://cdnjs.cloudflare.com/a.js', vu: '2026-11-10' }, { url: 'https://cdnjs.cloudflare.com/b.js', vu: '2026-11-17' }, { url: 'https://esm.sh/c.js', vu: '2026-11-12' }] } });
  const found = carriedCheck(report, { app: 'publipostage', id: 'pdfmake', host: 'cdnjs.cloudflare.com' });
  assert.equal(found.found, true);
  assert.equal(found.library.derniere, '0.3.14');
  assert.deepEqual(found.prints, { n: 2, since: '2026-11-17' });
  assert.equal(carriedCheck(report, { app: 'publipostage', id: 'zip', host: 'unpkg.com' }).found, false, 'adresse jamais vue dans la page');
  assert.equal(carriedCheck(report, { app: 'publipostage', id: 'zip', host: 'unpkg.com' }).library, null);
  assert.equal(carriedCheck(report, { app: 'bi', id: 'x', host: 'x.com' }), null, 'app absente du fichier');
  const unread = carriedCheck(reportWith({ bi: { lecture: { page: false, code: false } } }), { app: 'bi', id: 'x', host: 'x.com' });
  assert.equal(unread.found, null, 'page non lue : ni trouvée ni manquante');
});

test('le fichier commité se lit par la fenêtre : quatre apps, neuf règles chacune', () => {
  const real = { items: ['publipostage', 'automation', 'form', 'bi'].map(id => app(id, id, false)) };
  const view = securityOf({ report: committed, modules: real, lang: 'fr' });
  assert.equal(view.apps.length, 4);
  for (const each of view.apps) { assert.equal(each.checked, true, each.id); assert.equal(each.rules.length, 9); }
});

test('les textes : chaque état, chaque source, chaque règle et chaque code de motif du fichier ont leur phrase en français et en anglais', () => {
  const codes = new Set();
  for (const each of Object.values(committed.apps)) {
    for (const entry of Object.values(each.regles)) for (const motif of entry.motifs) codes.add(motif.code);
  }
  for (const lang of ['fr', 'en']) {
    const texts = TEXTS[lang];
    const need = ['tenue', 'a-noter', 'non-tenue', 'non-verifiable'].flatMap(state => [`sec.state.${state}`, `sec.state.low.${state}`])
      .concat(['gfs', 'declared', 'none'].map(source => `sec.source.${source}`), RULES.map(id => `sec.rule.${id}`), [...codes].map(code => `sec.m.${code}`));
    for (const key of need) assert.ok(texts[key], `${lang} : ${key}`);
  }
});
