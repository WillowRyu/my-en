import { describe, expect, it } from 'vitest'
import { courseById, courseLessons, diagnosticQuestions } from './curriculum'
import { advanceCourse, assessCourseInput, currentCourseExercise, diagnosticSuggestion, dueCourseKeys, emptyCourse, patchCourseInput, revealCourse, saveDiagnostic, setCoursePath, startCourse, submitCourse, toggleCourseSkip } from './course'
import { emptyState, patchWordStudy, regularCompletedToday, startSession, type State } from './model'
import { BACKUP_KEY, STORAGE_KEY, V2_MIGRATION_KEY, load, parseState, save } from './storage'
const now = new Date('2026-10-11T10:00:00Z')
const due = new Date('2026-10-14T10:00:00Z')
function roundtrip(s: State) { return parseState(JSON.stringify(s)) }
function finish(s: State, at = now): State {
  for (let i = 0; i < 20 && s.course.active; i++) {
    const a = s.course.active
    if (a.step === 'explain') s = advanceCourse(s, 'ready', at)
    else if (a.step === 'dialogue') { s = submitCourse(s, courseById[a.lessonId!].checks[a.index].answer); s = advanceCourse(s, 'ready', at) }
    else { s = patchCourseInput(s, currentCourseExercise(a)!.samples[0]); s = submitCourse(s); s = advanceCourse(s, 'ready', at) }
    s = roundtrip(s)
  }
  expect(s.course.active).toBeNull()
  return s
}
function v2(s: State) { const { course: _course, ...rest } = s; void _course; return { ...rest, schemaVersion: 2 } }
function db() {
  const values = new Map<string, string>()
  return { values, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) }, removeItem: (k: string) => { values.delete(k) } }
}
describe('authored practical curriculum', () => {
  it('has complete longer situations and actionable explanation/feedback rather than greetings only', () => {
    expect(courseLessons.filter(l => l.level === 'practical')).toHaveLength(6)
    expect(courseLessons.filter(l => l.level === 'stretch')).toHaveLength(7)
    expect(new Set(courseLessons.map(l => l.id)).size).toBe(13)
    for (const l of courseLessons) {
      expect(l.dialogue).toHaveLength(8); expect(l.rules).toHaveLength(2); expect(l.examples).toHaveLength(3)
      expect(l.transforms).toHaveLength(3); expect(l.responses).toHaveLength(2); expect(l.recalls).toHaveLength(2)
      expect(l.checks).toHaveLength(2)
      for (const q of l.checks) { expect(new Set(q.choices).size).toBe(q.choices.length); expect(q.choices[q.answer]).toBeTruthy(); expect(q.why).toMatch(/[가-힣]/) }
      for (const task of [...l.transforms, ...l.responses, ...l.recalls]) { expect(task.why).toMatch(/[가-힣]/); expect(task.samples.length).toBeGreaterThan(0); expect(task.instruction).toBeTruthy() }
    }
  })
  it('allows all authored controlled answers and supported contractions/punctuation', () => {
    for (const l of courseLessons) for (const ex of [...l.transforms, ...l.recalls]) for (const sample of ex.samples) {
      expect(assessCourseInput(sample.toUpperCase() + '!', ex).kind).toBe('matched')
    }
    expect(assessCourseInput('I am going to study this evening!', courseById['future-plan'].transforms[0]).kind).toBe('matched')
  })
  it('never rejects natural alternative free writing just for differing from a sample', () => {
    const ex = courseById['past-weekend'].responses[0]
    for (const input of ['I spent Saturday reading and Sunday hiking.', ex.samples[0], 'I did not went yesterday.']) {
      expect(assessCourseInput(input, ex, true).kind).toBe('compare')
    }
    expect(assessCourseInput('I remained indoors on Sunday.', courseById['past-weekend'].transforms[1]).kind).toBe('compare')
    expect(assessCourseInput("I didn't went out on Sunday.", courseById['past-weekend'].transforms[1])).toMatchObject({ kind: 'commonIssue' })
  })
  it('makes only a limited starting suggestion and permits overriding it', () => {
    const answers = diagnosticQuestions.map(q => q.answer)
    expect(diagnosticSuggestion(answers)).toEqual({ score: 6, path: 'stretch' })
    expect(diagnosticSuggestion(Array(6).fill(-1))).toEqual({ score: 0, path: 'foundation' })
    const s = saveDiagnostic(emptyState('UTC'), answers, now)
    expect(s.course.path).toBe('practical')
    expect(setCoursePath(s, 'foundation').course.diagnostic?.answers).toEqual(answers)
    expect(saveDiagnostic(s, [0], now)).toBe(s)
  })
})
describe('explanation, dialogue, variation, own answer and delayed recall', () => {
  it('preserves position and draft after every stage and finishes all 13 lessons without inventing recall mastery', () => {
    let s = emptyState('UTC')
    for (const [i, l] of courseLessons.entries()) {
      s = finish(startCourse(s, now, `course-${i}`, false, l.id))
      expect(s.course.reviews[`${l.id}:0`]).toMatchObject({ due: '2026-10-14', successes: 0, lastOutcome: 'unconfirmed' })
    }
    expect(s.course.completions).toHaveLength(13); expect(s.course.attempts).toHaveLength(13 * 7)
    expect(s.wordAttempts).toEqual([]); expect(s.completions).toEqual([]); expect(regularCompletedToday(s, now)).toBe(false)
    expect(dueCourseKeys(s, now)).toEqual([]); expect(dueCourseKeys(s, due)).toHaveLength(26)
  })
  it('keeps skipped lessons separate from completion and lets them be restored', () => {
    let s = toggleCourseSkip(emptyState('UTC'), 'past-weekend')
    expect(startCourse(s, now, 'next').course.active?.lessonId).toBe('future-plan')
    expect(s.course.completions).toEqual([]); expect(s.course.reviews).toEqual({})
    s = toggleCourseSkip(s, 'past-weekend'); expect(startCourse(s, now, 'first').course.active?.lessonId).toBe('past-weekend')
    const active = startCourse(s, now, 'keep'); expect(toggleCourseSkip(active, 'past-weekend')).toBe(active)
  })
  it('requires an input and a feedback comparison before non-skip progression', () => {
    let s = startCourse(emptyState('UTC'), now, 'input')
    s = advanceCourse(s, 'ready', now); s = advanceCourse(s, 'skip', now); s = advanceCourse(s, 'skip', now)
    expect(s.course.active?.step).toBe('transform')
    expect(submitCourse(s)).toBe(s); expect(advanceCourse(s, 'ready', now)).toBe(s)
    s = patchCourseInput(s, 'I visited a friend last weekend.')
    expect(roundtrip(s).course.active?.input).toBe('I visited a friend last weekend.')
    s = submitCourse(s); expect(s.course.active?.feedback).toBe('matched')
    s = advanceCourse(s, 'ready', now)
    expect(s.course.attempts.at(-1)?.result).toBe('matched')
    const active = startCourse(emptyState('UTC'), now, 'unfinished')
    expect(startCourse(active, now, 'replace', false, 'future-plan')).toBe(active)
  })
  it('records freely written answers as self confirmation, never automated grammar correctness', () => {
    let s = startCourse(emptyState('UTC'), now, 'free')
    while (s.course.active!.step !== 'respond') s = advanceCourse(s, 'skip', now)
    s = patchCourseInput(s, 'I spent Saturday reading. Then I walked with a neighbour.')
    s = submitCourse(s); expect(s.course.active?.feedback).toBe('compare')
    s = advanceCourse(s, 'ready', now)
    expect(s.course.attempts.at(-1)).toMatchObject({ result: 'selfConfirmed', hints: 0 })
  })
  it('starts due recall without showing English and caps the session at two targets', () => {
    const s = finish(startCourse(emptyState('UTC'), now, 'first'))
    const review = startCourse(s, due, 'review', true)
    expect(review.course.active).toMatchObject({ kind: 'review', lessonId: null, step: 'review', revealed: false, input: '', reviewKeys: ['past-weekend:0', 'past-weekend:1'] })
    const done = finish(review, due)
    expect(done.course.lastFinishedKind).toBe('review')
    expect(done.course.completions).toHaveLength(1)
    expect(done.course.reviews['past-weekend:0']).toMatchObject({ due: '2026-10-21', successes: 1, stage: 2 })
  })
  it('does not push a due date away by repeating the lesson on the same day', () => {
    let s = finish(startCourse(emptyState('UTC'), now, 'first'))
    const before = s.course.reviews['past-weekend:0']
    s = finish(startCourse(s, now, 'again', false, 'past-weekend'))
    expect(s.course.reviews['past-weekend:0']).toEqual(before)
  })
  it('restarts difficult or hinted recall, while a skip leaves the due target unchanged', () => {
    const s = finish(startCourse(emptyState('UTC'), now, 'first'))
    let review = startCourse(s, due, 'hinted', true)
    const a = review.course.active!
    review = patchCourseInput(review, currentCourseExercise(a)!.samples[0]); review = revealCourse(review); review = submitCourse(review)
    review = advanceCourse(review, 'ready', due)
    expect(review.course.reviews['past-weekend:0']).toMatchObject({ due: '2026-10-15', stage: 0, successes: 0, lastOutcome: 'needsPractice' })
    const untouched = s.course.reviews['past-weekend:1']
    review = advanceCourse(review, 'skip', due); expect(review.course.reviews['past-weekend:1']).toEqual(untouched)
  })
  it('marks revisions after feedback as assisted rather than unhinted recall', () => {
    let s = startCourse(finish(startCourse(emptyState('UTC'), now, 'first')), due, 'review', true)
    s = patchCourseInput(s, 'another wording'); s = submitCourse(s)
    s = patchCourseInput(s, currentCourseExercise(s.course.active!)!.samples[0]); s = submitCourse(s)
    s = advanceCourse(s, 'ready', due)
    expect(s.course.attempts.at(-1)?.hints).toBe(1)
    expect(s.course.reviews['past-weekend:0']?.successes).toBe(0)
  })
  it('keeps an independently paused original word session intact during advanced study', () => {
    let s = startSession(emptyState('UTC'), 'normal', now, 'words')
    s = patchWordStudy(s, { input: 'hel', hints: 1 })
    const original = s.active
    s = finish(startCourse(setCoursePath(s, 'stretch'), now, 'advanced'))
    expect(s.active).toEqual(original); expect(s.settings.newWordsPerDay).toBe(2)
    expect(roundtrip(s).active).toEqual(original)
  })
})
describe('v2 preservation and v3 protection', () => {
  it('migrates the exact v2 draft, word state, settings and old records without a write on load', () => {
    let s = startSession(emptyState('Asia/Seoul'), 'normal', now, 'old-word')
    s.settings.newWordsPerDay = 3; s.settings.intervals = [2, 5, 10, 20]
    s = patchWordStudy(s, { input: 'hel', hints: 2, revealed: true })
    const old = v2(s), raw = JSON.stringify(old, null, 2), storage = db()
    storage.values.set(STORAGE_KEY, raw)
    const next = load(storage).state
    expect(v2(next)).toEqual(old); expect(next.schemaVersion).toBe(3); expect(next.course).toEqual(emptyCourse())
    expect(storage.values.size).toBe(1); expect(storage.getItem(STORAGE_KEY)).toBe(raw)
    expect(save(storage, next).saved).toBe(true)
    expect(storage.getItem(V2_MIGRATION_KEY)).toBe(raw); expect(storage.getItem(BACKUP_KEY)).toBe(raw)
    save(storage, setCoursePath(next, 'stretch')); expect(storage.getItem(V2_MIGRATION_KEY)).toBe(raw)
  })
  it('aborts a v3 save if the exact old v2 original cannot be archived', () => {
    const old = JSON.stringify(v2(emptyState('UTC'))), storage = db()
    storage.values.set(STORAGE_KEY, old)
    const wrapped = { ...storage, setItem: (k: string, v: string) => { if (k === V2_MIGRATION_KEY) throw new Error('quota'); storage.setItem(k, v) } }
    expect(save(wrapped, parseState(old)).saved).toBe(false); expect(storage.getItem(STORAGE_KEY)).toBe(old)
  })
  it('rejects incompatible course versions, impossible steps and duplicate records without overwriting', () => {
    const s = startCourse(emptyState('UTC'), now, 'bad')
    for (const active of [{ ...s.course.active!, index: 99 }, { ...s.course.active!, version: 2 }, { ...s.course.active!, lessonId: 'unknown' }]) {
      const raw = JSON.stringify({ ...s, course: { ...s.course, active } }), storage = db(); storage.values.set(STORAGE_KEY, raw)
      expect(load(storage).blocked).toBe(true); expect(storage.getItem(STORAGE_KEY)).toBe(raw)
    }
    const done = finish(s); done.course.completions.push(done.course.completions[0]); expect(() => roundtrip(done)).toThrow()
    const date = emptyState('UTC'); date.course.reviews['past-weekend:0'] = { due: '2026-02-30', stage: 0, lastAt: now.toISOString(), lastAdvancedDay: null, successes: 0, practices: 0, lastOutcome: 'unconfirmed' }; expect(() => roundtrip(date)).toThrow()
  })
})
