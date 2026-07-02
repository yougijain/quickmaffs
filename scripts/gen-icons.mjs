// Generates brand PNG icons with no external deps (uses Node's zlib).
// Draws an emerald arithmetic motif (+ − × ÷ quadrants) on the ink background.
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const BG = [15, 23, 42, 255]; // #0f172a
const FG = [52, 211, 153, 255]; // emerald-400 #34d399

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(size, { maskable } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = c[3];
  };

  const radius = maskable ? size : size * 0.22; // maskable = full-bleed square
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // rounded-rect background
      const inCorner = (cx, cy) => Math.hypot(x - cx, y - cy) > radius;
      let bg = true;
      if (!maskable) {
        if (x < radius && y < radius && inCorner(radius, radius)) bg = false;
        else if (x > size - radius && y < radius && inCorner(size - radius, radius)) bg = false;
        else if (x < radius && y > size - radius && inCorner(radius, size - radius)) bg = false;
        else if (x > size - radius && y > size - radius && inCorner(size - radius, size - radius)) bg = false;
      }
      set(x, y, bg ? BG : [0, 0, 0, 0]);
    }
  }

  // Draw a bold "+" and "−" motif centered.
  const cx = size / 2;
  const cy = size / 2;
  const arm = size * 0.26; // half-length of bars
  const thick = size * 0.075;
  const plusYOffset = -size * 0.11;
  const minusYOffset = size * 0.17;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dyPlus = y - (cy + plusYOffset);
      const dyMinus = y - (cy + minusYOffset);
      // plus: horizontal or vertical bar
      const hPlus = Math.abs(dyPlus) <= thick && Math.abs(dx) <= arm;
      const vPlus = Math.abs(dx) <= thick && Math.abs(dyPlus) <= arm;
      // minus bar below
      const minus = Math.abs(dyMinus) <= thick && Math.abs(dx) <= arm;
      if (hPlus || vPlus || minus) set(x, y, FG);
    }
  }

  // PNG: prepend filter byte 0 per scanline
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

writeFileSync(join(OUT, 'icon-192.png'), png(192));
writeFileSync(join(OUT, 'icon-512.png'), png(512));
writeFileSync(join(OUT, 'icon-512-maskable.png'), png(512, { maskable: true }));
writeFileSync(join(OUT, 'apple-touch-icon.png'), png(180));
console.log('icons written to', OUT);
