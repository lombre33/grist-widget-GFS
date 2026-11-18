// L'écart entre la version que GFS sert et la dernière version stable d'une bibliothèque (fenêtre « Dépendances » des réglages ; outil du relevé,
// outils/releve-dependances.mjs). Du code sans effet de bord, partagé par les deux : une seule règle pour dire « correctif », « mineure » ou « majeure ».

export const STABLE_RE = /^(\d+)\.(\d+)\.(\d+)$/;

// `x.y.z` en trois nombres, ou null (une préversion, un suffixe, un texte quelconque ne sont pas des versions stables).
export const parseVersion = version => { const found = STABLE_RE.exec(version || ''); return found ? found.slice(1).map(Number) : null; };

// Compare deux versions déjà lues : négatif si a < b, 0 si égales, positif si a > b. Les numéros se comparent comme des nombres, pas comme du texte.
export const compareVersions = (a, b) => { for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

// « a-jour », « correctif », « mineure », « majeure » (en 0.x, une version mineure change l'interface : elle compte pour une majeure), « avance » (plus récente
// que la dernière stable), « inconnu ».
export function gap(used, latest) {
  const [a, b] = [parseVersion(used), parseVersion(latest)];
  if (!a || !b) return 'inconnu';
  const order = compareVersions(a, b);
  if (order === 0) return 'a-jour';
  if (order > 0) return 'avance';
  if (a[0] !== b[0] || (a[0] === 0 && a[1] !== b[1])) return 'majeure';
  return a[1] !== b[1] ? 'mineure' : 'correctif';
}
