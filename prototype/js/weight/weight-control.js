// Ce que le contrôleur fait de la fenêtre « Poids du document » (lot 4 du poids, contrats 2.4 point 5 ; 6.6 point 14) : la lecture du poids exact
// (js/weight/weight-reader.js) par le cadre d'envoi, et la fenêtre (js/weight/weight-window.js). Le fichier est à part pour que le contrôleur ne grossisse que
// de quelques lignes.

import { escalating, readWeight } from './weight-reader.js';
import { openWeight } from './weight-window.js';

export class WeightControl {
  #opts;

  // opts : { transfer (js/broker/transfer.js : sql()), container, inertTargets() -> [élément], t, locale() }
  constructor(opts) { this.#opts = opts; }

  // Ouvre la fenêtre. `estimate` : { list (octets), pj (null ou { bytes }) }, ce que l'explorateur montre au moment du clic ; le poids exact se lit à
  // l'ouverture, à chaque fois.
  open(estimate) {
    const { transfer, container, inertTargets, t, locale } = this.#opts;
    return openWeight({
      container, inertTargets, t, locale: locale(), estimate,
      load: (update, cancelled) => readWeight(escalating((statement, writable) => transfer.sql(statement, { writable })), update, cancelled),
    });
  }
}
