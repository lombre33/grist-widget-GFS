// La licence d'une bibliothèque face à la GPL 3.0 de GFS (décision du 21/10 : GPL 3.0 pour tous les dépôts de la suite ; le code d'un tiers garde sa licence,
// compatible). Lu dans l'identifiant SPDX que le registre donne (« MIT », « (MIT OR GPL-3.0-or-later) ») : GFS dit ce que l'identifiant permet de dire, jamais
// plus. Une licence qu'il ne connaît pas n'est pas déclarée incompatible : elle est « à vérifier ». Du code sans effet de bord.

// Les licences que la GPL 3.0 accepte en entrée (liste de la FSF ; MPL 2.0 par sa clause de licence secondaire).
const COMPATIBLE = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'Unlicense', 'CC0-1.0', 'Zlib', 'MPL-2.0', 'BlueOak-1.0.0',
  'GPL-3.0-only', 'GPL-3.0-or-later', 'GPL-2.0-or-later', 'LGPL-3.0-only', 'LGPL-3.0-or-later', 'AGPL-3.0-only', 'AGPL-3.0-or-later']);

const clean = text => text.replace(/[()]/g, ' ').trim();

// « compatible » : un choix (`OR`) dont une alternative l'est, ou des licences cumulées (`AND`) qui le sont toutes ; « inconnue » : le registre n'en dit rien ;
// « verifier » : le reste (licence inconnue de GFS, exception `WITH`, texte libre).
export function licenceFit(spdx) {
  if (typeof spdx !== 'string' || !spdx.trim()) return 'inconnue';
  const choice = spdx.split(/\s+OR\s+/i).map(clean);
  const fits = alternative => alternative.split(/\s+AND\s+/i).map(clean).every(id => COMPATIBLE.has(id));
  return choice.some(fits) ? 'compatible' : 'verifier';
}
