// Les gardiens des fichiers que l'explorateur retire, remet, copie et importe, construits pour le contrôleur (js/controller.js) : les PDF que GFS garde lui-même (js/kept-files.js) et les fichiers des apps
// (js/app-files.js). Sortis du contrôleur pour qu'il reste sous les 600 lignes de code de l'outil d'audit ; ce sont des assemblages, sans logique : chaque fonction lit ce que le contrôleur montre (`c`) et
// reçoit de lui, par `ask` et `hideNotice`, ce qu'il garde privé.

import { FilesStore } from './files-store.js';
import { KeptFiles } from './kept-files.js';
import { AppFiles } from './app-files.js';
import { activeAppCalls } from './app-calls.js';

// Les fichiers que GFS garde lui-même, les PDF : le cadre d'envoi, la table `GFS_Fichiers` (créée avec l'accord de la personne), et ce qu'il faut pour importer, télécharger et supprimer.
// Le cadre d'envoi ne s'ouvre qu'au premier transfert.
export function buildKept(c, { ask, hideNotice }) {
  const consent = () => ask({ title: c.t('files.table.title'), message: c.t('files.table.text'), confirmLabel: c.t('table.create'), cancelLabel: c.t('table.cancel') });
  return new KeptFiles({
    store: new FilesStore({ port: c.port, transfer: c.transfer, consent, identity: () => c.identity }), doc: c.doc, container: c.$('stage'),
    inertTargets: () => [c.explorer.root, c.$('frames'), c.$('floaters')], t: c.t, lang: () => c.lang, locale: () => c.locale, now: () => Date.now(),
    fullAccess: () => c.fullAccess, readonly: () => c.readonly, notice: text => c.notice(text), refresh: () => c.refreshFiles(),
    hideNotice: said => { if (c.$('toast').textContent === said) hideNotice(); }, folder: () => (c.explorer.state.view === 'folder' ? c.explorer.state.path : ''), rangement: c.rangement,
    reader: file => c.readerOf(file), session: () => c.session,
  });
}

// Les fichiers des apps à la corbeille et à la copie : le gardien des tables que les manifestes disent savoir retirer, remettre et copier (`suppression`, `copie`) ; `GFS_Corbeille` naît avec l'accord
// de la personne. Un fichier qui tient à plus qu'une ligne (contrats 2.4 `appel`) : l'app ouverte seule sait le fermer ou le copier.
export function buildAppFiles(c, { ask }) {
  const consent = () => ask({ title: c.t('trash.table.title'), message: c.t('trash.table.text'), confirmLabel: c.t('table.create'), cancelLabel: c.t('table.cancel') });
  return new AppFiles({
    port: c.port, apps: () => c.validApps(), consent, identity: () => c.identity, now: () => Date.now(), readonly: () => c.readonly, fullAccess: () => c.fullAccess, t: c.t, appName: c.appName,
    ...activeAppCalls(() => c.session),
  });
}
