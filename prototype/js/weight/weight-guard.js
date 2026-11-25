// La surveillance du poids du document (demande du porteur, 25/11 : « au-delà de 12 Go, un message d'erreur dit qu'on ne peut pas dépasser 13 Go » ; choix : le
// fichier entier du document). Le poids est celui que lit la fenêtre « Poids du document » (js/weight/weight-reader.js) : le fichier entier du document
// (données, pièces jointes stockées et historique), plus les pièces jointes que Grist compte et que le fichier ne garde pas (un stockage externe). Une lecture
// légère, faite longtemps après le départ pour ne pas alourdir l'ouverture, puis de temps en temps tant que la page reste ouverte ; rien n'est écrit ni gardé.
// 1 Go = 1 024³ octets, comme partout dans GFS.
import { SQL, failureKind, readOne } from './weight-reader.js';

export const GO = 1024 ** 3;
export const WARN_BYTES = 12 * GO; // au-delà : le message
export const LIMIT_GO = 13; // ce que le message dit que le document ne peut pas dépasser
export const FIRST_MS = 5000; // la première lecture : 5 s après le départ
export const EVERY_MS = 30 * 60 * 1000; // puis une lecture toutes les 30 min
export const HIDDEN_MS = 60 * 1000; // page cachée : pas de lecture, on revoit dans une minute

// Le poids du document en octets : le fichier entier, plus ce que Grist compte en pièces jointes au-delà de celles que le fichier garde (rien quand elles y
// sont toutes). Seule la lecture du fichier est obligatoire : celle des pièces jointes qui échoue laisse le fichier seul ; un refus de droits lève
// (`failureKind`). `sql(statement)` rend les lignes (`Transfer.sql`, avec `escalating`). Rend null quand Grist ne dit pas le fichier.
export async function readTotal(sql) {
  const file = await readOne(sql, SQL.file, false);
  if (file === null) return null;
  const stored = await readOne(sql, SQL.stored, true);
  const counted = await readOne(sql, SQL.counted, true);
  return file + (stored !== null && counted !== null ? Math.max(0, counted - stored) : 0);
}

export const isOver = bytes => bytes > WARN_BYTES;

// Les minuteurs du navigateur : `setTimeout` appelé comme méthode d'un autre objet (`timers.set(…)`) y lève « Illegal invocation » ; chacun est donc appelé
// seul.
export const BROWSER_TIMERS = { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) };

// La surveillance. opts : { read() -> octets (ou null ; un refus de droits lève), onChange({ bytes, over, entering }), visible() -> la page se voit, timers: {
// set, clear } (les essais en donnent d'autres), firstMs, everyMs }. `onChange` n'est appelé que quand le message paraît, change de poids ou s'en va ;
// `entering` : le poids vient de passer la limite (la première fois, ou après être revenu dessous).
export class WeightWatch {
  #opts;
  #timer = null;
  #running = false;
  #stopped = false;
  #bytes = null;

  constructor(opts) { this.#opts = { visible: () => true, timers: BROWSER_TIMERS, firstMs: FIRST_MS, everyMs: EVERY_MS, ...opts }; }

  get over() { return this.#bytes !== null && isOver(this.#bytes); }

  get bytes() { return this.#bytes; }

  start() {
    if (!this.#stopped && this.#timer === null && !this.#running) this.#schedule(this.#opts.firstMs);
  }

  stop() {
    this.#stopped = true;
    if (this.#timer !== null) this.#opts.timers.clear(this.#timer);
    this.#timer = null;
  }

  // Une lecture. Un échec reste silencieux et se retente à la prochaine ; un refus de droits (la personne ne peut pas tout copier) arrête la surveillance.
  async check() {
    if (this.#stopped || this.#running) return;
    if (!this.#opts.visible()) { this.#schedule(HIDDEN_MS); return; }
    this.#running = true;
    try {
      const bytes = await this.#opts.read();
      if (bytes !== null && !this.#stopped) this.#note(bytes);
    } catch (error) {
      if (failureKind(error) === 'denied') this.stop();
    } finally {
      this.#running = false;
    }
    if (!this.#stopped) this.#schedule(this.#opts.everyMs);
  }

  #schedule(ms) {
    if (this.#timer !== null) this.#opts.timers.clear(this.#timer);
    this.#timer = this.#opts.timers.set(() => { this.#timer = null; void this.check(); }, ms);
  }

  #note(bytes) {
    const was = this.over;
    const before = this.#bytes;
    this.#bytes = bytes;
    const over = isOver(bytes);
    if (over || was) this.#opts.onChange({ bytes, over, entering: over && !was, changed: before !== bytes });
  }
}
