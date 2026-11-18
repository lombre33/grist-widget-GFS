// Le pied de la fenêtre « Dépendances » (demande du porteur, 18/11 : « le plus d'options possible » et « audit de sécurité ») : la phrase du relevé, « Tout en
// copie figée » (le réglage des réseaux fermés : chaque fonction qui le peut passe en copie de GFS, après une question ; quand elles y sont toutes, le bouton
// propose le retour au CDN), « Exporter le rapport » (le rapport de GFS ou l'inventaire CycloneDX, js/apps/dependencies-export.js) et « Fermer ». Un bouton
// grisé garde son texte et dit pourquoi dans la phrase du pied, un instant ; rien ne s'écrit sans un geste de la personne.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openPanel } from '../ui/menu.js';
import { planFor, planSize } from './dependencies-source.js';
import { FORMATS, reportName, reportText } from './dependencies-export.js';

const FLASH_MS = 2600;

// Le choix du bouton « Tout… » : la copie figée, sauf quand chaque fonction qui peut l'avoir l'a déjà (le bouton propose alors le retour au CDN).
export function allTarget(units) {
  const open = [...units.values()].filter(unit => unit.why === null && unit.canCopy);
  return open.length && open.every(unit => unit.mode === 'vendorise') ? 'cdn' : 'vendorise';
}

// Le panneau de l'export : un bouton par format, avec ce qu'il contient.
function exportPanel(t, pick) {
  const buttons = FORMATS.map(format => h('button', { type: 'button', class: 'dp-export-btn', dataset: { fk: `dep-export-${format}` },
    on: { click: () => pick(format) } },
    h('strong', null, t(`dep.export.${format}`)), h('span', { class: 'dp-sub' }, t(`dep.export.${format}.hint`))));
  const content = h('div', { class: 'dp-export' }, ...buttons);
  content.addEventListener('keydown', event => {
    const at = buttons.indexOf(content.ownerDocument.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      buttons[(at + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length].focus();
    }
  });
  return { content, first: buttons[0] };
}

// opts : ceux de `openDependencies` ; `state.rows` : les lignes en cours ; `date` : la date du relevé, lisible ; `refresh()` : relit les lignes ; `close()`.
// Rend { node, update() } : `update` remet le bouton « Tout… » d'après les apps.
export function buildFoot({ opts, state, date, refresh, close }) {
  const { t } = opts;
  const base = opts.surveyed ? t('dep.foot', { date }) : t('dep.foot.none');
  const note = h('p', { class: 'mod-note', role: 'status' }, base);
  const all = h('button', { type: 'button', class: 'btn sm', dataset: { fk: 'dep-all' } });
  const exporter = h('button', { type: 'button', class: 'btn sm', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: t('dep.export.tip'),
    dataset: { fk: 'dep-export' } }, icon('download'), t('dep.export'));
  let timer = null;
  let panel = null;
  const flash = text => {
    note.textContent = text;
    clearTimeout(timer);
    timer = setTimeout(() => { note.textContent = base; }, FLASH_MS);
  };

  // « Tout en copie figée » : ce qui change est dit dans la question (les apps et leurs fonctions), puis une écriture par app.
  all.addEventListener('click', async () => {
    const why = opts.blocked();
    if (why !== null) { flash(why); return; }
    const units = opts.units();
    const mode = allTarget(units);
    const key = mode === 'cdn' ? 'cdn' : 'copy';
    const plan = planFor(units.values(), mode);
    if (!plan.length) { flash(t([...units.values()].some(unit => unit.why === null) ? `dep.all.none.${key}` : 'dep.all.nofn')); return; }
    const yes = await opts.ask({ title: t(`dep.all.title.${key}`), message: t(`dep.all.text.${key}`, { n: planSize(plan) }),
      items: plan.map(entry => `${entry.appName} : ${entry.names.join(', ')}`), confirmLabel: t(`dep.all.confirm.${key}`), cancelLabel: t('dep.all.cancel'),
        safeFirst: true });
    if (!yes) return;
    const pending = opts.apply(plan, mode);
    refresh();
    await pending;
    refresh();
    flash(t(`dep.all.done.${key}`, { n: planSize(plan) }));
  });

  // « Exporter le rapport » : un panneau à deux formats ; le fichier se fabrique ici et s'offre au téléchargement.
  const save = format => {
    const generated = opts.now().toISOString();
    const name = reportName(format, generated);
    try {
      opts.save(name, reportText(format, { rows: state.rows, surveyed: opts.surveyed, generated, serial: opts.uuid() }));
      flash(t('dep.export.done', { name }));
    } catch (error) {
      console.warn('GFS : le rapport des dépendances ne s’enregistre pas', error);
      flash(t('dep.export.failed'));
    }
  };
  exporter.addEventListener('click', () => {
    if (panel) { panel.close(); return; }
    const { content, first } = exportPanel(t, format => { panel.close(); exporter.focus({ preventScroll: true }); save(format); });
    panel = openPanel(exporter, content, { host: opts.container, side: 'above', align: 'right', label: t('dep.export.label'),
      onClose: () => { panel = null; } });
    first.focus({ preventScroll: true });
  });

  const update = () => {
    const key = allTarget(opts.units()) === 'cdn' ? 'cdn' : 'copy';
    all.replaceChildren(icon(key === 'cdn' ? 'globe' : 'shield'), t(`dep.all.${key}`));
    all.title = t(`dep.all.tip.${key}`);
    if (opts.blocked() !== null) all.setAttribute('aria-disabled', 'true'); else all.removeAttribute('aria-disabled');
  };
  const node = h('footer', { class: 'mod-foot' }, note, all, exporter, h('button',
    { type: 'button', class: 'btn', dataset: { fk: 'dep-close' }, on: { click: close } },
    t('dep.close')));
  return { node, update };
}
