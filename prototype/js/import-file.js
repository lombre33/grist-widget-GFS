// « Importer » du menu « Nouveau » (contrats 2.7, point 4, et 5.4, point 1) : un fichier d'un autre logiciel (un classeur Excel, un Markdown, un PowerPoint) que la personne choisit
// dans le sélecteur de GFS et que l'app lit pour en faire un modèle vierge. Du code sans effet de bord, sauf le sélecteur.

// Les formats qu'une app reçoit (`actions.importer` du manifeste), chacun avec le type de fichier qu'il crée : [{ item, type }]. Un format dont le type n'est pas déclaré est écarté.
export function importFormats(manifest) {
  const types = new Map();
  for (const spec of manifest.fichiers || []) for (const type of spec.types || []) types.set(type.valeur, type);
  const declared = (manifest.actions && manifest.actions.importer) || [];
  return declared.filter(item => types.has(item.type)).map(item => ({ item, type: types.get(item.type) }));
}

// Le fichier choisi porte-t-il l'une des extensions du format ? Le sélecteur les propose, mais la personne peut choisir « Tous les fichiers ».
export const acceptsFile = (name, extensions) => extensions.some(extension => String(name).toLowerCase().endsWith(extension.toLowerCase()));

// L'ouverture qu'on passe à l'app (contrats 5.2, point 3) : « Nouveau » d'un type, avec le fichier à lire. `valeur` dit lequel des formats de l'app, `fichier` est l'objet `File` du navigateur
// (le sous-cadre le lit comme n'importe quel fichier choisi ; GFS ne le lit pas).
export const importOpening = (entry, file, folder) => ({ fichier: null, type: entry.type, dossier: folder, raison: 'importer', importation: { valeur: entry.valeur, fichier: file } });

// Le genre d'ouverture, tel que `ACCEPTS_OPEN` le range : ouvrir un fichier précis, en créer un vierge (« Nouveau »), ou en créer un d'après un fichier (« Importer »).
export const openingKind = opening => (opening.importation ? 'importer' : (opening.fichier ? 'fichier' : 'nouveau'));

// Le sélecteur de fichier de GFS : un champ « file » caché, cliqué ici même, donc DANS le geste de la personne (le navigateur refuse sinon). Rend le fichier choisi, ou `null` si la
// personne annule (un navigateur qui ne dit pas l'annulation laisse la promesse en suspens, sans rien casser).
export function pickFile(doc, accept) {
  return new Promise(resolve => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.hidden = true;
    const finish = file => { input.remove(); resolve(file); };
    input.addEventListener('change', () => finish((input.files && input.files[0]) || null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    doc.body.append(input);
    input.click();
  });
}
