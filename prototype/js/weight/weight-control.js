// Ce que le contrôleur fait du poids du document (lots 4 du poids et alerte du 25/11 ; contrats 2.4 point 5 ; 6.6 points 14 et 16) : la lecture du poids exact
// (js/weight/weight-reader.js) par le cadre d'envoi et la fenêtre « Poids du document » (js/weight/weight-window.js), puis la surveillance du poids total
// (js/weight/weight-guard.js) et son bandeau (js/weight/weight-alert.js). Le fichier est à part pour que le contrôleur ne grossisse que de quelques lignes.

import { escalating, readWeight } from './weight-reader.js';
import { openWeight } from './weight-window.js';
import { WeightWatch, readTotal } from './weight-guard.js';
import { alertBar, alertText } from './weight-alert.js';

export class WeightControl {
  #opts;
  #watch = null;

  // opts : { transfer (js/broker/transfer.js : sql()), container, inertTargets() -> [élément], t, locale(), canRead() (GFS a l'accès complet : le jeton du
  //   cadre d'envoi), repaint() (l'explorateur redit ce qu'il montre), notice(texte) (le message bref), explorerOpen(), timers? (les minuteurs des essais) }
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

  // La surveillance du poids du document, lancée une fois GFS prêt : une lecture 5 s plus tard, puis toutes les 30 min (js/weight/weight-guard.js). Sans
  // l'accès complet, rien ne se lit. Le bandeau paraît dans l'explorateur ; l'explorateur fermé (une app est ouverte), le message bref le dit une fois.
  watch() {
    const { transfer, t, locale, canRead, repaint, notice, explorerOpen, container, timers } = this.#opts;
    if (this.#watch || !canRead()) return;
    const sql = escalating((statement, writable) => transfer.sql(statement, { writable }));
    this.#watch = new WeightWatch({
      read: () => readTotal(sql),
      visible: () => !container.ownerDocument.hidden,
      ...(timers ? { timers } : {}), // les essais donnent les leurs
      onChange: ({ bytes, entering }) => {
        repaint();
        if (entering && !explorerOpen()) notice(alertText(bytes, locale(), t));
      },
    });
    this.#watch.start();
  }

  // Le bandeau que l'explorateur met sous son en-tête : rien tant que le document n'a pas passé la limite. `detail()` ouvre la fenêtre du poids.
  alerts({ detail }) {
    const { t, locale } = this.#opts;
    return this.#watch && this.#watch.over ? [alertBar({ bytes: this.#watch.bytes, locale: locale(), t, detail })] : [];
  }
}
