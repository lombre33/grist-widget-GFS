// Les images de l'annuaire : la photo d'une personne et le logo d'une structure (module Annuaire ; demande du porteur du 27/11 : « un avatar » et « un logo en
// haut à droite de la carte » ; choix du porteur : les pièces jointes de Grist). Une image est une pièce jointe d'une colonne « Pièces jointes » : sa cellule
// dit son numéro (`['L', 12]`, lu par js/annuaire/annuaire-model.js), son contenu se télécharge par le cadre d'envoi de GFS (js/broker/transfer.js : un petit
// cadre isolé qui parle au serveur avec un jeton, car la page de GFS ne peut pas) puis se réduit ici et s'affiche en `data:` — la politique de contenu de GFS
// ne laisse passer ni `blob:` ni image d'un autre site (`img-src 'self' data:`), et aucune image n'est donc demandée à un tiers.
//
// Le coût est tenu bas : une image ne se télécharge que lorsqu'elle devient visible (`IntersectionObserver`), trois à la fois, une seule fois par session (le
// résultat réduit, quelques ko, reste en mémoire), et Grist n'ayant pas de miniature, la pièce entière est lue puis jetée. Une image qui ne vient pas (refus du
// serveur, fichier qui n'est pas une image) laisse les initiales (la photo) ou rien (le logo) : l'annuaire marche sans.
//
// L'envoi (« Modifier la fiche » : la photo d'une personne s'envoie depuis le widget, la cellule cite alors la pièce jointe que Grist a créée) passe par le
// même
// cadre : l'image est lue, jugée (c'est une image que le navigateur sait décoder), réduite à 512 pixels (la photo d'une personne n'a pas besoin de plus, et
// chaque lecture ultérieure en est allégée : Grist n'a pas de miniature), puis envoyée ; la photo réduite de la fiche est gardée en mémoire sous le numéro que
// Grist a rendu (rien à retélécharger).

import { h } from '../ui/dom.js';

const KINDS = Object.freeze({
  avatar: { box: 128, fit: 'cover', max: 128 },
  logo: { box: 192, fit: 'contain', max: 96 },
});
const PARALLEL = 3; // combien de téléchargements à la fois
const KEPT = 500; // combien d'images réduites on garde en mémoire
const SVG_LIMIT = 200 * 1024; // un SVG plus lourd est écarté (il s'afficherait tel quel, sans réduction possible)
export const IMAGE_MAX = 20 * 1024 * 1024; // au-delà, une image choisie n'est pas lue (le navigateur la décoderait en entier)
const SEND_BOX = 512; // le plus grand côté d'une photo envoyée
const SEND_KEEP = 300 * 1024; // une image plus légère que cela, et qui tient dans la boîte, s'envoie telle quelle

let source = null; // { download(numéro) -> Promise<Blob> }
const done = new Map(); // `${genre}:${numéro}` -> l'adresse `data:` réduite, ou '' quand l'image n'est pas venue
const pending = new Map(); // `${genre}:${numéro}` -> Promise<adresse>
const waiting = [];
let running = 0;

// La source des images : `download(numéro)` rend le contenu de la pièce jointe (un Blob), `upload(fichier, nom)` en crée une et rend son numéro (facultatif).
// Une autre source (un autre document) vide la mémoire.
export function useImages(next) {
  if (next === source) return;
  source = next && typeof next.download === 'function' ? next : null; // { download(numéro) -> Blob, upload(fichier, nom) -> numéro }
  done.clear();
  pending.clear();
}

export const imagesReady = () => source !== null;
export const canUpload = () => source !== null && typeof source.upload === 'function';

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('lecture'));
    reader.readAsDataURL(blob);
  });
}

function decode(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image illisible'));
    image.src = url;
  });
}

// Les dimensions de l'image réduite : la photo remplit un carré (rognée au centre), le logo tient dans sa boîte sans être rogné ni agrandi.
export function targetSize(kind, width, height) {
  const spec = KINDS[kind];
  if (kind === 'avatar') {
    const side = Math.min(width, height, spec.box);
    return { width: side, height: side, crop: Math.min(width, height) };
  }
  const scale = Math.min(1, spec.box / width, spec.max / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), crop: 0 };
}

// L'adresse `data:` d'une image réduite, ou '' : le contenu est lu, décodé, redessiné dans la taille de la boîte (un JPEG pour une photo, un PNG sinon : le
// logo garde sa transparence). Un SVG se garde tel quel (il se réduit à l'affichage).
async function shrink(blob, kind, known = '') {
  const url = known || await readAsDataUrl(blob);
  if (/^data:image\/svg\+xml/i.test(url)) return blob.size <= SVG_LIMIT ? url : '';
  if (!/^data:image\//i.test(url)) return '';
  const image = await decode(url);
  const { width, height, crop } = targetSize(kind, image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return '';
  if (kind === 'avatar') {
    context.drawImage(image, (image.naturalWidth - crop) / 2, (image.naturalHeight - crop) / 2, crop, crop, 0, 0, width, height);
  } else {
    context.drawImage(image, 0, 0, width, height);
  }
  const photo = blob.type === 'image/jpeg' || /^data:image\/jpe?g/i.test(url);
  return photo ? canvas.toDataURL('image/jpeg', 0.85) : canvas.toDataURL('image/png');
}

function remember(key, value) {
  if (done.size >= KEPT) done.delete(done.keys().next().value);
  done.set(key, value);
}

function pump() {
  while (running < PARALLEL && waiting.length) {
    const job = waiting.shift();
    running += 1;
    job().finally(() => { running -= 1; pump(); });
  }
}

// L'image réduite déjà en mémoire ('' : elle n'est pas venue ; undefined : pas encore demandée).
export const imageIn = (kind, id) => done.get(`${kind}:${id}`);

// Charge l'image : l'adresse `data:` réduite, ou '' quand elle ne vient pas (jamais d'exception).
export function loadImage(kind, id) {
  const key = `${kind}:${id}`;
  if (!source || !KINDS[kind] || !id) return Promise.resolve('');
  if (done.has(key)) return Promise.resolve(done.get(key));
  if (pending.has(key)) return pending.get(key);
  const from = source;
  const promise = new Promise(resolve => {
    waiting.push(async () => {
      let url = '';
      try {
        url = await shrink(await from.download(id), kind);
      } catch (error) {
        url = '';
      }
      if (from === source) remember(key, url);
      pending.delete(key);
      resolve(url);
    });
    pump();
  });
  pending.set(key, promise);
  return promise;
}

// Garde en mémoire l'image réduite d'une pièce jointe qu'on vient d'envoyer (inutile de la retélécharger).
export function rememberImage(kind, id, url) {
  if (source && KINDS[kind] && id && url) remember(`${kind}:${id}`, url);
}

// Le fichier à envoyer : le fichier lui-même quand il est léger et petit (ou un SVG), sinon l'image redessinée dans 512 pixels (un JPEG reste un JPEG, le reste
// devient un PNG : la transparence se garde). Jamais plus lourd que l'original.
async function reduced(file, url) {
  if (/^data:image\/svg\+xml/i.test(url)) return file;
  const image = await decode(url);
  const side = Math.max(image.naturalWidth, image.naturalHeight);
  if (side <= SEND_BOX && file.size <= SEND_KEEP) return file;
  const scale = Math.min(1, SEND_BOX / side);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) return file;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const jpeg = /^data:image\/jpe?g/i.test(url);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, jpeg ? 'image/jpeg' : 'image/png', 0.9));
  return blob && blob.size < file.size ? blob : file;
}

const EXTENSIONS = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png' });

// Le nom du fichier réduit : celui de l'original, avec l'extension du type que l'image a pris.
function nameFor(name, type) {
  const base = String(name || '').replace(/\.[^./\\]*$/, '') || 'image';
  return EXTENSIONS[type] ? `${base}.${EXTENSIONS[type]}` : base;
}

// Prépare l'image qu'une personne vient de choisir (un fichier) : { file (ce qui s'enverra : un `File`), name, url (la photo réduite à la taille d'un avatar,
// en `data:`, pour l'aperçu) }, ou null quand le fichier n'est pas une image que le navigateur sait lire (ou qu'il est trop lourd).
export async function prepareImage(file, kind = 'avatar') {
  if (!file || file.size > IMAGE_MAX || !KINDS[kind]) return null;
  try {
    const raw = await readAsDataUrl(file);
    const url = await shrink(file, kind, raw);
    if (!url) return null;
    const out = await reduced(file, raw);
    const name = out === file ? file.name : nameFor(file.name, out.type);
    return { file: out === file ? file : new File([out], name, { type: out.type }), name, url };
  } catch (error) {
    return null;
  }
}

// Envoie une image préparée à Grist : le numéro de la pièce jointe créée (une erreur de Grist se lève telle quelle).
export async function uploadImage(prepared) {
  if (!canUpload()) throw new Error('envoi indisponible');
  return source.upload(prepared.file, prepared.name);
}

// Pose l'image dans `node` (un `.an-av` ou un `.an-logo`) quand elle est visible ; `node` n'est pas touché si elle ne vient pas.
function mount(node, kind, id, cls) {
  const put = url => {
    if (!url) return; // même sur un nœud pas encore posé dans la page : une image déjà en mémoire se pose à la construction de la carte
    node.querySelector(`img.${cls}`)?.remove();
    node.append(h('img', { class: cls, src: url, alt: '', draggable: 'false' }));
    node.classList.add('has-img');
    node.classList.remove('is-wait');
  };
  const known = imageIn(kind, id);
  if (known !== undefined) { put(known); return; }
  const start = () => void loadImage(kind, id).then(put);
  if (typeof IntersectionObserver !== 'function') { start(); return; }
  const watch = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    watch.disconnect();
    start();
  });
  try { watch.observe(node); } catch (error) { start(); }
}

// L'avatar d'une personne ou d'une carte : un rond qui porte les initiales, et la photo par-dessus quand la personne en a une et qu'elle est venue. `cls` : les
// classes de taille (« an-av-l »). `id` : le numéro de la pièce jointe (0 : pas de photo).
export function avatarNode({ id = 0, text = '', cls = '' }) {
  const node = h('span', { class: `an-av${cls ? ` ${cls}` : ''}` }, text);
  if (id && imagesReady()) mount(node, 'avatar', id, 'an-av-img');
  return node;
}

// La pastille du logo (en haut à droite d'une carte), ou null sans logo. Invisible (mais en place, pour que la visibilité se mesure) tant que l'image n'est pas
// venue : une pastille blanche vide serait un défaut.
export function logoNode(id, cls = '') {
  if (!id || !imagesReady()) return null;
  const node = h('span', { class: `an-logo is-wait${cls ? ` ${cls}` : ''}`, 'aria-hidden': 'true' });
  mount(node, 'logo', id, 'an-logo-img');
  return node;
}
