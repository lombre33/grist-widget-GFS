// L'audit d'une copie figée (fenêtre « Dépendances ») : GFS relit le fichier qu'il sert et recalcule son empreinte SHA-384, puis la compare à celle du
// catalogue (`bibliotheques/catalogue.json`), la même que le navigateur exige d'un fichier chargé par le CDN. Rien ne part sur le réseau que la lecture d'un
// fichier de GFS : la personne ne dépend ni d'un service ni d'un avis de GFS pour s'assurer que la copie est celle que le catalogue annonce.

// L'empreinte au format des attributs `integrity` : « sha384-<base 64> ». `digest` et `encode` se donnent pour les essais ; le navigateur et Node ont les
// mêmes.
export async function fingerprint(bytes, subtle = globalThis.crypto && globalThis.crypto.subtle) {
  if (!subtle) throw new Error('crypto.subtle absent');
  const hash = new Uint8Array(await subtle.digest('SHA-384', bytes));
  let binary = '';
  for (const byte of hash) binary += String.fromCharCode(byte);
  return `sha384-${btoa(binary)}`;
}

// Vérifie un fichier de la ligne (`file.copie` : { chemin, integrite }) : « ok » (l'empreinte recalculée est celle du catalogue), « different » (elle diffère :
// le fichier a changé depuis le catalogue) ou « erreur » (le fichier ne se lit pas, avec la raison). `readBytes(adresse)` rend les octets (ArrayBuffer) du
// fichier de GFS.
export async function verifyCopy(file, { readBytes, base, subtle }) {
  const address = new URL(file.copie.chemin, base).href;
  try {
    const found = await fingerprint(await readBytes(address), subtle);
    return { state: found === file.copie.integrite ? 'ok' : 'different', found, expected: file.copie.integrite, address };
  } catch (error) {
    return { state: 'erreur', reason: String((error && error.message) || error).slice(0, 120), expected: file.copie.integrite, address };
  }
}

// Le résumé d'une ligne : « ok » si toutes ses copies le sont, « different » dès qu'une diffère, « erreur » sinon.
export function verdict(results) {
  if (results.some(result => result.state === 'different')) return 'different';
  if (results.some(result => result.state === 'erreur')) return 'erreur';
  return results.length ? 'ok' : 'erreur';
}
