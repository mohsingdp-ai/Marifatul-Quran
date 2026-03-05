/**
 * Generates icon-192.png and icon-512.png in the project root.
 * Run: node scripts/generate-icons.js
 */
"use strict";
const zlib = require("zlib");
const fs   = require("fs");
const path = require("path");

/* ── CRC-32 ─────────────────────────────────────────── */
const CRC = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC[i] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC[(c ^ buf[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ── PNG helpers ─────────────────────────────────────── */
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; }

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const crcVal = crc32(Buffer.concat([t, data]));
  return Buffer.concat([u32(data.length), t, data, u32(crcVal)]);
}

function makePNG(size, pixels) {
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = chunk("IHDR", Buffer.concat([u32(size), u32(size), Buffer.from([8,2,0,0,0])]));

  // Raw scanlines with filter byte 0 (None)
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0;
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 3;
      const dst = y * (1 + size * 3) + 1 + x * 3;
      raw[dst]   = pixels[src];
      raw[dst+1] = pixels[src+1];
      raw[dst+2] = pixels[src+2];
    }
  }

  const idat = chunk("IDAT", zlib.deflateSync(raw));
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

/* ── Icon drawing ────────────────────────────────────── */
function generateIcon(size) {
  const px = new Uint8Array(size * size * 3);

  const bg  = [13,  79,  79];   // --teal-dark  #0d4f4f
  const mid = [15, 122, 122];   // --teal-accent #0f7a7a
  const gold= [139,105, 20];    // --arabic-gold #8b6914

  // Fill background
  for (let i = 0; i < px.length; i += 3) { px[i]=bg[0]; px[i+1]=bg[1]; px[i+2]=bg[2]; }

  // Soft inner circle (teal-accent)
  const cx = size/2, cy = size/2, r1 = size*0.4;
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    if ((x-cx)**2+(y-cy)**2 <= r1*r1) {
      const i=(y*size+x)*3; px[i]=mid[0]; px[i+1]=mid[1]; px[i+2]=mid[2];
    }
  }

  // Gold ring border
  const r2 = r1, r3 = r2 - size*0.05;
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    const d2=(x-cx)**2+(y-cy)**2;
    if (d2 <= r2*r2 && d2 >= r3*r3) {
      const i=(y*size+x)*3; px[i]=gold[0]; px[i+1]=gold[1]; px[i+2]=gold[2];
    }
  }

  // Letter "ق" rendered as pixel art scaled to icon size
  // Use a cross-shaped "Q"-like mark in gold (simple geometric, no font needed)
  const stroke = Math.max(2, Math.round(size * 0.06));
  const qR = size * 0.22;

  function dot(x, y, s) {
    const x0=Math.round(x)-s, x1=Math.round(x)+s;
    const y0=Math.round(y)-s, y1=Math.round(y)+s;
    for (let py=y0; py<=y1; py++) for (let px2=x0; px2<=x1; px2++) {
      if (py>=0&&py<size&&px2>=0&&px2<size) {
        const i=(py*size+px2)*3; px[i]=gold[0]; px[i+1]=gold[1]; px[i+2]=gold[2];
      }
    }
  }

  // Draw a circle for "ق" body
  const steps = 360;
  for (let a=0; a<steps; a++) {
    const rad = (a/steps)*2*Math.PI;
    const x = cx + qR*Math.cos(rad);
    const y = (cy - size*0.04) + qR*Math.sin(rad);
    dot(x, y, stroke);
  }

  // Two dots below (ق has two dots underneath)
  const dotY = cy + size*0.22;
  const dotR = Math.max(2, Math.round(size*0.04));
  dot(cx - size*0.08, dotY, dotR);
  dot(cx + size*0.08, dotY, dotR);

  return makePNG(size, px);
}

/* ── Write files ─────────────────────────────────────── */
const root = path.join(__dirname, "..");
[192, 512].forEach(s => {
  const file = path.join(root, `icon-${s}.png`);
  fs.writeFileSync(file, generateIcon(s));
  console.log("Generated " + file);
});
