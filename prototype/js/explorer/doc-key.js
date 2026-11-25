// L'identifiant du document, pour ce que GFS garde par document sur le navigateur : le souvenir de son poids (js/explorer/heavy-hint.js) et le garde-fou des
// lectures complètes (js/explorer/read-guard.js). C'est celui que Grist donne à la page, et il ne sert que de fin de clé. Rien n'est jamais obligatoire : un
// identifiant qui tarde, qui manque ou qui n'a pas la forme attendue rend `null`, et l'appelant fait sans.

const ID = /^[A-Za-z0-9_~-]{1,64}$/;
// Le nom du document vient de Grist : la liste des fichiers ne l'attend jamais plus longtemps (un serveur lent, ou qui ne répond pas, ne l'arrête pas).
export const DOC_ID_WAIT_MS = 1500;

// `docId()` : l'identifiant du document (promesse) ; `wait` : le temps qu'on laisse à Grist pour le dire. Rend une fonction qui rend la promesse de
// l'identifiant sûr, ou de `null`. Grist n'est interrogé qu'une fois, et elle ne lève jamais.
export function docKey(docId, wait = DOC_ID_WAIT_MS) {
  let asked = null;
  const find = async () => {
    let timer = null;
    try {
      const late = new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('identifiant trop long à venir')), wait); });
      const id = await Promise.race([docId(), late]);
      return typeof id === 'string' && ID.test(id) ? id : null;
    } catch (error) { return null; } finally { clearTimeout(timer); }
  };
  return () => {
    asked = asked || find();
    return asked;
  };
}
