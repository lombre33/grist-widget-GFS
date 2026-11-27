// La reprise après un rechargement de la page (demande du porteur, 26/11 ; contrats 5.2, point 3 ; cahier 6.2, point 6). Quand Grist recharge la page, ou qu'on
// la quitte pour une autre page de Grist et qu'on y revient, il reconstruit le cadre de GFS : l'app et l'explorateur sont perdus (mesuré, faits vérifiés 188).
// GFS retient donc où la personne en était, et y revient au démarrage :
//   - un fichier que GFS a fait ouvrir dans une app : il est rouvert, le même, dans l'app (comme un double-clic), s'il existe encore et si la personne peut
//     toujours l'ouvrir ; sinon l'explorateur, avec une phrase qui dit pourquoi ;
//   - l'explorateur devant : il revient au même endroit (la vue, le dossier ; un dossier qui n'existe plus ramène au dossier du dessus).
// Ce que GFS ne sait pas, il ne le devine pas : il ne connaît que les fichiers qu'il a lui-même ouverts (un modèle changé dans le sélecteur de l'app ne le
// prévient pas), et un « Nouveau » pas encore enregistré n'existe pas. Sans souvenir ou sans accès complet, l'arrivée est celle d'avant (js/broker/arrival.js :
// le réglage de la vue, sinon l'explorateur à la racine) ; le souvenir de l'onglet passe avant le réglage de la vue, qui reste le départ d'un onglet neuf.
//
// Le souvenir vit sur l'onglet (`sessionStorage` du cadre : il survit au rechargement et au retour sur la page, sous Chromium et Firefox, mesuré), sous
// `gfs.rouvrir.<document>.<table>` ; rien n'est écrit dans Grist, et rien ne se retient avant que l'arrivée ait fini (`begin`). La ligne « Rouvrir au
// rechargement » des réglages avancés le coupe (choix retenu sur le navigateur de GFS, `gfs.rouvrir`, allumé tant qu'on ne l'a pas coupé).
//
// `c` : le contrôleur (js/controller.js). Il donne `docId()`, `state`, `explorer`, `opened`, `session`, `identity`, `fullAccess`, `locale`, `lockOf`,
// `refreshFiles`, `openings.openFile`, `showExplorer`, `notice`, `t`. Les décisions sont dans js/broker/resume-place.js.

import { StoredChoice, keyStore, watchKey } from '../shell/stored-choice.js';
import { placeOf } from '../explorer/explorer-place.js';
import { slotKey, parseMemory, serializeMemory, needsList, decide } from './resume-place.js';

export const ENABLED_KEY = 'gfs.rouvrir';
// Le temps qu'on laisse à Grist pour dire la table de la section : une section sans table n'a pas de souvenir, et ne retient pas l'arrivée plus longtemps.
const TABLE_WAIT_MS = 1000;

export class Resume {
  #win;
  #choice;
  #bound = null;
  #slot = null; // le souvenir de cette section : { read(), write(valeur | null) } sur l'onglet, ou null (document ou table inconnus)
  #live = false;
  #last = null; // ce qui est écrit : un changement qui n'en est pas un n'écrit rien

  constructor(c, win = window) {
    this.c = c;
    this.#win = win;
    this.#choice = new StoredChoice({ choices: ['oui', 'non'], fallback: 'oui', store: keyStore(win, ENABLED_KEY),
      keep: value => (value === 'non' ? 'non' : null) });
    watchKey(this.#choice, ENABLED_KEY, win);
    this.#choice.onChange(() => this.#switched());
    c.opened.onChange(() => this.sync()); // un fichier ouvert, ou plus aucun : le souvenir suit
  }

  // La ligne « Rouvrir au rechargement » : allumée tant que la personne ne l'a pas coupée.
  get enabled() { return this.#choice.value === 'oui'; }

  // Rend `true` si le navigateur a retenu le choix (sinon il vaut jusqu'au rechargement de la page).
  toggle() { return this.#choice.choose(this.enabled ? 'non' : 'oui'); }

  // Coupée, la reprise efface ce qu'elle retenait ; rallumée, elle retient où la personne est.
  #switched() {
    if (this.enabled) { this.sync(); return; }
    this.#last = null;
    if (this.#slot) this.#slot.write(null);
  }

  // Le document et la table de la section, d'où vient la clé du souvenir (une fois).
  #bind() {
    this.#bound = this.#bound || (async () => {
      const { c } = this;
      const [doc, table] = await Promise.all([c.docId(), c.state.whenTable(TABLE_WAIT_MS)]);
      const key = slotKey(doc, table && table.tableId);
      this.#slot = key ? keyStore(this.#win, key, 'sessionStorage') : null;
    })();
    return this.#bound;
  }

  // L'arrivée : rend 'file' (le fichier est rouvert dans son app), 'explorer' (l'explorateur est montré au même endroit) ou `null` (rien à reprendre : le
  //   contrôleur fait l'arrivée d'avant). `identified` : la promesse de l'adresse de la personne (js/files/rangement.js), qu'on n'attend que pour ce qui se
  //   vérifie dans la liste des fichiers.
  async arrive(identified) {
    const { c } = this;
    await this.#bind();
    if (!this.#slot || !this.enabled || !c.fullAccess) return null;
    const memory = parseMemory(this.#slot.read());
    if (!memory) return null;
    let who = '';
    if (needsList(memory)) {
      who = await identified;
      await c.refreshFiles({ quiet: true }); // la page n'a rien affiché de la liste : lue sans phrase, derrière l'arrivée
    }
    return this.#carryOut(decide(memory, { who, files: c.explorer.files, folders: c.explorer.folders, locale: c.locale, lockOf: file => c.lockOf(file) }));
  }

  async #carryOut(outcome) {
    const { c } = this;
    if (outcome.kind === 'file') return (await c.openings.openFile(outcome.file)) ? 'file' : null;
    if (outcome.kind === 'missing') {
      c.notice(c.t(`resume.${outcome.why}`, { name: outcome.name || c.t('ex.untitled') }));
      return null;
    }
    if (outcome.kind !== 'place') return null;
    c.explorer.goTo(outcome.place);
    c.showExplorer();
    return 'explorer';
  }

  // L'arrivée a fini : à partir d'ici, où la personne est se retient.
  begin() {
    this.#live = true;
    this.sync();
  }

  // Où la personne est maintenant : l'explorateur (la vue, le dossier), ou l'app (le fichier que GFS lui a fait ouvrir, s'il y en a un). À rappeler à chaque
  // changement : le texte n'est écrit que s'il est différent du dernier.
  sync() {
    const { c } = this;
    if (!this.#live || !this.#slot || !this.enabled || !c.explorer) return;
    const record = this.#where();
    if (!record) return;
    const text = serializeMemory(record);
    if (text === this.#last) return;
    this.#last = text;
    this.#slot.write(text);
  }

  #where() {
    const { c } = this;
    const base = { v: 1, who: c.identity || '' };
    if (c.explorer.isOpen) return { ...base, lieu: 'explorateur', ...placeOf(c.explorer.state) };
    if (!c.session) return null;
    const key = c.opened.shown(c.session);
    if (!key) return { ...base, lieu: 'app' };
    const file = c.explorer.files.find(item => item.key === key);
    return { ...base, lieu: 'fichier', key, name: file ? file.name || '' : '' };
  }
}
