// La lecture des fichiers que le contrôleur lance (js/controller.js : `refreshFiles`) et ce que l'explorateur en dit sous la liste : « chargement », « accès
// complet requis », les apps qu'on n'a pas pu lire. Sortie du contrôleur pour qu'il reste sous les 600 lignes de code de l'outil d'audit. La garde de séquence
// (seule la dernière lecture lancée fait foi) est celle de js/explorer/file-refresh.js.
//
// x : { port, apps() (les apps dont on lit les fichiers), prepare() (facultatif : ce qui se lit avant les tables, les noms que le document donne à celles des
//   apps : js/apps/doc-names.js), fullAccess(), rangement ({ learning }), reader (la lecture légère, js/explorer/explorer-sql.js),
//   explorer() (l'explorateur, ou null avant sa construction), openedBar(), appName(id), t(clé, variables), onSpaces(espaces), onFiles(fichiers) (la suite
//   d'une
//   lecture réussie : les dossiers partagés « à jour »), onStats(mesures) }

import { loadFiles } from './explorer-data.js';
import { createFileRefresh } from './file-refresh.js';
import { FILES_ENTRY } from '../files/gfs-files.js';

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
        this.#waited = typeof learning !== 'string';
        if (x.prepare) await x.prepare();
        return loadFiles(x.port, [...x.apps(), FILES_ENTRY], learning, x.reader);
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

  // Lit les fichiers : la dernière lecture lancée fait seule foi.
  refresh() { return this.#run(); }

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

  #loaded({ files, trash, folders, received, spaces, problems, stats }) {
    const x = this.#x;
    x.onSpaces(spaces);
    x.explorer().setFiles(files, trash, folders, received);
    x.onFiles(files);
    x.openedBar().sync(); // un fichier renommé, ou disparu, change le compte de la barre
    this.#say({ loading: false, restricted: false, problems: problems.map(item => ({ key: 'ex.readFailed', app: item.app, reason: item.reason })) });
    x.onStats(stats);
  }
}
