// Le sous-cadre d'une app : son adresse et son élément (contrats 1.3).

import { CONTRACT } from './manifest.js';

// Ce que Grist ajoute à l'adresse d'un widget, GFS le donne à l'app sous les mêmes noms (1.3, point 3) ; `access` est le niveau de l'APP.
const PREFERENCES = ['language', 'culture', 'timeZone', 'currency'];

export const SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals allow-downloads';

// Les essais servent l'app telle qu'elle est en ligne, sur son propre site (le porteur, 22/10) ; `?live=0` dans l'adresse du widget ramène à la copie figée (le sous-module).
export const liveSwitch = search => new URLSearchParams(search).get('live') !== '0';

// L'adresse est calculée à partir du catalogue et du manifeste livrés avec GFS : jamais lue dans un réglage, une table ou un message. Le site vivant est à la racine de
// l'origine de GFS (`frame-src 'self'` le laisse passer ; un autre site ferait mourir le cadre, contrats 1.4) ; une app qui n'en a pas garde sa copie.
export function frameUrl({ entry, manifest, access, readonly, preferences, base, live }) {
  const path = live && entry.site ? `/${entry.site}${manifest.entree}` : entry.dossier + manifest.entree;
  const url = new URL(path, base);
  url.searchParams.set('access', access);
  url.searchParams.set('readonly', String(Boolean(readonly)));
  for (const key of PREFERENCES) {
    if (preferences && preferences[key]) url.searchParams.set(key, preferences[key]);
  }
  url.searchParams.set('gfs', String(CONTRACT));
  return url.href;
}

// Les préférences de la personne : Grist les met dans l'adresse de GFS lui-même.
export function readPreferences(search) {
  const params = new URLSearchParams(search);
  const out = {};
  for (const key of PREFERENCES) if (params.get(key)) out[key] = params.get(key);
  return out;
}

export function buildFrame(url, title) {
  const frame = document.createElement('iframe');
  frame.className = 'app-frame';
  frame.title = title;
  frame.setAttribute('sandbox', SANDBOX);
  frame.setAttribute('allow', 'clipboard-write');
  frame.src = url;
  return frame;
}
