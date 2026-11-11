// Le choix « CDN ou copie figée » des bibliothèques natives d'une app, dans la fenêtre « Apps et extensions », sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à
// test/interfaces-firefox.test.mjs ; demande du porteur du 10/11, contrats 2.6 point 14). La vraie fenêtre, le vrai modèle et le vrai catalogue de GFS, sur le manifeste de Publipostage+ à qui la page
// d'essai donne quatre fonctions (`window.__natives`, test/pages/explorateur.js) ; la vraie souris et le vrai clavier. À mesurer : le choix de toutes les fonctions ; le détail se déplie à la
// souris, reste déplié après un choix et tient dans la fenêtre (rien ne déborde, rien ne se superpose) ; le choix d'une fonction la met en copie figée et le choix de toutes dit « mélange » ;
// le raccourci « toutes » met toutes les fonctions du même côté ; le clavier (flèche) choisit comme la souris et le clavier reste là où il était ; une copie qui manque est grisée avec sa raison
// (un clic dessus ne fait rien) ; la fenêtre en lecture seule grise tout.
import { createI18n } from '../js/i18n.js';

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

  s = await open('lecture');
  if (!s.radios.length || s.radios.some(item => !item.disabled)) note('lecture seule', 'en lecture seule, tous les choix devraient être grisés');
  await close();
  return found;
}
