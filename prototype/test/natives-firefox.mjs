// Le choix « CDN ou copie figée » des bibliothèques natives d'une app, dans la fenêtre « Apps et extensions », sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à
// test/interfaces-firefox.test.mjs ; demande du porteur du 10/11, contrats 2.6 point 14). La vraie fenêtre, le vrai modèle et le vrai catalogue de GFS, sur le manifeste de Publipostage+ à qui la page
// d'essai donne quatre fonctions (`window.__natives`, test/pages/explorateur.js) ; la vraie souris et le vrai clavier. À mesurer : le choix de toutes les fonctions ; le détail se déplie à la
// souris, reste déplié après un choix et tient dans la fenêtre (rien ne déborde, rien ne se superpose) ; le choix d'une fonction la met en copie figée et le choix de toutes dit « mélange » ;
// le raccourci « toutes » met toutes les fonctions du même côté ; le clavier (flèche) choisit comme la souris et le clavier reste là où il était ; une copie qui manque est grisée avec sa raison
// (un clic dessus ne fait rien) ; la fenêtre en lecture seule grise tout.
import { createI18n } from '../js/i18n/i18n.js';

function state() {
  const modal = document.querySelector('.mod-scrim .mod');
  if (!modal) return null;
  const body = modal.querySelector('.mod-body');
  const box = (node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
  const app = modal.querySelector('.mr--app');
  const natives = app && app.querySelector('.mr-natives');
  if (!natives) return null;
  const details = app.querySelector('details');
  return {
    legend: natives.querySelector('legend').textContent.replace(/\s+/g, ' ').trim(),
    open: Boolean(details && details.open),
    radios: [...app.querySelectorAll('input[type=radio]')].map(input => ({ key: input.dataset.fk, checked: input.checked, disabled: input.disabled })),
    rows: [...app.querySelectorAll('.mr-lib')].map(row => ({ name: row.querySelector('.mr-lib-name').textContent, overflow: row.scrollWidth - row.clientWidth, box: box(row), warn: (row.querySelector('.mr-warn') || {}).textContent || null, note: (row.querySelector('.mr-note') || {}).textContent || null })),
    bodyOverflow: body.scrollWidth - body.clientWidth,
    window: box(modal),
    summary: details ? box(details.querySelector('summary')) : null,
    focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null,
    events: window.__nativeEvents,
  };
}

// Le centre, en pixels de la page, du libellé d'un choix (une fois amené dans la fenêtre) : le clic s'y fait à la vraie souris.
function centerOf(selector) {
  const input = document.querySelector(selector);
  if (!input) return null;
  input.scrollIntoView({ block: 'center' });
  const r = input.closest('label, summary').getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

const ALL = value => `.mr--app input[data-native-all][value="${value}"]`;
const ROW = (group, value) => `.mr--app input[data-native-for="${group}"][value="${value}"]`;
const SUMMARY = '.mr--app details summary';

// Le choix « Depuis un CDN » ou « Copie de GFS » de l'édition collaborative, et la phrase qui dit que Publipostage+ ne nomme pas encore l'adresse du CDN (contrats 2.6 point 15, carte du 13/11).
function modeState(want) {
  const radio = value => document.querySelector(`input[data-mode-for="edition"][value="${value}"]`);
  const cdn = radio('cdn');
  if (!cdn || (want && !radio(want).checked)) return null;
  const fieldset = cdn.closest('fieldset');
  const warn = fieldset.querySelector('.mr-mode-warn');
  if (warn) warn.scrollIntoView({ block: 'nearest' });
  const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
  const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const light = ([r, g, b]) => { const f = c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  let contrast = null;
  if (warn) {
    const back = light(rgb(getComputedStyle(fieldset).backgroundColor));
    const front = light(rgb(getComputedStyle(warn).color));
    contrast = (Math.max(back, front) + 0.05) / (Math.min(back, front) + 0.05);
  }
  const options = [...fieldset.querySelectorAll('label.rd')];
  const hint = value => radio(value).closest('label').querySelector('.rd-hint').textContent.trim();
  return {
    hints: { cdn: hint('cdn'), vendorise: hint('vendorise') },
    cdn: cdn.checked, vendorise: radio('vendorise').checked, cdnDisabled: cdn.disabled, vendoriseDisabled: radio('vendorise').disabled,
    warn: warn ? warn.textContent.trim() : null, warnBox: warn ? box(warn) : null, warnOverflow: warn ? warn.scrollWidth - warn.clientWidth : 0, contrast,
    fieldset: box(fieldset), optionsBottom: Math.max(...options.map(option => box(option).bottom)), window: box(document.querySelector('.mod-scrim .mod')),
    bodyOverflow: document.querySelector('.mod-body').scrollWidth - document.querySelector('.mod-body').clientWidth, events: window.__modeEvents,
  };
}

export async function nativesProblems(page, language, tag) {
  const found = [];
  const { t } = createI18n(language);
  const note = (kind, text) => found.push({ kind: `bibliothèques natives : ${kind}`, text: `${tag} : ${text}` });
  const click = async (selector) => {
    const at = await page.run(centerOf, selector);
    if (!at) { note('choix absent', `${selector} n'existe pas`); return; }
    await page.click(...at);
    await page.run(() => new Promise(resolve => setTimeout(resolve, 120)));
  };
  const checked = (s, key) => (s.radios.find(radio => radio.key === key) || {}).checked;
  const open = async (variant) => {
    await page.run(variant => window.__natives(variant), variant);
    return page.until(state);
  };
  const close = async () => { await page.press('Escape'); await page.until(() => !document.querySelector('.mod-scrim'), [], 2000).catch(async () => { await page.press('Escape'); }); };

  let s = await open('ok');
  if (!s.legend.startsWith(t('mod.native.title')) || s.legend.includes(t('mod.native.mixed'))) note('légende', `« ${s.legend} » devrait nommer les bibliothèques de l'app, sans « mélange »`);
  if (s.open || !checked(s, 'nativeall:publipostage/cdn') || checked(s, 'nativeall:publipostage/vendorise')) note('départ', 'au départ le détail est replié et le choix de toutes est le CDN');

  await click(SUMMARY);
  s = await page.run(state);
  if (!s.open || s.rows.length !== 4) note('détail', `le détail ne se déplie pas à la souris (${s.rows.length} lignes au lieu de 4)`);
  if (s.bodyOverflow > 1) note('débordement', `la liste déborde la fenêtre de ${s.bodyOverflow} px`);
  s.rows.forEach((row, index) => {
    if (row.overflow > 1) note('ligne coupée', `« ${row.name} » déborde de ${row.overflow} px`);
    if (row.box.left < s.window.left || row.box.right > s.window.right) note('ligne hors de la fenêtre', `« ${row.name} » sort de la fenêtre`);
    if (index && row.box.top < s.rows[index - 1].box.bottom - 1) note('lignes superposées', `« ${row.name} » recouvre la ligne qui la précède`);
  });

  await click(ROW('word', 'vendorise'));
  s = await page.run(state);
  if (JSON.stringify(s.events) !== JSON.stringify([['publipostage', 'word', 'vendorise']])) note('choix d\'une fonction', `la souris sur « copie figée » de Word a envoyé ${JSON.stringify(s.events)}`);
  if (!checked(s, 'native:publipostage/word/vendorise') || checked(s, 'native:publipostage/word/cdn')) note('choix d\'une fonction', 'la ligne Word ne montre pas la copie figée choisie');
  if (!s.legend.includes(t('mod.native.mixed')) || checked(s, 'nativeall:publipostage/cdn') || checked(s, 'nativeall:publipostage/vendorise')) note('mélange', `fonctions différentes : la légende dit « ${s.legend} » et le choix de toutes devrait être vide`);
  if (!s.open) note('détail replié', 'le détail s\'est replié après un choix');
  if (s.focused !== 'native:publipostage/word/vendorise') note('clavier', `le clavier est sur ${s.focused} au lieu de la case cliquée`);

  await click(ALL('vendorise'));
  s = await page.run(state);
  if (JSON.stringify(s.events[s.events.length - 1]) !== JSON.stringify(['publipostage', null, 'vendorise'])) note('toutes', `le raccourci a envoyé ${JSON.stringify(s.events[s.events.length - 1])}`);
  if (!['pdf', 'word', 'excel', 'divers'].every(group => checked(s, `native:publipostage/${group}/vendorise`)) || !checked(s, 'nativeall:publipostage/vendorise') || s.legend.includes(t('mod.native.mixed'))) note('toutes', 'le raccourci ne met pas toutes les fonctions en copie figée');

  await click(ALL('cdn'));
  await page.press('ArrowRight');
  s = await page.run(state);
  if (JSON.stringify(s.events.slice(-2)) !== JSON.stringify([['publipostage', null, 'cdn'], ['publipostage', null, 'vendorise']])) note('clavier', `la flèche droite sur « CDN » devait choisir « copie figée » : ${JSON.stringify(s.events.slice(-2))}`);
  if (!checked(s, 'nativeall:publipostage/vendorise')) note('clavier', 'la flèche ne laisse pas la copie figée choisie');
  await close();

  s = await open('manque');
  await click(SUMMARY);
  s = await page.run(state);
  const pdf = s.rows.find(row => row.name.startsWith('Export PDF') || row.name.startsWith('PDF export'));
  const radio = (s.radios.find(item => item.key === 'native:publipostage/pdf/vendorise') || {});
  if (!radio.disabled || !pdf || !/9\.9\.9/.test(pdf.warn || '')) note('copie manquante', `la copie figée du PDF devrait être grisée avec sa raison (grisée : ${radio.disabled}, raison : ${pdf && pdf.warn})`);
  if (!(s.radios.find(item => item.key === 'nativeall:publipostage/vendorise') || {}).disabled) note('copie manquante', 'le choix de toutes en copie figée devrait être grisé tant qu\'une copie manque');
  const before = s.events.length;
  await click(ROW('pdf', 'vendorise'));
  s = await page.run(state);
  if (s.events.length !== before) note('copie manquante', 'un clic sur une copie grisée a quand même envoyé un choix');
  await close();

  s = await open('editeur');
  await click(SUMMARY);
  s = await page.run(state);
  const editor = s.rows.find(row => /^(Éditeur|Editor)/.test(row.name));
  if (s.rows.length !== 5 || !editor || s.rows[0] !== editor) note('éditeur', `l'éditeur devrait être la première des cinq fonctions (${s.rows.length} lignes)`);
  else {
    if (editor.note !== t('mod.native.restart') || editor.warn) note('éditeur', `la ligne devrait dire que le choix prend effet au démarrage de l'app (note : ${editor.note}, grisé : ${editor.warn})`);
    if (s.rows.some(row => row !== editor && row.note)) note('éditeur', 'seule la ligne de l\'éditeur dit que le choix attend le démarrage de l\'app');
    if (editor.overflow > 1 || s.bodyOverflow > 1 || editor.box.left < s.window.left || editor.box.right > s.window.right) note('éditeur', 'la ligne de l\'éditeur déborde de la fenêtre');
  }
  const editorRadio = s.radios.find(item => item.key === 'native:publipostage/editeur/vendorise') || {};
  if (editorRadio.disabled !== false) note('éditeur', 'la copie figée de l\'éditeur ne doit jamais être grisée : GFS n\'a rien à y vérifier');
  await click(ROW('editeur', 'vendorise'));
  s = await page.run(state);
  if (JSON.stringify(s.events) !== JSON.stringify([['publipostage', 'editeur', 'vendorise']])) note('éditeur', `la souris sur « copie figée » de l'éditeur a envoyé ${JSON.stringify(s.events)}`);
  if (!checked(s, 'native:publipostage/editeur/vendorise') || !s.legend.includes(t('mod.native.mixed'))) note('éditeur', 'la ligne de l\'éditeur ne montre pas la copie figée choisie, ou la légende ne dit pas « mélange »');
  await close();

  // L'édition collaborative cochée, au défaut : « Copie de GFS » est choisie (Publipostage+ ne nomme pas encore l'adresse du CDN), sans phrase ; « Depuis un CDN » reste libre et, une fois choisi
  // à la souris, la phrase dit que le navigateur le refuse ; la copie la fait disparaître.
  await open('direct');
  let m = await page.until(modeState);
  const noteMode = text => note('mode de l\'édition collaborative', text);
  if (!m.vendorise || m.cdn || m.cdnDisabled || m.vendoriseDisabled) noteMode(`au départ « Copie de GFS » devrait être choisie, et les deux choix libres (CDN ${m.cdn}/${m.cdnDisabled}, copie ${m.vendorise}/${m.vendoriseDisabled})`);
  if (m.warn !== null) noteMode(`tant que le CDN n'est pas choisi, la phrase ne devrait pas être là : « ${m.warn} »`);
  if (m.hints.vendorise !== t('mod.mode.vendoriseHint') || m.hints.cdn !== t('mod.mode.cdnPlain')) noteMode(`seule la copie devrait dire « Par défaut » (copie : « ${m.hints.vendorise} », CDN : « ${m.hints.cdn} »)`);
  const modeAt = async value => page.run(centerOf, `input[data-mode-for="edition"][value="${value}"]`);
  await page.click(...await modeAt('cdn'));
  m = await page.until(modeState, ['cdn']);
  if (!m.cdn || m.vendorise) noteMode('à la souris sur « Depuis un CDN », le CDN devrait être choisi');
  if (JSON.stringify(m.events) !== JSON.stringify([['publipostage', 'edition', 'cdn']])) noteMode(`la souris sur « Depuis un CDN » a envoyé ${JSON.stringify(m.events)}`);
  if (m.warn !== t('mod.mode.cdnRefused')) noteMode(`la phrase sous le CDN devrait être « ${t('mod.mode.cdnRefused')} » : « ${m.warn} »`);
  else {
    if (m.warnOverflow > 1 || m.bodyOverflow > 1) noteMode(`la phrase ou la liste déborde (${m.warnOverflow} px, ${m.bodyOverflow} px)`);
    if (m.warnBox.left < m.fieldset.left - 1 || m.warnBox.right > m.fieldset.right + 1 || m.warnBox.bottom > m.fieldset.bottom + 1) noteMode('la phrase sort du cadre des deux choix');
    if (m.warnBox.top < m.optionsBottom - 1) noteMode('la phrase recouvre les deux choix');
    if (m.warnBox.left < m.window.left || m.warnBox.right > m.window.right) noteMode('la phrase sort de la fenêtre');
    if (m.contrast < 4.5) noteMode(`la phrase est trop pâle (contraste ${m.contrast.toFixed(2)}, 4,5 attendu)`);
  }
  await page.click(...await modeAt('vendorise'));
  m = await page.until(modeState, ['vendorise']);
  if (!m.vendorise || m.cdn || m.warn !== null) noteMode(`à la souris sur « Copie de GFS », la copie devrait être choisie et la phrase partir (copie ${m.vendorise}, phrase ${m.warn})`);
  if (JSON.stringify(m.events) !== JSON.stringify([['publipostage', 'edition', 'cdn'], ['publipostage', 'edition', 'vendorise']])) noteMode(`les deux clics ont envoyé ${JSON.stringify(m.events)}`);
  await close();

  s = await open('lecture');
  if (!s.radios.length || s.radios.some(item => !item.disabled)) note('lecture seule', 'en lecture seule, tous les choix devraient être grisés');
  await close();
  return found;
}
