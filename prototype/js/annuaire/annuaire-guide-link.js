// La section « Démarches » de la fiche d'une personne (module Annuaire, demande du porteur du 27/11 : « le guide des démarches, lié à l'annuaire ») : un seul
// bouton, qui ouvre le guide du document sur les démarches où la personne est le contact. L'annuaire ne dépend pas du guide : il sait seulement que le module
// existe (une table `GFS_Guides` dans le document) et lui passe la personne ; le bouton est grisé, jamais masqué, quand le document n'a pas de guide, et un
// clic dit pourquoi. Des fonctions qui construisent des nœuds, sans lecture ni écriture.

import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

const GUIDES_TABLE = 'GFS_Guides';

// Ce qui empêche d'ouvrir le guide : le texte (le document n'a pas de guide), ou '' ; `data` : la lecture de l'annuaire (`data.schema`).
export const guideBlock = (data, t) => (data && data.schema && data.schema[GUIDES_TABLE] ? '' : t('an.guide.none'));

// Le contenu de la section : la phrase qui dit à quoi sert le bouton, puis le bouton. `ctx.guideBlock` : le texte qui l'empêche, ou ''.
export function guideContent(person, ctx) {
  const { t } = ctx;
  const blocked = ctx.guideBlock || '';
  return [h('p', { class: 'an-note' }, t('an.guide.hint')),
    h('button', { type: 'button', class: 'btn sm an-see', 'aria-disabled': blocked ? 'true' : null, title: blocked || t('an.guide.tip'),
      dataset: { act: 'guide-open', row: String(person.row), fk: 'guide-open' } }, icon('guide'), t('an.guide.see'))];
}
