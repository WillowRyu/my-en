import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { loadContent } from './load-content.mjs'
const { phrases, words } = await loadContent()

if (process.platform !== 'darwin') throw new Error('개인용 음성 생성은 macOS에서 /usr/bin/say를 사용합니다. 다른 OS에서는 직접 녹음한 WAV 자산을 public/audio에 제공하세요.')
const folder = resolve('public/audio'), temp = mkdtempSync(join(tmpdir(), 'my-en-audio-'))
mkdirSync(folder, { recursive: true })
try {
  for (const p of process.argv.includes('--words-only') ? words : [...phrases, ...words]) {
    const input = join(temp, `${p.id}.aiff`)
    execFileSync('/usr/bin/say', ['-v', 'Samantha', '-r', '155', '-o', input, p.en], { timeout: 30000 })
    execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16@22050', input, join(folder, p.audio.split('/').at(-1))], { timeout: 10000 })
    const bytes = readFileSync(join(folder, p.audio.split('/').at(-1)))
    let dataBytes = 0
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const length = bytes.readUInt32LE(offset + 4)
      if (bytes.toString('ascii', offset, offset + 4) === 'data') dataBytes = length
      offset += 8 + length + length % 2
    }
    if (dataBytes < 8820) throw new Error(`${p.id}: 음성 서비스가 비어 있는 오디오를 생성했습니다. macOS 음성 서비스 접근 권한을 확인하세요.`)
    console.log(`${p.id}: ${p.en}`)
  }
  writeFileSync(join(folder, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Local macOS Samantha voice', usage: 'personal, non-commercial only; replace before public sharing', phrases: phrases.map(p => ({ id: p.id, text: p.en, file: p.audio.split('/').at(-1) })), words: words.map(w => ({ id: w.id, text: w.en, file: w.audio.split('/').at(-1) })) }, null, 2) + '\n')
} finally { rmSync(temp, { recursive: true, force: true }) }
