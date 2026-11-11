// Lire un fichier que GFS garde (contrats 2.7, point 5, et 5.4, point 8) : un PDF s'ouvre dans l'app dont le manifeste dit qu'elle le lit (`actions.lire`),
// avec ses octets, que GFS va chercher lui-même dans le document. Ce module choisit l'app et écrit l'ouverture qu'on lui passe ; il ne sait rien d'une app en
// particulier. Du code sans effet de bord.

// Les apps qui lisent ce type de fichier : [{ manifest, item }] dans l'ordre du catalogue. `item` est l'entrée de `actions.lire` (`type`, et `extension` quand
// c'est une extension de l'app qui lit).
export function readersOf(manifests, type) {
  return manifests.flatMap(manifest => ((manifest.actions && manifest.actions.lire) ||
    []).filter(item => item.type === type).map(item => ({ manifest, item })));
}

// L'app qui sert : la première qui est prête, sinon la première déclarée (son grisé dit pourquoi, et au clic ce qui la débloque). `lockOf(lecteur)` rend `null`
// quand le lecteur est prêt, sinon son grisé { text, focus? }. Rend `{ reader, lock }`, ou `null` quand aucune app du catalogue ne lit ce type : le fichier se
// télécharge alors, comme avant.
export function chooseReader(readers, lockOf) {
  const states = readers.map(reader => ({ reader, lock: lockOf(reader) }));
  return states.find(state => !state.lock) || states[0] || null;
}

// L'ouverture qu'on passe à l'app (contrats 5.2, point 3) : `lecture.id` est l'identifiant du fichier chez GFS (il ne change ni au renommage ni au
// remplacement : c'est la clé à laquelle l'app peut accrocher ce qu'elle garde), `lecture.fichier` l'objet `File` des octets, que le sous-cadre lit comme tout
// fichier choisi. `fichier` reste `null` : le fichier n'est pas à l'app.
export const readOpening = (kept, file, folder) => ({ fichier: null, type: kept.type, dossier: folder, raison: 'lire',
  lecture: { id: kept.id, fichier: file } });
