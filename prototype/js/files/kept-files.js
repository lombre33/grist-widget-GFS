// Les fichiers que GFS garde lui-même (contrats 6.6), côté personne : « Nouveau > Importer > PDF », le téléchargement, les gestes de la corbeille, les phrases
// qui disent ce qui s'est passé, et le dépôt d'une app qui range un fichier (js/broker/deposit.js). Ce module lie les gestes de l'explorateur, les fenêtres du
// widget (js/files/conflict-window.js, js/ui/ask-window.js) et les données (js/files/files-store.js) ; le contrôleur lui prête ce qu'il sait faire (l'accord de
// la personne, une phrase, la relecture de la liste) et l'explorateur l'interroge pour ne rien savoir lui-même d'un PDF.

import { isAcceptedReceived } from '../sharing/received-files.js';
import { FILES_APP, FILES_MANIFEST, PDF_EXTENSION, PDF_MIME, cleanName, looksLikePdf } from './gfs-files.js';
import { importFormats, acceptsFile, pickFile } from './import-file.js';
import { TransferError } from '../broker/transfer.js';
import { TableDeclined } from './own-table.js';
import { askConflict } from './conflict-window.js';
import { label } from '../apps/manifest.js';
import { ERR, Refus } from '../broker/filter.js';
import { Deposit } from '../broker/deposit.js';
import { formatDate, person, familyOf } from '../explorer/explorer-model.js';

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
  #deposits;

  // opts : { store (js/files/files-store.js), doc (le document de la page), container, inertTargets(), t(clé, vars), lang(), locale(), now(), fullAccess(),
  //   readonly(), notice(texte), refresh() -> Promise,
  //          folder() -> le dossier ouvert dans l'explorateur, rangement (js/files/rangement.js : pour ranger un fichier dans ce dossier),
  //          reader?(fichier) -> { name, lock } | null : l'app qui lit ce fichier (js/broker/reading.js), son nom et son grisé (null : prête) ; null quand
  //          aucune app
  //          ne le lit,
  //          session?() -> l'app active (celle qui range un fichier doit l'être encore quand son tour vient), conflict? (la fenêtre du nom pris :
  //          js/files/conflict-window.js, par défaut) }
  constructor(opts) {
    this.#opts = { reader: () => null, session: () => null, conflict: askConflict, ...opts };
    this.#store = opts.store;
    this.#deposits = new Deposit({ kept: this, session: () => this.#opts.session(), appName: session => label(session.manifest.nom, this.#opts.lang()) });
  }

  // Les appels d'une app à GFS qui touchent ce qu'il garde : `ranger` (js/broker/deposit.js, contrats 5.4, point 9), pour la table des poignées de l'enveloppe
  // (5.1).
  handlers(session) { return this.#deposits.handlers(session); }

  // ---------- ce que l'explorateur demande ----------

  // Un fichier que GFS garde se lit comme tel : les PDF de `GFS_Fichiers`, et ceux qu'un autre document a partagés et que la personne a acceptés
  // (js/sharing/received-files.js : ils sont dans une table `GFS_Recus`).
  has = file => file.app === FILES_APP || isAcceptedReceived(file);

  // La corbeille (js/files/trash.js) : GFS garde ces fichiers, il sait donc les mettre à la corbeille, les restaurer et les supprimer pour de bon. `lock()` : {
  // text } quand rien ne peut s'écrire. Un fichier reçu n'est à nous que pour le lire : la table qui le porte appartient au partage.
  manages = file => file.app === FILES_APP;

  lock = () => this.#lock('trash.readonly');

  // Le geste principal d'un fichier que GFS garde : « Lire » quand une app le lit (grisé tant qu'elle n'est pas prête : le clic dit ce qui la débloque), sinon
  // « Télécharger ». Le bouton, l'article du menu et la phrase de la barre d'information le disent.
  openAs = file => {
    const reader = this.#opts.reader(file);
    return reader ? { label: this.#opts.t('files.read'), icon: 'read', greyed: Boolean(reader.lock) } :
      { label: this.#opts.t('files.download'), icon: 'download', greyed: false };
  };

  opensIn = file => {
    const reader = this.#opts.reader(file);
    if (!reader) return this.#opts.t('files.opensIn');
    return reader.lock ? reader.lock.text : this.#opts.t('ex.opensIn', { app: reader.name });
  };

  // Ce que le menu d'une ligne offre en plus du geste principal : télécharger, quand le geste principal est de lire.
  extras = file => (this.#opts.reader(file) ? [{ label: this.#opts.t('files.download'), icon: 'download', run: () => void this.open(file) }] : []);

  // Les articles du sous-menu « Importer » : un par format que GFS garde (le PDF), grisé avec sa raison quand rien ne peut s'écrire.
  importEntries() {
    const { t, lang } = this.#opts;
    const lock = this.#lock();
    return importFormats(FILES_MANIFEST).map(({ item, type }) => ({
      app: FILES_APP, type: type.valeur, icon: type.icone, family: familyOf(type.couleur) || null, greyed: Boolean(lock), focus: null,
        reason: lock ? lock.text : '',
      valeur: item.valeur, extensions: item.extensions, label: label(item.nom, lang()), hint: lock ? (lock.hint || lock.text) : t('files.import.hint'),
    }));
  }

  // Ce qui empêche d'écrire : pas l'accès complet, ou un document en lecture seule (`readonlyKey` : le texte de ce que la personne voulait faire).
  #lock(readonlyKey = 'files.readonly') {
    const { t } = this.#opts;
    if (!this.#opts.fullAccess()) return { text: t('gfs.needsFullAccess'), hint: t('gfs.needsFullAccessHint') };
    return this.#opts.readonly() ? { text: t(readonlyKey), hint: t('files.readonlyHint') } : null;
  }

  // ---------- importer ----------

  // Le sélecteur de fichier s'ouvre tout de suite (dans le geste de la personne : le navigateur refuse sinon), puis les vérifications, la décision en cas de
  // nom pris, l'envoi.
  async importFile(entry) {
    const { t, notice } = this.#opts;
    if (entry.greyed) { notice(entry.reason || entry.hint); return; }
    const file = await pickFile(this.#opts.doc, entry.extensions.join(','));
    if (!file) return;
    const name = cleanName(file.name);
    try {
      const problem = await this.#check(file, entry);
      if (problem) { notice(problem); return; }
      const result = await this.#store.add({ file, name, decide: (existing, copy) => this.#decide(existing, copy),
        onUpload: () => notice(t('files.sending', { name })) });
      if (result) {
        notice(this.#saidAfter(result, name));
        const unfiled = await this.#file(result, this.#opts.folder());
        if (unfiled) notice(unfiled instanceof TableDeclined ? t('ex.filingDeclined') : this.#failure(unfiled, 'ex.filingFailed'));
      }
    } catch (error) {
      notice(this.#failure(error, 'files.failed', { name }));
    }
    await this.#opts.refresh();
  }

  // Un fichier du bon format, non vide, qui commence comme un PDF : le problème, dit à la personne, ou ''.
  async #check(file, entry) {
    const { t } = this.#opts;
    if (!acceptsFile(file.name, entry.extensions)) return t('ex.import.wrong', { name: file.name, format: entry.label,
      extensions: entry.extensions.join(', ') });
    return this.#content(file, file.name);
  }

  // Un fichier non vide qui commence comme un PDF (`name` : le nom que la phrase donne au fichier) : le problème, dit à la personne, ou ''.
  async #content(file, name) {
    const { t } = this.#opts;
    if (file.size === 0) return t('files.empty', { name });
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    return looksLikePdf(head) ? '' : t('files.notPdf', { name });
  }

  // Un nom déjà pris : la personne choisit (js/files/conflict-window.js). Le fichier existant est décrit par sa date et son auteur ; `copy` est le nom que
  // prendrait la copie ; `from` : { app, repeat } quand c'est une app qui range le fichier (la fenêtre la nomme, et offre la case « Faire pareil pour les
  // suivants » quand `repeat`). Rend { choice: 'replace' | 'both' | 'skip', again }.
  #askName(existing, copy, from = {}) {
    const { t, locale, now } = this.#opts;
    const who = person(existing.by).name;
    const when = typeof existing.ts === 'number' ? t('ex.modifiedOn', { date: formatDate(existing.ts, new Date(now()), locale(), t) }) : '';
    const detail = [when, who ? t('ex.modifiedBy', { by: who }) : ''].filter(Boolean).join(' · ');
    return this.#opts.conflict({ container: this.#opts.container, inertTargets: this.#opts.inertTargets, t, name: existing.name, detail, copy, ...from });
  }

  // Ce que le magasin attend de la décision : 'replace', 'both', ou null quand la personne renonce.
  async #decide(existing, copy) {
    const { choice } = await this.#askName(existing, copy);
    return choice === 'skip' ? null : choice;
  }

  // La phrase qui dit ce que GFS a fait.
  #saidAfter(result, asked) {
    const { t } = this.#opts;
    if (result.status === 'replaced') return t('files.replaced', { name: result.name });
    return result.name === asked ? t('files.added', { name: result.name }) : t('files.copied', { name: result.name });
  }

  // Un fichier ajouté va dans le dossier `folder`, comme un fichier créé dans une app : le rangement de la personne le sait (js/files/rangement.js). Un fichier
  // remplacé garde sa place. Rend l'erreur du rangement (le fichier est gardé quand même), ou null.
  async #file(result, folder) {
    if (result.status !== 'added' || !folder) return null;
    try {
      await this.#opts.rangement.setFiling([{ app: FILES_APP, file: result.id, pinned: false, folder }]);
      return null;
    } catch (error) {
      return error;
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

  // ---------- ranger (une app dépose un fichier : contrats 5.4, point 9) ----------

  // Une app demande à GFS de garder un PDF. `request` : { file (le Blob), name (celui de GFS, avec « .pdf »), app (son identifiant : la colonne `Origine`),
  // appName, folder (le dossier de la personne où va un fichier nouveau, '' : aucun), repeat (offrir « Faire pareil pour les suivants »), batch (ce qui vaut
  // pour tout le lot : { choice, declined, noFolder }) }. Rend { status: 'added' | 'replaced' | 'copied' | 'skipped', id, name }. Un refus est un `Refus` (ses
  // codes : contrats 3.6) : GFS_ACCES ou GFS_LECTURE_SEULE (rien ne s'écrit), GFS_REFUSE (le fichier est vide ou n'est pas un PDF), GFS_ANNULE (la personne
  // refuse de créer la table), GFS_ECHEC (Grist ou le cadre d'envoi n'ont pas suivi). GFS ne dit rien à la personne en dehors de ses fenêtres : c'est l'app qui
  // lui rend compte.
  async deposit({ file, name, app, appName, folder, repeat, batch }) {
    const { t } = this.#opts;
    const blocked = this.#lock();
    if (blocked) throw new Refus(this.#opts.fullAccess() ? ERR.LECTURE_SEULE : ERR.ACCES, blocked.text);
    if (batch.declined) throw new Refus(ERR.ANNULE, t('files.declined'));
    const problem = await this.#content(file, name);
    if (problem) throw new Refus(ERR.REFUSE, problem);
    try {
      const result = await this.#store.add({ file, name, origin: app, decide: (existing, copy) =>
        this.#decideFor(existing, copy, { appName, repeat, batch }) });
      if (!result) return { status: 'skipped', id: null, name: null };
      if (!batch.noFolder) await this.#filedIn(result, folder, batch);
      return { status: result.status === 'replaced' ? 'replaced' : (result.name === name ? 'added' : 'copied'), id: result.id, name: result.name };
    } catch (error) {
      if (error instanceof TableDeclined) { batch.declined = true; throw new Refus(ERR.ANNULE, t('files.declined')); }
      throw new Refus(ERR.ECHEC, this.#failure(error, 'files.failed', { name }));
    }
  }

  // Un nom pris par un fichier qu'une app range : la réponse retenue pour le lot (« Faire pareil pour les suivants ») vaut sans rien demander ; sinon la
  // fenêtre, qui nomme l'app.
  async #decideFor(existing, copy, { appName, repeat, batch }) {
    const answer = batch.choice ? { choice: batch.choice, again: false } : await this.#askName(existing, copy, { app: appName, repeat });
    if (answer.again) batch.choice = answer.choice;
    return answer.choice === 'skip' ? null : answer.choice;
  }

  // Le dossier d'un fichier nouveau. Un rangement qui échoue ne perd pas le fichier : il est gardé, sans dossier ; la personne qui refuse de créer la table du
  // rangement n'est pas interrogée une seconde fois pour le même lot.
  async #filedIn(result, folder, batch) {
    const failed = await this.#file(result, folder);
    if (failed instanceof TableDeclined) batch.noFolder = true;
    else if (failed) console.warn('GFS : le fichier rangé par une app n’a pas pu être mis dans son dossier', failed);
  }

  // ---------- télécharger, lire ----------

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

  // Lire : les octets du fichier, prêts à être remis à l'app qui le lit, en objet `File` au nom du fichier (contrats 5.4, point 8). Rend `null` quand le
  //   transfert a échoué : la phrase est dite. « Ouverture de… » ne dure que le transfert : une fois fini, l'app prend le relais et la phrase s'efface
  //   (`hideNotice`, qui ne retire que cette phrase-là), au lieu de rester six secondes sur le PDF.
  async load(file) {
    const { t, notice, hideNotice = () => {} } = this.#opts;
    const reading = t('files.reading', { name: file.name });
    notice(reading);
    try {
      const { blob, name } = await this.#store.download(file);
      hideNotice(reading);
      return new File([blob], name, { type: PDF_MIME });
    } catch (error) {
      notice(this.#failure(error, 'files.readFailed', { name: file.name }));
      return null;
    }
  }

  // ---------- la corbeille ----------

  // Contrats 6.6, point 7. Les gestes seuls, sans question ni phrase : js/files/trash.js les demande à la personne, les dit et relit la liste. Rendus : voir
  // js/files/files-store.js.
  trash = file => this.#store.trash(file);

  restore = file => this.#store.restore(file);

  empty = files => this.#store.empty(files);

  // La copie (js/files/copying.js) : un PDF que GFS garde se copie ; le geste seul, comme les précédents (rendu : voir `copy` de js/files/files-store.js).
  copies = file => file.app === FILES_APP;

  copy = file => this.#store.copy(file);
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
