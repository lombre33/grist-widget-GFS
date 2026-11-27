// Écrire l'image du plan d'un lieu (module Annuaire, plan des bâtiments, lot 2 ; demande du porteur du 27/11). Le geste vient du bouton « Image du plan… » (ou
// « Remplacer l'image… », « Retirer ») de js/annuaire/annuaire-plan-view.js, réservé aux administrateurs du document (GFS l'a prouvé : js/broker/transfer.js).
// L'image est lue, jugée (une image que le navigateur sait décoder, de 20 Mo au plus) et réduite à 2048 pixels (js/annuaire/annuaire-images.js, genre « plan
// »), envoyée par le cadre d'envoi de GFS, puis la cellule `Plan` du lieu cite la pièce jointe que Grist a créée : une seule `UpdateRecord`, jamais avant le
// geste, jamais sur une colonne absente. « Retirer » écrit `null`. Grist garde le dernier mot (ses règles d'accès) : son refus est dit tel quel, rien n'est
// écrit. Sans effet de bord autre que ces deux gestes ; essayé sous Node (test/annuaire-plan-map.test.mjs) avec un faux port.

import { updateAction, PLAN_TABLE } from './annuaire-config.js';
import { prepareImage, uploadImage, rememberImage, IMAGE_MAX } from './annuaire-images.js';

const reason = error => String(error && error.message ? error.message : error);

// Écrit l'image du lieu `id` : `file` (un `File`) la choisit ou la remplace, `null` la retire. `store` : js/annuaire/annuaire-store.js (`update`), `plan` : le
// plan lu,
// `t` : les textes. Rend { ok, say } : `say` est la phrase que la fenêtre dit (le succès, ou la raison du refus).
export async function writePlanImage({ store, plan, id, file, t }) {
  const place = plan && plan.byId.get(id);
  if (!place || !plan.canImage) return { ok: false, say: t('an.plan.noPlanCol') };
  let cell = null;
  if (file) {
    if (file.size > IMAGE_MAX) return { ok: false, say: t('an.img.tooBig', { max: Math.round(IMAGE_MAX / 1048576) }) };
    const prepared = await prepareImage(file, 'plan');
    if (!prepared) return { ok: false, say: t('an.img.unreadable', { name: file.name }) };
    try {
      const number = await uploadImage(prepared);
      rememberImage('plan', number, prepared.url);
      cell = ['L', number];
    } catch (error) {
      return { ok: false, say: t('an.img.uploadFailed', { name: prepared.name, reason: reason(error) }) };
    }
  }
  try {
    await store.update(updateAction(plan.table, id, { [PLAN_TABLE.image]: cell }));
  } catch (error) {
    return { ok: false, say: t('an.plan.imgRefused', { reason: reason(error) }) };
  }
  return { ok: true, say: t(file ? 'an.plan.imgSaved' : 'an.plan.imgRemoved', { name: place.name }) };
}
