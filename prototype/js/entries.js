// Ce que l'explorateur demande à GFS pour s'afficher (contrats 5.4, point 1, et 6.5, point 3) : le grisé et sa raison, les types du menu « Nouveau », les formats de son sous-menu « Importer », l'app qui
// lit un fichier que GFS garde. Sorti du contrôleur (js/controller.js) pour qu'il reste sous les 600 lignes de code de l'outil d'audit ; rien ne s'y garde : tout se lit sur le contrôleur (`c`) à l'appel,
// et le contrôleur prête ces quatre fonctions à l'explorateur, aux liens entre apps et aux gardiens des fichiers.

import { label } from './manifest.js';
import { familyOf } from './explorer-model.js';
import { activeExtensionIds, extensionsOf } from './extensions.js';
import { rowKey } from './modules-window.js';
import { FILES_APP } from './gfs-files.js';
import { RECEIVED_APP } from './received-files.js';
import { importFormats, acceptsOpening } from './import-file.js';
import { readersOf, chooseReader } from './reading.js';

export class Entries {
  constructor(c) { this.c = c; }

  // Grisé, jamais masqué (charte) : un fichier d'une app non installée, un type absent du manifeste, un type d'une extension non active sont listés
  // avec la raison (contrats 5.4, point 1, et 6.5, point 3). `focus` : la ligne de la fenêtre « Apps et extensions » qui le débloque, s'il y en a une.
  lockOf = file => {
    const { c } = this;
    if (!c.fullAccess) return { text: c.t('gfs.needsFullAccess'), hint: c.t('gfs.needsFullAccessHint') };
    if (file.app === FILES_APP || file.app === RECEIVED_APP) return null; // un fichier que GFS garde, ou reçu d'un autre document et accepté : aucune app à installer (une arrivée en attente est grisée par js/received-control.js)
    if (!c.registry.has(file.app)) return { text: c.t('ex.lockedApp', { app: c.appName(file.app) }), focus: rowKey(file.app) };
    if (!file.known) return { text: c.t('ex.lockedType', { app: c.appName(file.app) }) };
    const extension = file.typeInfo.extension;
    if (extension && !this.isExtensionActive(file.app, extension)) {
      const entry = extensionsOf(c.registry.manifest(file.app)).find(item => item.id === extension);
      return { text: c.t('ex.lockedExtension', { name: entry ? label(entry.nom, c.lang) : extension }), focus: rowKey(file.app, extension) };
    }
    return null;
  };

  isExtensionActive = (appId, extensionId) => {
    const { registry } = this.c;
    return activeExtensionIds(registry.manifest(appId), registry.apps[appId], registry.catalogue).includes(extensionId);
  };

  // Le menu « Nouveau » : un article par type que l'app sait ouvrir (`actions.ouvrir`), le nom de l'app quand il y en a plusieurs.
  newTypes = () => {
    const several = this.c.registry.installedIds().length > 1;
    const entries = [];
    for (const { manifest } of this.c.validApps()) {
      const canOpen = new Set((manifest.actions && manifest.actions.ouvrir) || []);
      for (const spec of manifest.fichiers || []) {
        for (const type of spec.types || []) {
          if (canOpen.has(type.valeur)) entries.push(this.#newEntry(manifest, type, several));
        }
      }
    }
    return entries;
  };

  // Le sous-menu « Importer » : un article par format que le manifeste d'une app déclare (`actions.importer`, contrats 2.7, point 4), au nom du format ; le type qu'il crée le suit (l'icône et le mot du type vont ensemble).
  // Puis les formats que GFS garde lui-même (les PDF), et l'arrivée d'un partage d'un autre document Grist.
  importTypes = () => {
    const { c } = this;
    const several = c.registry.installedIds().length > 1;
    return [...c.validApps().flatMap(({ manifest }) => importFormats(manifest).map(format => this.#importEntry(manifest, format, several))), ...c.kept.importEntries(), c.otherDocuments.entry()];
  };

  // Qui lit ce fichier que GFS garde (js/reading.js) : { app, name, lock } avec le grisé de l'app qui sert (`null` : prête), ou `null` quand aucune app du catalogue ne le lit (il se télécharge).
  readerOf = file => {
    const { c } = this;
    const chosen = chooseReader(readersOf(c.manifests(), file.type), reader => this.#readLock(reader));
    return chosen && { app: chosen.reader.manifest.id, name: c.appName(chosen.reader.manifest.id), lock: chosen.lock };
  };

  // Ce que les articles de « Nouveau » et de son sous-menu « Importer » ont en commun : l'app, le type créé, son icône et sa famille de couleur, et le grisé avec sa raison (`reason`, dite au clic).
  #entry(manifest, type, lock) {
    return {
      app: manifest.id, type: type.valeur, icon: type.icone || 'doc', family: lock ? null : familyOf(type.couleur) || null,
      greyed: Boolean(lock), focus: lock ? lock.focus : null, reason: lock ? lock.text : '',
    };
  }

  // Un article du menu « Nouveau » : grisé avec sa raison et son rappel court (`hint`, sous le nom).
  #newEntry(manifest, type, several) {
    const { c } = this;
    const lock = this.lockOf({ app: manifest.id, known: true, typeInfo: type });
    return { ...this.#entry(manifest, type, lock), label: label(type.nom, c.lang), hint: lock ? (lock.hint || lock.text) : (several ? label(manifest.nom, c.lang) : '') };
  }

  #importEntry(manifest, { item, type }, several) {
    const { c } = this;
    const lock = this.lockOf({ app: manifest.id, known: true, typeInfo: type }) || this.#importLock(manifest.id);
    const shown = [label(type.nom, c.lang), several ? label(manifest.nom, c.lang) : ''].filter(Boolean).join(' · ');
    return { ...this.#entry(manifest, type, lock), valeur: item.valeur, extensions: item.extensions, label: label(item.nom, c.lang), hint: lock ? (lock.hint || lock.text) : shown };
  }

  // Une app qui ne reçoit pas encore le fichier : le format est grisé et le clic dit quoi faire en attendant (jamais un sélecteur de fichier pour rien).
  #importLock(appId) {
    const { c } = this;
    return acceptsOpening(c.manifestOf(appId), 'importer') ? null : { text: c.t('ex.import.notYet', { app: c.appName(appId) }), hint: c.t('ex.import.notYetHint') };
  }

  // Ce qui empêche l'app de lire : le grisé ordinaire (accès, app à installer, extension éteinte), puis le « pas encore » d'une app qui ne reçoit pas le fichier.
  #readLock({ manifest, item }) {
    const { c } = this;
    const lock = this.lockOf({ app: manifest.id, known: true, typeInfo: { extension: item.extension } });
    return lock || (acceptsOpening(manifest, 'lire') ? null : { text: c.t('files.read.notYet', { app: c.appName(manifest.id) }) });
  }
}
