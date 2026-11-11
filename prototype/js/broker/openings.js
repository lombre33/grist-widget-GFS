// Les ouvertures (contrats 5.4) : ouvrir un fichier, en créer un vierge (« Nouveau »), en créer un d'après un fichier (« Importer »), lire un fichier que GFS
// garde, et quitter l'app active pour une autre. Sorties du contrôleur (js/controller.js) pour qu'il reste sous les 600 lignes de code de l'outil d'audit. Le
// contrôleur (`c`) garde l'app active et ses cadres : ce module lui demande `activate`, `isOpen`, `openable`, `unlock` et `ask`, lit `session`, `opening` et
// `contextServed`, et n'écrit que `opening` (le fichier part une seule fois).

import { acceptsFile, importOpening, openingKind, acceptsOpening, carriesFile, pickFile } from '../files/import-file.js';
import { readOpening } from './reading.js';
import { leaveApp, leaveQuestion } from './leave.js';
import { FILES_APP } from '../files/gfs-files.js';
import { fileKey } from '../explorer/explorer-model.js';
import { ERR } from './filter.js';

export class Openings {
  #leaveRun = 0; // le numéro de la dernière demande « fermer » : une réponse qui arrive après un autre geste de la personne n'ouvre plus rien

  constructor(c) { this.c = c; }

  // La personne repart explorer (ou fait autre chose) : une app qui répondrait « fermer » plus tard ne change plus rien.
  moved() { this.#leaveRun++; }

  openFile(file) {
    const { c } = this;
    const lock = c.lockOf(file);
    if (lock) { void c.unlock(lock); return; }
    if (c.kept.has(file)) { void this.#openKept(file); return; }
    if (!c.appById(file.app)) { c.notice(c.t('ex.notice.noApp')); return; }
    void this.openIn(file.app, { fichier: { id: file.id, type: file.type }, type: file.type, dossier: c.explorer.state.path, raison: 'explorateur' },
      'ex.notice.open');
  }

  openNew(entry) {
    const { c } = this;
    if (entry.greyed) { void c.unlock({ text: entry.reason || entry.hint, focus: entry.focus }); return; }
    void this.openIn(entry.app, { fichier: null, type: entry.type, dossier: c.explorer.state.path, raison: 'nouveau' }, 'ex.notice.new');
  }

  // « Importer » (contrats 5.4, point 1) : la personne choisit le fichier dans le sélecteur de GFS (ouvert ici, dans son geste), puis l'app le reçoit avec
  // l'ouverture et en fait un modèle vierge. Annuler le sélecteur ne change rien ; un fichier qui n'est pas du format est dit sans ouvrir l'app.
  async importFile(entry) {
    const { c } = this;
    if (entry.action === 'receive') { await c.otherDocuments.receive(); return; } // « D'un autre document Grist… » : recevoir un partage
    if (entry.app === FILES_APP) { await c.kept.importFile(entry); return; } // GFS garde ce format lui-même : aucune app n'est ouverte
    if (entry.greyed) { void c.unlock({ text: entry.reason || entry.hint, focus: entry.focus }); return; }
    const file = await pickFile(c.doc, entry.extensions.join(','));
    if (!file) return;
    if (!acceptsFile(file.name, entry.extensions)) {
      c.notice(c.t('ex.import.wrong', { name: file.name, format: entry.label, extensions: entry.extensions.join(', ') })); return; }
    void this.openIn(entry.app, importOpening(entry, file, c.explorer.state.path), 'ex.notice.import');
  }

  // Rend `true` quand l'ouverture est partie vers l'app (ou qu'elle l'a faite), `false` quand l'app n'a pu être activée ou que la personne a annulé dans l'app
  // (l'appel `ouvrir` d'une app attend ce résultat).
  async openIn(appId, opening, noticeKey) {
    const { c } = this;
    // une autre app : la première s'enregistre ou pose sa question avant de partir
    if (!(await this.leave((opening && opening.raison) || 'ouvrir', appId))) return false;
    // L'app déjà ouverte a lu son contexte : elle n'y relira pas l'ouverture, GFS la lui dit par l'appel `ouvrir` (contrats 5.4, point 1).
    // Sinon (une autre app, ou celle-ci qui démarre) l'ouverture part dans le contexte qu'elle va demander.
    const running = c.isOpen(appId) && c.contextServed;
    if (!c.activate(appId, opening)) return false;
    c.hideExplorer();
    // ouvrir un fichier précis, en créer un vierge (« Nouveau »), en créer un d'après un fichier (« Importer »), ou le lire
    const knows = acceptsOpening(c.manifestOf(appId), openingKind(opening));
    if (!knows) c.notice(c.t(noticeKey, { app: c.appName(appId) }));
    const session = c.session;
    const asked = running && knows ? this.#askToOpen(session, opening, noticeKey) : true;
    // le fichier part une seule fois, avec l'appel : une réouverture de l'app (`activate` avec l'ouverture gardée) ne le reprend pas
    if (running && carriesFile(opening)) c.opening = null;
    const opened = await asked;
    // « Ouverts » n'apprend que ce que l'app a ouvert (pas un refus de la personne, ni une app qui ne connaît pas l'appel)
    if (opened && knows) this.#remember(appId, opening, session);
    return opened;
  }

  // La vue « Ouverts » (js/explorer/opened-files.js) : un fichier précis ouvert dans l'app entre dans la liste et c'est lui qu'elle affiche ; un fichier vierge
  // (« Nouveau ») ou d'après un autre (« Importer ») n'en est pas un, et l'app n'affiche plus aucun fichier de la liste. Un fichier que GFS garde et fait lire
  // a sa propre entrée (`#openKept`).
  #remember(appId, opening, session) {
    const file = opening && opening.fichier;
    if (file && file.id !== undefined && file.id !== null) this.c.opened.add(fileKey(appId, file.id), session);
    else this.c.opened.none();
  }

  // Quitter l'app active pour une autre (contrats 5.4, point 3) : GFS lui demande de se fermer ; elle enregistre ou pose sa question, derrière l'explorateur
  // qu'on referme pour qu'elle se voie.
  // `false` : la personne reste (elle a annulé dans l'app, ou n'a pas voulu fermer) ou a fait autre chose entre-temps. Une app qui n'a pas demandé son contexte
  //   n'a encore rien à enregistrer. Rien à demander quand la même app reste ou que l'app visée ne peut être activée (l'app active resterait alors en place :
  //   elle n'a rien arrêté). Une app qui a dit oui puis reste (la personne est revenue à l'explorateur) reçoit « rester ».
  async leave(reason, target) {
    const { c } = this;
    const session = c.session;
    if (!session || session.id === target || !c.contextServed || !c.openable(target)) return true;
    const run = ++this.#leaveRun;
    c.hideExplorer();
    const app = c.appName(session.id);
    const where = () => (session !== c.session ? 'gone' : run === this.#leaveRun ? 'now' : 'moved');
    return leaveApp(session, reason, { offer: fault => c.ask(leaveQuestion({ t: c.t, app, fault })), where });
  }

  // Un fichier que GFS garde (contrats 5.4, point 8) : lu dans l'app qui sait le lire, une fois ses octets chargés ; l'app pas prête dit ce qui la débloque ;
  // aucune app qui le lise, il se télécharge.
  async #openKept(file) {
    const { c } = this;
    const reader = c.readerOf(file);
    if (!reader) { await c.kept.open(file); return; }
    if (reader.lock) { await c.unlock(reader.lock); return; }
    const bytes = await c.kept.load(file);
    if (bytes && (await this.openIn(reader.app, readOpening(file, bytes, c.explorer.state.path), 'ex.notice.read'))) c.opened.add(file.key, c.session);
  }

  // L'app ouvre le fichier elle-même, après sa propre question d'enregistrement : `{ ouvert: false }` veut dire que la personne a annulé, GFS n'ajoute rien.
  // Une app qui ne connaît pas l'appel (GFS_INCONNU) reçoit la phrase provisoire ; une autre erreur est dite avec son texte.
  async #askToOpen(session, opening, noticeKey) {
    const { c } = this;
    try {
      const answer = await session.openFile(opening);
      return Boolean(answer && answer.ouvert);
    } catch (error) {
      if (session !== c.session) return false; // l'app a été fermée ou remplacée pendant l'attente : plus rien à dire
      const app = c.appName(session.id);
      if (error && error.code === ERR.INCONNU) c.notice(c.t(noticeKey, { app }));
      else c.notice(c.t('ex.notice.openFailed', { app, reason: String((error && error.message) || '').slice(0, 120) }));
      return false;
    }
  }
}
