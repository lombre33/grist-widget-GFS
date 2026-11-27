// Le volet « Plan » de la fenêtre de l'annuaire (module Annuaire, demande du porteur du 27/11) : le lieu où l'on est, le lieu à repérer (le bureau de la
// personne dont la fiche s'ouvre) et le dessin (js/annuaire/annuaire-plan-view.js). La fenêtre (js/annuaire/annuaire-window.js) lui dit quoi montrer et lit les
// clics ; elle ne sait rien des lieux. Rien ici ne parle à Grist.

import { PlanView } from './annuaire-plan-view.js';
import { placeOfPerson } from './annuaire-plan.js';
import { planReady } from './annuaire-config.js';
import { canUpload } from './annuaire-images.js';

// Pourquoi le plan ne s'allume pas dans cette lecture (la clé du texte : la vue reste grisée et un clic le dit), ou '' quand il s'allume : il se lit dans un
// annuaire principal dont la table des lieux et la colonne du bureau sont réglées (js/annuaire/annuaire-setup-plan.js).
export function planWhy(data) {
  if (data.merged) return 'an.plan.noMerged';
  if (data.sub) return 'an.plan.noSub';
  if (data.plan) return '';
  return planReady(data.config) ? 'an.plan.gone' : 'an.plan.notSet';
}

// Pourquoi les boutons de l'image d'un plan sont grisés (la clé du texte), ou '' : la table a sa colonne « Plan », la personne administre le document (GFS l'a
// prouvé) et GFS sait envoyer un fichier. Grist garde le dernier mot (ses règles d'accès).
export function imageWhy(data) {
  if (!data.plan.canImage) return 'an.plan.noPlanCol';
  if (!data.admin) return 'an.plan.imgAdmin';
  return canUpload() ? '' : 'an.img.noUpload';
}

// Pourquoi « Tracer les locaux » est grisé (la clé du texte), ou '' : la table a sa colonne « Shape » et la personne administre le document (GFS l'a prouvé).
// Grist garde le dernier mot (ses règles d'accès).
export function traceWhy(data) {
  if (!data.plan.canShape) return 'an.plan.noShapeCol';
  return data.admin ? '' : 'an.plan.traceAdmin';
}

export class PlanPane {
  #view = new PlanView();
  #place = 0; // le lieu que le plan montre (0 : tous les lieux)
  #here = 0; // le lieu à repérer

  get element() { return this.#view.element; }

  get tools() { return this.#view.tools; }

  get filters() { return this.#view.filters; }

  get here() { return this.#here; }

  // Un autre annuaire repart de tous les lieux.
  reset() {
    this.#place = 0;
    this.#here = 0;
  }

  // Dessine le lieu où l'on est (un lieu qui n'existe plus ramène à tous les lieux). `state` : { t, data (la lecture : `plan`, `masked`, `admin`), people
  // (celles que l'annuaire montre), selected (la ligne de la personne dont la fiche est ouverte), send ({ image((lieu, fichier | null) : écrire l'image d'un
  // plan),
  // trace(lieu) : ouvrir la fenêtre de tracé de ses locaux }) }.
  paint({ t, data, people, selected, send }) {
    if (!data.plan.byId.has(this.#place)) this.#place = 0;
    this.#view.show({ t, plan: data.plan, people, current: this.#place, here: this.#here, selected, masked: data.masked, send, imageWhy: imageWhy(data),
      filtered: people.length < data.people.length,
      traceWhy: traceWhy(data) });
  }

  // Descend ou remonte au lieu `id` (0 : tous les lieux) ; faux quand il n'existe pas.
  go(plan, id) {
    if (id && !(plan && plan.byId.has(id))) return false;
    this.#place = id;
    this.#here = 0;
    return true;
  }

  // Le lieu au-dessus de celui où l'on est (0 au sommet).
  parent(plan) {
    const at = plan.byId.get(this.#place);
    return at ? at.parent : 0;
  }

  get atTop() { return this.#place === 0; }

  // Ouvre le plan sur l'étage du bureau de la personne `row`, le bureau repéré : rend le lieu du bureau, ou null quand elle n'en a pas.
  reveal(plan, row) {
    const at = plan ? placeOfPerson(plan, row) : null;
    if (!at) return null;
    this.#place = at.parent;
    this.#here = at.id;
    return at;
  }
}
