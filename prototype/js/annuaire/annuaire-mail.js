// « Écrire au groupe » (module Annuaire, demande du porteur du 25/11 : attention aux ~2 000 caractères d'un lien de messagerie) : les adresses des personnes
// affichées, la longueur du lien qu'elles donneraient, leur découpage en messages qui tiennent, et l'export de la liste. Du code sans effet de bord, essayé
// sous Node (test/annuaire-mail.test.mjs) ; la fenêtre est à js/annuaire/annuaire-mail-window.js.
//
// Un lien « mailto: » est coupé par des messageries et des navigateurs autour de 2 000 caractères : passé quelques dizaines d'adresses, le message s'ouvrirait
// incomplet. GFS dit donc la longueur avant d'ouvrir, grise « un seul message » quand il serait trop long, découpe en messages de `per` adresses au plus, et
// offre toujours de copier toutes les adresses (aucune limite) ou d'exporter la liste.

import { normalize } from '../ui/search.js';
import { fieldLabel } from './annuaire-config.js';

// La longueur au-delà de laquelle un lien n'est plus ouvert (marge sous les ~2 000 caractères où des messageries coupent).
export const MAILTO_LIMIT = 1800;

// Les adresses d'une liste de personnes : sans les vides, sans doublons (une adresse écrite deux fois, à la casse près, n'est écrite qu'une fois), dans
// l'ordre.
export function addressesOf(people) {
  const seen = new Set();
  const found = [];
  for (const person of people) {
    const address = String(person.email || '').trim();
    const key = address.toLowerCase();
    if (!address || seen.has(key)) continue;
    seen.add(key);
    found.push(address);
  }
  return found;
}

// Une adresse telle qu'un lien l'écrit : « @ » et « , » restent lisibles, le reste est protégé.
const encoded = address => encodeURIComponent(address).replace(/%40/g, '@');

// Le lien d'un message : `to` vaut « bcc » (les destinataires ne se voient pas entre eux) ou « to ».
export function mailLink(addresses, to = 'bcc') {
  const list = addresses.map(encoded).join(',');
  return to === 'to' ? `mailto:${list}` : `mailto:?bcc=${list}`;
}

export const linkLength = (addresses, to = 'bcc') => mailLink(addresses, to).length;

// Les messages qu'il faut ouvrir : des lots d'au plus `per` adresses dont le lien tient sous `limit`. Une adresse seule plus longue que `limit` a son lot.
export function mailBatches(addresses, { per = 40, to = 'bcc', limit = MAILTO_LIMIT } = {}) {
  const batches = [];
  let current = [];
  for (const address of addresses) {
    const next = [...current, address];
    if (current.length && (next.length > per || linkLength(next, to) > limit)) { batches.push(current); current = [address]; } else current = next;
  }
  if (current.length) batches.push(current);
  return batches;
}

// L'état de la fenêtre pour ces adresses : combien, quelle longueur, si un seul message tient, et les lots.
export function mailPlan(addresses, options = {}) {
  const { to = 'bcc', limit = MAILTO_LIMIT } = options;
  const length = linkLength(addresses, to);
  return { count: addresses.length, length, limit, fits: addresses.length > 0 && length <= limit, batches: mailBatches(addresses, options) };
}

// Un champ de CSV : entre guillemets quand il en a besoin ; un début « = », « + », « - » ou « @ » est précédé d'une apostrophe (un tableur le prendrait pour
// une
// formule : l'injection de formule d'un fichier exporté).
function csvField(value) {
  let text = String(value ?? '').replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t]/.test(text)) text = `'${text}`;
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Le CSV de la liste (point-virgule et BOM : le tableur français l'ouvre sans assistant). `columns` : [{ label, of(personne) -> texte }].
export function csvOf(people, columns) {
  const rows = [columns.map(column => column.label), ...people.map(person => columns.map(column => column.of(person)))];
  return `﻿${rows.map(row => row.map(csvField).join(';')).join('\r\n')}\r\n`;
}

// Le nom d'un fichier d'export : celui de l'annuaire, sans ce qu'un nom de fichier refuse, et le jour.
export function csvName(name, day) {
  const base = normalize(name).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '') || 'annuaire';
  return `${base}-${day}.csv`;
}

// Les colonnes de l'export : le nom, l'adresse, le téléphone quand l'annuaire en a un, chaque niveau de la hiérarchie, puis les champs que la liste ou la fiche
// montre (« Liste » ou « Colonne » du réglage). `labels` : { name, email, phone } ; `genres` : { colonne: genre } ; `show(valeur, genre)` écrit une valeur dans
// la langue de la personne (js/annuaire/annuaire-panes.js, `shown`).
export function csvColumns(config, { labels, genres, show }) {
  const columns = [{ label: labels.name, of: person => person.name }, { label: labels.email, of: person => person.email }];
  if (config.phone) columns.push({ label: labels.phone, of: person => person.phone });
  config.levels.forEach((level, i) => columns.push({ label: level.label || level.path.at(-1), of: person => person.levels[i] }));
  for (const field of config.fields.filter(each => each.list || each.column)) {
    columns.push({ label: fieldLabel(field), of: person => (person.fields[field.col] || []).map(value => show(value, genres[field.col])).join(', ') });
  }
  return columns;
}
