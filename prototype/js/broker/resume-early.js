// L'app lancée plus tôt après un rechargement (27/11, choix du porteur après la mesure de fluidité : « Les deux, plus l'app lancée plus tôt », lot 3).
// La reprise (js/broker/resume.js) vérifie d'abord dans la liste des fichiers que le fichier du souvenir existe encore et que la personne peut l'ouvrir
// (Publipostage+ lancée sur un numéro absent ouvre une page blanche) : l'app ne démarrait qu'après cette lecture, alors que son démarrage (une page, ses
// bibliothèques, ses premières lectures) est le plus long du rechargement. Ici, le souvenir dit aussi l'app, le numéro et le type du fichier : l'app
// démarre PENDANT que la liste vérifie, et la vérification tranche ensuite :
//   - le même fichier, toujours ouvrable, pour la même personne : rien à faire, l'app est déjà là (elle a gagné le temps de la lecture) ;
//   - sinon (fichier supprimé, caché, grisé, autre personne) : l'app est refermée (`undoEarly`) et la reprise suit son chemin d'avant (la phrase, ou
//     l'explorateur).
// L'app lit le document avec les droits de la personne, comme à toute ouverture : ce qu'elle ne peut pas lire, elle ne le montre pas, même le temps de la
// vérification. Le souvenir d'avant le lot (sans app, ni numéro, ni type) ne lance rien tôt : la reprise est celle d'avant.
import { FILES_APP } from '../files/gfs-files.js';
import { ANNUAIRES_APP } from '../files/annuaire-files.js';

const PIECE = /^[A-Za-z0-9_~-]{1,64}$/;

const isApp = app => typeof app === 'string' && PIECE.test(app) && app !== FILES_APP && app !== ANNUAIRES_APP;
const isId = id => Number.isInteger(id) || isText(id, 64);
const isText = (text, max) => typeof text === 'string' && text !== '' && text.length <= max;

// Ce que GFS ajoute au souvenir d'un fichier pour pouvoir le rouvrir tôt.
export const earlyFields = file => ({ app: file.app, id: file.id, type: file.type });

// Le fichier du souvenir, s'il peut s'ouvrir tôt : une app de la suite (pas un fichier que GFS garde lui-même, ni un annuaire, que le module de GFS montre), et
// de quoi le désigner. Rend `{ app, id, type, key }` ou `null`.
export function earlyTarget(memory) {
  if (!memory || memory.lieu !== 'fichier') return null;
  const { app, id, type, key } = memory;
  if (!isApp(app) || !isId(id) || !isText(type, 40) || !isText(key, 200)) return null;
  return { app, id, type, key };
}

// L'app démarre sur le fichier, comme à un double-clic mais sans attendre la liste. Rend la promesse de `true` (l'app est en route) ou `false` (elle ne s'ouvre
// pas : app absente, extension éteinte, accès insuffisant) ; elle ne lève jamais.
export async function startEarly(c, target) {
  try {
    if (!c.openable(target.app)) return false;
    const opening = { fichier: { id: target.id, type: target.type }, type: target.type, dossier: c.explorer.state.path, raison: 'explorateur' };
    return (await c.openings.openIn(target.app, opening, 'ex.notice.open')) === true;
  } catch {
    return false;
  }
}

// La vérification dit-elle que l'app lancée tôt montre le bon fichier ? `outcome` : la décision de js/broker/resume-place.js d'après la liste lue.
export const keeps = (target, outcome) => outcome.kind === 'file' && outcome.file.key === target.key && outcome.file.type === target.type;

// Le fichier n'est plus à rouvrir : l'app lancée tôt est refermée, et « Ouverts » oublie le fichier qu'elle y avait mis.
export function undoEarly(c, target) {
  c.opened.remove(target.key);
  if (c.session) c.closeSession();
  c.opening = null;
}
