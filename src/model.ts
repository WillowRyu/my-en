import { z } from 'zod'
import { lessons, matchesWord, phraseWordIds, wordById, words } from './content'
import { legacyStateSchema } from './legacy'
import { courseSchema, emptyCourse } from './course'
import { dayKey, addDays } from './calendar'
export { dayKey, addDays } from './calendar'

export const skillNames = { listening: '듣고 이해함', reading: '문장을 맞춤', speaking: '보고 따라 말함', recall: '힌트 없이 떠올림' } as const
export type Skill = keyof typeof skillNames
export const steps = ['listen', 'meaning', 'arrange', 'speak', 'recall'] as const
export type Step = typeof steps[number]
export type Mode = 'normal' | 'quick'
export const wordSkillNames = { meaning: '영어 → 뜻', production: '뜻 → 영어' } as const
export type WordSkill = keyof typeof wordSkillNames
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s
})
const timeSchema = z.string().datetime()
const wordIdSchema = z.enum(words.map(w => w.id) as [string, ...string[]])
const skillSchema = z.enum(['listening', 'reading', 'speaking', 'recall'])
const wordSkillSchema = z.enum(['meaning', 'production'])
const reviewMeta = {
  stage: z.number().int().min(0).max(3), due: dateSchema, lastAt: timeSchema,
  lastSessionId: z.string().max(100), successes: z.number().int().min(0), practices: z.number().int().min(0),
  lastOutcome: z.enum(['success', 'difficulty', 'practice', 'unknown']),
  lastAdvancedDay: dateSchema.nullable(),
}
const wordStudySchema = z.object({
  wordIds: z.array(wordIdSchema).min(1).max(5), wordIndex: z.number().int().min(0),
  step: z.enum(['learn', 'meaning', 'produce']), heard: z.boolean(), hints: z.number().int().min(0).max(1000), revealed: z.boolean(),
  input: z.string().max(80), reviewDirections: z.record(z.string(), z.array(wordSkillSchema).min(1).max(2)),
}).refine(s => s.wordIndex < s.wordIds.length && new Set(s.wordIds).size === s.wordIds.length &&
  Object.entries(s.reviewDirections).every(([id, directions]) => s.wordIds.includes(id) && new Set(directions).size === directions.length) && wordSteps(s).includes(s.step))
const legacySession = legacyStateSchema.shape.active.unwrap()
const sessionSchema = z.object({
  ...legacySession.shape,
  wordStudy: wordStudySchema.nullable(),
  reviewSkills: z.record(z.string(), z.array(skillSchema).min(1).max(4)),
}).refine(s => legacySession.safeParse(s).success && Object.entries(s.reviewSkills).every(([id, skills]) =>
  s.phraseIds.includes(id) && new Set(skills).size === skills.length) && stepsForPhrase(s).includes(s.step), 'Invalid active lesson')
const reviewSchema = z.object({
  phraseId: legacyStateSchema.shape.active.unwrap().shape.phraseIds.element, phraseVersion: z.literal(1), skill: skillSchema,
  evidence: z.enum(['observed', 'selfReported']), ...reviewMeta,
})
const wordReviewSchema = z.object({ wordId: wordIdSchema, wordVersion: z.literal(1), skill: wordSkillSchema, ...reviewMeta })
const wordAttemptSchema = z.object({
  id: z.string().max(160), sessionId: z.string().max(100), wordId: wordIdSchema, wordVersion: z.literal(1),
  step: z.enum(['learn', 'meaning', 'produce']), outcome: z.enum(['heard', 'correct', 'incorrect', 'skipped']),
  hints: z.number().int().min(0).max(1000), at: timeSchema, newWord: z.boolean(),
})
export const v2StateSchema = z.object({
  ...legacyStateSchema.shape,
  schemaVersion: z.literal(2),
  settings: z.object({ ...legacyStateSchema.shape.settings.shape, newWordsPerDay: z.number().int().min(1).max(3) }),
  active: sessionSchema.nullable(),
  reviews: z.record(z.string(), reviewSchema).refine(r => Object.entries(r).every(([key, v]) => key === `${v.phraseId}:${v.skill}`)),
  wordReviews: z.record(z.string(), wordReviewSchema).refine(r => Object.entries(r).every(([key, v]) => key === `${v.wordId}:${v.skill}`)),
  wordAttempts: z.array(wordAttemptSchema).max(100000),
}).refine(s => new Set(s.attempts.map(a => a.id)).size === s.attempts.length &&
  new Set(s.wordAttempts.map(a => a.id)).size === s.wordAttempts.length &&
  new Set(s.completions.map(c => c.sessionId)).size === s.completions.length, 'Duplicate records')
export const stateSchema = z.object({ ...v2StateSchema.shape, schemaVersion: z.literal(3), course: courseSchema }).refine(s =>
  new Set(s.attempts.map(a => a.id)).size === s.attempts.length &&
  new Set(s.wordAttempts.map(a => a.id)).size === s.wordAttempts.length &&
  new Set(s.completions.map(c => c.sessionId)).size === s.completions.length, 'Duplicate records')
export type State = z.infer<typeof stateSchema>
export function migrateV2(raw: unknown): State {
  const old = v2StateSchema.parse(raw)
  return stateSchema.parse({ ...old, schemaVersion: 3, course: emptyCourse() })
}
export type Session = NonNullable<State['active']>
export type Attempt = State['attempts'][number]
export type Review = State['reviews'][string]
export type WordReview = State['wordReviews'][string]
export type WordStudy = NonNullable<Session['wordStudy']>
export type WordAttempt = State['wordAttempts'][number]

export function migrateLegacy(raw: unknown): State {
  const old = legacyStateSchema.parse(raw)
  return stateSchema.parse({ ...old, schemaVersion: 3, course: emptyCourse(), settings: { ...old.settings, newWordsPerDay: 2 },
    active: old.active ? { ...old.active, wordStudy: null, reviewSkills: {} } : null,
    reviews: Object.fromEntries(Object.entries(old.reviews).map(([key, r]) => [key, { ...r, lastOutcome: 'unknown', lastAdvancedDay: null }])),
    wordReviews: {}, wordAttempts: [],
  })
}
export function emptyState(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'): State {
  return { schemaVersion: 3, course: emptyCourse(), settings: { timeZone, intervals: [1, 3, 7, 14], newWordsPerDay: 2 }, active: null,
    attempts: [], reviews: {}, completions: [], wordReviews: {}, wordAttempts: [] }
}
export function completedLessons(s: State): Set<string> {
  return new Set(s.completions.filter(c => c.lessonId && c.mode === 'normal').map(c => `${c.lessonId}@${c.lessonVersion}`))
}
export function regularCompletedToday(s: State, now: Date): boolean {
  return s.completions.some(c => c.mode === 'normal' && c.lessonId && c.day === dayKey(now, s.settings.timeZone))
}
export function dueSkills(s: State, now: Date): Record<string, Skill[]> {
  const today = dayKey(now, s.settings.timeZone), result: Record<string, Skill[]> = {}
  for (const r of Object.values(s.reviews).filter(r => r.due <= today).sort((a, b) => a.due.localeCompare(b.due))) {
    ;(result[r.phraseId] ??= []).push(r.skill)
  }
  return result
}
export function duePhrases(s: State, now: Date): string[] { return Object.keys(dueSkills(s, now)) }
export function dueWords(s: State, now: Date): string[] {
  const today = dayKey(now, s.settings.timeZone)
  return [...new Set(Object.values(s.wordReviews).filter(r => r.due <= today).sort((a, b) => a.due.localeCompare(b.due)).map(r => r.wordId))]
}
export function plan(s: State, mode: Mode, now: Date): { lessonId: string | null; phraseIds: string[]; review: boolean } {
  const done = completedLessons(s), lesson = lessons.find(l => !done.has(`${l.id}@${l.version}`)), due = duePhrases(s, now)
  if (mode === 'quick') return { lessonId: null, phraseIds: (due.length ? due : lesson?.newPhraseIds ?? ['hello', 'thanks']).slice(0, 2), review: due.length > 0 }
  if (!regularCompletedToday(s, now) && lesson) return { lessonId: lesson.id, phraseIds: [...lesson.newPhraseIds,
    ...[...new Set([...due, ...lesson.reusePhraseIds])].filter(id => !lesson.newPhraseIds.includes(id)).slice(0, 2)], review: false }
  return { lessonId: null, phraseIds: (due.length ? due : s.completions.at(-1)?.phraseIds ?? ['hello', 'thanks']).slice(0, 3), review: true }
}
export function stepsForPhrase(a: { phraseIds: string[]; phraseIndex: number; reviewSkills: Record<string, Skill[]> }): Step[] {
  const skills = a.reviewSkills[a.phraseIds[a.phraseIndex]]
  if (!skills) return [...steps]
  return steps.filter(step => step === 'listen' || step === 'meaning' ? skills.includes('listening')
    : step === 'arrange' ? skills.includes('reading') : step === 'speak' ? skills.includes('speaking') : skills.includes('recall'))
}
function wordPlan(s: State, phraseIds: string[], mode: Mode, now: Date): WordStudy | null {
  const related = [...new Set(phraseIds.flatMap(id => phraseWordIds[id] ?? []))]
  const today = dayKey(now, s.settings.timeZone)
  const introduced = new Set(s.wordAttempts.filter(t => t.newWord).map(t => t.wordId))
  const introducedToday = new Set(s.wordAttempts.filter(t => t.newWord && dayKey(new Date(t.at), s.settings.timeZone) === today).map(t => t.wordId))
  const due = dueWords(s, now).filter(id => related.includes(id))
  const incomplete = related.filter(id => introduced.has(id) && (!s.wordReviews[`${id}:meaning`] || !s.wordReviews[`${id}:production`]))
  const review = [...new Set([...due, ...incomplete])].slice(0, mode === 'quick' ? 1 : 2)
  const remaining = Math.max(0, s.settings.newWordsPerDay - introducedToday.size)
  const fresh = related.filter(id => !introduced.has(id) && !Object.values(s.wordReviews).some(r => r.wordId === id)).slice(0, Math.min(remaining, mode === 'quick' ? 1 : s.settings.newWordsPerDay))
  const wordIds = [...review, ...fresh]
  if (!wordIds.length) return null
  const reviewDirections = Object.fromEntries(review.map(id => [id, (['meaning', 'production'] as const).filter(skill => {
    const r = s.wordReviews[`${id}:${skill}`]
    return !r || r.due <= today
  })]))
  const result: WordStudy = { wordIds, wordIndex: 0, step: 'learn', heard: false, hints: 0, revealed: false, input: '', reviewDirections }
  result.step = wordSteps(result)[0]
  return result
}
export function wordSteps(w: { wordIds: string[]; wordIndex: number; reviewDirections: Record<string, WordSkill[]> }): ('learn' | 'meaning' | 'produce')[] {
  const targets = w.reviewDirections[w.wordIds[w.wordIndex]]
  return targets ? [...(targets.includes('meaning') ? ['meaning' as const] : []), ...(targets.includes('production') ? ['produce' as const] : [])] : ['learn', 'meaning', 'produce']
}
export function startSession(s: State, mode: Mode, now: Date, id: string, reviewOnly = false): State {
  if (s.active) return s
  const due = dueSkills(s, now)
  const dueWordIds = dueWords(s, now)
  const p = reviewOnly ? { lessonId: null, phraseIds: [...new Set([...Object.keys(due), ...dueWordIds.map(w => wordById[w].examplePhraseId)])].slice(0, mode === 'quick' ? 2 : 3) }
    : plan(s, mode, now)
  if (!p.phraseIds.length) return s
  const lesson = lessons.find(l => l.id === p.lessonId)
  const reviewSkills = Object.fromEntries(p.phraseIds.filter(pid => due[pid] && !lesson?.newPhraseIds.includes(pid)).map(pid => [pid, due[pid]]))
  const active: Session = { id, lessonId: p.lessonId, lessonVersion: 1, phraseIds: p.phraseIds, phraseIndex: 0, step: 'listen', mode,
    startedAt: now.toISOString(), dateKey: dayKey(now, s.settings.timeZone), heard: false, audioSkipped: false, hints: 0, revealed: false, selectedTokens: [],
    reviewSkills, wordStudy: wordPlan(s, p.phraseIds, mode, now) }
  active.step = stepsForPhrase(active)[0]
  return { ...s, active }
}
export function patchSession(s: State, patch: Partial<Pick<Session, 'heard' | 'hints' | 'revealed' | 'selectedTokens'>>): State {
  return s.active ? { ...s, active: { ...s.active, ...patch } } : s
}
export function patchWordStudy(s: State, patch: Partial<Pick<WordStudy, 'heard' | 'hints' | 'revealed' | 'input'>>): State {
  return s.active?.wordStudy ? { ...s, active: { ...s.active, wordStudy: { ...s.active.wordStudy, ...patch } } } : s
}
export function skipWordStudy(s: State, now: Date): State {
  if (!s.active?.wordStudy) return s
  const a = s.active, w = a.wordStudy!
  const additions = w.wordIds.slice(w.wordIndex).map((wordId, i): WordAttempt => ({
    id: `${a.id}:word:${s.wordAttempts.length + i}`, sessionId: a.id, wordId, wordVersion: 1, step: 'learn', outcome: 'skipped', hints: 0, at: now.toISOString(), newWord: false,
  }))
  return { ...s, wordAttempts: [...s.wordAttempts, ...additions], active: { ...a, wordStudy: null } }
}
// Only a due review on a later local day can extend an interval. Extra practice is still recorded.
function nextReview<T extends Review | WordReview>(old: T | undefined, success: boolean | null, s: State, now: Date, sessionId: string) {
  const today = dayKey(now, s.settings.timeZone)
  const eligible = old && old.due <= today && dayKey(new Date(old.lastAt), s.settings.timeZone) !== today && old.lastAdvancedDay !== today
  let stage = old?.stage ?? 0, due = old?.due ?? addDays(today, s.settings.intervals[0]), lastAdvancedDay = old?.lastAdvancedDay ?? null
  if (success === false) { stage = 0; const next = addDays(today, s.settings.intervals[0]); due = old && old.due > today && old.due < next ? old.due : next }
  else if (success === null) { stage = 0; if (!old || old.due <= today) due = addDays(today, s.settings.intervals[0]) }
  else if (!old || eligible) {
    stage = old ? old.lastOutcome === 'success' ? Math.min(3, old.stage + 1) : old.lastOutcome === 'difficulty' ? 0 : old.stage : 0
    due = addDays(today, s.settings.intervals[stage]); lastAdvancedDay = today
  }
  return { stage, due, lastAdvancedDay, lastAt: now.toISOString(), lastSessionId: sessionId,
    successes: (old?.successes ?? 0) + Number(success === true), practices: (old?.practices ?? 0) + 1,
    lastOutcome: success === true ? 'success' as const : success === false ? 'difficulty' as const : 'practice' as const }
}
function evaluatePhrase(s: State, now: Date): State {
  const a = s.active!, pid = a.phraseIds[a.phraseIndex]
  const attempts = s.attempts.filter(t => t.sessionId === a.id && t.phraseId === pid), reviews = { ...s.reviews }
  const update = (skill: Skill, success: boolean | null, evidence: Review['evidence']) => {
    const key = `${pid}:${skill}`, old = reviews[key]
    if (old?.lastSessionId === a.id) return
    reviews[key] = { phraseId: pid, phraseVersion: 1, skill, evidence, ...nextReview(old, success, s, now, a.id) }
  }
  const meaning = attempts.filter(t => t.step === 'meaning')
  if (!a.audioSkipped && meaning.some(t => t.outcome === 'correct')) update('listening', !meaning.some(t => t.outcome === 'incorrect' || t.hints > 0), 'observed')
  const arrange = attempts.filter(t => t.step === 'arrange')
  if (arrange.some(t => t.outcome === 'correct')) update('reading', !arrange.some(t => t.outcome === 'incorrect' || t.hints > 0), 'observed')
  if (attempts.some(t => t.step === 'speak' && t.outcome === 'self')) update('speaking', null, 'selfReported')
  const recall = attempts.findLast(t => t.step === 'recall')
  if (recall && recall.outcome !== 'skipped') update('recall', recall.outcome === 'remembered' && recall.hints === 0, 'selfReported')
  return { ...s, reviews }
}
export function answer(s: State, outcome: Attempt['outcome'], now: Date): State {
  const a = s.active
  if (!a || a.wordStudy) return s
  if (a.step === 'listen' && (!['heard', 'skipped'].includes(outcome) || outcome === 'heard' && !a.heard)) return s
  if (['meaning', 'arrange'].includes(a.step) && !['correct', 'incorrect'].includes(outcome)) return s
  if (a.step === 'speak' && !['self', 'skipped'].includes(outcome)) return s
  if (a.step === 'recall' && !['remembered', 'unsure', 'skipped'].includes(outcome)) return s
  let next: State = { ...s, attempts: [...s.attempts, { id: `${a.id}:${s.attempts.length}`, sessionId: a.id,
    phraseId: a.phraseIds[a.phraseIndex], phraseVersion: 1, lessonId: a.lessonId, lessonVersion: a.lessonVersion,
    step: a.step, outcome, hints: a.hints, at: now.toISOString() }] }
  if (outcome === 'incorrect') return a.step === 'arrange' ? patchSession(next, { selectedTokens: [] }) : next
  if (a.step === 'listen') next = { ...next, active: { ...next.active!, audioSkipped: outcome === 'skipped' } }
  const sequence = stepsForPhrase(a), nextStep = sequence[sequence.indexOf(a.step) + 1]
  if (nextStep) return { ...next, active: { ...next.active!, step: nextStep, hints: 0, revealed: false, selectedTokens: [] } }
  next = evaluatePhrase(next, now)
  if (a.phraseIndex + 1 < a.phraseIds.length) {
    const active = { ...a, phraseIndex: a.phraseIndex + 1, heard: false, audioSkipped: false, hints: 0, revealed: false, selectedTokens: [] }
    active.step = stepsForPhrase(active)[0]
    return { ...next, active }
  }
  if (next.completions.some(c => c.sessionId === a.id)) return { ...next, active: null }
  return { ...next, active: null, completions: [...next.completions, { sessionId: a.id, lessonId: a.lessonId, lessonVersion: a.lessonVersion,
    mode: a.mode, at: now.toISOString(), day: dayKey(now, s.settings.timeZone), timeZone: s.settings.timeZone, phraseIds: a.phraseIds }] }
}
export function answerWord(s: State, outcome: WordAttempt['outcome'], now: Date): State {
  const a = s.active, w = a?.wordStudy
  if (!a || !w) return s
  if (w.step === 'learn' && (!['heard', 'skipped'].includes(outcome) || outcome === 'heard' && !w.heard)) return s
  if (w.step !== 'learn' && !['correct', 'incorrect'].includes(outcome)) return s
  const wordId = w.wordIds[w.wordIndex]
  if (w.step === 'produce' && outcome === 'correct' && !matchesWord(w.input, wordById[wordId])) return s
  let next: State = { ...s, wordAttempts: [...s.wordAttempts, { id: `${a.id}:word:${s.wordAttempts.length}`, sessionId: a.id,
    wordId, wordVersion: 1, step: w.step, outcome, hints: w.hints, at: now.toISOString(),
    newWord: w.step === 'learn' && !s.wordAttempts.some(t => t.wordId === wordId && t.newWord) && !Object.values(s.wordReviews).some(r => r.wordId === wordId) }] }
  if (outcome === 'incorrect') return next
  if (w.step === 'learn') return { ...next, active: { ...a, wordStudy: { ...w, step: 'meaning', hints: 0, revealed: false, input: '' } } }
  const skill: WordSkill = w.step === 'meaning' ? 'meaning' : 'production', key = `${wordId}:${skill}`, old = s.wordReviews[key]
  const attempts = next.wordAttempts.filter(t => t.sessionId === a.id && t.wordId === wordId && t.step === w.step)
  if (old?.lastSessionId !== a.id) next = { ...next, wordReviews: { ...next.wordReviews, [key]: { wordId, wordVersion: 1, skill,
    ...nextReview(old, !attempts.some(t => t.outcome === 'incorrect' || t.hints > 0), s, now, a.id) } } }
  const sequence = wordSteps(w), nextStep = sequence[sequence.indexOf(w.step) + 1]
  if (nextStep) return { ...next, active: { ...a, wordStudy: { ...w, step: nextStep, hints: 0, revealed: false, input: '' } } }
  const following: WordStudy | null = w.wordIndex + 1 < w.wordIds.length
    ? { ...w, wordIndex: w.wordIndex + 1, step: 'learn', heard: false, hints: 0, revealed: false, input: '' } : null
  if (following) following.step = wordSteps(following)[0]
  return { ...next, active: { ...a, wordStudy: following } }
}
