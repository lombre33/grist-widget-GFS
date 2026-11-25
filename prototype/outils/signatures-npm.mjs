// Les signatures du registre npm (choix du porteur, 25/11 : « CDN vérifié, secours chez GFS »). Le registre signe, pour chaque version publiée, le texte
// `<paquet>@<version>:<intégrité de l'archive>` (ECDSA, SHA-256) ; ses clés publiques sont à `/-/npm/v1/keys`. `npm pack` compare déjà l'archive à ce que le registre annonce ;
// ceci vérifie que le registre l'a bien signé lui-même, et note la preuve de publication (`dist.attestations`) quand l'auteur en a publié une. Mesuré le 25/11 : 17 paquets
// sur 17 ont une signature valide, 6 sur 17 une preuve de publication (faits vérifiés 163).

import { createPublicKey, createVerify } from 'node:crypto';

const verifies = (text, signature, key) => {
  try {
    return createVerify('SHA256').update(text).verify(createPublicKey({ key: Buffer.from(key, 'base64'), format: 'der', type: 'spki' }), signature, 'base64');
  } catch (error) { return false; }
};

// L'état de la signature d'une version : `valide`, `invalide`, `absente` (le registre n'en donne aucune), `cle-inconnue` (aucune clé publiée ne correspond) ou
// `non-verifiee` (les clés n'ont pas pu être lues). `manifest` : le document de la version (`/<paquet>/<version>`), `keys` : la liste des clés du registre, ou null.
export function registrySignature({ paquet, version, manifest, keys }) {
  const dist = manifest && manifest.dist ? manifest.dist : {};
  const provenance = Boolean(dist.attestations);
  const signatures = Array.isArray(dist.signatures) ? dist.signatures : [];
  if (!signatures.length) return { signature: 'absente', provenance };
  if (!Array.isArray(keys) || !keys.length) return { signature: 'non-verifiee', provenance };
  let state = 'cle-inconnue';
  for (const { keyid, sig } of signatures) {
    const key = keys.find(each => each.keyid === keyid);
    if (!key) continue;
    state = verifies(`${paquet}@${version}:${dist.integrity}`, sig, key.key) ? 'valide' : 'invalide';
    if (state === 'valide') break;
  }
  return { signature: state, provenance };
}
