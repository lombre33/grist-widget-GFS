// Les pixels d'une capture PNG (BiDi `browsingContext.captureScreenshot`) : de quoi dire si une couleur est PEINTE à l'écran, ce que ni `getComputedStyle` ni le DOM ne disent d'un trait dessiné dans un
// `<use>` (ses éléments ne sont pas atteignables). Du PNG de 8 bits, sans entrelacement, en RVB ou RVBA : celui de Firefox et de Chromium. Aucune bibliothèque (zlib est celle de Node).
import { inflateSync } from 'node:zlib';

const SIGNATURE = '89504e470d0a1a0a';

// Le prédicteur de Paeth du filtre PNG 4.
const paeth = (a, b, c) => {
  const p = a + b - c;
  const [da, db, dc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  if (da <= db && da <= dc) return a;
  return db <= dc ? b : c;
};

// Un octet défiltré : `kind` est le filtre de la ligne, `left`, `up` et `upLeft` les octets voisins déjà défiltrés.
const unfilter = (kind, raw, left, up, upLeft) => {
  if (kind === 1) return raw + left;
  if (kind === 2) return raw + up;
  if (kind === 3) return raw + ((left + up) >> 1);
  return kind === 4 ? raw + paeth(left, up, upLeft) : raw;
};

// { width, height, pixels } : `pixels[(y * width + x)]` est [r, g, b, a].
export function decodePng(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== SIGNATURE) throw new Error('ce n\'est pas un PNG');
  let at = 8;
  let header = null;
  const data = [];
  while (at < buffer.length) {
    const length = buffer.readUInt32BE(at);
    const kind = buffer.toString('latin1', at + 4, at + 8);
    const body = buffer.subarray(at + 8, at + 8 + length);
    if (kind === 'IHDR') header = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8], color: body[9], interlace: body[12] };
    if (kind === 'IDAT') data.push(body);
    at += 12 + length;
  }
  if (!header || header.depth !== 8 || header.interlace !== 0 || ![2, 6].includes(header.color)) throw new Error('PNG non lu : seulement RVB ou RVBA de 8 bits, sans entrelacement');
  const bytes = header.color === 6 ? 4 : 3;
  const stride = header.width * bytes;
  const raw = inflateSync(Buffer.concat(data));
  const rows = [Buffer.alloc(stride)];
  for (let y = 0; y < header.height; y++) {
    const line = Buffer.alloc(stride);
    const previous = rows[y];
    const start = y * (stride + 1);
    for (let x = 0; x < stride; x++) {
      const [left, upLeft] = x >= bytes ? [line[x - bytes], previous[x - bytes]] : [0, 0];
      line[x] = unfilter(raw[start], raw[start + 1 + x], left, previous[x], upLeft) & 255;
    }
    rows.push(line);
  }
  const pixels = [];
  for (let y = 1; y <= header.height; y++) {
    for (let x = 0; x < header.width; x++) pixels.push([rows[y][x * bytes], rows[y][x * bytes + 1], rows[y][x * bytes + 2], bytes === 4 ? rows[y][x * bytes + 3] : 255]);
  }
  return { width: header.width, height: header.height, pixels };
}

// Le nombre de pixels opaques à `gap` près de `rgb` ([r, g, b] sur 255) dans la capture.
export const countNear = ({ pixels }, rgb, gap = 6) => pixels.filter(pixel => pixel[3] === 255 && rgb.every((value, i) => Math.abs(pixel[i] - value) <= gap)).length;
