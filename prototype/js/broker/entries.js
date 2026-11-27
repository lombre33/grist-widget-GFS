// Ce que l'explorateur demande à GFS pour s'afficher (contrats 5.4, points 1 et 13, et 6.5, point 3) : le grisé et sa raison, les types du menu « Nouveau »,
// les formats de son sous-menu « Importer », les modèles de départ de « Depuis un modèle », l'app qui lit un fichier que GFS garde. Sorti du contrôleur
// (js/controller.js) pour qu'il reste sous les 600 lignes de code de l'outil d'audit ; rien ne s'y garde : tout se lit sur le contrôleur (`c`) à l'appel, et le
// contrôleur prête ces quatre fonctions à l'explorateur, aux liens entre apps et aux gardiens des fichiers.

import { label } from '../apps/manifest.js';
import { familyOf } from '../explorer/explorer-model.js';
import { activeExtensionIds, extensionsOf } from '../apps/extensions.js';
import { rowKey } from '../apps/modules-window.js';
import { FILES_APP } from '../files/gfs-files.js';
import { ANNUAIRES_APP, ANNUAIRES_MANIFEST } from '../files/annuaire-files.js';
import { GUIDES_APP, GUIDES_MANIFEST } from '../files/guide-files.js';
import { RECEIVED_APP } from '../sharing/received-files.js';
import { importFormats, acceptsOpening } from '../files/import-file.js';
import { readersOf, chooseReader } from './reading.js';
import { thumbUrl, templateTypeOf } from '../apps/templates-catalogue.js';

// Le type du manifeste d'une app (`fichiers[].types[]`, ou `modeles.type` pour une app sans fichier) : celui d'un modèle de son catalogue (parseCatalogue ne
// garde que des types déclarés).
const typeInfoOf = (manifest, value) => (manifest.fichiers || []).flatMap(spec => spec.types).find(type => type.valeur === value)
  || [templateTypeOf(manifest)].find(type => type && type.valeur === value);

export class Entries {
  constructor(c) { this.c = c; }

  // Grisé, jamais masqué (charte) : un fichier d'une app non installée, un type absent du manifeste, un type d'une extension non active sont listés
  // avec la raison (contrats 5.4, point 1, et 6.5, point 3). `focus` : la ligne de la fenêtre « Apps et extensions » qui le débloque, s'il y en a une.
  lockOf = file => {
    const { c } = this;
    if (!c.fullAccess) return { text: c.t('gfs.needsFullAccess'), hint: c.t('gfs.needsFullAccessHint') };
    // un fichier que GFS garde, ou reçu d'un autre document et accepté : aucune app à installer (une arrivée en attente est grisée par
    // js/sharing/received-control.js)
    // un annuaire ou un guide : le module de GFS qui le lit (js/annuaire/, js/guide/), aucune app à installer
    if (file.app === FILES_APP || file.app === RECEIVED_APP || file.app === ANNUAIRES_APP || file.app === GUIDES_APP) return null;
    if (!c.registry.has(file.app)) return { text: c.t('ex.lockedApp', { app: c.appName(file.app) }), focus: rowKey(file.app) };
    if (!file.known) return { text: c.t('ex.lockedType', { app: c.appName(file.app) }) };
    const extension = file.typeInfo.extension;
    if (extension && !this.isExtensionActive(file.app, extension)) {
      const entry = extensionsOf(c.registry.manifest(file.app)).find(item => item.id === extension);
      return { text: c.t('ex.lockedExtension', { name: entry ? label(entry.nom, c.lang) : extension }), focus: rowKey(file.app, extension) };
    }
    return null;
  };

  // Les apps qui acceptent qu'on leur pose une personne de l'annuaire (« Insérer dans… » de la fiche, contrats 2.7, point 8, et 5.4, point 16) : celles dont le
  // manifeste déclare `actions.personnes.inserer`. [{ id, name, where (les mots de l'app, dans la langue du moment), lock (ce qui la grise : le texte, ou ''),
  // focus (la ligne de la fenêtre « Apps et extensions » qui la débloque), ready (elle déclare aussi `ouverture.personne`) }].
  personTargets = () => {
    const { c } = this;
    return c.validApps().filter(({ manifest }) => manifest.actions && manifest.actions.personnes && manifest.actions.personnes.inserer).map(({ manifest }) => {
      const lock = this.lockOf({ app: manifest.id, known: true, typeInfo: { extension: null } });
      return { id: manifest.id, name: c.appName(manifest.id), where: label(manifest.actions.personnes.inserer, c.lang), lock: lock ? lock.text : '',
        focus: lock ? lock.focus || null : null, ready: acceptsOpening(manifest, 'personne') };
    });
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
    entries.push(this.#annuaireEntry(), this.#guideEntry());
    return entries;
  };

  // L'article « Annuaire » de « Nouveau » (retour du porteur, 25/11 : « juste annuaire ») : le module de GFS, aucune app. Le premier annuaire du document, ou
  // un sous-annuaire de celui qu'on voit (js/annuaire/annuaire-control.js, `createNew`) ; `kind` le distingue d'un type d'app (js/broker/openings.js,
  // `openNew`).
  #annuaireEntry() {
    const { c } = this;
    const type = ANNUAIRES_MANIFEST.fichiers[0].types[0];
    const lock = this.lockOf({ app: ANNUAIRES_APP, known: true, typeInfo: type });
    return { ...this.#entry(ANNUAIRES_MANIFEST, type, lock), kind: 'annuaire', label: label(type.nom, c.lang),
      hint: lock ? (lock.hint || lock.text) : c.t('an.newMenuHint') };
  }

  // L'article « Guide » de « Nouveau » (demande du porteur du 27/11) : le module de GFS, aucune app ; le réglage d'un nouveau guide (`kind` :
  // js/broker/openings.js).
  #guideEntry() {
    const { c } = this;
    const type = GUIDES_MANIFEST.fichiers[0].types[0];
    const lock = this.lockOf({ app: GUIDES_APP, known: true, typeInfo: type });
    return { ...this.#entry(GUIDES_MANIFEST, type, lock), kind: 'guide', label: label(type.nom, c.lang),
      hint: lock ? (lock.hint || lock.text) : c.t('gd.newMenuHint') };
  }

  // Le sous-menu « Importer » : un article par format que le manifeste d'une app déclare (`actions.importer`, contrats 2.7, point 4), au nom du format ; le
  // type qu'il crée le suit (l'icône et le mot du type vont ensemble). Puis les formats que GFS garde lui-même (les PDF), et l'arrivée d'un partage d'un autre
  // document Grist.
  importTypes = () => {
    const { c } = this;
    const several = c.registry.installedIds().length > 1;
    return [...c.validApps().flatMap(({ manifest }) => importFormats(manifest).map(format => this.#importEntry(manifest, format, several))),
      ...c.kept.importEntries(), c.otherDocuments.entry()];
  };

  // La galerie « Depuis un modèle » (contrats 5.4, point 13) : `loaded` est la liste des apps avec leurs modèles déjà lus (`{ manifest, models, state, reason
  // }`, js/apps/templates-control.js). Rend { apps, models } : une pastille par app (« ok », « soon » : pas de catalogue, « broken » : illisible) et un article
  // par modèle, grisé avec sa raison (accès, app à installer, extension du type ou du modèle, app qui ne sait pas encore ouvrir un modèle de départ).
  templates = loaded => {
    const { c } = this;
    return {
      apps: loaded.map(({ manifest, models, state, reason }) => ({ id: manifest.id, name: label(manifest.nom, c.lang), state, reason, count: models.length })),
      models: loaded.flatMap(({ manifest, models }) => models.map(model => this.#templateEntry(manifest, model))),
    };
  };

  // Qui lit ce fichier que GFS garde (js/broker/reading.js) : { app, name, lock } avec le grisé de l'app qui sert (`null` : prête), ou `null` quand aucune app
  // du catalogue ne le lit (il se télécharge).
  readerOf = file => {
    const { c } = this;
    // Le type d'un fichier REÇU est celui que l'envoyeur a écrit : GFS ne reçoit que des PDF, un autre type n'ouvre aucune app (le fichier se télécharge) —
    // sans cela un envoyeur choisirait l'app qui reçoit les octets (audit « contournement » du 11/11).
    if (file.received && !file.known) return null;
    const chosen = chooseReader(readersOf(c.manifests(), file.type), reader => this.#readLock(reader));
    return chosen && { app: chosen.reader.manifest.id, name: c.appName(chosen.reader.manifest.id), lock: chosen.lock };
  };

  // Ce que les articles de « Nouveau » et de son sous-menu « Importer » ont en commun : l'app, le type créé, son icône et sa famille de couleur, et le grisé
  // avec sa raison (`reason`, dite au clic).
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
    return { ...this.#entry(manifest, type, lock), label: label(type.nom, c.lang),
      hint: lock ? (lock.hint || lock.text) : (several ? label(manifest.nom, c.lang) : '') };
  }

  #importEntry(manifest, { item, type }, several) {
    const { c } = this;
    const lock = this.lockOf({ app: manifest.id, known: true, typeInfo: type }) || this.#importLock(manifest.id);
    const shown = [label(type.nom, c.lang), several ? label(manifest.nom, c.lang) : ''].filter(Boolean).join(' · ');
    return { ...this.#entry(manifest, type, lock), valeur: item.valeur, extensions: item.extensions, label: label(item.nom, c.lang),
      hint: lock ? (lock.hint || lock.text) : shown };
  }

  // Une app qui ne reçoit pas encore le fichier : le format est grisé et le clic dit quoi faire en attendant (jamais un sélecteur de fichier pour rien).
  #importLock(appId) {
    const { c } = this;
    return acceptsOpening(c.manifestOf(appId), 'importer') ? null : { text: c.t('ex.import.notYet', { app: c.appName(appId) }),
      hint: c.t('ex.import.notYetHint') };
  }

  #templateEntry(manifest, model) {
    const { c } = this;
    const type = typeInfoOf(manifest, model.type);
    const lock = this.lockOf({ app: manifest.id, known: true, typeInfo: type }) || this.#extensionsLock(manifest, model) || this.#templateLock(manifest.id);
    return { ...this.#entry(manifest, type, lock), id: model.id, label: label(model.nom, c.lang), description: label(model.description, c.lang),
      tags: (model.etiquettes || []).map(tag => label(tag, c.lang)), thumb: thumbUrl(manifest, model), tables: model.tables === true,
      typeLabel: label(type.nom, c.lang), appLabel: label(manifest.nom, c.lang) };
  }

  // Une extension que le modèle demande en plus de celle de son type, et qui n'est pas active : la ligne de la fenêtre « Apps et extensions » qui la débloque.
  #extensionsLock(manifest, model) {
    const { c } = this;
    const missing = (model.extensions || []).find(id => !this.isExtensionActive(manifest.id, id));
    if (!missing) return null;
    const entry = extensionsOf(manifest).find(item => item.id === missing);
    return { text: c.t('ex.lockedExtension', { name: entry ? label(entry.nom, c.lang) : missing }), focus: rowKey(manifest.id, missing) };
  }

  // Une app qui ne sait pas encore ouvrir un modèle de départ : le modèle est grisé et le clic dit quoi faire en attendant (jamais un modèle vierge à la
  // place).
  #templateLock(appId) {
    const { c } = this;
    return acceptsOpening(c.manifestOf(appId), 'modele') ? null : { text: c.t('ex.template.notYet', { app: c.appName(appId) }) };
  }

  // Ce qui empêche l'app de lire : le grisé ordinaire (accès, app à installer, extension éteinte), puis le « pas encore » d'une app qui ne reçoit pas le
  // fichier.
  #readLock({ manifest, item }) {
    const { c } = this;
    const lock = this.lockOf({ app: manifest.id, known: true, typeInfo: { extension: item.extension } });
    return lock || (acceptsOpening(manifest, 'lire') ? null : { text: c.t('files.read.notYet', { app: c.appName(manifest.id) }) });
  }
}
