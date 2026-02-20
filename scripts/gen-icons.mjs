/**
 * Generates PWA icons and OG image using pure Node.js (no external deps).
 * Outputs: public/icon-192.png, public/icon-512.png,
 *          public/apple-touch-icon.png, public/og-image.png
 */
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, '..', 'public')

// ─── Minimal PNG encoder ────────────────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t = Buffer.from(type)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crcBuf])
}
function makePNG(w, h, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit RGB

  const raw = Buffer.alloc(h * (w * 3 + 1))
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0 // filter: None
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixelFn(x, y)
      const i = y * (w * 3 + 1) + 1 + x * 3
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b
    }
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── Colors ─────────────────────────────────────────────────────────────────

const TEAL   = [32, 178, 170]  // #20B2AA lightseagreen
const DTEAL  = [20, 130, 125]  // slightly darker teal for depth
const WHITE  = [255, 255, 255]
const LGRAY  = [200, 230, 228] // light teal-gray for windows
const DARK   = [30, 40, 38]    // near-black for wheels/details

// ─── Bus icon pixel painter (for icon-sized images) ─────────────────────────

function busIcon(size) {
  const s = size / 192 // scale factor relative to 192px base
  const round = (n) => Math.round(n * s)

  // Geometry (base 192px coordinates)
  const bodyX1 = 20, bodyX2 = 172, bodyY1 = 44, bodyY2 = 140
  const winY1 = 58, winY2 = 108
  const win1X1 = 32, win1X2 = 86
  const win2X1 = 98, win2X2 = 158
  const doorX1 = 134, doorX2 = 158, doorY1 = 108, doorY2 = 140
  const stripe1Y = 44, stripe2Y = 50 // top color stripe
  const bumperX = 168, bumperY1 = 80, bumperY2 = 140 // front face
  const w1cx = 55, w1cy = 152, wR = 22  // left wheel
  const w2cx = 137, w2cy = 152          // right wheel

  return (px, py) => {
    const x = px / s, y = py / s

    // Wheels
    function inCircle(cx, cy, r) { return (x-cx)**2 + (y-cy)**2 <= r**2 }
    if (inCircle(w1cx, w1cy, wR)) {
      return inCircle(w1cx, w1cy, wR - 8) ? [80, 80, 80] : DARK
    }
    if (inCircle(w2cx, w2cy, wR)) {
      return inCircle(w2cx, w2cy, wR - 8) ? [80, 80, 80] : DARK
    }

    // Bus body
    if (x >= bodyX1 && x <= bodyX2 && y >= bodyY1 && y <= bodyY2) {
      // Front face (dark strip on right)
      if (x >= bumperX && y >= bumperY1 && y <= bumperY2) return [60, 70, 68]
      // Top color stripe
      if (y <= stripe1Y + 6) return DTEAL
      // Windows
      if (y >= winY1 && y <= winY2) {
        if (x >= win1X1 && x <= win1X2) return LGRAY
        if (x >= win2X1 && x <= win2X2) return LGRAY
      }
      // Door opening
      if (x >= doorX1 && x <= doorX2 && y >= doorY1 && y <= doorY2) return LGRAY
      return WHITE
    }

    return TEAL
  }
}

// ─── OG image painter (1200×630) ────────────────────────────────────────────

function ogPixel(x, y) {
  const W = 1200, H = 630

  // Subtle diagonal split: slightly darker teal on right portion
  const t = x / W - y / H  // diagonal
  const bg = t > 0.15 ? DTEAL : TEAL

  // Draw a scaled-up bus silhouette centered-left
  const busW = 480, busH = 240
  const busLeft = 80, busTop = (H - busH) / 2

  const bx = (x - busLeft) / (busW / 192)
  const by = (y - busTop) / (busH / 192)

  if (bx >= 0 && bx < 192 && by >= 0 && by < 192) {
    const c = busIcon(192)(Math.floor(bx), Math.floor(by))
    // Blend bus onto bg (simple: just return bus pixel if not background teal)
    const isBg = c[0] === TEAL[0] && c[1] === TEAL[1] && c[2] === TEAL[2]
    if (!isBg) return c
  }

  return bg
}

// ─── Generate & write ───────────────────────────────────────────────────────

const icons = [
  { name: 'icon-192.png',          w: 192,  h: 192,  fn: (x, y) => busIcon(192)(x, y) },
  { name: 'icon-512.png',          w: 512,  h: 512,  fn: (x, y) => busIcon(512)(x, y) },
  { name: 'apple-touch-icon.png',  w: 180,  h: 180,  fn: (x, y) => busIcon(180)(x, y) },
  { name: 'og-image.png',          w: 1200, h: 630,  fn: ogPixel },
]

for (const { name, w, h, fn } of icons) {
  const dest = path.join(PUBLIC, name)
  const buf = makePNG(w, h, fn)
  fs.writeFileSync(dest, buf)
  console.log(`✓ ${name} (${w}×${h}, ${(buf.length / 1024).toFixed(1)} KB)`)
}
