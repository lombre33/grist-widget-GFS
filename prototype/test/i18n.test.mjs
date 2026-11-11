// Les textes : même lot en français et en anglais, pluriels par {n|singulier|pluriel}.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createI18n, STRING_TABLES } from '../js/i18n/i18n.js';

test('chaque texte existe en français et en anglais, avec les mêmes variables', () => {
  const fr = Object.keys(STRING_TABLES.fr);
  const en = Object.keys(STRING_TABLES.en);
  assert.deepEqual(fr.filter(k => !en.includes(k)), [], 'absents en anglais');
  assert.deepEqual(en.filter(k => !fr.includes(k)), [], 'absents en français');
  const vars = text => [...new Set([...text.matchAll(/\{(\w+)[|}]/g)].map(m => m[1]))].sort().join(',');
  for (const key of fr) assert.equal(vars(STRING_TABLES.fr[key]), vars(STRING_TABLES.en[key]), key);
});

test('pluriels : zéro et un sont au singulier en français, un seul l\'est en anglais', () => {
  const fr = createI18n('fr').t;
  const en = createI18n('en').t;
  assert.equal(fr('ex.fileCount', { n: 0 }), '0 fichier');
  assert.equal(fr('ex.fileCount', { n: 1 }), '1 fichier');
  assert.equal(fr('ex.fileCount', { n: 3 }), '3 fichiers');
  assert.equal(en('ex.fileCount', { n: 0 }), '0 files');
  assert.equal(en('ex.fileCount', { n: 1 }), '1 file');
});

test('variables, texte inconnu et langue inconnue', () => {
  const { t, lang } = createI18n('de');
  assert.equal(lang, 'fr');
  assert.equal(t('gfs.loading', { app: 'Publipostage+' }), 'Publipostage+ se charge…');
  const warnings = [];
  const original = console.warn;
  console.warn = message => warnings.push(message);
  try { assert.equal(t('absent.cle'), 'absent.cle'); t('absent.cle'); } finally { console.warn = original; }
  assert.equal(warnings.length, 1, 'un seul avertissement par texte inconnu');
});

test('le français parle de « modèle », jamais de « template »', () => {
  for (const [key, text] of Object.entries(STRING_TABLES.fr)) assert.doesNotMatch(text, /template/i, key);
});

// Décision du porteur du 09/11 (« Vous partout ») : les textes français de GFS vouvoient, comme les apps et le guide des apps.
// L'anglais ne change pas. Un texte à la 3e personne qui décrit un geste (« Retire les règles… ») n'est pas un impératif :
// il est listé ici, avec sa raison, pour que tout autre tutoiement soit refusé.
const TROISIEME_PERSONNE = new Set([
  'weight.pjTip', 'rights.link.protected', 'rights.act.remove.hint', 'rights.act.sharing.hint', 'rights.act.unsharing.hint',
  'theme.acces.tip', 'gfs.needsFullAccessHint', 'mod.needsApp', 'ex.lockedApp', 'ex.lockedExtension',
  'copy.done', 'copy.doneIn', 'so.level.live', 'so.level.stop.hint', 'mod.mode.vendorise',
  'mod.native.copy', 'mod.native.missing', 'so.tab.none.folder', // le nom « copie » (« Copie figée », « Copie indisponible : … », le niveau « Copie à jour »), pas l'impératif de « copier »
]);
const PRONOM_TU = /(^|[^\p{L}])(?:(?:tu|toi|ton|ta|tes|te|tien|tiens|tienne|tiennes)(?![\p{L}])|t[’'](?=\p{L}))/iu;
const IMPERATIF_TU = /(^|[.:;!?«»(—–]\s*|\s-\s|,\sn[’'])(?:n[’'])?(?:double-)?(ajoute|attends|choisis|clique|colle|copie|demande|ouvre|recharge|réessaie|sélectionne|essaie|vérifie|garde|tape|écris|lis|retire|dépose|glisse|donne|réponds|fais|passe|enregistre|regarde|prends|mets|va|reviens|coche|décoche|saisis|entre|indique|nomme|renomme|déplace|supprime|crée|change|trouve|utilise|appuie|laisse|continue|annule|valide|confirme|accepte|refuse|relis|reprends|commence|termine|ferme|lance|teste|connecte|autorise|accorde|envoie|reçois|transmets|invite|partage|active|désactive|cherche|note|patiente|contacte|consulte|affine|relie|importe|télécharge|range|compare|recommence)\b/iu;
const FORME_TU = /\b(peux|veux|dois|sais|vas|verras|pourras|devras|auras|seras|as-tu|es-tu)\b|\b\p{L}+(?:e|s)-(?:le|la|les|en|y|moi|toi|lui|leur)\b/iu;

test('le français de GFS vouvoie : ni « tu », « ton », « t’ », ni impératif à la 2e personne du singulier', () => {
  const fautes = [];
  for (const [key, text] of Object.entries(STRING_TABLES.fr)) {
    if (PRONOM_TU.test(text) || FORME_TU.test(text)) fautes.push(`${key} : ${text}`);
    else if (IMPERATIF_TU.test(text) && !TROISIEME_PERSONNE.has(key)) fautes.push(`${key} : ${text}`);
  }
  assert.deepEqual(fautes, [], 'textes encore au tutoiement');
  assert.ok(Object.values(STRING_TABLES.fr).filter(text => /\b(vous|votre|vos)\b/iu.test(text)).length >= 30, 'le vouvoiement est bien présent');
});

test('la liste des textes à la 3e personne ne garde que des clés qui existent', () => {
  for (const key of TROISIEME_PERSONNE) assert.ok(key in STRING_TABLES.fr, key);
});
