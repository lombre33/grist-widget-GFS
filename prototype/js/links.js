// Les liens entre apps (contrats 5.4, points 2 et 7) : une app demande à GFS de lui faire choisir un fichier d'une autre app (`choisir`), puis de l'ouvrir plus tard (`ouvrir`). Elle garde la
// clé { app, id, type } que rend `choisir` ; GFS n'écrit rien pour elle et ne lit rien de ses tables. Ce module lit les deux demandes (sans effet de bord) et mène les deux appels ; le
// contrôleur lui prête ce qu'il sait faire (l'explorateur, le grisé et sa fenêtre, l'ouverture d'une app) par l'objet `host` : ni lui ni ce module ne connaît le code d'une app.

import { ERR, Refus } from './filter.js';

const NAME_MAX = 64;
const ID_MAX = 200;
const TITLE_MAX = 120;
const LIST_MAX = 16;

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const shortText = (value, max) => typeof value === 'string' && value.trim() !== '' && value.length <= max;
const refuse = message => new Refus(ERR.REFUSE, message);

// Une liste de 1 à 16 noms courts (`types`, `apps`), sans doublon.
function nameList(value, where) {
  if (!Array.isArray(value) || value.length === 0 || value.length > LIST_MAX || !value.every(item => shortText(item, NAME_MAX))) {
    throw refuse(`${where} : une liste de 1 à ${LIST_MAX} noms est attendue.`);
  }
  return [...new Set(value)];
}

// `choisir { types, apps?, titre? }` (5.4, point 2) -> { types, apps | null, titre }. Une forme hors règle est refusée (GFS_REFUSE) avant que rien ne s'ouvre ; `titre` est un texte que GFS montre tel
// quel (déjà traduit par l'app), sur une ligne et au plus 120 signes.
export function readChoice(args) {
  const { titre } = args;
  if (titre !== undefined && typeof titre !== 'string') throw refuse('choisir : titre doit être un texte.');
  return {
    types: nameList(args.types, 'choisir : types'),
    apps: args.apps === undefined ? null : nameList(args.apps, 'choisir : apps'),
    titre: (titre || '').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX),
  };
}

// Les fichiers que cette demande peut désigner : leur type est demandé ET offert par leur app (`actions.choisir`, 2.7 point 2), et leur app figure dans `apps` quand la demande en donne.
export function chooser(manifests, { types, apps }) {
  const offered = new Map(manifests.map(manifest => [manifest.id, new Set((manifest.actions && manifest.actions.choisir) || [])]));
  return file => types.includes(file.type) && (!apps || apps.includes(file.app)) && Boolean(offered.get(file.app) && offered.get(file.app).has(file.type));
}

// `ouvrir { app, fichier: { id, type }, raison? }` (5.4, point 7) -> { app, id, type }, l'`id` pris comme texte. `raison` ne peut valoir que « lien » ici : GFS donne lui-même la raison à l'app visée.
export function readOpen(args) {
  const file = isObject(args.fichier) ? args.fichier : {};
  const id = Number.isInteger(file.id) ? String(file.id) : file.id;
  if (!shortText(args.app, NAME_MAX) || !shortText(id, ID_MAX) || !shortText(file.type, NAME_MAX)) throw refuse('ouvrir : { app, fichier: { id, type } } est attendu.');
  if (args.raison !== undefined && args.raison !== 'lien') throw refuse('ouvrir : raison ne peut valoir que « lien ».');
  return { app: args.app, id: id.trim(), type: file.type };
}

export class AppLinks {
  #host;
  #choice = null;

  // host : { explorer(), session(), manifests(), appById(id), appName(id), fullAccess(), t(clé, vars), notice(texte), lockOf(fichier), unlock(grisé) -> Promise, showExplorer(), hideExplorer(),
  //          loadFiles(apps) -> Promise<{ files, problems }>, openIn(app, ouverture) -> Promise<boolean> }
  constructor(host) { this.#host = host; }

  // Les deux appels de l'app à GFS, pour la table des poignées de l'enveloppe (5.1).
  handlers(session) {
    return { choisir: args => this.choose(session, args), ouvrir: args => this.open(session, args) };
  }

  // ---------- choisir ----------

  // L'explorateur s'ouvre en mode choix, filtré par la demande ; la promesse se tient jusqu'au choix (`{ app, id, nom, type }`) ou à l'annulation (`null`). Un seul choix à la fois.
  choose(session, args) {
    const request = readChoice(args);
    const host = this.#host;
    if (!host.fullAccess()) throw new Refus(ERR.ACCES, host.t('gfs.needsFullAccess'));
    if (this.#choice) throw refuse('choisir : un choix de fichier est déjà en cours.');
    return new Promise(resolve => {
      this.#choice = { session, resolve, wasOpen: host.explorer().isOpen };
      host.explorer().enterChoice({ title: request.titre, accept: chooser(host.manifests(), request), onPick: file => this.#pick(file), onCancel: () => this.cancel() });
      host.showExplorer();
    });
  }

  // Un fichier grisé (app non installée, extension éteinte) ne se choisit pas : la fenêtre qui le débloque s'ouvre et le choix continue. `nom` est le nom que la personne a vu.
  #pick(file) {
    const host = this.#host;
    const lock = host.lockOf(file);
    if (lock) { void host.unlock(lock); return; }
    this.#end({ app: file.app, id: file.id, nom: file.name || host.t('ex.untitled'), type: file.type }, true);
  }

  // La personne annule (Annuler, Échap, Fermer) ou l'explorateur se ferme par un autre geste : `null`. `hide` : l'explorateur se referme sur l'app, sauf s'il était ouvert avant la demande.
  cancel(hide = true) { this.#end(null, hide); }

  // L'app qui demandait n'est plus là (retirée, remplacée) : le choix finit sans toucher à ce qui est affiché, le contrôleur décide de la suite.
  drop() { this.#end(null, false); }

  #end(result, hide) {
    const choice = this.#choice;
    if (!choice) return;
    this.#choice = null;
    this.#host.explorer().exitChoice();
    if (hide && !choice.wasOpen) this.#host.hideExplorer();
    choice.resolve(result);
  }

  // ---------- ouvrir ----------

  // GFS ouvre le fichier que l'app désigne par sa clé : l'app du fichier devient l'app active (celle qui a demandé s'en va, une seule app à la fois, 1.4), sauf si c'est elle, qui reçoit l'appel `ouvrir`.
  // Rend { ouvert } ; les refus ont leur code (3.6) : GFS_REFUSE (forme, type), GFS_ACCES, GFS_INTROUVABLE (app ou fichier), GFS_ANNULE (la personne n'a pas débloqué l'app).
  async open(session, args) {
    const want = readOpen(args);
    const host = this.#host;
    const target = host.appById(want.app);
    if (!target) throw new Refus(ERR.INTROUVABLE, `GFS ne connaît pas l'app « ${want.app} ».`);
    if (!((target.manifest.actions && target.manifest.actions.ouvrir) || []).includes(want.type)) throw refuse(`ouvrir : le type « ${want.type} » ne figure pas dans actions.ouvrir de l'app « ${want.app} ».`);
    if (!host.fullAccess()) throw new Refus(ERR.ACCES, host.t('gfs.needsFullAccess'));
    const file = await this.#find(target, want);
    this.#stillActive(session);
    await this.#unlocked(file);
    this.#stillActive(session);
    return { ouvert: await host.openIn(want.app, { fichier: { id: file.id, type: file.type }, type: file.type, dossier: file.folder, raison: 'lien' }) };
  }

  // L'app qui a demandé a été fermée ou remplacée pendant l'attente : rien ne s'ouvre (sa réponse n'a plus de destinataire).
  #stillActive(session) {
    if (session !== this.#host.session()) throw new Refus(ERR.INACTIF, `L'app n'est plus active.`);
  }

  // La ligne du fichier, relue dans la table de l'app visée (une lecture fraîche : la liste de l'explorateur peut dater). Un fichier qui n'y est plus, ou une table illisible, est dit à la personne.
  async #find(target, want) {
    const host = this.#host;
    const { files, problems } = await host.loadFiles([target]);
    const file = files.find(item => item.id === want.id && item.type === want.type);
    if (file) return file;
    const app = host.appName(want.app);
    const reason = problems.length ? problems[0].reason : '';
    host.notice(reason ? host.t('ex.readFailed', { app, reason }) : host.t('link.gone', { app }));
    throw new Refus(ERR.INTROUVABLE, reason ? `La table des fichiers de l'app « ${want.app} » est illisible : ${reason}` : `Le fichier ${want.id} (${want.type}) n'est plus dans la table de l'app « ${want.app} ».`);
  }

  // Un fichier grisé : la fenêtre qui le débloque s'ouvre comme au clic dans l'explorateur, et l'appel attend qu'elle se ferme ; la personne qui ne le débloque pas annule (GFS_ANNULE).
  async #unlocked(file) {
    const host = this.#host;
    if (!host.lockOf(file)) return;
    await host.unlock(host.lockOf(file));
    const still = host.lockOf(file);
    if (still) throw new Refus(ERR.ANNULE, still.text);
  }
}
