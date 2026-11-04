// Les appels de GFS à l'app ouverte pour un fichier qui tient à plus qu'une ligne (contrats 5.4, points 10 et 11 : `supprimer`, `dupliquer`). Seule l'app active peut répondre : GFS n'ouvre pas une app
// cachée pour un geste de l'explorateur (une app à la fois, contrats 1.4), l'explorateur grise le geste et dit d'ouvrir l'app. `getSession()` rend la session de l'app active, ou rien.

import { ERR } from './filter.js';

const inactive = () => Object.assign(new Error('L’app n’est pas ouverte.'), { code: ERR.INACTIF });

// `appReady(app)` : l'app `app` est celle qui est ouverte, et elle a dit qu'elle est prête (son contexte est donné) ; `appCall(app, name, body)` : l'appel, rejeté `GFS_INACTIF` quand elle ne l'est plus. Les deux noms
// sont ceux qu'`AppFiles` attend (js/app-files.js) : le contrôleur les lui passe d'un coup.
export function activeAppCalls(getSession) {
  const ready = appId => {
    const session = getSession();
    return Boolean(session && session.id === appId && session.isReady);
  };
  const call = (appId, name, body) => {
    if (!ready(appId)) return Promise.reject(inactive());
    const session = getSession();
    return name === 'supprimer' ? session.deleteFile(body) : session.copyFile(body);
  };
  return { appReady: ready, appCall: call };
}
