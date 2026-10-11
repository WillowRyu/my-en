import { describe, expect, it } from 'vitest'
import { lessons, phrases, shuffledIndices } from './content'
import { addDays, answer, completedLessons, dayKey, duePhrases, emptyState, patchSession, plan, skipWordStudy, startSession, type State } from './model'
import { BACKUP_KEY, STORAGE_KEY, load, parseState, save } from './storage'

const now = new Date('2026-10-04T12:00:00Z')
const begin = (s = emptyState('UTC'), mode: 'normal' | 'quick' = 'normal') => skipWordStudy(startSession(s, mode, now, 'session-1'), now)
function phraseRound(s: State, opts: { noSound?: boolean; noSpeak?: boolean; hint?: boolean; incorrect?: boolean; unsure?: boolean } = {}, at = now): State {
  s = patchSession(s, { heard: true })
  s = answer(s, opts.noSound ? 'skipped' : 'heard', at)
  if (opts.incorrect) s = answer(s, 'incorrect', at)
  s = answer(s, 'correct', at); s = answer(s, 'correct', at)
  s = answer(s, opts.noSpeak ? 'skipped' : 'self', at)
  if (opts.hint) s = patchSession(s, { hints: 1, revealed: true })
  return answer(s, opts.unsure ? 'unsure' : 'remembered', at)
}
const finish = (s: State) => { while (s.active) s = phraseRound(s); return s }
describe('review evidence and progression', () => {
  it('cannot advance listening until audio ends; a technical skip is separate', () => {
    let s = begin(); expect(answer(s, 'heard', now)).toBe(s)
    s = phraseRound(s, { noSound: true, noSpeak: true })
    expect(s.reviews['hello:listening']).toBeUndefined(); expect(s.reviews['hello:speaking']).toBeUndefined()
    expect(s.reviews['hello:recall'].successes).toBe(1)
    expect(s.attempts.find(t => t.step === 'listen')?.outcome).toBe('skipped')
  })
  it('wrong recognition does not claim successful listening or speaking mastery', () => {
    const s = phraseRound(begin(), { incorrect: true })
    expect(s.reviews['hello:listening'].successes).toBe(0)
    expect(s.reviews['hello:speaking']).toMatchObject({ successes: 0, evidence: 'selfReported', due: '2026-10-05' })
    expect(s.reviews['hello:recall']).toMatchObject({ successes: 1, evidence: 'selfReported' })
  })
  it('a revealed recall is not unprompted recall, including after reload', () => {
    let s = begin(); s = patchSession(s, { heard: true }); s = answer(s, 'heard', now); s = answer(s, 'correct', now); s = answer(s, 'correct', now); s = answer(s, 'skipped', now)
    s = patchSession(s, { hints: 1, revealed: true }); s = parseState(JSON.stringify(s)); s = answer(s, 'remembered', now)
    expect(s.reviews['hello:recall'].successes).toBe(0)
    expect(s.attempts.at(-1)?.hints).toBe(1)
  })
  it('completion is idempotent and full lessons are versioned', () => {
    const s = finish(begin())
    expect(s.completions).toHaveLength(1); expect(completedLessons(s).has('day-1@1')).toBe(true)
    expect(answer(s, 'remembered', now)).toBe(s)
    expect(s.attempts.every(a => a.lessonVersion === 1 && a.phraseVersion === 1)).toBe(true)
  })
  it('five-minute mode limits to two expressions and does not consume the regular lesson', () => {
    const s = begin(emptyState('UTC'), 'quick')
    expect(s.active?.phraseIds).toHaveLength(2)
    const done = finish(s)
    expect(completedLessons(done).size).toBe(0)
    expect(done.completions[0].mode).toBe('quick')
  })
  it('resumes without replacing the session and preserves selected token order', () => {
    let s = begin(); s = patchSession(s, { heard: true }); s = answer(s, 'heard', now); s = answer(s, 'correct', now)
    s = patchSession(s, { selectedTokens: [0] })
    const loaded = parseState(JSON.stringify(s))
    expect(startSession(loaded, 'quick', new Date('2026-10-05'), 'another')).toBe(loaded)
    expect(loaded.active?.selectedTokens).toEqual([0])
  })
  it('caps absence reviews and carries on with the next small lesson', () => {
    const s = finish(begin()), later = new Date('2026-12-01T12:00:00Z')
    const p = plan(s, 'normal', later)
    expect(p.lessonId).toBe('day-2'); expect(p.phraseIds.length).toBeLessThanOrEqual(5)
    expect(plan(s, 'quick', later).phraseIds).toHaveLength(2)
    expect(duePhrases(s, later)).toHaveLength(3)
  })
  it('uses configurable intervals and advances each skill separately', () => {
    let s = finish(begin()); s.settings.intervals = [2, 4, 8, 16]
    s = skipWordStudy(startSession(s, 'quick', new Date('2026-10-06T12:00:00Z'), 'session-2', true), new Date('2026-10-06T12:00:00Z'))
    s = phraseRound(s, { hint: true }, new Date('2026-10-06T12:00:00Z'))
    expect(s.reviews['hello:listening']).toMatchObject({ stage: 1, due: '2026-10-10' })
    expect(s.reviews['hello:recall']).toMatchObject({ stage: 0, due: '2026-10-08' })
    expect(s.reviews['hello:speaking'].successes).toBe(0)
  })
  it('all seven days form a completable path using earlier expressions', () => {
    let s = emptyState('UTC')
    for (let i = 0; i < 7; i++) {
      const date = new Date(`2026-10-${String(i + 4).padStart(2, '0')}T12:00:00Z`)
      s = skipWordStudy(startSession(s, 'normal', date, `day-session-${i}`), date)
      while (s.active) { // Finish at the same local day as the session.
        s = patchSession(s, { heard: true }); s = answer(s, 'heard', date); s = answer(s, 'correct', date); s = answer(s, 'correct', date); s = answer(s, 'self', date); s = answer(s, 'remembered', date)
      }
    }
    expect(completedLessons(s).size).toBe(7); expect(Object.keys(s.reviews)).toHaveLength(60)
    expect(plan(s, 'normal', new Date('2026-10-20')).lessonId).toBeNull()
  })
})
describe('calendar safety', () => {
  it('respects time zones at midnight', () => {
    const d = new Date('2026-10-04T16:00:00Z')
    expect(dayKey(d, 'Asia/Seoul')).toBe('2026-10-05'); expect(dayKey(d, 'America/Los_Angeles')).toBe('2026-10-04')
  })
  it('calendar addition survives month/year boundaries and daylight-saving days', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01'); expect(addDays('2026-10-31', 3)).toBe('2026-11-03')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
  it('records the completion day when a session crosses midnight', () => {
    let s = begin()
    while (s.active && s.active.phraseIndex < 2) s = phraseRound(s)
    s = patchSession(s, { heard: true }); s = answer(s, 'heard', now); s = answer(s, 'correct', now); s = answer(s, 'correct', now); s = answer(s, 'self', now)
    s = answer(s, 'remembered', new Date('2026-10-05T00:01:00Z'))
    expect(s.completions[0].day).toBe('2026-10-05')
    expect(plan(s, 'normal', new Date('2026-10-05T12:00:00Z')).review).toBe(true)
  })
})
describe('data protection', () => {
  function storage() { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } } }
  it('export/import round trips all state and attempts', () => { const s = finish(begin()); expect(parseState(JSON.stringify(s))).toEqual(s) })
  it('blocks corrupt records from being overwritten on load', () => { const db = storage(); db.setItem(STORAGE_KEY, '{broken'); expect(load(db).blocked).toBe(true); expect(db.getItem(STORAGE_KEY)).toBe('{broken') })
  it('backs up the prior valid state and leaves that backup when recovering corrupt data', () => {
    const db = storage(); const first = begin(); save(db, first); save(db, phraseRound(first)); expect(parseState(db.getItem(BACKUP_KEY)!)).toEqual(first)
    db.setItem(STORAGE_KEY, 'broken'); save(db, emptyState('UTC'), true); expect(parseState(db.getItem(BACKUP_KEY)!)).toEqual(first)
  })
  it('reports storage quota or private-mode failures without treating them as learning errors', () => {
    const db = { getItem: () => null, setItem: () => { throw new Error('quota') }, removeItem: () => {} }
    expect(save(db, emptyState()).warning).toContain('백업')
  })
  it('rejects future versions, unknown content, impossible dates and duplicate completions', () => {
    expect(() => parseState(JSON.stringify({ ...emptyState(), schemaVersion: 99 }))).toThrow()
    const s = begin(); s.active!.phraseIds = ['does-not-exist']; expect(() => parseState(JSON.stringify(s))).toThrow()
    const done = finish(begin()); done.completions.push(done.completions[0]); expect(() => parseState(JSON.stringify(done))).toThrow()
    const date = begin(); date.active!.dateKey = '2026-02-30'; expect(() => parseState(JSON.stringify(date))).toThrow()
  })
  it('rejects unsafe order indices and invalid interval rules', () => {
    const s = begin(); s.active!.selectedTokens = [99]; expect(() => parseState(JSON.stringify(s))).toThrow()
    const t = emptyState(); t.settings.intervals = [1, 1, 0, 14]; expect(() => parseState(JSON.stringify(t))).toThrow()
  })
})
describe('content integrity', () => {
  it('has small authored lessons with unambiguous choices, assets and reuse', () => {
    expect(phrases).toHaveLength(15); expect(lessons).toHaveLength(7)
    const seen = new Set<string>()
    for (const lesson of lessons) { expect(lesson.newPhraseIds.length).toBeLessThanOrEqual(3); for (const id of lesson.reusePhraseIds) expect(seen.has(id)).toBe(true); lesson.newPhraseIds.forEach(id => seen.add(id)) }
    for (const p of phrases) { expect(new Set(p.choices).size).toBe(3); expect(p.choices[0]).toBe(p.ko); expect(p.tokens.join(' ')).toBe(p.en); expect(p.audio).toBe(`/audio/${p.id}.wav`) }
  })
  it('shuffles deterministically without losing tokens or always showing the answer first', () => {
    for (const p of phrases) { const shuffled = shuffledIndices(p.tokens.length, p.id); expect(new Set(shuffled).size).toBe(p.tokens.length); expect(shuffledIndices(p.tokens.length, p.id)).toEqual(shuffled) }
    expect(shuffledIndices(3, 'hello')).not.toEqual([0, 1, 2])
  })
})
