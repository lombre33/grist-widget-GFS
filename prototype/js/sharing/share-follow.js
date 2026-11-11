// Suivre un dossier partagé « à jour » (« Partager… » sur un dossier > « Copie à jour » ; choix du porteur, 11/11 : « un fichier ajouté ensuite arrive à
// accepter »). Le moteur ne suit pas un dossier : il envoie les fichiers que la condition du lien nomme (js/share-links.js). Tant que la page est ouverte, que
// la personne est propriétaire et que le document a un lien, GFS compare à chaque lecture des fichiers ce que le dossier contient avec ce qu'il contenait au
// dernier passage (la ligne du dossier suivi, `Rangement.followed`) et change la condition en conséquence :
//   - un PDF NOUVEAU dans le dossier (ajouté, déplacé dedans, restauré de la corbeille) entre dans la condition, avec le nom du dossier : chez l'autre il
//   arrive grisé, seul, « à accepter » ;
//   - un PDF qui n'y est plus (déplacé ailleurs, à la corbeille) sort de la condition : sa copie reste chez l'autre, en archive ;
//   - un PDF que la personne a retiré à part (« Arrêter la copie » sur le fichier) n'est pas ré-ajouté : seuls les fichiers nouveaux du dossier entrent ;
//   - un dossier sans fichier (vidé, ou renommé : ses fichiers ont un autre chemin) ne change rien : le suivi attend.
import { filesOfFolder, folderLabel, writeFolderName } from './share-folder.js';
import { setCondition } from './share-links.js';

// Ce que la condition doit changer pour un dossier : `current` ses fichiers d'aujourd'hui, `previous` ceux du dernier passage, `inside` la condition du lien.
// Rend { add, drop }.
export function planFollow({ current, previous, inside }) {
  const had = new Set(previous);
  const now = new Set(current);
  return { add: current.filter(id => !had.has(id) && !inside.includes(id)), drop: previous.filter(id => !now.has(id) && inside.includes(id)) };
}

const same = (a, b) => a.length === b.length && a.every(id => b.includes(id));

// Un passage : pour chaque dossier suivi dont le lien existe encore, la condition suit le dossier. `followed` : [{ link, path, ids }] (`Rangement.followed`),
// `links` : les liens lus (js/share-links.js), `files` : les fichiers que l'explorateur montre, `engine` : le moteur, `docApi`, `remember(link, path, ids)` :
// retient les fichiers du dossier (`Rangement.follow`), `forget(link, path)` : ne suit plus (`Rangement.unfollow`). Un lien arrêté ne suit plus rien : ses
// dossiers sont oubliés. Rend la liste de ce qui a changé : [{ link, path, add, drop }].
export async function followFolders({ followed, links, files, engine, docApi, remember, forget }) {
  const changed = [];
  for (const entry of followed) {
    const link = links.find(each => each.id === entry.link);
    if (!link) { await forget(entry.link, entry.path); continue; }
    const picked = filesOfFolder(files, entry.path);
    if (!picked.length) continue;
    const current = picked.map(file => file.id);
    const { add, drop } = planFollow({ current, previous: entry.ids, inside: link.files });
    // le nom d'abord : le moteur n'envoie que ce que la table porte à l'enregistrement
    if (add.length) await writeFolderName(docApi, picked.filter(file => add.includes(file.id)).map(file => file.row), folderLabel(entry.path));
    if (add.length || drop.length) await setCondition(engine, link, [...link.files.filter(id => !drop.includes(id)), ...add]);
    if (add.length || drop.length || !same(current, entry.ids)) await remember(entry.link, entry.path, current);
    if (add.length || drop.length) changed.push({ link: entry.link, path: entry.path, add, drop });
  }
  return changed;
}

// Le suiveur de la page : `run(files)` à chaque lecture des fichiers. Un seul passage à la fois (une lecture qui arrive pendant un passage en demande un autre
// juste après) ; rien ne se charge tant qu'aucun dossier n'est suivi.
// deps : { rangement (followed, follow, unfollow), writeBlock() → la raison d'un blocage ou null, isOwner() → vrai/faux/null, engine() → le moteur de partage,
//   docApi() }.
export function createFollower(deps) {
  let running = false;
  let again = null;
  async function pass(files) {
    if (deps.writeBlock()) return [];
    const followed = await deps.rangement.followed();
    if (!followed.length || (await deps.isOwner()) !== true) return [];
    const engine = await deps.engine();
    return followFolders({
      followed, links: await engine.readLinks(), files, engine, docApi: deps.docApi(), remember: (link, path, ids) => deps.rangement.follow(link, path, ids),
        forget: (link, path) => deps.rangement.unfollow(link, path),
    });
  }
  return async function run(files) {
    if (running) { again = files; return []; }
    running = true;
    let changed = [];
    try { changed = await pass(files); } catch (error) { console.warn('GFS : le suivi des dossiers partagés n’a pas pu se faire', error); }
      finally { running = false; }
    if (again) { const next = again; again = null; return [...changed, ...await run(next)]; }
    return changed;
  };
}
