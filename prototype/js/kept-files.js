// Les fichiers que GFS garde lui-même (contrats 6.6), côté personne : « Nouveau > Importer > PDF », le téléchargement, la suppression, les phrases qui disent ce qui s'est passé. Ce module
// lie les gestes de l'explorateur, les fenêtres du widget (js/conflict-window.js, js/ask-window.js) et les données (js/files-store.js) ; le contrôleur lui prête ce qu'il sait faire
// (l'accord de la personne, une phrase, la relecture de la liste) et l'explorateur l'interroge pour ne rien savoir lui-même d'un PDF.

import { FILES_APP, FILES_MANIFEST, PDF_EXTENSION, PDF_MIME, cleanName, looksLikePdf } from './gfs-files.js';
import { importFormats, acceptsFile, pickFile } from './import-file.js';
import { TransferError } from './transfer.js';
import { TableDeclined } from './own-table.js';
import { askConflict } from './conflict-window.js';
import { ask } from './ask-window.js';
import { label } from './manifest.js';
import { formatDate, person } from './explorer-model.js';

const REASON_MAX = 120;

// Pourquoi un transfert a échoué, dit à la personne : la clé du texte, et ses variables.
function reasonKey(error) {
  const byStatus = { 401: 'files.err.denied', 403: 'files.err.denied', 404: 'files.err.gone', 413: 'files.err.tooBig' };
  const byKind = { network: 'files.err.network', frame: 'files.err.frame', token: 'files.err.token', timeout: 'files.err.timeout' };
  if (error.kind === 'http') return byStatus[error.status] || 'files.err.http';
  return byKind[error.kind] || null;
}

export class KeptFiles {
  #opts;
  #store;

  // opts : { store (js/files-store.js), doc (le document de la page), container, inertTargets(), t(clé, vars), lang(), locale(), now(), fullAccess(), readonly(), notice(texte), refresh() -> Promise,
  //          folder() -> le dossier ouvert dans l'explorateur, rangement (js/rangement.js : pour ranger un fichier dans ce dossier),
  //          reader?(fichier) -> { name, lock } | null : l'app qui lit ce fichier (js/reading.js), son nom et son grisé (null : prête) ; null quand aucune app ne le lit }
  constructor(opts) {
    this.#opts = { reader: () => null, ...opts };
    this.#store = opts.store;
  }

  // ---------- ce que l'explorateur demande ----------

  has = file => file.app === FILES_APP;

  // Le geste principal d'un fichier que GFS garde : « Lire » quand une app le lit (grisé tant qu'elle n'est pas prête : le clic dit ce qui la débloque), sinon « Télécharger ». Le bouton, l'article
  // du menu et la phrase de la barre d'information le disent.
  openAs = file => {
    const reader = this.#opts.reader(file);
    return reader ? { label: this.#opts.t('files.read'), icon: 'read', greyed: Boolean(reader.lock) } : { label: this.#opts.t('files.download'), icon: 'download', greyed: false };
  };

  opensIn = file => {
    const reader = this.#opts.reader(file);
    if (!reader) return this.#opts.t('files.opensIn');
    return reader.lock ? reader.lock.text : this.#opts.t('ex.opensIn', { app: reader.name });
  };

  // Ce que le menu d'une ligne offre en plus du geste principal : télécharger, quand le geste principal est de lire.
  extras = file => (this.#opts.reader(file) ? [{ label: this.#opts.t('files.download'), icon: 'download', run: () => void this.open(file) }] : []);

  copyNotice = () => this.#opts.t('files.noCopy');

  // Les articles du sous-menu « Importer » : un par format que GFS garde (le PDF), grisé avec sa raison quand rien ne peut s'écrire.
  importEntries() {
    const { t, lang } = this.#opts;
    const lock = this.#lock();
    return importFormats(FILES_MANIFEST).map(({ item, type }) => ({
      app: FILES_APP, type: type.valeur, icon: type.icone, family: null, greyed: Boolean(lock), focus: null, reason: lock ? lock.text : '',
      valeur: item.valeur, extensions: item.extensions, label: label(item.nom, lang()), hint: lock ? (lock.hint || lock.text) : t('files.import.hint'),
    }));
  }

  // Ce qui empêche d'écrire : pas l'accès complet, ou un document en lecture seule.
  #lock() {
    const { t } = this.#opts;
    if (!this.#opts.fullAccess()) return { text: t('gfs.needsFullAccess'), hint: t('gfs.needsFullAccessHint') };
    return this.#opts.readonly() ? { text: t('files.readonly'), hint: t('files.readonlyHint') } : null;
  }

  // ---------- importer ----------

  // Le sélecteur de fichier s'ouvre tout de suite (dans le geste de la personne : le navigateur refuse sinon), puis les vérifications, la décision en cas de nom pris, l'envoi.
  async importFile(entry) {
    const { t, notice } = this.#opts;
    if (entry.greyed) { notice(entry.reason || entry.hint); return; }
    const file = await pickFile(this.#opts.doc, entry.extensions.join(','));
    if (!file) return;
    const name = cleanName(file.name);
    try {
      const problem = await this.#check(file, entry);
      if (problem) { notice(problem); return; }
      const result = await this.#store.add({ file, name, decide: (existing, copy) => this.#decide(existing, copy), onUpload: () => notice(t('files.sending', { name })) });
      if (result) {
        notice(this.#saidAfter(result, name));
        await this.#file(result);
      }
    } catch (error) {
      notice(this.#failure(error, 'files.failed', { name }));
    }
    await this.#opts.refresh();
  }

  // Un fichier du bon format, non vide, qui commence comme un PDF : le problème, dit à la personne, ou ''.
  async #check(file, entry) {
    const { t } = this.#opts;
    if (!acceptsFile(file.name, entry.extensions)) return t('ex.import.wrong', { name: file.name, format: entry.label, extensions: entry.extensions.join(', ') });
    if (file.size === 0) return t('files.empty', { name: file.name });
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    return looksLikePdf(head) ? '' : t('files.notPdf', { name: file.name });
  }

  // Un nom déjà pris : la personne choisit (js/conflict-window.js). Le fichier existant est décrit par sa date et son auteur ; `copy` est le nom que prendrait la copie.
  #decide(existing, copy) {
    const { t, locale, now } = this.#opts;
    const who = person(existing.by).name;
    const when = typeof existing.ts === 'number' ? t('ex.modifiedOn', { date: formatDate(existing.ts, new Date(now()), locale(), t) }) : '';
    const detail = [when, who ? t('ex.modifiedBy', { by: who }) : ''].filter(Boolean).join(' · ');
    return askConflict({ container: this.#opts.container, inertTargets: this.#opts.inertTargets, t, name: existing.name, detail, copy });
  }

  // La phrase qui dit ce que GFS a fait.
  #saidAfter(result, asked) {
    const { t } = this.#opts;
    if (result.status === 'replaced') return t('files.replaced', { name: result.name });
    return result.name === asked ? t('files.added', { name: result.name }) : t('files.copied', { name: result.name });
  }

  // Un fichier ajouté va dans le dossier ouvert, comme un fichier créé dans une app : le rangement de la personne le sait (js/rangement.js).
  async #file(result) {
    const folder = this.#opts.folder();
    if (result.status !== 'added' || !folder) return;
    try {
      await this.#opts.rangement.setFiling([{ app: FILES_APP, file: result.id, pinned: false, folder }]);
    } catch (error) {
      this.#opts.notice(error instanceof TableDeclined ? this.#opts.t('ex.filingDeclined') : this.#failure(error, 'ex.filingFailed'));
    }
  }

  #failure(error, key, vars = {}) {
    const { t } = this.#opts;
    if (error instanceof TableDeclined) return t('files.declined');
    console.warn('GFS : le fichier n’a pas pu être traité', error);
    const reason = error instanceof TransferError && reasonKey(error)
      ? t(reasonKey(error), { status: error.status, message: error.message })
      : String((error && error.message) || error).slice(0, REASON_MAX);
    return t(key, { ...vars, reason });
  }

  // ---------- télécharger, supprimer ----------

  async open(file) {
    const { t, notice, doc } = this.#opts;
    notice(t('files.downloading', { name: file.name }));
    try {
      const { blob, name } = await this.#store.download(file);
      saveBlob(doc, blob, name);
      notice(t('files.downloaded', { name }));
    } catch (error) {
      notice(this.#failure(error, 'files.downloadFailed', { name: file.name }));
    }
  }

  // Lire : les octets du fichier, prêts à être remis à l'app qui le lit, en objet `File` au nom du fichier (contrats 5.4, point 8). Rend `null` quand le transfert a échoué : la phrase est dite.
  async load(file) {
    const { t, notice } = this.#opts;
    notice(t('files.reading', { name: file.name }));
    try {
      const { blob, name } = await this.#store.download(file);
      return new File([blob], name, { type: PDF_MIME });
    } catch (error) {
      notice(this.#failure(error, 'files.readFailed', { name: file.name }));
      return null;
    }
  }

  // La suppression demande confirmation (une fenêtre du widget) : le fichier disparaît du document, pour tout le monde.
  async remove(file) {
    const { t, notice } = this.#opts;
    const blocked = this.#lock();
    if (blocked) { notice(blocked.text); return; }
    const name = file.name || t('ex.untitled');
    const yes = await ask({
      container: this.#opts.container, inertTargets: this.#opts.inertTargets, title: t('files.remove.title', { name }), message: t('files.remove.text'),
      confirmLabel: t('files.remove.confirm'), cancelLabel: t('table.cancel'), safeFirst: true,
    });
    if (!yes) return;
    try {
      await this.#store.remove(file);
      notice(t('files.removed', { name }));
    } catch (error) {
      notice(this.#failure(error, 'files.removeFailed', { name }));
    }
    await this.#opts.refresh();
  }
}

// Le fichier téléchargé est offert au navigateur sous son nom : un lien invisible, cliqué ici même.
export function saveBlob(doc, blob, name) {
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = name.toLowerCase().endsWith(PDF_EXTENSION) ? name : `${name}${PDF_EXTENSION}`;
  link.hidden = true;
  doc.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
