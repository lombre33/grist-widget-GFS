// La fenêtre « Poids du document » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; lot 4 du poids, contrats 2.4 point 5).
// La vraie fenêtre (js/weight-window.js) et le vrai lecteur (js/weight-reader.js) s'ouvrent à la vraie souris, d'un clic sur le total du pied, sur une doublure de `Transfer.sql` (test/pages/explorateur.js,
// `window.__weight`) qui répond comme un serveur : 'ok' (dix-huit tables, dont une au nom très long et une que Grist coupe), 'refuse' (403 : pas le droit de tout copier) et 'muet' (le serveur ne répond
// pas). Ce que le vrai Grist rend se mesure dans un vrai Grist (labo/run-poids.mjs, passe 8). À mesurer : le total est un bouton au clavier ; la fenêtre dit l'estimation, ses cinq lignes et ses tables du plus
// lourd au plus léger, avec la raison de ce qu'elle n'a pas pu lire ; refusée, elle reste là, grisée, avec la raison ; elle tient dans la page, son titre et son bouton restent en place, seul le contenu défile,
// rien n'en sort ; le clavier est sur « Fermer », Tab reste dedans, Échap la ferme et le clavier revient sur le total ; la souris la rouvre et « Fermer » la ferme.
import { createI18n } from '../js/i18n.js';
import { formatBytes } from '../js/weight.js';
import { Run } from './corbeille-firefox.mjs';

// Les octets que la doublure répond (test/pages/explorateur.js) et ce qu'on en tire.
const FILE = 67108864;
const HISTORY = 18874368;
const STORED = 9437184;
const COUNTED = 7340032;
const LONG_BYTES = 9437184;
const TABLES = 18;
const DATA = 9437184 + 2621440 + 524288 + 1310720 + 40960 + 4096 + 8192 * (78 - 3); // les dix-sept tables lues (« Table_03 » est coupée)
const REST = FILE - (DATA + HISTORY + STORED);

function state() {
  const modal = document.querySelector('.mod.wd');
  const total = document.querySelector('.ex-total');
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const out = { total: { tag: total.tagName, tabIndex: total.tabIndex, popup: total.getAttribute('aria-haspopup'), title: total.title, focused: document.activeElement === total } };
  if (!modal) return { ...out, modal: null };
  const box = modal.getBoundingClientRect();
  const head = modal.querySelector('.mod-head').getBoundingClientRect();
  const foot = modal.querySelector('.mod-foot').getBoundingClientRect();
  const body = modal.querySelector('.wd-body');
  const active = document.activeElement;
  const sections = [...modal.querySelectorAll('.wd-sec')];
  const within = node => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); };
  out.modal = {
    title: text(modal.querySelector('.mod-head h2')), lead: [...modal.querySelectorAll('.wd-lead')].map(text), states: sections.map(section => section.dataset.state),
    message: text(modal.querySelector('.wd-state')), messageHidden: modal.querySelector('.wd-state').hidden, progress: text(modal.querySelector('.wd-progress')),
    lines: Object.fromEntries([...modal.querySelectorAll('.wd-line')].map(line => [line.className.replace('wd-line wd-', ''), text(line.querySelector('dd'))])),
    labels: [...modal.querySelectorAll('.wd-line dt')].map(text),
    rows: [...modal.querySelectorAll('.wd-row')].map(row => ({ name: text(row.querySelector('.wd-name')), value: text(row.querySelector('.wd-num')), state: row.dataset.state, width: row.querySelector('.wd-bar i').style.getPropertyValue('--w') })),
    focus: active && active.dataset ? active.dataset.fk || null : null, inside: modal.contains(active),
    inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1,
    sticky: head.bottom <= foot.top + 1 && foot.bottom <= box.bottom + 1 && head.top >= box.top - 1,
    outside: [...modal.querySelectorAll('.wd-body *, .mod-foot *, .mod-head *')].filter(within).map(node => node.className || node.tagName).slice(0, 5),
    scrolls: body.scrollHeight > body.clientHeight + 1, foot: text(modal.querySelector('.mod-note')),
  };
  return out;
}

export async function poidsFenetreProblems(page, language, tag) {
  const found = [];
  const { t } = createI18n(language);
  const locale = language === 'en' ? 'en-GB' : 'fr-FR';
  const show = bytes => formatBytes(bytes, locale, t);
  const run = new Run(page, tag, found, 'fenêtre « Poids du document »');
  const snap = () => page.run(state);
  const expect = async (kind, what, test) => {
    let now = await snap();
    for (let i = 0; i < 60 && !test(now); i += 1) { await new Promise(resolve => setTimeout(resolve, 75)); now = await snap(); }
    if (!test(now)) run.note(kind, `${what} (état : ${JSON.stringify(now).slice(0, 600)})`);
    return now;
  };
  const closed = s => s.modal === null;
  try {
    await run.reset();
    const start = await snap();
    if (start.total.tag !== 'BUTTON' || start.total.tabIndex < 0 || start.total.popup !== 'dialog') run.note('le total', `le total devait être un bouton au clavier qui ouvre une fenêtre (il est ${JSON.stringify(start.total)})`);
    if (!start.total.title.includes(t('weight.detailTip'))) run.note('le total', `l'infobulle du total devait dire « ${t('weight.detailTip')} » (elle dit « ${start.total.title} »)`);

    // 1. Le serveur répond : la souris ouvre la fenêtre sur le total, elle se remplit.
    await page.run(() => { window.__weightKind = 'ok'; });
    await run.clickSelector('.ex-total');
    const open = await expect('ouverture', 'la fenêtre devait s\'ouvrir à la souris, le clavier sur « Fermer »', s => s.modal && s.modal.focus === 'weight-close');
    const full = await expect('lecture', 'la lecture devait finir : « ok » partout, sans message ni progression', s => s.modal && s.modal.states.join() === 'ok,ok' && s.modal.messageHidden && s.modal.progress === '' && s.modal.rows.length === TABLES && s.modal.rows.every(row => row.state !== 'wait'));
    const modal = full.modal || open.modal;
    if (modal) {
      if (modal.title !== t('wd.title')) run.note('titre', `le titre devait être « ${t('wd.title')} » (il dit « ${modal.title} »)`);
      if (!modal.lead[0] || !modal.lead[0].includes(t('wd.estimate')) || !modal.lead[0].includes(show(18971940))) run.note('estimation', `l'estimation devait dire « ${t('wd.estimate')} » et ${show(18971940)} (elle dit « ${modal.lead[0]} »)`);
      const want = { file: show(FILE), data: show(DATA), attachments: `${show(STORED)} · ${t('wd.attachmentsCounted', { n: show(COUNTED) })}`, history: show(HISTORY), rest: show(REST) };
      for (const [key, value] of Object.entries(want)) if (modal.lines[key] !== value) run.note('lignes', `la ligne « ${key} » devait dire « ${value} » (elle dit « ${modal.lines[key]} »)`);
      if (modal.labels.join('|') !== ['wd.file', 'wd.data', 'wd.attachments', 'wd.history', 'wd.rest'].map(key => t(key)).join('|')) run.note('lignes', `les cinq lignes devaient être dans l'ordre fichier, tables, pièces jointes, historique, reste (${modal.labels.join(' | ')})`);
      const names = modal.rows.map(row => row.name);
      if (names[0] !== 'Publipostage_Modeles_Attestations_De_Formation_Fin_De_Session' || modal.rows[0].value !== show(LONG_BYTES)) run.note('tables', `la table la plus lourde devait venir en premier avec ${show(LONG_BYTES)} (${JSON.stringify(modal.rows[0])})`);
      if (modal.rows[0].width !== '100%') run.note('tables', `la barre de la plus lourde devait remplir sa colonne (${modal.rows[0].width})`);
      const cut = modal.rows.at(-1);
      if (cut.name !== 'Table_03' || cut.state !== 'slow' || cut.value !== t('wd.tableSlow')) run.note('tables', `la table que Grist coupe devait finir la liste en disant « ${t('wd.tableSlow')} » (${JSON.stringify(cut)})`);
      if (!modal.inPage) run.note('mise en page', 'la fenêtre devait tenir dans la page');
      if (!modal.sticky) run.note('mise en page', 'le titre et le bouton devaient rester en place (le titre au-dessus du contenu, le pied sous lui)');
      if (modal.outside.length) run.note('mise en page', `rien ne devait sortir de la fenêtre (sort : ${modal.outside.join(', ')})`);
      if (!modal.scrolls) run.note('mise en page', 'dix-huit tables devaient faire défiler le contenu, pas la fenêtre');
      if (modal.foot !== t('wd.foot')) run.note('pied', `le pied devait dire « ${t('wd.foot')} » (il dit « ${modal.foot} »)`);
    }
    // Tab reste dans la fenêtre ; Échap la ferme et rend le clavier au total ; la souris la rouvre, « Fermer » la ferme.
    for (let i = 0; i < 3; i += 1) { await page.press('Tab'); const inside = await snap(); if (!inside.modal || !inside.modal.inside) run.note('clavier', 'Tab devait rester dans la fenêtre'); }
    await page.press('Escape');
    await expect('clavier', 'Échap devait fermer la fenêtre et rendre le clavier au total', s => closed(s) && s.total.focused);
    await run.clickSelector('.ex-total');
    await expect('réouverture', 'la fenêtre devait se rouvrir', s => s.modal !== null);
    await run.clickSelector('[data-fk="weight-close"]');
    await expect('fermer', '« Fermer » devait fermer la fenêtre', closed);

    // 2. Le serveur refuse (pas le droit de tout copier) ou ne répond pas : la fenêtre reste, grisée, avec la raison ; l'estimation est là.
    for (const [kind, reason] of [['refuse', t('wd.denied')], ['muet', t('wd.failed', { reason: 'NetworkError when attempting to fetch resource.' })]]) {
      await page.run(name => { window.__weightKind = name; }, kind);
      await run.clickSelector('.ex-total');
      const grey = await expect(kind, 'la fenêtre devait se griser avec la raison', s => s.modal && s.modal.states.join() !== 'loading,loading' && s.modal.message === reason);
      if (grey.modal) {
        const expected = kind === 'refuse' ? 'denied,denied' : 'failed,failed';
        if (grey.modal.states.join() !== expected) run.note(kind, `les deux blocs devaient être « ${expected} » (${grey.modal.states.join()})`);
        if (Object.values(grey.modal.lines).some(value => value !== t('wd.none'))) run.note(kind, `les cinq lignes devaient rester là, en « ${t('wd.none')} » (${JSON.stringify(grey.modal.lines)})`);
        if (grey.modal.rows.length) run.note(kind, 'aucune table ne devait être listée sans lecture');
        if (!grey.modal.lead[0] || !grey.modal.lead[0].includes(show(18971940))) run.note(kind, 'l\'estimation devait rester dans la fenêtre');
        if (!grey.modal.inPage || !grey.modal.sticky || grey.modal.outside.length) run.note(kind, 'la fenêtre grisée devait tenir dans la page, titre et bouton en place');
      }
      await page.press('Escape');
      await expect(kind, 'Échap devait fermer la fenêtre', closed);
    }
  } catch (error) {
    run.note('geste impossible', String(error.message).slice(0, 200));
    await page.press('Escape').catch(() => {});
  }
  await page.run(() => { window.__weightKind = 'ok'; });
  await run.reset();
  return found;
}
