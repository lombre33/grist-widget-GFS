// Les adresses que GFS propose quand la personne tape les membres d'un groupe (choix du porteur, 13/11 : « connues + une colonne d'e-mails »). Grist ne donne
// pas la liste des personnes d'un document à un widget (`/access` : 403, même pour un propriétaire, faits vérifiés 107) : GFS propose ce qu'il a déjà lu, et
// les adresses d'une colonne de table que la personne choisit. Rien ici ne parle à Grist ni ne dessine : des fonctions pures.

const ADDRESS = /^[^\s@,;<>()"'[\]]+@[^\s@,;<>()"'[\]]+\.[^\s@,;<>()"'[\]]+$/;

// Les adresses d'un texte (séparées par des espaces, retours à la ligne, virgules ou points-virgules), en minuscules, sans doublon, dans l'ordre.
export function addressesIn(text) {
  const found = String(text ?? '').split(/[\s,;]+/).map(word => word.trim().toLowerCase()).filter(word => ADDRESS.test(word));
  return [...new Set(found)];
}

// Les adresses d'une colonne : les valeurs d'une colonne de texte, de choix ou de liste de choix (un tableau commençant par « L » dans le format de Grist).
export function addressesOfColumn(values) {
  const flat = (values || []).flatMap(value => (Array.isArray(value) ? value.slice(value[0] === 'L' ? 1 : 0) : [value]));
  return [...new Set(flat.flatMap(addressesIn))];
}

const personOf = who => String(who ?? '').trim().toLowerCase();
const rowsAddresses = (rows, ...columns) => (rows || []).flatMap(row => columns.map(column => personOf(row[column]))).filter(who => ADDRESS.test(who));

// Les adresses que GFS connaît déjà dans ce document : celle de la personne, les personnes des partages et leurs auteurs, les membres des groupes tapés dans
// GFS et les personnes qui ont rangé un fichier (une ligne de rangement porte leur adresse, écrite par Grist). Triées, sans doublon.
// `known` : { me, shares (GFS_Partages), groups (GFS_Groupes), filing (GFS_Rangement) }.
export function knownAddresses({ me = '', shares = [], groups = [], filing = [] } = {}) {
  const all = [personOf(me), ...rowsAddresses(shares, 'PersonneL', 'Personne', 'Auteur'), ...(groups || []).flatMap(group => addressesIn(group.PersonnesIci)),
    ...rowsAddresses(filing, 'Utilisateur')].filter(who => ADDRESS.test(who));
  return [...new Set(all)].sort((a, b) => a.localeCompare(b));
}

// Ce que la liste propose : les adresses connues, puis celles de la colonne choisie, sans celles que le groupe a déjà (`typed` : le texte du champ). Chacune
// est { value, label } pour la liste avec recherche (js/ui/pick-window.js).
export function suggestionsFor({ known = [], column = [], typed = '' }) {
  const have = new Set(addressesIn(typed));
  return [...new Set([...known, ...column])].filter(address => !have.has(address)).map(address => ({ value: address, label: address, glyph: 'mail' }));
}

// Le texte du champ avec l'adresse de plus, sur sa propre ligne ; inchangé si elle y est déjà.
export function withAddress(typed, address) {
  const text = String(typed ?? '');
  const who = personOf(address);
  if (!ADDRESS.test(who) || addressesIn(text).includes(who)) return text;
  return `${text.replace(/\s+$/, '')}${text.trim() ? '\n' : ''}${who}`;
}
