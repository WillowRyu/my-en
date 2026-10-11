import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { phraseById, phrases, wordById, words } from '../src/content'
import { emptyState, skipWordStudy, startSession, type State, type Step } from '../src/model'
declare global { interface Window { myEnTestStream: MediaStream; myEnLateStream: MediaStream; myEnOriginalSetItem: Storage['setItem'] } }
const key = 'my-en:progress:v1'
async function stored(page: Page): Promise<State> { return page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key) }
async function seed(page: Page, step: Step = 'listen', mode: 'normal' | 'quick' = 'quick') {
  let s = skipWordStudy(startSession(emptyState('UTC'), mode, new Date(), `test-${step}`), new Date())
  s = { ...s, active: { ...s.active!, step, heard: step !== 'listen', phraseIds: ['hello', 'name'] } }
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)) }, { key, state: s })
  await page.goto('/#study')
}
async function order(page: Page, id: string) {
  for (const token of phraseById[id].tokens) await page.locator('.word-bank').getByRole('button', { name: token, exact: true }).click()
  await page.getByRole('button', { name: '문장 확인', exact: true }).click()
}
async function listen(page: Page) {
  await page.getByRole('button', { name: '모범 음성 듣기', exact: true }).click()
  await expect(page.getByRole('button', { name: '뜻 확인하기', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '뜻 확인하기', exact: true }).click()
}
async function finishWords(page: Page, noSound = false) {
  for (let n = 0; n < 15; n++) {
    const s = await stored(page), w = s.active?.wordStudy
    if (!w) return
    const word = wordById[w.wordIds[w.wordIndex]]
    if (w.step === 'learn') {
      if (noSound) await page.getByRole('button', { name: '단어 뜻 확인하기', exact: true }).click()
      else { await page.getByRole('button', { name: '모범 음성 듣기', exact: true }).click(); await page.getByRole('button', { name: '단어 뜻 확인하기', exact: true }).click() }
    } else if (w.step === 'meaning') await page.getByRole('button', { name: word.ko, exact: true }).click()
    else { await page.getByLabel('영어 단어', { exact: true }).fill(word.en); await page.getByRole('button', { name: '단어 확인', exact: true }).click() }
  }
  throw new Error('Word steps did not finish')
}
async function finishCurrent(page: Page, noSound = false) {
  await finishWords(page, noSound)
  for (let n = 0; n < 8; n++) {
    const s = await stored(page)
    if (!s.active) break
    const p = phraseById[s.active.phraseIds[s.active.phraseIndex]]
    if (s.active.step === 'listen') { if (noSound) await page.getByRole('button', { name: '소리 없이 뜻부터 보기' }).click(); else await listen(page) }
    if ((await stored(page)).active?.step === 'meaning') await page.getByRole('button', { name: p.ko, exact: true }).click()
    if ((await stored(page)).active?.step === 'arrange') await order(page, p.id)
    if ((await stored(page)).active?.step === 'speak') await page.getByRole('button', { name: '말하기는 다음에 할게요' }).click()
    if ((await stored(page)).active?.step === 'recall') await page.getByRole('button', { name: '스스로 떠올렸어요' }).click()
    await expect.poll(async () => (await stored(page)).active?.phraseIndex ?? -1).not.toBe(s.active.phraseIndex)
  }
}

test('home, real audio, entire first lesson, separate evidence and no duplicate completion', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '오늘은 영어 한마디부터.' })).toBeVisible()
  await expect(page.getByText('오프라인 준비됨', { exact: true })).toBeVisible()
  mkdirSync('docs/screenshots', { recursive: true })
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-home.png`, fullPage: true })
  await page.getByRole('button', { name: '오늘 공부 시작', exact: true }).click()
  await finishWords(page)
  await expect(page.getByRole('button', { name: '뜻 확인하기' })).toBeDisabled()
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-study.png`, fullPage: true })
  await finishCurrent(page)
  await expect(page.getByRole('heading', { name: '오늘의 한 걸음을 남겼어요.' })).toBeVisible()
  const result = await stored(page)
  expect(result.completions).toHaveLength(1); expect(result.completions[0].phraseIds).toHaveLength(3)
  expect(result.reviews['hello:listening'].successes).toBe(1); expect(result.reviews['hello:speaking']).toBeUndefined()
  await page.reload(); expect((await stored(page)).completions).toHaveLength(1)
  await page.getByRole('link', { name: '나의 기록 보기', exact: true }).click()
  await expect(page.getByText('아직 확인 전').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('wrong choice, hint reduction, refresh and back/pause keep progress', async ({ page }) => {
  await seed(page, 'meaning')
  await page.getByRole('button', { name: '감사합니다.', exact: true }).click()
  await expect(page.getByText('조금 달랐어요.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '뜻 힌트 보기' }).click()
  await page.getByRole('button', { name: '안녕하세요.', exact: true }).click()
  await page.locator('.word-bank').getByRole('button', { name: 'Hello.', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Hello. 빼기' })).toBeVisible()
  await page.getByRole('button', { name: '잠깐 쉬기' }).click()
  await expect(page.getByRole('button', { name: '이어서 공부하기' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: '짧은 문장을 만들어 볼까요?' })).toBeVisible()
  await page.getByRole('button', { name: '문장 확인', exact: true }).click()
  await page.getByRole('button', { name: '따라 말했어요' }).click()
  await expect(page.locator('.study-content').getByText('Hello.', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '표현 다시 보기' }).click()
  await page.reload()
  await expect(page.locator('.study-content').getByText('Hello.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '보고 다시 연습했어요' }).click()
  const s = await stored(page)
  expect(s.reviews['hello:listening'].successes).toBe(0); expect(s.reviews['hello:recall'].successes).toBe(0)
  expect(s.reviews['hello:speaking'].evidence).toBe('selfReported')
})

test('five-minute path and failed audio can finish without fabricated listening progress', async ({ page }) => {
  await page.route('**/audio/*.wav', route => route.abort())
  // Disable SW for this one failure simulation so its cached assets cannot mask failure.
  await page.addInitScript(() => { Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true }) })
  await page.goto('/')
  await page.getByRole('button', { name: '5분만 공부하기' }).click()
  await page.getByRole('button', { name: '모범 음성 듣기', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: '음성' }).first()).toBeVisible()
  await page.getByRole('button', { name: '모범 음성 듣기', exact: true }).click()
  await finishCurrent(page, true)
  await expect(page.getByRole('heading', { name: '오늘의 한 걸음을 남겼어요.' })).toBeVisible()
  const s = await stored(page)
  expect(s.completions[0].mode).toBe('quick'); expect(s.completions[0].phraseIds).toHaveLength(2)
  expect(Object.values(s.reviews).some(r => r.skill === 'listening')).toBe(false)
})

test('microphone denial and unsupported recording allow an alternative', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) }, configurable: true }) })
  await seed(page, 'speak')
  await page.getByRole('button', { name: '녹음 시작' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '마이크 사용이 허용되지' })).toBeVisible()
  await page.getByRole('button', { name: '녹음 시작' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '마이크 사용이 허용되지' })).toBeVisible()
  await page.evaluate(() => { Object.defineProperty(window, 'MediaRecorder', { value: undefined, configurable: true }) })
  await page.getByRole('button', { name: '녹음 시작' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '이 환경에서는 녹음을 사용할 수 없습니다.' })).toBeVisible()
  await page.getByRole('button', { name: '따라 말했어요' }).click()
  await expect(page.getByRole('heading', { name: '이제, 힌트 없이 떠올려요.' })).toBeVisible()
})

test('real MediaRecorder records/replays a synthetic stream; cancel and navigation release tracks', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
      const audio = new AudioContext(), tone = audio.createOscillator(), target = audio.createMediaStreamDestination()
      tone.frequency.value = 220; tone.connect(target); tone.start(); void audio.resume()
      Object.defineProperty(window, 'myEnTestStream', { value: target.stream, configurable: true })
      return target.stream
    } } })
  })
  await seed(page, 'speak')
  await page.getByRole('button', { name: '녹음 시작' }).click()
  await expect(page.getByText('녹음 중', { exact: false })).toBeVisible()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: '녹음 끝내기' }).click()
  await expect(page.getByLabel('내 녹음 재생')).toBeVisible()
  await page.locator('audio').evaluate(async (audio: HTMLAudioElement) => { await audio.play() })
  await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.myEnTestStream.getTracks().every(t => t.readyState === 'ended'))).toBe(true)
  await page.getByRole('button', { name: '다시 녹음하기' }).click()
  await expect(page.getByText('녹음 중', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '녹음 취소', exact: true }).click()
  expect(await page.evaluate(() => window.myEnTestStream.getTracks().every(t => t.readyState === 'ended'))).toBe(true)
  await expect(page.locator('audio')).toHaveCount(0)
  await page.getByRole('button', { name: '녹음 시작' }).click()
  await expect(page.getByText('녹음 중', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '잠깐 쉬기' }).click()
  await expect(page.getByRole('button', { name: '이어서 공부하기' })).toBeVisible()
  expect(await page.evaluate(() => window.myEnTestStream.getTracks().every(t => t.readyState === 'ended'))).toBe(true)
})

test('pending microphone request cancellation releases a late stream', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => new Promise(resolve => {
      document.addEventListener('release-test-mic', () => {
        const a = new AudioContext(), d = a.createMediaStreamDestination()
        Object.defineProperty(window, 'myEnLateStream', { value: d.stream, configurable: true })
        resolve(d.stream)
      }, { once: true })
    }) } })
  })
  await seed(page, 'speak')
  await page.getByRole('button', { name: '녹음 시작' }).click()
  await page.getByRole('button', { name: '녹음 요청 취소' }).click()
  await page.evaluate(() => document.dispatchEvent(new Event('release-test-mic')))
  await expect.poll(() => page.evaluate(() => window.myEnLateStream.getTracks().every(t => t.readyState === 'ended'))).toBe(true)
  await expect(page.getByRole('button', { name: '녹음 시작' })).toBeVisible()
})

test('offline reload includes all audio, cached range playback, and progress', async ({ page, context, browserName }) => {
  // WebKit's network interception blocks before SW. Use a private test-owned
  // server on an OS-assigned free port, then close only that server for real loss.
  const server = browserName === 'webkit' ? createServer((req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname
    const file = resolve('dist', path === '/' ? 'index.html' : '.' + path)
    if (!file.startsWith(resolve('dist') + '/')) { res.writeHead(403).end(); return }
    try {
      const body = readFileSync(file)
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.wav') ? 'audio/wav' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': type }); res.end(body)
    } catch { res.writeHead(404).end() }
  }) : null
  if (server) await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const address = server?.address()
  const url = address && typeof address !== 'string' ? `http://127.0.0.1:${address.port}` : '/'
  await page.goto(url)
  await expect(page.getByText('오프라인 준비됨', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '5분만 공부하기' }).click()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  if (server) { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())) }
  else await context.setOffline(true)
  await page.reload()
  await finishWords(page)
  await listen(page)
  await expect(page.getByRole('heading', { name: '방금 표현은 어떤 뜻일까요?' })).toBeVisible()
  const cached = await page.evaluate(async () => {
    const response = await fetch('/audio/again.wav', { headers: { Range: 'bytes=100-199' } })
    return { status: response.status, size: (await response.arrayBuffer()).byteLength }
  })
  expect(cached).toEqual({ status: 206, size: 100 })
  const missFailed = await page.evaluate(async () => { try { await fetch('/uncached-offline-probe'); return false } catch { return true } })
  expect(missFailed).toBe(true)
  await page.getByRole('button', { name: '잠깐 쉬기' }).click()
  await expect(page.getByRole('button', { name: '이어서 공부하기' })).toBeVisible()
})

test('backup validation, export, restore confirmation, and safe reset/recovery', async ({ page }) => {
  await seed(page, 'arrange')
  await page.getByRole('link', { name: '설정과 백업', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '백업 내려받기', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/my-en-backup.*\.json/)
  await page.locator('input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":9}') })
  await expect(page.getByRole('alert').filter({ hasText: '호환되는 my-en 백업이 아닙니다' })).toBeVisible()
  expect((await stored(page)).active?.step).toBe('arrange')
  const path = await download.path()
  await page.locator('input[type=file]').setInputFiles(path!)
  await expect(page.getByRole('heading', { name: '이 백업으로 바꿀까요?' })).toBeVisible()
  await page.getByRole('button', { name: '이 백업으로 복원' }).click()
  await page.getByRole('button', { name: '진도 초기화 열기' }).click()
  expect((await stored(page)).active).not.toBeNull()
  await page.getByRole('button', { name: '진도 비우기 확인' }).click()
  expect((await stored(page)).active).toBeNull()
  await page.getByRole('button', { name: '직전 저장본 복구' }).click()
  expect((await stored(page)).active?.step).toBe('arrange')
})

test('corrupt storage stays untouched until explicit recovery and keyboard actions work', async ({ page }) => {
  await page.addInitScript(k => localStorage.setItem(k, '{broken'), key)
  await page.goto('/')
  await expect(page.getByRole('button', { name: '오늘 공부 시작' })).toBeDisabled()
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe('{broken')
  await page.getByRole('button', { name: '복구 화면 열기' }).focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '설정과 백업' })).toBeVisible()
  await page.getByRole('button', { name: '진도 초기화 열기' }).focus(); await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '취소', exact: true }).focus(); await page.keyboard.press('Enter')
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe('{broken')
})

test('all bundled audio have real PCM samples, UI fits 320px and large desktop', async ({ page, request }) => {
  for (const p of [...phrases, ...words]) {
    const response = await request.get(p.audio); expect(response.ok()).toBe(true)
    const buffer = await response.body()
    expect(buffer.toString('ascii', 0, 4)).toBe('RIFF')
    let dataSize = 0, peak = 0
    for (let offset = 12; offset + 8 <= buffer.length;) {
      const length = buffer.readUInt32LE(offset + 4)
      if (buffer.toString('ascii', offset, offset + 4) === 'data') { dataSize = length; for (let i = offset + 8; i + 2 <= offset + 8 + length; i += 2) peak = Math.max(peak, Math.abs(buffer.readInt16LE(i))) }
      offset += 8 + length + length % 2
    }
    expect(dataSize).toBeGreaterThan(8820); expect(peak).toBeGreaterThan(100)
  }
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: '오늘 공부 시작', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await page.getByRole('button', { name: '단어 뜻 확인하기' }).evaluate(e => e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48)
    await page.getByRole('button', { name: '잠깐 쉬기' }).click()
    await page.getByRole('link', { name: '설정과 백업', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.evaluate(k => localStorage.removeItem(k), key)
  }
})

test('words: wrong meaning, reverse recall, hint/input resume, and sentence connection', async ({ page }, info) => {
  await page.goto('/')
  await page.getByRole('button', { name: '오늘 공부 시작', exact: true }).click()
  await expect(page.getByRole('heading', { name: '이 단어부터 만나 볼까요?' })).toBeVisible()
  expect(await page.getByRole('button', { name: '단어 뜻 확인하기', exact: true }).evaluate(el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === el || !!hit && el.contains(hit) })).toBe(true)
  mkdirSync('docs/screenshots', { recursive: true })
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-word.png`, fullPage: true })
  await page.getByRole('button', { name: '단어 뜻 확인하기', exact: true }).click()
  await page.getByRole('button', { name: '감사합니다', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '뜻이 조금 달라요' })).toBeVisible()
  await page.getByRole('button', { name: '안녕하세요', exact: true }).click()
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-word-recall.png`, fullPage: true })
  await page.getByLabel('영어 단어', { exact: true }).fill('hell')
  await page.getByRole('button', { name: '단어 확인', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '아직 조금 달라요' })).toBeVisible()
  await page.getByRole('button', { name: '첫 글자 힌트' }).click()
  await page.reload()
  await expect(page.getByLabel('영어 단어', { exact: true })).toHaveValue('hell')
  await page.getByLabel('영어 단어', { exact: true }).fill('HELLO')
  await page.getByRole('button', { name: '단어 확인', exact: true }).click()
  await finishWords(page, true)
  await expect(page.getByRole('heading', { name: '먼저, 소리를 들어 보세요.' })).toBeVisible()
  const s = await stored(page)
  expect(s.wordReviews['hello:meaning'].lastOutcome).toBe('difficulty')
  expect(s.wordReviews['hello:production']).toMatchObject({ lastOutcome: 'difficulty', successes: 0 })
  await page.getByRole('link', { name: '나의 기록', exact: true }).click()
  await expect(page.getByRole('heading', { name: '문장에 쓰는 단어' })).toBeVisible()
  await expect(page.getByText('다시 연습해요', { exact: true })).toHaveCount(2)
})

test('quick completion still offers regular lesson today', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '5분만 공부하기' }).click()
  await finishCurrent(page, true)
  await page.getByRole('button', { name: '오늘은 여기까지', exact: true }).click()
  await expect(page.getByRole('button', { name: '오늘 공부 시작', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '오늘 공부 시작', exact: true }).click()
  expect((await stored(page)).active?.lessonId).toBe('day-1')
})

test('v1 import and load preserve in-flight lesson, exact original bytes, and export v2', async ({ page }) => {
  const current = skipWordStudy(startSession(emptyState('UTC'), 'normal', new Date(), 'old-session'), new Date())
  const old = { schemaVersion: 1, settings: { timeZone: 'UTC', intervals: [1, 3, 7, 14] },
    active: Object.fromEntries(Object.entries({ ...current.active!, step: 'arrange', selectedTokens: [0], hints: 2 }).filter(([k]) => !['wordStudy', 'reviewSkills'].includes(k))),
    attempts: [], reviews: {}, completions: [] }
  const raw = JSON.stringify(old)
  await page.addInitScript(({ key, raw }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, raw) }, { key, raw })
  await page.goto('/#study')
  await expect(page.getByRole('button', { name: 'Hello. 빼기' })).toBeVisible()
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(raw)
  await page.getByRole('button', { name: '문장 확인', exact: true }).click()
  expect((await stored(page)).schemaVersion).toBe(2)
  expect(await page.evaluate(() => localStorage.getItem('my-en:previous:v1'))).toBe(raw)
  await page.getByRole('link', { name: '설정과 백업', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'v1.json', mimeType: 'application/json', buffer: Buffer.from(raw) })
  await page.getByRole('button', { name: '이 백업으로 복원' }).click()
  expect((await stored(page)).active).toMatchObject({ step: 'arrange', hints: 2, selectedTokens: [0], wordStudy: null })
  const exportPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '백업 내려받기', exact: true }).click()
  const exported = await exportPromise
  expect(JSON.parse(readFileSync((await exported.path())!, 'utf8'))).toEqual(await stored(page))
  const originalPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '업데이트 전 원본 내려받기' }).click()
  expect(readFileSync((await (await originalPromise).path())!, 'utf8')).toBe(raw)
})

test('failed restore shows failure and keeps persisted progress and download available', async ({ page }) => {
  await seed(page, 'arrange')
  const before = await stored(page)
  await page.getByRole('link', { name: '설정과 백업', exact: true }).click()
  const restored = { ...before, active: { ...before.active!, step: 'speak' } }
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(restored)) })
  await page.evaluate(() => { Object.defineProperty(window, 'myEnOriginalSetItem', { value: Storage.prototype.setItem, configurable: true }); Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError') } })
  await page.getByRole('button', { name: '이 백업으로 복원' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '복원 내용을 저장하지 못했습니다' })).toBeVisible()
  await expect(page.getByText('백업을 복원하고 저장했습니다.', { exact: false })).toHaveCount(0)
  expect(await stored(page)).toEqual(before)
  await page.getByRole('button', { name: '이 백업으로 복원' }).click()
  await expect(page.getByText('백업을 복원하고 저장했습니다.', { exact: false })).toHaveCount(0)
  expect(await stored(page)).toEqual(before)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '백업 내려받기', exact: true }).click()
  const exported = await download
  expect(exported.suggestedFilename()).toMatch(/my-en-backup/)
  expect(JSON.parse(readFileSync((await exported.path())!, 'utf8'))).toEqual(restored)
  await page.evaluate(() => { Storage.prototype.setItem = window.myEnOriginalSetItem })
  await page.getByRole('button', { name: '이 백업으로 복원' }).click()
  await expect(page.getByText('백업을 복원하고 저장했습니다.', { exact: false })).toBeVisible()
  expect(await stored(page)).toEqual(restored)
})

test('due speaking review offers only that step and preserves later reservations', async ({ page }) => {
  const state = emptyState('UTC'), today = new Date().toISOString().slice(0, 10)
  const common = { phraseId: 'hello', phraseVersion: 1 as const, stage: 0, due: today, lastAt: '2026-01-01T12:00:00Z', lastSessionId: 'old', successes: 0, practices: 1, lastOutcome: 'practice' as const, lastAdvancedDay: null }
  state.reviews['hello:speaking'] = { ...common, skill: 'speaking', evidence: 'selfReported' }
  state.reviews['hello:recall'] = { ...common, due: '2099-01-01', skill: 'recall', evidence: 'selfReported' }
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)) }, { key, state })
  await page.goto('/')
  await page.getByRole('button', { name: '복습 시작', exact: true }).click()
  await page.getByRole('button', { name: '남은 단어는 다음에, 문장으로 가기' }).click()
  await expect(page.getByRole('heading', { name: '보고, 한 번 따라 말해요.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '먼저, 소리를 들어 보세요.' })).toHaveCount(0)
  await page.getByRole('button', { name: '따라 말했어요' }).click()
  await expect(page.getByRole('heading', { name: '오늘의 한 걸음을 남겼어요.' })).toBeVisible()
  expect((await stored(page)).reviews['hello:recall'].due).toBe('2099-01-01')
})
