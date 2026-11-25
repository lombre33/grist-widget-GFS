// La cloche Notifications (maquette du 09/11, à droite de l'en-tête de l'explorateur) : ce qu'il y a à dire à la personne. Deux sortes de choses : les fichiers
// reçus d'un autre document Grist, qui attendent sa réponse (js/sharing/received-files.js : la cloche les lit dans la liste déjà chargée), et ce qu'on lui a
// donné dans ce document (un fichier, un dossier, un espace : js/sharing/notice-model.js, ses lignes dans la table `GFS_Notifications`, choix du porteur du
// 25/11). La cloche n'écrit rien elle-même : « lu » passe par js/sharing/notice-store.js, et la table ne naît qu'avec le partage, avec l'accord du
// propriétaire.
import { person } from '../explorer/explorer-model.js';
import { receivedFolders } from './received-folders.js';

export const SHOWN = 6; // les arrivées nommées dans le menu ; les autres se trouvent dans « Partagés avec moi »

// Une chose donnée à la personne, en une phrase : « Camille vous a donné « Contrat.pdf » », ou sans le nom de qui l'a donnée quand GFS ne le sait pas.
export function givenLabel(t, item) {
  const by = item.par ? person(item.par).name : '';
  const name = item.nom || t('ex.untitled');
  return t(`nt.given.${item.type}${by ? 'By' : ''}`, { name, by });
}

// Les articles du menu de la cloche. x : { t, pending (les arrivées à accepter), notices? ({ items, unread } : ce qui est donné, js/sharing/notice-store.js),
// notice(texte), ask(arrivée) (la question « Accepter … ? »), askFolder(dossier) (celle d'un dossier reçu), openNotice?(item) (ouvre ce qui est donné et le
// marque lu), markAll?() (tout marquer comme lu), openShared() (la vue « Partagés avec moi ») }. Sans notification, la ligne reste, grisée : son clic dit ce
// qui s'annonce ici (charte : grisé, jamais masqué).
export function notificationItems(x) {
  const { t, pending } = x;
  // Les fichiers d'un dossier reçu n'ont qu'une ligne, celle du dossier (un oui pour tous) ; les autres, une ligne chacun.
  const { folders, loose } = receivedFolders(pending);
  const given = ((x.notices && x.notices.items) || []).filter(item => !item.lu);
  const entries = [...folders.map(folder => ({ folder })), ...loose.map(file => ({ file })), ...given.map(item => ({ item }))];
  const lines = entries.slice(0, SHOWN).map(({ folder, file, item }) => {
    if (item) return { label: givenLabel(t, item), icon: 'users', run: () => x.openNotice(item) };
    const by = person((folder || file).by).name;
    if (folder) return { label: t(by ? 'nt.folder' : 'nt.folderUnknown', { name: folder.name, by, n: folder.pending }), icon: 'users',
      run: () => x.askFolder(folder) };
    const name = file.name || t('ex.untitled');
    return { label: by ? t('nt.arrival', { name, by }) : t('nt.arrivalUnknown', { name }), icon: 'users', run: () => x.ask(file) };
  });
  const more = entries.length - lines.length;
  const markAll = given.length ? { label: t('nt.markAll'), icon: 'check', run: () => x.markAll() }
    : { label: t('nt.markAll'), icon: 'check', greyed: true, run: () => x.notice(t('nt.markAllWhy')) };
  return [...(lines.length ? lines : [{ label: t('nt.none'), icon: 'info', greyed: true, run: () => x.notice(t('nt.noneWhy')) }]), '-',
    ...(x.markAll ? [markAll] : []),
    { label: more > 0 ? t('nt.openMore', { n: more }) : t('nt.open'), icon: 'open', run: () => x.openShared() }];
}
