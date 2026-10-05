import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
const crc = bytes => { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1 } return (c ^ 0xffffffff) >>> 0 }
const chunk = (name, data) => { const type = Buffer.from(name), size = Buffer.alloc(4), check = Buffer.alloc(4); size.writeUInt32BE(data.length); check.writeUInt32BE(crc(Buffer.concat([type, data]))); return Buffer.concat([size, type, data, check]) }
for (const n of [192, 512]) {
  const raw = Buffer.alloc(n * (n * 4 + 1))
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n, v = y / n
    const bubble = u >= .2 && u <= .8 && v >= .3 && v <= .68 || u >= .25 && u <= .4 && v > .68 && v <= .78 && u + v <= 1.03
    const wave = v > .4 && v < .58 && [0.34,0.45,0.56,0.67].some((cx, i) => Math.abs(u-cx)<.018 && Math.abs(v-.49)<[.045,.08,.06,.04][i])
    const color = bubble && !wave ? [255,255,255,255] : [36,91,181,255]
    const offset = y * (n * 4 + 1) + 1 + x * 4
    color.forEach((c, i) => { raw[offset + i] = c })
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n,0); ihdr.writeUInt32BE(n,4); ihdr[8]=8; ihdr[9]=6
  writeFileSync(`public/icon-${n}.png`, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]))
}
