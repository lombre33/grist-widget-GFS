// La fenêtre de mise à jour des noms de GFS : celle du kit (js/names-update/window.js, mêmes textes `kit.names.*`, même déroulé) posée sur la base commune des
// fenêtres du widget (js/ui/modal.js), car GFS tient ses fenêtres sur une seule base. BLOQUANTE : ni « Annuler » ni Échap avant que la mise à jour soit faite
// ou refusée ; elle ne s'ouvre que pour qui peut la faire (le kit, `prepare`, l'a décidé avant) et dit ce qu'elle fait : les données ne changent pas, seuls les
// noms. Après un refus, « Continuer sans mettre à jour » rend la main : GFS ne crée alors rien et n'écrit rien dans le document (js/files/own-table.js).
//   showNamesWindow({ container, inertTargets, t, appName, prepared, run }) -> Promise<{ state: 'done' | 'already' | 'blocked' | 'skipped', result }>
//     t : le traducteur des textes `kit.names.*` ; prepared : ce que `prepare` a rendu (état « ready ») ; run : () => Promise<résultat de `execute`>.

import { h } from './dom.js';
import { openModal } from './modal.js';

const MAX_PAIRS = 5;
const paragraph = (text, className = '') => h('p', { class: `names-text ${className}`.trim() }, text);

// Ce que la fenêtre dit avant le clic, le plus important en haut : rien n'est perdu, c'est l'affaire de quelques secondes, ce qui change pour la personne ;
// puis, sous un titre qu'on ouvre, la liste des noms (les cinq premières paires, le reste en un mot).
function introduction(t, appName, prepared) {
  const { tables, columns } = prepared.summary;
  const pairs = tables.slice(0, MAX_PAIRS).map(([from, to]) => h('li', {}, h('code', {}, from), ` ${t('kit.names.becomes')} `, h('code', {}, to)));
  if (tables.length > MAX_PAIRS) pairs.push(h('li', {}, t('kit.names.more', { n: tables.length - MAX_PAIRS })));
  const heading = t('kit.names.list', { tables: tables.length, columns });
  return [
    paragraph(t('kit.names.intro', { app: appName })),
    paragraph(t('kit.names.quick'), 'names-strong'),
    paragraph(t('kit.names.follow')),
    pairs.length ? h('details', { class: 'names-details' }, h('summary', { tabindex: 0 }, heading), h('ul', { class: 'names-pairs' }, pairs)) :
      paragraph(heading),
  ];
}

// Le texte d'un résultat et ses boutons : { nodes, label (le bouton principal), retry (il relance), skip (le bouton « sans mettre à jour », ou null) }.
function describe(t, result) {
  const detail = result.detail ? paragraph(t('kit.names.detail', { detail: result.detail })) : null;
  if (result.state === 'done') {
    const sentence = result.rows === null ? t('kit.names.doneNoCount', { tables: result.tables }) :
      t('kit.names.done', { tables: result.tables, rows: result.rows });
    const warning = result.mismatch.length ? paragraph(t('kit.names.mismatch', { names: result.mismatch.join(', ') }), 'names-alert') : null;
    return { nodes: [paragraph(sentence, 'names-ok'), warning], label: 'continue', retry: false, skip: null };
  }
  if (result.state === 'already') return { nodes: [paragraph(t('kit.names.already'), 'names-ok')], label: 'continue', retry: false, skip: null };
  if (result.state === 'blocked') {
    return { nodes: [paragraph(t('kit.names.blocked', { names: [...result.taken, ...result.missing].join(', ') }), 'names-alert')], label: 'continue',
      retry: false, skip: null };
  }
  if (result.state === 'refused') return { nodes: [paragraph(t('kit.names.refused'), 'names-alert'), detail], label: 'retry', retry: true, skip: 'skip' };
  return { nodes: [paragraph(t('kit.names.unknown'), 'names-alert'), detail], label: 'check', retry: true, skip: 'skip' };
}

export function showNamesWindow({ container, inertTargets, t, appName, prepared, run }) {
  let phase = 'ready'; // ready, working, puis result (describe() dit les boutons)
  let shown = null;
  const body = h('div', { class: 'ask-body names-body', 'aria-live': 'polite' });
  const ok = h('button', { type: 'button', class: 'btn primary', dataset: { fk: 'names-ok' } }, t('kit.names.start'));
  const skip = h('button', { type: 'button', class: 'btn', hidden: true, dataset: { fk: 'names-skip' } });
  const section = h('section', { class: 'mod ask names', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'names-title' },
    h('header', { class: 'mod-head' }, h('h2', { id: 'names-title' }, t('kit.names.title'))), body, h('footer', { class: 'mod-foot ask-foot' }, skip, ok));
  // Échap ne ferme que ce qui est fini : jamais avant le clic, jamais pendant la mise à jour ; après un refus, il vaut « Continuer sans mettre à jour ».
  const opened = openModal({ container, section, inertTargets, first: ok, cancel: null, keepOpen: () => phase !== 'result' });
  const leave = state => opened.done({ state, result: shown ? shown.result : null });

  function render(nodes, { label, skip: skipKey, busy = false }) {
    body.replaceChildren(...nodes.filter(Boolean));
    skip.hidden = !skipKey;
    if (skipKey) skip.textContent = t(`kit.names.${skipKey}`);
    ok.textContent = t(`kit.names.${label}`);
    ok.disabled = busy;
  }
  async function start() {
    phase = 'working';
    render([paragraph(t('kit.names.workingText'))], { label: 'working', busy: true });
    let result;
    try { result = await run(); } catch (error) { result = { state: 'unknown', detail: String((error && error.message) || error).slice(0, 200) }; }
    shown = { ...describe(t, result), result };
    phase = 'result';
    render(shown.nodes, shown);
    ok.focus({ preventScroll: true });
  }
  skip.addEventListener('click', () => { if (phase === 'result' && shown.skip) leave('skipped'); });
  ok.addEventListener('click', () => {
    if (phase === 'ready' || (phase === 'result' && shown.retry)) void start();
    else if (phase === 'result') leave(shown.result.state);
  });
  render(introduction(t, appName, prepared), { label: 'start' });
  return opened.result.then(value => value || { state: shown && shown.skip ? 'skipped' : (shown ? shown.result.state : 'skipped'),
    result: shown ? shown.result : null });
}
