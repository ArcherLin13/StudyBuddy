const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 1024

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

function writePng(file, pixels, size) {
  const raw = []
  for (let y = 0; y < size; y++) {
    raw.push(0)
    for (let x = 0; x < size; x++) raw.push(...pixels[y][x])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.writeUInt8(8, 8)
  ihdr.writeUInt8(6, 9)
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.from(raw), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, png)
}

function blank(size, color) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => color.slice())
  )
}

function blend(px, color, a) {
  if (a <= 0) return
  a = Math.min(1, a)
  const ia = 1 - a
  px[0] = Math.round(px[0] * ia + color[0] * a)
  px[1] = Math.round(px[1] * ia + color[1] * a)
  px[2] = Math.round(px[2] * ia + color[2] * a)
  px[3] = 255
}

function fillCircle(pixels, cx, cy, r, color) {
  const size = pixels.length
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = Math.max(0, Math.min(1, r + 0.8 - Math.hypot(x - cx, y - cy)))
      if (a) blend(pixels[y][x], color, a)
    }
  }
}

function fillTriangle(pixels, pts, color) {
  const size = pixels.length
  const [x1, y1] = pts[0]
  const [x2, y2] = pts[1]
  const [x3, y3] = pts[2]
  const den = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
  const minx = Math.max(0, Math.floor(Math.min(x1, x2, x3) - 2))
  const maxx = Math.min(size - 1, Math.ceil(Math.max(x1, x2, x3) + 2))
  const miny = Math.max(0, Math.floor(Math.min(y1, y2, y3) - 2))
  const maxy = Math.min(size - 1, Math.ceil(Math.max(y1, y2, y3) + 2))
  for (let y = miny; y <= maxy; y++) {
    for (let x = minx; x <= maxx; x++) {
      const a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / den
      const b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / den
      const c = 1 - a - b
      if (a >= -0.01 && b >= -0.01 && c >= -0.01) blend(pixels[y][x], color, 1)
    }
  }
}

const paper = [247, 246, 242, 255]
const terracotta = [196, 92, 38, 255]
const white = [255, 255, 255, 255]
const p = blank(SIZE, paper)
fillCircle(p, 512, 512, 320, terracotta)
fillTriangle(p, [[430, 360], [430, 664], [690, 512]], white)
const root = path.join(__dirname, '..', 'assets')
writePng(path.join(root, 'icon.png'), p, SIZE)
writePng(path.join(root, 'splash-icon.png'), p, SIZE)
console.log('icons written')
