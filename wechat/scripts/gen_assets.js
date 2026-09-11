const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ROOT = path.join(__dirname, '..')
const ICON_DIR = path.join(ROOT, 'assets', 'icons')
const SIZE = 81

function crc32(buf) {
  return zlib.crc32(buf)
}

function chunk(tag, data) {
  const tagBuf = Buffer.from(tag)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([tagBuf, data])))
  return Buffer.concat([len, tagBuf, data, crc])
}

function writePng(file, pixels) {
  const raw = []
  for (let y = 0; y < SIZE; y++) {
    raw.push(0)
    for (let x = 0; x < SIZE; x++) {
      raw.push(...pixels[y][x])
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr.writeUInt8(8, 8)
  ihdr.writeUInt8(6, 9)
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.from(raw), { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, png)
}

function blank() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => [0, 0, 0, 0]))
}

function blend(px, color, a) {
  if (a <= 0) return
  a = Math.min(1, a)
  const ia = 1 - a * (color[3] / 255)
  const na = color[3] * a
  px[0] = Math.round(px[0] * ia + (color[0] * na) / 255)
  px[1] = Math.round(px[1] * ia + (color[1] * na) / 255)
  px[2] = Math.round(px[2] * ia + (color[2] * na) / 255)
  px[3] = Math.round(Math.min(255, px[3] * ia + na))
}

function fillCircle(pixels, cx, cy, r, color, width) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy)
      const a = width == null
        ? Math.max(0, Math.min(1, r + 0.6 - d))
        : Math.max(0, Math.min(1, width / 2 + 0.6 - Math.abs(d - r)))
      if (a) blend(pixels[y][x], color, a)
    }
  }
}

function fillRect(pixels, x0, y0, x1, y1, color, radius) {
  radius = radius || 0
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let a
      if (radius > 0) {
        const ix0 = x0 + radius
        const iy0 = y0 + radius
        const ix1 = x1 - radius
        const iy1 = y1 - radius
        if (x >= ix0 && x <= ix1 && y >= y0 && y <= y1) a = 1
        else if (y >= iy0 && y <= iy1 && x >= x0 && x <= x1) a = 1
        else {
          const cx = Math.min(Math.max(x, ix0), ix1)
          const cy = Math.min(Math.max(y, iy0), iy1)
          a = Math.max(0, Math.min(1, radius + 0.6 - Math.hypot(x - cx, y - cy)))
        }
      } else {
        const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1
        const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0
        const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0
        a = inside ? 1 : Math.max(0, Math.min(1, 0.6 - Math.hypot(dx, dy)))
      }
      if (a) blend(pixels[y][x], color, a)
    }
  }
}

function makeTimer(color) {
  const p = blank()
  fillCircle(p, 40, 40, 24, color, 5)
  fillRect(p, 38, 22, 42, 40, color, 1)
  fillRect(p, 38, 38, 52, 42, color, 1)
  return p
}

function makeConfig(color) {
  const p = blank()
  ;[24, 40, 56].forEach((y, i) => {
    fillRect(p, 18, y - 3, 62, y + 3, color, 2)
    fillCircle(p, 30 + i * 12, y, 7, color)
  })
  return p
}

function makeHistory(color) {
  const p = blank()
  fillRect(p, 18, 42, 30, 62, color, 2)
  fillRect(p, 34, 28, 46, 62, color, 2)
  fillRect(p, 50, 18, 62, 62, color, 2)
  return p
}

function writeWav() {
  const fr = 16000
  const samples = []
  function tone(freq, dur, vol) {
    const n = Math.floor(fr * dur)
    for (let i = 0; i < n; i++) {
      let env = 1
      if (i < 200) env = i / 200
      if (i > n - 300) env = Math.max(0, (n - i) / 300)
      samples.push(Math.round(32767 * vol * env * Math.sin((2 * Math.PI * freq * i) / fr)))
    }
  }
  function silence(dur) {
    const n = Math.floor(fr * dur)
    for (let i = 0; i < n; i++) samples.push(0)
  }
  ;[880, 880, 988].forEach((freq) => {
    tone(freq, 0.22, 0.32)
    silence(0.12)
  })
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2))
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(fr, 24)
  header.writeUInt32LE(fr * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  fs.mkdirSync(path.join(ROOT, 'assets'), { recursive: true })
  fs.writeFileSync(path.join(ROOT, 'assets', 'alarm.wav'), Buffer.concat([header, data]))
}

const muted = [138, 134, 128, 255]
const active = [44, 42, 38, 255]
fs.mkdirSync(ICON_DIR, { recursive: true })
writePng(path.join(ICON_DIR, 'timer.png'), makeTimer(muted))
writePng(path.join(ICON_DIR, 'timer-active.png'), makeTimer(active))
writePng(path.join(ICON_DIR, 'config.png'), makeConfig(muted))
writePng(path.join(ICON_DIR, 'config-active.png'), makeConfig(active))
writePng(path.join(ICON_DIR, 'history.png'), makeHistory(muted))
writePng(path.join(ICON_DIR, 'history-active.png'), makeHistory(active))
writeWav()
console.log('assets generated')
