/**
 * Zero-dependency PNG icon generator (Node built-ins only).
 *
 * Rasterizes a simple VGC icon (dark rounded-square background, blue ring,
 * center dot) at the sizes Android/Chrome want for PWA install, plus a
 * maskable variant with extra safe-area padding. Uses only `zlib` + `fs`.
 *
 * Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'public', 'icons');

const BG = [0x1f, 0x29, 0x37]; // #1f2937
const BLUE = [0x3b, 0x82, 0xf6]; // #3b82f6
const LIGHT = [0xe5, 0xe7, 0xeb];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  // Scale reference from the 512 viewBox SVG.
  const s = size / 512;
  const pad = maskable ? size * 0.1 : 0; // maskable safe area
  const inner = size - pad * 2;
  const radius = 64 * (inner / 512);
  const ringOuter = 180 * (inner / 512);
  const ringInner = ringOuter - 24 * (inner / 512);
  const centerOuter = 48 * (inner / 512);
  const centerDot = 20 * (inner / 512);
  const lineHalf = 12 * (inner / 512);

  const put = (x, y, rgb, a = 255) => {
    const i = (y * size + x) * 4;
    rgba[i] = rgb[0];
    rgba[i + 1] = rgb[1];
    rgba[i + 2] = rgb[2];
    rgba[i + 3] = a;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Rounded-square background within padded area.
      const lx = x - pad;
      const ly = y - pad;
      const inArea = lx >= 0 && ly >= 0 && lx < inner && ly < inner;
      let insideRounded = false;
      if (inArea) {
        const rx = Math.min(lx, inner - lx);
        const ry = Math.min(ly, inner - ly);
        if (rx >= radius || ry >= radius) insideRounded = true;
        else {
          const dx = radius - rx;
          const dy = radius - ry;
          insideRounded = dx * dx + dy * dy <= radius * radius;
        }
      }
      if (!insideRounded) {
        put(x, y, BG, 0); // transparent outside
        continue;
      }
      put(x, y, BG, 255);
      const dcx = x - cx;
      const dcy = y - cy;
      const dist = Math.sqrt(dcx * dcx + dcy * dcy);
      // Horizontal blue line.
      if (Math.abs(dcy) <= lineHalf && dist <= ringOuter) put(x, y, BLUE);
      // Ring.
      if (dist <= ringOuter && dist >= ringInner) put(x, y, BLUE);
      // Center circle ring + dot.
      if (dist <= centerOuter && dist >= centerOuter - 20 * (inner / 512))
        put(x, y, BLUE);
      if (dist <= centerOuter - 20 * (inner / 512)) put(x, y, BG);
      if (dist <= centerDot) put(x, y, BLUE);
    }
  }
  void s;
  void LIGHT;
  return encodePng(size, size, rgba);
}

writeFileSync(resolve(OUT, 'icon-192.png'), drawIcon(192));
writeFileSync(resolve(OUT, 'icon-512.png'), drawIcon(512));
writeFileSync(resolve(OUT, 'icon-maskable-512.png'), drawIcon(512, { maskable: true }));
console.log('Generated icon-192.png, icon-512.png, icon-maskable-512.png');
