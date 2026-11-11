// La cloche Notifications (maquette du 09/11, à droite de l'en-tête de l'explorateur) : ce qu'il y a à dire à la personne, sans rien garder. Aujourd'hui, ce sont les fichiers reçus d'un autre document Grist
// qui attendent sa réponse (js/received-files.js) : la cloche les lit dans la liste déjà chargée, elle n'écrit rien et ne crée aucune table. La table `GFS_Notifications` ne viendra que pour une notification
// qu'il faut retenir (lue ou non, un partage demandé avant tout fichier), et seulement avec l'accord de la personne.
import { person } from './explorer-model.js';
import { receivedFolders } from './received-folders.js';

export const SHOWN = 6; // les arrivées nommées dans le menu ; les autres se trouvent dans « Partagés avec moi »

// Les articles du menu de la cloche. x : { t, pending (les arrivées à accepter), notice(texte), ask(arrivée) (la question « Accepter … ? »), askFolder(dossier) (celle d'un dossier reçu), openShared() (la vue « Partagés avec moi ») }.
// Sans notification, la ligne reste, grisée : son clic dit ce qui s'annonce ici (charte : grisé, jamais masqué).
export function notificationItems(x) {
  const { t, pending } = x;
  // Les fichiers d'un dossier reçu n'ont qu'une ligne, celle du dossier (un oui pour tous) ; les autres, une ligne chacun.
  const { folders, loose } = receivedFolders(pending);
  const entries = [...folders.map(folder => ({ folder })), ...loose.map(file => ({ file }))];
  const lines = entries.slice(0, SHOWN).map(({ folder, file }) => {
    const by = person((folder || file).by).name;
    if (folder) return { label: t(by ? 'nt.folder' : 'nt.folderUnknown', { name: folder.name, by, n: folder.pending }), icon: 'users', run: () => x.askFolder(folder) };
    const name = file.name || t('ex.untitled');
    return { label: by ? t('nt.arrival', { name, by }) : t('nt.arrivalUnknown', { name }), icon: 'users', run: () => x.ask(file) };
  });
  const more = entries.length - lines.length;
  return [...(lines.length ? lines : [{ label: t('nt.none'), icon: 'info', greyed: true, run: () => x.notice(t('nt.noneWhy')) }]), '-',
    { label: more > 0 ? t('nt.openMore', { n: more }) : t('nt.open'), icon: 'open', run: () => x.openShared() }];
}
