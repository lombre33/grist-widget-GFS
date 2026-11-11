// Ce que GFS a dit à l'app active (contrats 5.1 et 5.2) : son contexte au premier appel `contexte` (avec l'ouverture, une seule fois), puis les événements `extensions` et `identite` quand ce qu'elle doit charger ou
// l'adresse de la personne changent vraiment. Sorti du contrôleur (js/controller.js) pour qu'il reste sous les 600 lignes de code de l'outil d'audit ; comme js/entries.js et js/openings.js, il reçoit le contrôleur (`c`)
// et lit `session`, `registry`, `identity`, `opening`, `appStorage`, `dock`, `rights`, `theme`, `port`, `doc`, `readonly` et `appPreferences()` ; il n'écrit que `c.opening` (le fichier part une seule fois).

import { buildContext, identityFor, instanceOf, pageOf } from './context.js';
import { carriesFile } from './import-file.js';

export class AppContext {
  #facts = null;
  #sentExtensions = null; // les extensions et bibliothèques données à l'app active (JSON), ou null tant qu'elle n'a pas demandé son contexte
  #sentIdentity = null; // l'identité donnée à l'app active (JSON), ou null tant qu'elle n'a pas demandé son contexte
  #served = false; // l'app active a demandé son contexte : elle a lu l'ouverture qui s'y trouvait, et ne la relira pas

  constructor(c) { this.c = c; }

  get served() { return this.#served; }

  // L'app active se ferme : la suivante repart de rien.
  reset() {
    this.#sentExtensions = null;
    this.#sentIdentity = null;
    this.#served = false;
  }

  // L'événement `identite` (contrats 5.2, points 2 et 9) : seulement à l'app qui a déjà son contexte et que l'adresse vient de changer (une app qui ne l'a pas déclarée n'en reçoit rien).
  pushIdentity() {
    const { c } = this;
    if (!c.session || this.#sentIdentity === null) return;
    const identity = identityFor(c.session.policy, c.identity);
    const sent = JSON.stringify(identity);
    if (sent === this.#sentIdentity) return;
    this.#sentIdentity = sent;
    c.session.sendIdentity(identity);
  }

  // L'événement `extensions` (contrats 5.2, point 2) : seulement quand ce que l'app doit charger a vraiment changé.
  pushExtensions() {
    const { c } = this;
    const given = c.registry.extensionsFor(c.session.id, c.doc.baseURI);
    const sent = JSON.stringify([given.extensions, given.bibliotheques, given.natives]);
    if (sent === this.#sentExtensions) return;
    this.#sentExtensions = sent;
    c.session.sendExtensions(given);
  }

  // Les faits qui ne changent pas pendant la vie de la page : lus une fois (le nom du document, l'instance, la page).
  async readFacts() {
    if (this.#facts) return this.#facts;
    const { c } = this;
    let document = null;
    try { document = await c.port.doc.getDocName(); } catch (error) { console.warn('GFS : le nom du document est illisible', error); }
    const referrer = c.doc.referrer;
    this.#facts = { instance: instanceOf(referrer), page: pageOf(referrer), document, widgetAddress: `${location.origin}${location.pathname}` };
    return this.#facts;
  }

  // L'appel `contexte` : tout ce que l'app a le droit de savoir au démarrage.
  async contextFor(session) {
    const { c } = this;
    c.dock.mask(false); // un cadre qui redemande son contexte repart avec la barre (contrats 5.2, point 7)
    const opening = this.#takeOpening(session);
    const given = c.registry.extensionsFor(session.id, c.doc.baseURI);
    this.#sentExtensions = JSON.stringify([given.extensions, given.bibliotheques, given.natives]);
    const facts = await this.readFacts();
    const storage = c.appStorage.read(session.id);
    const identity = identityFor(session.policy, c.identity);
    if (session === c.session) this.#sentIdentity = JSON.stringify(identity);
    const role = await c.rights.reader.role(); // ce que GFS a prouvé : propriétaire ou non, `null` sinon (contrats 5.2, point 8)
    session.announceSaved(); // d'avance, ce que deviendront ses réglages de vue : dans la vue (rien à enregistrer dans Grist) ou en brouillon (contrats 7.3, point 5)
    return buildContext(facts, { access: session.access, extensions: given.extensions, libraries: given.bibliotheques, natives: given.natives, opening, storage, bar: c.dock.barre(), identity, players: session.policy.lecteurs, ambiance: c.theme.message(), role }, { preferences: c.appPreferences(), readonly: c.readonly });
  }

  // L'ouverture n'est rendue qu'au premier `contexte` de l'app qui vient d'être activée (contrats 5.2, point 3) : une app dont le cadre est rechargé sur place (sa langue, un
  // réglage qui le demande) retrouve son ordre habituel, au lieu de refaire un « Nouveau » déjà fait ou de rouvrir le modèle du dernier clic. Une app déjà ouverte reçoit l'appel `ouvrir`.
  #takeOpening(session) {
    const { c } = this;
    if (session !== c.session) return null;
    const opening = this.#served ? null : c.opening;
    this.#served = true;
    if (carriesFile(opening)) c.opening = null; // le fichier part une seule fois : une réouverture de l'app ne le reprend pas
    return opening;
  }
}
