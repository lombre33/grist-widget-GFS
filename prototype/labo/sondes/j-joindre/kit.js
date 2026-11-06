// Sonde J « kit » du labo (contrats 5.4 point 12) : la même app que `joindre.js`, mais qui parle à GFS par le VRAI client du kit (`GfsLink.attach`, js/gfs-link.js du sous-module `kit/`), et non par une enveloppe
// écrite à la main. Même façade (`window.sondeJ.joindre`). Chaque réponse de GFS, dans l'ordre où elle arrive, est écrite dans `document.body.dataset.sonde` : `{ ok: true, data }` (ce que le kit rend :
// { colonne, probleme, joints, echecs }) ou `{ ok: false, code, message }` (ce que le kit rejette).
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
    result = { label, ok: true, data: await GfsLink.attach(args) };
  } catch (error) {
    result = { label, ok: false, code: error.code, message: error.message };
  }
  received.resultats.push(result);
  publish();
  return result;
};

// demande : { table, colonne, mode?, fichiers: [{ ligne, nom, b64, fichier? }] } -> la demande de l'app. `brut` : une demande donnée telle quelle (hors règle).
const request = demande => {
  if (demande.brut) return demande.brut;
  const args = { table: demande.table, colonne: demande.colonne, fichiers: demande.fichiers.map(item => ({ ligne: item.ligne, nom: item.nom, fichier: fileOf(item.b64, item.fichier || 'export.pdf') })) };
  if (demande.mode !== undefined) args.mode = demande.mode;
  return args;
};

// Ce que fait le script d'API de Grist au démarrage d'une app : `ready`, puis le thème (c'est alors que GFS montre le cadre).
window.parent.postMessage({ mtype: 5 }, '*');
window.parent.postMessage({ mtype: 4, data: { message: 'themeInitialized' } }, '*');
window.sondeJ = { joindre: demande => call(demande.label || 'joindre', request(demande)) };
GfsLink.ready.then(() => {
  received.contexte = GfsLink.context() !== null;
  document.getElementById('state').textContent = 'Prête à joindre';
  publish();
});
publish();
