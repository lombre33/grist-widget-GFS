// La recherche de GFS : des mots dans n'importe quel ordre, accents, casse et ponctuation ignorés (charte, « liste avec recherche »).
// À passer au kit (étape 3) : il porte déjà la liste avec recherche des apps.

// Le texte comparable : sans accents (NFKD retire aussi les ligatures « ﬁ »), en minuscules, la ponctuation et les espaces réduits à un espace.
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Les mots de la recherche, déjà normalisés ; une recherche vide donne une liste vide.
export function words(query) {
  const text = normalize(query);
  return text ? text.split(' ') : [];
}

// Vrai quand chaque mot figure dans le texte (déjà normalisé), quel que soit l'ordre.
export const matchesWords = (needles, haystack) => needles.every(word => haystack.includes(word));
