// La lecture des captures PNG (test/png-pixels.mjs) : un PNG fait à la main, avec chacun des cinq filtres, est relu pixel pour pixel ; ce qui n'est pas lisible est refusé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateSync } from 'node:zlib';
import { countNear, decodePng } from './png-pixels.mjs';

const chunk = (kind, body) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(kind, 4, 'latin1');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, tail]);
};

const paeth = (a, b, c) => { const p = a + b - c; const [da, db, dc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)]; return da <= db && da <= dc ? a : (db <= dc ? b : c); };

// Un PNG de `rows` (des lignes de [r, g, b, a]) : la ligne i prend le filtre i % 5.
function encode(rows, color = 6) {
  const bytes = color === 6 ? 4 : 3;
  const lines = rows.map(row => Buffer.from(row.flatMap(pixel => pixel.slice(0, bytes))));
  const filtered = lines.map((line, y) => {
    const kind = y % 5;
    const out = Buffer.alloc(line.length + 1);
    out[0] = kind;
    for (let x = 0; x < line.length; x++) {
      const left = x >= bytes ? line[x - bytes] : 0;
      const up = y > 0 ? lines[y - 1][x] : 0;
      const upLeft = y > 0 && x >= bytes ? lines[y - 1][x - bytes] : 0;
      const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][kind];
      out[x + 1] = (line[x] - predictor) & 255;
    }
    return out;
  });
  const header = Buffer.alloc(13);
  header.writeUInt32BE(rows[0].length, 0);
  header.writeUInt32BE(rows.length, 4);
  header[8] = 8;
  header[9] = color;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.concat(filtered))), chunk('IEND', Buffer.alloc(0))]);
}

const image = Array.from({ length: 6 }, (unused, y) => Array.from({ length: 5 }, (also, x) => [(x * 40 + y * 7) % 256, (y * 50 + x * 3) % 256, (x * y * 11) % 256, 255]));

test('un PNG RVBA aux cinq filtres se relit pixel pour pixel', () => {
  const read = decodePng(encode(image));
  assert.deepEqual([read.width, read.height], [5, 6]);
  assert.deepEqual(read.pixels, image.flat());
});

test('un PNG RVB se relit avec une opacité pleine', () => {
  const read = decodePng(encode(image, 2));
  assert.deepEqual(read.pixels, image.flat());
});

test('countNear compte les pixels opaques proches de la couleur, pas les transparents ni les autres', () => {
  const read = { pixels: [[10, 20, 30, 255], [12, 18, 33, 255], [10, 20, 30, 128], [200, 20, 30, 255]] };
  assert.equal(countNear(read, [10, 20, 30]), 2);
  assert.equal(countNear(read, [10, 20, 30], 0), 1);
  assert.equal(countNear(read, [1, 1, 1]), 0);
});

test('ce qui n\'est pas un PNG lisible est refusé, jamais lu de travers', () => {
  assert.throws(() => decodePng(Buffer.from('GIF89a......')), /pas un PNG/);
  const grey = encode(image);
  grey[8 + 8 + 9] = 0; // l'octet du type de couleur de l'en-tête : du gris
  assert.throws(() => decodePng(grey), /non lu/);
});
