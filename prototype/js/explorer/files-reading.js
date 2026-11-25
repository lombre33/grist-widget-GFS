// La lecture des fichiers que le contrôleur lance (js/controller.js : `refreshFiles`) et ce que l'explorateur en dit sous la liste : « chargement », « accès
// complet requis », les apps qu'on n'a pas pu lire. Sortie du contrôleur pour qu'il reste sous les 600 lignes de code de l'outil d'audit. La garde de séquence
// (seule la dernière lecture lancée fait foi) est celle de js/explorer/file-refresh.js.
//
// x : { port, apps() (les apps dont on lit les fichiers), prepare() (facultatif : ce qui se lit avant les tables, les noms que le document donne à celles des
//   apps : js/apps/doc-names.js), fullAccess(), rangement ({ learning }), reader (la lecture légère, js/explorer/explorer-sql.js), explorer() (l'explorateur,
//   ou null avant sa construction), openedBar(), appName(id), t(clé, variables), onSpaces(espaces), onFiles(fichiers) (la suite d'une lecture réussie : les
//   dossiers partagés « à jour »), onStats(mesures), noteBin?(table) (la table de la corbeille existe, ou non : js/files/app-files.js), hint? (le souvenir d'un
//   document lourd, js/explorer/heavy-hint.js : la lecture légère d'emblée), pending? (les changements de rangement affichés avant d'être écrits,
//   js/explorer/pending.js : une lecture partie après leur confirmation les remplace), guard? (le garde-fou des lectures complètes,
//   js/explorer/read-guard.js) }

import { loadFiles } from './explorer-data.js';
import { createFileRefresh } from './file-refresh.js';
import { FILES_ENTRY } from '../files/gfs-files.js';
import { ANNUAIRES_ENTRY } from '../files/annuaire-files.js';

export class FilesReading {
  #x;
  // Ce que l'explorateur dit sous la liste, gardé pour être redit dans la langue qui vaut.
  #status = { loading: false, restricted: false, problems: [] };
  // La dernière lecture a-t-elle attendu l'adresse de la personne (qui s'apprenait encore) ? Alors son rangement est déjà le bon.
  #waited = false;
  #run;

  constructor(x) {
    this.#x = x;
    this.#run = createFileRefresh({
      canRead: () => x.fullAccess(),
      load: async () => {
        const { learning } = x.rangement;
        const stamp = x.pending ? x.pending.stamp() : 0;
        this.#waited = typeof learning !== 'string';
        if (x.prepare) await x.prepare();
        if (x.hint) await x.hint.prime(x.reader); // un document vu lourd à la visite précédente se lit d'emblée en lecture légère
        return { ...(await loadFiles(x.port, [...x.apps(), FILES_ENTRY, ANNUAIRES_ENTRY], learning, x.reader, x.guard || null)), stamp };
      },
      onRestricted: () => {
        x.explorer().setFiles([]);
        this.#say({ loading: false, restricted: true, problems: [{ key: 'gfs.needsFullAccess' }] });
      },
      onLoading: () => this.#say({ loading: true, restricted: false, problems: [] }),
      onLoaded: result => this.#loaded(result),
      onFailed: error => {
        console.error('GFS : lecture des fichiers impossible', error);
        this.#say({ loading: false, restricted: false, problems: [{ key: 'gfs.loadFailed', reason: String(error && error.message) }] });
      },
    });
  }

  // Lit les fichiers : la dernière lecture lancée fait seule foi. `quiet` : après un geste de rangement, sans « Lecture des fichiers… ».
  refresh(opts) { return this.#run(opts); }

  // Une lecture est en cours et attend l'adresse de la personne : la relancer jetterait ce qu'elle a lu.
  get waitingForIdentity() { return this.#status.loading && this.#waited; }

  // Redit sous la liste ce qu'elle dit déjà, dans la langue qui vaut.
  show() {
    const x = this.#x;
    const { loading, restricted, problems } = this.#status;
    x.explorer().setStatus({ loading, restricted, problems: problems.map(({ key, app, reason }) => x.t(key, { app: app ? x.appName(app) : '', reason })) });
  }

  #say(status) {
    this.#status = status;
    this.show();
  }

  #loaded({ files, trash, folders, received, spaces, problems, stats, stamp, gfsTable, binTable }) {
    const x = this.#x;
    x.onSpaces(spaces);
    x.rangement.note(gfsTable); // la table du rangement existe (ou non) : un geste de rangement le sait sans la relire
    if (x.noteBin) x.noteBin(binTable); // de même pour la table de la corbeille : mettre un fichier à la corbeille le sait
    if (x.pending) x.pending.retire(stamp);
    x.explorer().setFiles(files, trash, folders, received);
    x.onFiles(files);
    x.openedBar().sync(); // un fichier renommé, ou disparu, change le compte de la barre
    // une table que le garde-fou retient (js/explorer/read-guard.js) a sa phrase : elle dit pourquoi les fichiers manquent, et que GFS réessaiera
    this.#say({ loading: false, restricted: false,
      problems: problems.map(item => ({ key: item.held ? 'ex.readHeld' : 'ex.readFailed', app: item.app, reason: item.reason })) });
    x.onStats(stats);
    if (x.hint && !problems.length) x.hint.note(stats.bytes); // une app illisible n'est pas comptée : son poids manquant ne dirait pas « léger »
  }
}
