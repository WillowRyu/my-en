import { describe, expect, it } from 'vitest'
import { matchesWord, phraseById, wordById, words, phraseWordIds } from './content'
import { answer, answerWord, completedLessons, duePhrases, dueWords, emptyState, patchSession, patchWordStudy, plan, regularCompletedToday, skipWordStudy, startSession, stepsForPhrase, type State } from './model'
import { BACKUP_KEY, MIGRATION_KEY, STORAGE_KEY, load, parseState, save } from './storage'

const now = new Date('2026-10-04T12:00:00Z')
const nextDay = new Date('2026-10-05T12:00:00Z')
function finishWords(s: State, at = now): State {
  while (s.active?.wordStudy) {
    const w = s.active.wordStudy
    if (w.step === 'learn') { s = patchWordStudy(s, { heard: true }); s = answerWord(s, 'heard', at) }
    else if (w.step === 'meaning') s = answerWord(s, 'correct', at)
    else { s = patchWordStudy(s, { input: wordById[w.wordIds[w.wordIndex]].en }); s = answerWord(s, 'correct', at) }
  }
  return s
}
function finish(s: State, at = now): State {
  s = skipWordStudy(s, at)
  while (s.active) {
    const step = s.active.step
    if (step === 'listen') { s = patchSession(s, { heard: true }); s = answer(s, 'heard', at) }
    else s = answer(s, step === 'speak' ? 'self' : step === 'recall' ? 'remembered' : 'correct', at)
  }
  return s
}
function legacy(s: State) {
  return { schemaVersion: 1,
    settings: { timeZone: s.settings.timeZone, intervals: s.settings.intervals },
    active: s.active ? Object.fromEntries(Object.entries(s.active).filter(([key]) => !['wordStudy', 'reviewSkills'].includes(key))) : null,
    attempts: s.attempts, completions: s.completions,
    reviews: Object.fromEntries(Object.entries(s.reviews).filter(([, r]) => r.skill !== 'reading').map(([key, r]) =>
      [key, Object.fromEntries(Object.entries(r).filter(([field]) => !['lastOutcome', 'lastAdvancedDay'].includes(field)))])),
  }
}
function db() {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}
describe('regular lessons and targeted reviews', () => {
  it('allows a regular lesson after five-minute completion on the same day', () => {
    const s = finish(startSession(emptyState('UTC'), 'quick', now, 'quick'))
    expect(completedLessons(s).size).toBe(0); expect(regularCompletedToday(s, now)).toBe(false)
    expect(plan(s, 'normal', now).lessonId).toBe('day-1')
  })
  it('allows the next regular lesson after a separate morning review', () => {
    let s = finish(startSession(emptyState('UTC'), 'normal', now, 'first'))
    s = finish(startSession(s, 'normal', nextDay, 'review', true), nextDay)
    expect(regularCompletedToday(s, nextDay)).toBe(false)
    expect(plan(s, 'normal', nextDay).lessonId).toBe('day-2')
  })
  it('keeps intervals and dates on same-day repetition', () => {
    let s = finish(startSession(emptyState('UTC'), 'normal', now, 'first'))
    for (let i = 0; i < 4; i++) s = finish(startSession(s, 'normal', now, `repeat-${i}`))
    expect(s.reviews['hello:listening']).toMatchObject({ stage: 0, due: '2026-10-05', successes: 5 })
    expect(s.reviews['hello:recall'].stage).toBe(0)
  })
  it('extends only once at a due review; early practice preserves the reservation', () => {
    let s = finish(startSession(emptyState('UTC'), 'normal', now, 'first'))
    s = finish(startSession(s, 'normal', nextDay, 'due', true), nextDay)
    const first = s.reviews['hello:listening']
    expect(first).toMatchObject({ stage: 1, due: '2026-10-08' })
    s = finish(startSession({ ...s, reviews: { 'hello:listening': first } }, 'quick', new Date('2026-10-06T12:00:00Z'), 'early'))
    expect(s.reviews['hello:listening']).toMatchObject({ stage: 1, due: '2026-10-08' })
  })
  it('speaking-only review does not replay or reschedule other skills', () => {
    let s = finish(startSession(emptyState('UTC'), 'normal', now, 'first'))
    s = { ...s, reviews: Object.fromEntries(Object.entries(s.reviews).filter(([, r]) => r.phraseId === 'hello').map(([key, r]) => [key, { ...r, due: r.skill === 'speaking' ? '2026-10-05' : '2026-10-10' }])) }
    const before = s.reviews['hello:recall']
    s = skipWordStudy(startSession(s, 'normal', nextDay, 'speaking', true), nextDay)
    expect(stepsForPhrase(s.active!)).toEqual(['speak'])
    s = answer(s, 'self', nextDay)
    expect(s.active).toBeNull(); expect(s.reviews['hello:recall']).toEqual(before)
    expect(s.reviews['hello:speaking'].due).toBe('2026-10-06')
  })
  it('schedules word-order errors without lowering listening evidence', () => {
    let s = skipWordStudy(startSession(emptyState('UTC'), 'normal', now, 'first'), now)
    s = patchSession(s, { heard: true }); s = answer(s, 'heard', now); s = answer(s, 'correct', now)
    s = answer(s, 'incorrect', now); s = answer(s, 'correct', now); s = answer(s, 'skipped', now); s = answer(s, 'skipped', now)
    expect(s.reviews['hello:reading']).toMatchObject({ lastOutcome: 'difficulty', successes: 0, due: '2026-10-05' })
    expect(s.reviews['hello:listening'].successes).toBe(1)
  })
  it('technical skips leave an existing due listening review untouched', () => {
    let s = finish(startSession(emptyState('UTC'), 'normal', now, 'first'))
    s = { ...s, reviews: { 'hello:listening': s.reviews['hello:listening'] } }
    const before = s.reviews['hello:listening']
    s = skipWordStudy(startSession(s, 'normal', nextDay, 'skip', true), nextDay)
    s = answer(s, 'skipped', nextDay); s = answer(s, 'correct', nextDay)
    expect(s.active).toBeNull(); expect(s.reviews['hello:listening']).toEqual(before)
  })
  it('a difficult due review restarts the first interval instead of staying overdue', () => {
    let s = finish(startSession(emptyState('UTC'), 'normal', now, 'first'))
    s = { ...s, reviews: { 'hello:recall': s.reviews['hello:recall'] } }
    s = skipWordStudy(startSession(s, 'normal', nextDay, 'difficult', true), nextDay)
    s = answer(s, 'unsure', nextDay)
    expect(s.reviews['hello:recall']).toMatchObject({ stage: 0, due: '2026-10-06', lastOutcome: 'difficulty' })
    expect(duePhrases(s, nextDay)).toEqual([])
  })
})
describe('small words connected to phrases', () => {
  it('introduces a configurable small set with compatible local audio and examples', () => {
    const s = startSession(emptyState('UTC'), 'normal', now, 'words')
    expect(s.active?.wordStudy?.wordIds).toEqual(['hello', 'again'])
    const smaller = emptyState('UTC'); smaller.settings.newWordsPerDay = 1
    expect(startSession(smaller, 'normal', now, 'small').active?.wordStudy?.wordIds).toHaveLength(1)
    for (const word of words) {
      expect(new Set(word.choices).size).toBe(3); expect(phraseById[word.examplePhraseId]).toBeDefined()
      expect(word.audio).toBe(`/audio/word-${word.id}.wav`)
    }
    for (const ids of Object.values(phraseWordIds)) for (const id of ids) expect(wordById[id]).toBeDefined()
  })
  it('records both directions then continues the original phrase lesson', () => {
    const s = finishWords(startSession(emptyState('UTC'), 'normal', now, 'words'))
    expect(s.active).toMatchObject({ step: 'listen', wordStudy: null, lessonId: 'day-1' })
    expect(s.wordReviews['hello:meaning']).toMatchObject({ successes: 1, due: '2026-10-05' })
    expect(s.wordReviews['hello:production']).toMatchObject({ successes: 1, due: '2026-10-05' })
    expect(s.completions).toHaveLength(0)
  })
  it('caps new words across multiple sessions in one local day without capping reviews', () => {
    let s = finishWords(startSession(emptyState('UTC'), 'normal', now, 'first-words'))
    s = { ...s, active: null }
    const repeated = startSession(s, 'quick', now, 'again')
    expect(repeated.active?.wordStudy).toBeNull()
    s = { ...s, completions: [{ sessionId: 'lesson', lessonId: 'day-1', lessonVersion: 1, mode: 'normal', at: now.toISOString(), day: '2026-10-03', timeZone: 'UTC', phraseIds: ['hello', 'name', 'again'] }] }
    expect(startSession(s, 'normal', now, 'next-lesson').active?.wordStudy).toBeNull()
    expect(startSession(s, 'normal', nextDay, 'tomorrow').active?.wordStudy).not.toBeNull()
  })
  it('offers an unfinished reverse direction after leaving a word partway through', () => {
    let s = startSession(emptyState('UTC'), 'quick', now, 'partial')
    s = answerWord(s, 'skipped', now); s = answerWord(s, 'correct', now)
    s = { ...skipWordStudy(s, now), active: null }
    const resumed = startSession(s, 'quick', now, 'continue')
    expect(resumed.active?.wordStudy).toMatchObject({ step: 'produce', wordIds: ['hello'] })
  })
  it('persists the word, direction, input and hint across reload', () => {
    let s = startSession(emptyState('UTC'), 'quick', now, 'words')
    s = answerWord(s, 'skipped', now); s = answerWord(s, 'correct', now)
    s = patchWordStudy(s, { input: 'hel', hints: 1 })
    expect(parseState(JSON.stringify(s)).active?.wordStudy).toMatchObject({ step: 'produce', input: 'hel', hints: 1 })
    expect(answer(s, 'heard', now)).toBe(s)
  })
  it('does not accept an incorrect reverse-recall answer as correct', () => {
    let s = startSession(emptyState('UTC'), 'quick', now, 'words')
    s = answerWord(s, 'skipped', now); s = answerWord(s, 'correct', now); s = patchWordStudy(s, { input: 'wrong' })
    expect(answerWord(s, 'correct', now)).toBe(s)
    expect(matchesWord('  HELLO. ', wordById.hello)).toBe(true)
    expect(matchesWord('hell', wordById.hello)).toBe(false)
  })
  it('wrong answers and hints schedule relearning in the affected direction', () => {
    let s = startSession(emptyState('UTC'), 'quick', now, 'words')
    s = answerWord(s, 'skipped', now); s = answerWord(s, 'incorrect', now); s = answerWord(s, 'correct', now)
    s = patchWordStudy(s, { hints: 1, revealed: true, input: 'hello' }); s = answerWord(s, 'correct', now)
    expect(s.wordReviews['hello:meaning'].lastOutcome).toBe('difficulty')
    expect(s.wordReviews['hello:production']).toMatchObject({ successes: 0, stage: 0 })
  })
  it('reviews reverse recall before showing English, without repeating the other direction', () => {
    let s = finishWords(startSession(emptyState('UTC'), 'quick', now, 'words'))
    s = { ...s, active: null, wordReviews: Object.fromEntries(Object.entries(s.wordReviews).map(([key, r]) => [key, { ...r, due: r.skill === 'production' ? '2026-10-05' : '2026-10-10' }])) }
    const before = s.wordReviews['hello:meaning']
    s = startSession(s, 'normal', nextDay, 'review-words', true)
    expect(s.active?.wordStudy).toMatchObject({ step: 'produce', revealed: false })
    s = patchWordStudy(s, { input: 'hello' }); s = answerWord(s, 'correct', nextDay)
    expect(s.wordReviews['hello:meaning']).toEqual(before)
    expect(s.wordReviews['hello:production']).toMatchObject({ stage: 1, due: '2026-10-08' })
  })
  it('does not extend word intervals during same-day repeated practice', () => {
    let s = finishWords(startSession(emptyState('UTC'), 'quick', now, 'words'))
    s = { ...s, active: null, wordReviews: { ...s.wordReviews, 'hello:production': { ...s.wordReviews['hello:production'], due: '2026-10-04' } } }
    s = finishWords(startSession(s, 'normal', now, 'same-day', true))
    expect(s.wordReviews['hello:production'].stage).toBe(0)
    expect(dueWords(s, nextDay)).toContain('hello')
  })
})
describe('lossless compatible records and honest save results', () => {
  it('migrates every old active step without inserting words or changing progress', () => {
    for (const step of ['listen', 'meaning', 'arrange', 'speak', 'recall'] as const) {
      let s = skipWordStudy(startSession(emptyState('UTC'), 'normal', now, 'legacy'), now)
      s = { ...s, active: { ...s.active!, step, hints: 2, selectedTokens: [0] } }
      const old = legacy(s), migrated = parseState(JSON.stringify(old))
      expect(migrated.schemaVersion).toBe(3); expect(migrated.active?.wordStudy).toBeNull()
      expect({ ...migrated.active, wordStudy: undefined, reviewSkills: undefined }).toEqual({ ...old.active, wordStudy: undefined, reviewSkills: undefined })
      expect(migrated.wordAttempts).toEqual([])
    }
  })
  it('preserves old attempts, completions, settings and review counters/dates', () => {
    const old = legacy(finish(startSession(emptyState('Asia/Seoul'), 'normal', now, 'legacy')))
    const migrated = parseState(JSON.stringify(old))
    expect(migrated.attempts).toEqual(old.attempts); expect(migrated.completions).toEqual(old.completions)
    expect(migrated.settings.timeZone).toBe(old.settings.timeZone)
    for (const [key, r] of Object.entries(old.reviews)) expect(migrated.reviews[key]).toMatchObject(r)
    expect(parseState(JSON.stringify(migrated))).toEqual(migrated)
  })
  it('does not write on load and keeps exact v1 bytes as the first recovery backup', () => {
    const storage = db(), raw = JSON.stringify(legacy(finish(startSession(emptyState('UTC'), 'normal', now, 'old'))))
    storage.setItem(STORAGE_KEY, raw)
    const loaded = load(storage)
    expect(loaded.blocked).toBe(false); expect(storage.getItem(STORAGE_KEY)).toBe(raw)
    expect(save(storage, loaded.state).saved).toBe(true)
    expect(storage.getItem(BACKUP_KEY)).toBe(raw)
    save(storage, { ...loaded.state, settings: { ...loaded.state.settings, newWordsPerDay: 3 } })
    expect(storage.getItem(MIGRATION_KEY)).toBe(raw)
    expect(parseState(storage.getItem(BACKUP_KEY)!)).toEqual(loaded.state)
  })
  it('aborts migration saving when preserving the old original fails', () => {
    const storage = db(), raw = JSON.stringify(legacy(emptyState('UTC')))
    storage.setItem(STORAGE_KEY, raw)
    const failing = { ...storage, setItem: (key: string, value: string) => { if (key === MIGRATION_KEY) throw new Error('quota'); storage.setItem(key, value) } }
    expect(save(failing, load(storage).state)).toMatchObject({ saved: false, backupSaved: false })
    expect(storage.getItem(STORAGE_KEY)).toBe(raw)
  })
  it('preserves incompatible originals and recovery backups on unsuccessful writes', () => {
    const storage = db(); storage.setItem(STORAGE_KEY, '{broken'); storage.setItem(BACKUP_KEY, 'last valid bytes')
    const failing = { ...storage, setItem: () => { throw new Error('quota') } }
    expect(save(failing, emptyState(), true).saved).toBe(false)
    expect(storage.getItem(STORAGE_KEY)).toBe('{broken'); expect(storage.getItem(BACKUP_KEY)).toBe('last valid bytes')
  })
  it('reports a backup-only failure even when the progress save succeeds', () => {
    const storage = db(); storage.setItem(STORAGE_KEY, JSON.stringify(emptyState()))
    const failing = { ...storage, setItem: (key: string, value: string) => { if (key === BACKUP_KEY) throw new Error('quota'); storage.setItem(key, value) } }
    expect(save(failing, emptyState())).toMatchObject({ saved: true, backupSaved: false })
    expect(save(failing, emptyState()).warning).toContain('직전 저장본')
  })
})
