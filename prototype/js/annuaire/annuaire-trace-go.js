// Le geste « Tracer les locaux » du module Annuaire (plan des bâtiments, lot 3 ; demande du porteur du 27/11) : relit l'image du plan du lieu, ouvre la fenêtre
// de tracé (js/annuaire/annuaire-trace-window.js) et lui donne l'écriture : toutes les actions du tracé partent d'un coup (js/annuaire/annuaire-store.js,
// `update`), jamais colonne par colonne. La fenêtre se mesure dans un vrai Grist (labo/run-annuaire-plan.mjs), jamais contre un faux. Rend { ok, say } comme
// `writePlanImage` : `say` est la phrase que la fenêtre de l'annuaire dit.

import { loadImage } from './annuaire-images.js';
import { openTrace } from './annuaire-trace-window.js';

// opts : { store, read (la lecture de l'annuaire, `read.plan`), id (le lieu dont l'image est tracée), t, container, inertTargets(), ask(opts) }
export async function traceRooms({ store, read, id, t, container, inertTargets, ask }) {
  const host = read.plan ? read.plan.byId.get(id) : null;
  if (!host || !host.plan) return { ok: false, say: '' };
  const imageUrl = await loadImage('plan', host.plan);
  if (!imageUrl) return { ok: false, say: t('an.plan.mapFailed', { name: host.name }) };
  const saved = await openTrace({ read, host, imageUrl, t, container, inertTargets, ask, save: actions => store.update(actions) });
  return { ok: saved, say: saved ? t('an.tr.saved', { name: host.name }) : '' };
}
