// Sonde Z « kit » du labo (contrats 5.4 point 9) : la même app que `ranger.js`, mais qui parle à GFS par le VRAI client du kit (`GfsLink.deposit`, js/gfs-link.js du sous-module `kit/`), et non par une enveloppe
// écrite à la main. Elle offre au labo la même façade (`window.sondeZ`) : `ranger`, `exporter`, `ensemble`. Chaque réponse de GFS, dans l'ordre où elle arrive, est écrite dans `document.body.dataset.sonde` :
// `{ ok: true, data }` (ce que le kit rend : { statut, id, nom }) ou `{ ok: false, code, message }` (ce que le kit rejette).
import { GfsLink } from '../../../kit/js/gfs-link.js';

const received = { contexte: false, resultats: [] };
const publish = () => { document.body.dataset.sonde = JSON.stringify(received); };

// Les octets du labo (base64) deviennent un `File` de ce cadre : c'est lui que le kit envoie à GFS, comme l'app le fera avec le PDF qu'elle vient de fabriquer.
const fileOf = (b64, name) => {
  const text = atob(b64);
  const bytes = new Uint8Array(text.length);
  for (let at = 0; at < text.length; at += 1) bytes[at] = text.charCodeAt(at);
  return new File([bytes], name, { type: 'application/pdf' });
};

// Un appel du kit : la promesse rend { label, ok, … } (jamais rejetée) et l'écrit dans `resultats`.
const call = async (label, args) => {
  let result;
  try {
    result = { label, ok: true, data: await GfsLink.deposit(args) };
  } catch (error) {
    result = { label, ok: false, code: error.code, message: error.message };
  }
  received.resultats.push(result);
  publish();
  return result;
};

// item : { b64, nom, fichier? (le nom du File, par défaut « export.pdf »), lot?, suivants?, dossier?, type? } -> la demande de l'app. `brut` : une demande donnée telle quelle (hors règle, pour la mesurer).
const request = item => {
  if (item.brut) return item.brut;
  const args = { fichier: fileOf(item.b64, item.fichier || 'export.pdf'), nom: item.nom };
  for (const key of ['lot', 'suivants', 'dossier', 'type']) if (item[key] !== undefined) args[key] = item[key];
  return args;
};

window.sondeZ = {
  ranger: item => call(item.nom || 'brut', request(item)),
  // Un export en lot : les fichiers l'un après l'autre, avec le nom du lot et combien en restent après celui-ci.
  exporter: async (lot, items, dossier) => {
    const results = [];
    for (let at = 0; at < items.length; at += 1) {
      const item = items[at];
      results.push(await call(item.nom, request({ ...item, lot, suivants: items.length - 1 - at, ...(dossier ? { dossier } : {}) })));
    }
    return results;
  },
  // Tous les appels d'un coup, sans attendre les réponses.
  ensemble: items => Promise.all(items.map(item => call(item.nom, request(item)))),
};

// Ce que fait le script d'API de Grist au démarrage d'une app : `ready`, puis le thème (c'est alors que GFS montre le cadre).
window.parent.postMessage({ mtype: 5 }, '*');
window.parent.postMessage({ mtype: 4, data: { message: 'themeInitialized' } }, '*');
GfsLink.ready.then(() => {
  received.contexte = GfsLink.hosted && GfsLink.context() !== null;
  document.getElementById('state').textContent = 'Prête à ranger';
  publish();
});
publish();
