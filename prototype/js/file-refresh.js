// La lecture de la liste des fichiers (js/controller.js, `refreshFiles`), avec une garde de séquence : quand deux lectures se chevauchent (l'explorateur s'ouvre, puis un rangement relit tout de suite), seule la dernière
// lancée fait foi. Sans elle, la lecture la plus ancienne, si elle finit en dernier, remplaçait la liste récente par une liste périmée jusqu'au geste suivant (audit du code du 09/11, défaut 9).
// Le module ne sait rien de l'explorateur : le contrôleur donne ce qu'il faut lire (`load`) et ce qu'il faut faire de chaque issue.
//
// createFileRefresh({ canRead, load, onRestricted, onLoading, onLoaded, onFailed }) rend la fonction à appeler à chaque lecture :
//   canRead()      : la personne a l'accès complet (sinon la lecture n'a pas lieu) ;
//   load()         : lit les fichiers, rend ce que `onLoaded` reçoit (une promesse) ;
//   onRestricted() : pas d'accès complet ; onLoading() : la lecture commence ; onLoaded(résultat) : elle a réussi ; onFailed(erreur) : elle a échoué.
// Une lecture dépassée (une plus récente a été lancée depuis, ou l'accès a été perdu) ne rappelle rien : ni sa réussite ni son échec ne touche l'état que la plus récente a posé.

export function createFileRefresh({ canRead, load, onRestricted, onLoading, onLoaded, onFailed }) {
  let latest = 0;
  return async function refresh() {
    const mine = ++latest;
    if (!canRead()) {
      onRestricted();
      return;
    }
    onLoading();
    try {
      const result = await load();
      if (mine === latest) onLoaded(result);
    } catch (error) {
      if (mine === latest) onFailed(error);
    }
  };
}
