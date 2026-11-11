// Ctrl+Z et Ctrl+Y pour la corbeille et la copie (demande du porteur, 04/11 : « Ctrl+Z doit aussi faire revenir un fichier supprimé » ; puis le rétablissement,
// « au clavier seulement »). Le rangement, les noms et les dossiers déposent eux-mêmes de quoi se défaire dans la pile (js/filing.js) ; la corbeille
// (js/trash.js) et la copie (js/copying.js) appartiennent aux gardiens des apps, qui ne savent rien de la pile : ce module les entoure. Il rend la même
// corbeille et la même copie, et dépose dans la pile, quand un geste a abouti, le geste qui le défait : à la corbeille -> restaurer ; restaurer -> remettre à
// la corbeille ; copier -> mettre la copie à la corbeille. Ce que ce geste écrit dépose à son tour le contraire (la pile le range dans la pile du
// rétablissement, js/undo-stack.js) : Ctrl+Y remet à la corbeille ce que Ctrl+Z avait restauré, et restaure la copie que Ctrl+Z avait mise à la corbeille.
// Défaire et rétablir passent par la corbeille elle-même, avec ses phrases (« X est à la corbeille », « X est restauré ») et ses écritures (une seule pour le
// lot, l'accord de la table) ; ce qui ne s'annule pas (supprimer pour de bon, vider la corbeille) passe sans rien déposer. Chaque annulation relit les listes
// d'aujourd'hui : un fichier qui n'y est plus est dit (« n'est plus là »), jamais écrit à l'aveugle.

const stamp = file => Number(file.trashed && file.trashed.ts) || 0;
const opposite = kind => (kind === 'undo' ? 'redo' : 'undo');

// opts : { stack (js/undo-stack.js), bin (js/trash.js), copying (js/copying.js), trashed() -> les fichiers à la corbeille, live() -> les fichiers vivants, t,
//   appName(id), reveal(key) }
// `reveal` (facultatif) : appelée avec la clé du fichier que Ctrl+Z ou Ctrl+Y vient de sortir de la corbeille, pour que l'explorateur le choisisse (audit du
// 10/11, carte « Sélectionner le fichier ramené » : sans cela,
// la ligne choisie restait celle d'un voisin, et un Suppr de plus agissait sur lui).
// Rend { bin, copying } : de quoi mettre à la place de ceux qu'on entoure (même forme, mêmes gestes).
export function undoable({ stack, bin, copying, trashed, live, t, appName, reveal }) {
  const nameOf = file => file.name || t('ex.untitled');
  const newestInBin = key => trashed().filter(file => file.key === key).reduce((best, file) => (!best || stamp(file) >= stamp(best) ? file : best), null);
  // Remet à la corbeille le fichier vivant `key` (`kind` : 'undo' pour défaire une restauration ou une copie, 'redo' pour refaire une suppression). Cela attend
  // l'app ouverte pour un fichier qui tient à plus qu'une ligne (contrats 2.4 `appel`) : on le dit, et le geste reste à défaire.
  const toBin = (key, name, kind) => async () => {
    const file = live().find(item => item.key === key);
    if (!file) return t(`${kind}.gone`, { name });
    const lock = bin.appLockOf ? bin.appLockOf(file) : null;
    if (lock) return { said: lock.text, again: true };
    if (!bin.handles(file)) return t('trash.appOnly', { app: appName(file.app) });
    if (await bin.move(file)) stack.push({ run: fromBin({ key, name }, opposite(kind)) });
    return undefined;
  };
  // Restaure l'entrée la plus récente de la corbeille pour ce fichier ; restaurer n'a pas besoin de l'app. La restauration peut donner une autre clé (une
  // nouvelle ligne) : on la lit par ce qui est apparu.
  const fromBin = (file, kind) => async () => {
    const entry = newestInBin(file.key);
    if (!entry) return t(`${kind}.gone`, { name: nameOf(file) });
    const before = new Set(live().map(item => item.key));
    if (await bin.restore(entry)) {
      const back = live().find(item => !before.has(item.key));
      stack.push({ run: toBin(back ? back.key : file.key, nameOf(file), opposite(kind)) });
      if (reveal) reveal(back ? back.key : file.key);
    }
    return undefined;
  };
  return {
    bin: {
      handles: file => bin.handles(file),
      appLockOf: file => (bin.appLockOf ? bin.appLockOf(file) : null),
      purge: file => bin.purge(file),
      empty: files => bin.empty(files),
      async move(file) {
        const done = await bin.move(file);
        if (done) stack.push({ run: fromBin(file, 'undo') });
        return done;
      },
      async restore(file) {
        const before = new Set(live().map(item => item.key));
        const done = await bin.restore(file);
        if (done) {
          const back = live().find(item => !before.has(item.key));
          stack.push({ run: toBin(back ? back.key : file.key, nameOf(file), 'undo') });
        }
        return done;
      },
    },
    copying: {
      handles: file => copying.handles(file),
      appLockOf: file => (copying.appLockOf ? copying.appLockOf(file) : null),
      async copy(file, folder) {
        const made = await copying.copy(file, folder);
        if (made) stack.push({ run: toBin(made.key, made.name || nameOf(file), 'undo') });
        return made;
      },
    },
  };
}
