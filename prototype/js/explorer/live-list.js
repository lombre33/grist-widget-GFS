// La liste qui se tient à jour toute seule (demande du porteur, 25/11 : « tout les 5 s ok, que ça voie tout » — un fichier créé, renommé, déplacé ou supprimé
// par quelqu'un d'autre, sans recharger — « et pour les gros fichiers aucun impact : jamais les lire en entier, juste leur nom »). GFS n'écoute rien de ce que
// Grist ne lui pousse pas (une section de widget n'est prévenue que pour sa propre table, faits vérifiés 179) : il relit, doucement, la liste que l'explorateur
// montre.
//
// Les règles de ce module (aucune ne touche à une cellule de contenu) :
//   - seule la lecture que l'explorateur fait déjà tourne, en silence (`quiet`) : la lecture légère (js/explorer/explorer-sql.js, les noms et le poids, jamais
//   le
//     contenu) quand le document est lourd, la lecture complète d'un document léger (moins de 4 Mo de fichiers) sinon ; un document lourd que Grist ne laisse
//     lire qu'en entier (règles d'accès, `/sql` refusé) ne se relit PAS tout seul : c'est lui que la relecture épargnerait. Avec l'index des noms
//     (js/explorer/index-model.js, choix du porteur du 26/11), il se relit comme un document léger : le résumé que Grist tient ne porte aucun contenu ;
//   - le rythme suit le coût : 5 s au plus vite, 15 s quand la lecture passe par l'API REST (`/sql` compte dans le plafond d'appels des offres hébergées), et
//     jamais plus vite que 5 fois la durée de la dernière lecture ;
//   - rien ne tourne explorateur fermé, page cachée, ni après 5 minutes sans geste ; le retour sur l'onglet et le premier geste après un calme relisent tout de
//     suite ;
//   - jamais pendant qu'un menu ou une fenêtre est ouvert (la liste ne se redessine pas sous la main de la personne) ;
//   - une lecture qui ne change rien ne redessine rien (js/explorer/files-reading.js).

import { HEAVY_BYTES } from './explorer-sql.js';

export const LIVE_EVERY = 5000; // le pas de la relecture, au plus vite
export const LIVE_EVERY_REST = 15000; // celui d'une lecture qui passe par l'API REST (la lecture légère)
export const LIVE_IDLE = 5 * 60 * 1000; // sans geste depuis ce temps, la relecture s'arrête jusqu'au prochain geste
export const LIVE_SLOWER = 5; // jamais plus vite que ce multiple de la durée de la dernière lecture
const POKE_GAP = 1000; // deux relectures « tout de suite » ne se suivent jamais plus vite que cela

// Le pas avant la prochaine relecture d'après ce que la dernière a coûté (`stats` : { ms, bytes, light }, js/explorer/explorer-data.js), ou null : le document
// est lourd et se lit en entier, la relecture automatique ne le lirait pas sans un coût qu'on ne veut pas (voir en tête).
export function paceOf(stats) {
  if (!stats) return LIVE_EVERY;
  const spent = Math.max(0, Number(stats.ms) || 0) * LIVE_SLOWER;
  if (stats.light) return Math.max(LIVE_EVERY_REST, spent);
  if (stats.indexed) return Math.max(LIVE_EVERY, spent); // l'index des noms : une lecture par la page, sans appel REST ni contenu, quel que soit le poids
  if ((Number(stats.bytes) || 0) >= HEAVY_BYTES) return null;
  return Math.max(LIVE_EVERY, spent);
}

const INPUTS = ['pointerdown', 'keydown', 'wheel'];

export class LiveList {
  #o;
  #stats = null;
  #timer = null;
  #running = false;
  #last = 0; // le dernier geste de la personne
  #poked = 0; // la dernière relecture « tout de suite »

  // o : { refresh({ quiet, live }) (la lecture des fichiers), isOpen() (l'explorateur est ouvert), canRead() (GFS a l'accès complet), loading() (une lecture
  //   est
  //   en cours), doc (le document de la page), now?() (les millisecondes, pour les essais), setTimer?, clearTimer? }
  constructor(o) {
    this.#o = { now: () => Date.now(), setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: id => clearTimeout(id), ...o };
    this.#last = this.#o.now();
  }

  get running() { return this.#running; }

  // Ce que la dernière lecture a coûté : elle règle le pas de la suivante.
  note(stats) { this.#stats = stats; }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#last = this.#o.now();
    this.#o.doc.addEventListener('visibilitychange', this.#onVisible);
    for (const type of INPUTS) this.#o.doc.addEventListener(type, this.#onInput, { passive: true, capture: true });
    this.#schedule();
  }

  stop() {
    this.#running = false;
    if (this.#timer !== null) this.#o.clearTimer(this.#timer);
    this.#timer = null;
    this.#o.doc.removeEventListener('visibilitychange', this.#onVisible);
    for (const type of INPUTS) this.#o.doc.removeEventListener(type, this.#onInput, { capture: true });
  }

  // Y a-t-il lieu de relire maintenant ? Chaque raison de se taire est ici.
  may() {
    const o = this.#o;
    if (!o.isOpen() || !o.canRead() || o.loading()) return false;
    if (o.doc.visibilityState === 'hidden' || paceOf(this.#stats) === null) return false;
    if (o.now() - this.#last >= LIVE_IDLE) return false;
    return !o.doc.querySelector('[data-layer]'); // un menu ou une fenêtre est ouvert : la liste ne bouge pas sous la main de la personne
  }

  #schedule() {
    if (!this.#running) return;
    if (this.#timer !== null) this.#o.clearTimer(this.#timer);
    const pace = paceOf(this.#stats);
    this.#timer = this.#o.setTimer(() => this.#tick(), pace === null ? LIVE_EVERY_REST : pace);
  }

  #tick() {
    this.#timer = null;
    if (!this.#running) return;
    if (this.may()) void this.#o.refresh({ quiet: true, live: true });
    this.#schedule();
  }

  // Le retour sur l'onglet, ou un geste après un long calme : une relecture tout de suite (jamais deux à moins d'une seconde l'une de l'autre).
  #poke() {
    const now = this.#o.now();
    if (!this.#running || now - this.#poked < POKE_GAP) return;
    this.#poked = now;
    if (this.may()) void this.#o.refresh({ quiet: true, live: true });
    this.#schedule();
  }

  #onVisible = () => { if (this.#o.doc.visibilityState === 'visible') { this.#last = this.#o.now(); this.#poke(); } };

  #onInput = () => {
    const now = this.#o.now();
    const idle = now - this.#last >= LIVE_IDLE;
    this.#last = now;
    if (idle) this.#poke();
  };
}
