// L'export du rapport de la fenêtre « Dépendances » (demande du porteur, 18/11 : « clarté et audit de sécurité ») : deux fichiers JSON que la personne
// enregistre, le rapport de GFS (tout ce que la fenêtre montre, pour un script) et l'inventaire CycloneDX (pour un outil d'audit,
// js/apps/dependencies-cyclonedx.js). Rien n'est envoyé nulle part : le fichier se fabrique dans le navigateur et s'offre au téléchargement, sur un geste de la
// personne.

import { cyclonedx } from './dependencies-cyclonedx.js';

export const FORMATS = Object.freeze(['json', 'cdx']);
const EXTENSIONS = { json: 'json', cdx: 'cdx.json' };
const SOURCE = { vendorise: 'copie', cdn: 'cdn' };

// Le nom du fichier : `gfs-dependances-2026-11-18.json`, ou `….cdx.json`.
export const reportName = (format, generated) => `gfs-dependances-${generated.slice(0, 10)}.${EXTENSIONS[format]}`;

const useOf = use => ({ app: use.appName, fonction: use.what, etat: use.state, source: use.unit ? SOURCE[use.unit.mode] : null });
const fileOf = file => ({ id: file.id, version: file.version, poids: file.poids, forme: file.forme, copie: { ...file.copie },
  cdn: file.cdn ? { ...file.cdn } : null });

// Le rapport de GFS : une entrée par bibliothèque, avec ce que la fenêtre dit d'elle. Les clés sont celles du relevé (bibliotheques/releve.json) et du
// catalogue.
export function gfsReport({ rows, surveyed, generated }) {
  return { format: 'gfs-dependances', version: 1, genere: generated, releve: surveyed || null,
    bibliotheques: rows.map(row => ({ paquet: row.paquet, version: row.version, etat: row.state, utilisee_par: row.uses.map(useOf),
      fichiers: row.files.map(fileOf),
      derniere_stable: row.latest, ecart: row.ecart, avis: row.advisories.map(advisory => ({ ...advisory })), licence: row.licence, licence_gpl: row.licenceFit,
      site: row.site, depot: row.depot })) };
}

// Le texte d'un rapport : `serial` ne sert qu'à CycloneDX.
export function reportText(format, { rows, surveyed, generated, serial }) {
  const report = format === 'cdx' ? cyclonedx({ rows, surveyed, generated, serial }) : gfsReport({ rows, surveyed, generated });
  return `${JSON.stringify(report, null, 2)}\n`;
}

// Offre le texte au navigateur sous son nom : un lien invisible, cliqué ici même.
export function saveText(doc, name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  doc.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Un numéro de série d'inventaire (UUID version 4) : celui du navigateur, ou construit d'après ses octets aléatoires.
export function newSerial(source = globalThis.crypto) {
  if (source && typeof source.randomUUID === 'function') return source.randomUUID();
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
