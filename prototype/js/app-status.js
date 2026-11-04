// La phrase d'état de l'app active (« Form+ se charge… », « Form+ ne répond pas. »), au bas de l'écran. Elle parle de l'app, pas de l'explorateur : tant que l'explorateur recouvre l'app,
// elle se tait (un « ne répond pas » en rouge restait sur la liste des fichiers) ; elle revient avec l'app, si elle est encore vraie.

export class AppStatus {
  #el;
  #text = '';
  #bad = false;
  #covered = false;

  constructor(element) { this.#el = element; }

  // Dit une phrase (en rouge si `bad`), ou la retire quand le texte est vide.
  say(text, bad = false) {
    this.#text = text || '';
    this.#bad = Boolean(bad);
    this.#paint();
  }

  // L'explorateur recouvre l'app (`true`) ou la laisse voir (`false`) : la phrase gardée se cache ou revient.
  cover(covered) {
    this.#covered = Boolean(covered);
    this.#paint();
  }

  #paint() {
    const shown = Boolean(this.#text) && !this.#covered;
    this.#el.hidden = !shown;
    this.#el.textContent = shown ? this.#text : '';
    this.#el.classList.toggle('status--bad', shown && this.#bad);
  }
}
