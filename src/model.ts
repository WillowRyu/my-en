import { z } from 'zod'
import { lessons, phraseById, phrases } from './content'

export const skillNames = { listening: '듣고 이해함', speaking: '보고 따라 말함', recall: '힌트 없이 떠올림' } as const
export type Skill = keyof typeof skillNames
export const steps = ['listen', 'meaning', 'arrange', 'speak', 'recall'] as const
export type Step = typeof steps[number]
export type Mode = 'normal' | 'quick'
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s
})
const timeSchema = z.string().datetime()
const phraseIdSchema = z.enum(phrases.map(p => p.id) as [string, ...string[]])
const skillSchema = z.enum(['listening', 'speaking', 'recall'])
const stepSchema = z.enum(steps)
const outcomeSchema = z.enum(['correct', 'incorrect', 'self', 'remembered', 'unsure', 'skipped', 'heard'])
const timezoneSchema = z.string().refine(s => { try { new Intl.DateTimeFormat('en', { timeZone: s }); return true } catch { return false } })
const attemptSchema = z.object({
  id: z.string().max(120), sessionId: z.string().max(100), phraseId: phraseIdSchema,
  phraseVersion: z.literal(1), lessonId: z.string().max(50).nullable(), lessonVersion: z.literal(1),
  step: stepSchema, outcome: outcomeSchema, hints: z.number().int().min(0).max(1000), at: timeSchema,
})
const sessionSchema = z.object({
  id: z.string().max(100), lessonId: z.string().max(50).nullable(), lessonVersion: z.literal(1),
  phraseIds: z.array(phraseIdSchema).min(1).max(8), phraseIndex: z.number().int().min(0), step: stepSchema,
  mode: z.enum(['normal', 'quick']), startedAt: timeSchema, dateKey: dateSchema,
  heard: z.boolean(), audioSkipped: z.boolean(), hints: z.number().int().min(0).max(1000),
  revealed: z.boolean(), selectedTokens: z.array(z.number().int().min(0)).max(20),
}).refine(s => s.phraseIndex < s.phraseIds.length && new Set(s.phraseIds).size === s.phraseIds.length &&
  (!s.lessonId || lessons.some(l => l.id === s.lessonId && l.version === s.lessonVersion)) &&
  new Set(s.selectedTokens).size === s.selectedTokens.length &&
  s.selectedTokens.every(i => i < phraseById[s.phraseIds[s.phraseIndex]].tokens.length), 'Invalid active lesson')
const reviewSchema = z.object({
  phraseId: phraseIdSchema, phraseVersion: z.literal(1), skill: skillSchema,
  stage: z.number().int().min(0).max(3), due: dateSchema, lastAt: timeSchema,
  lastSessionId: z.string().max(100), evidence: z.enum(['observed', 'selfReported']),
  successes: z.number().int().min(0), practices: z.number().int().min(0),
})
export const stateSchema = z.object({
  schemaVersion: z.literal(1),
  settings: z.object({ timeZone: timezoneSchema, intervals: z.array(z.number().int().min(1).max(90)).length(4).refine(a => a.every((n, i) => !i || n > a[i - 1])) }),
  active: sessionSchema.nullable(), attempts: z.array(attemptSchema).max(100000),
  reviews: z.record(z.string(), reviewSchema).refine(r => Object.entries(r).every(([key, v]) => key === `${v.phraseId}:${v.skill}`)),
  completions: z.array(z.object({ sessionId: z.string().max(100), lessonId: z.string().max(50).nullable(), lessonVersion: z.literal(1),
    mode: z.enum(['normal', 'quick']), at: timeSchema, day: dateSchema, timeZone: timezoneSchema, phraseIds: z.array(phraseIdSchema).min(1).max(8) })).max(10000),
}).refine(s => new Set(s.attempts.map(a => a.id)).size === s.attempts.length && new Set(s.completions.map(c => c.sessionId)).size === s.completions.length, 'Duplicate records')
export type State = z.infer<typeof stateSchema>
export type Session = NonNullable<State['active']>
export type Attempt = State['attempts'][number]
export type Review = State['reviews'][string]
export function emptyState(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'): State {
  return { schemaVersion: 1, settings: { timeZone, intervals: [1, 3, 7, 14] }, active: null, attempts: [], reviews: {}, completions: [] }
}
export function dayKey(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export function completedLessons(s: State): Set<string> {
  // A five-minute lesson does not consume the full lesson.
  return new Set(s.completions.filter(c => c.lessonId && c.mode === 'normal').map(c => `${c.lessonId}@${c.lessonVersion}`))
}
export function duePhrases(s: State, now: Date): string[] {
  const today = dayKey(now, s.settings.timeZone)
  const due = Object.values(s.reviews).filter(r => r.due <= today).sort((a, b) => a.due.localeCompare(b.due))
  return [...new Set(due.map(r => r.phraseId))]
}
export function plan(s: State, mode: Mode, now: Date): { lessonId: string | null; phraseIds: string[]; review: boolean } {
  const done = completedLessons(s)
  const lesson = lessons.find(l => !done.has(`${l.id}@${l.version}`))
  const due = duePhrases(s, now)
  const finishedToday = s.completions.some(c => c.day === dayKey(now, s.settings.timeZone))
  if (mode === 'quick') return { lessonId: null, phraseIds: (due.length ? due : lesson?.newPhraseIds ?? ['hello', 'thanks']).slice(0, 2), review: due.length > 0 }
  if (!finishedToday && lesson) return { lessonId: lesson.id, phraseIds: [...lesson.newPhraseIds, ...[...new Set([...due, ...lesson.reusePhraseIds])].filter(id => !lesson.newPhraseIds.includes(id)).slice(0, 2)], review: false }
  return { lessonId: null, phraseIds: (due.length ? due : s.completions.at(-1)?.phraseIds ?? ['hello', 'thanks']).slice(0, 3), review: true }
}
export function startSession(s: State, mode: Mode, now: Date, id: string, reviewOnly = false): State {
  if (s.active) return s
  const p = reviewOnly ? { lessonId: null, phraseIds: duePhrases(s, now).slice(0, mode === 'quick' ? 2 : 3) } : plan(s, mode, now)
  if (!p.phraseIds.length) return s
  return { ...s, active: { id, lessonId: p.lessonId, lessonVersion: 1, phraseIds: p.phraseIds, phraseIndex: 0, step: 'listen', mode,
    startedAt: now.toISOString(), dateKey: dayKey(now, s.settings.timeZone), heard: false, audioSkipped: false, hints: 0, revealed: false, selectedTokens: [] } }
}
export function patchSession(s: State, patch: Partial<Pick<Session, 'heard' | 'hints' | 'revealed' | 'selectedTokens'>>): State {
  return s.active ? { ...s, active: { ...s.active, ...patch } } : s
}
function record(s: State, outcome: Attempt['outcome'], now: Date): State {
  const a = s.active!
  return { ...s, attempts: [...s.attempts, { id: `${a.id}:${s.attempts.length}`, sessionId: a.id, phraseId: a.phraseIds[a.phraseIndex], phraseVersion: 1,
    lessonId: a.lessonId, lessonVersion: a.lessonVersion, step: a.step, outcome, hints: a.hints, at: now.toISOString() }] }
}
function advance(s: State, step: Step): State {
  return { ...s, active: { ...s.active!, step, hints: 0, revealed: false, selectedTokens: [] } }
}
function evaluatePhrase(s: State, now: Date): State {
  const a = s.active!
  const pid = a.phraseIds[a.phraseIndex]
  const attempts = s.attempts.filter(t => t.sessionId === a.id && t.phraseId === pid)
  const reviews = { ...s.reviews }
  const update = (skill: Skill, success: boolean, evidence: Review['evidence']) => {
    const key = `${pid}:${skill}`, old = reviews[key]
    if (old?.lastSessionId === a.id) return
    const stage = success ? Math.min(3, old ? old.stage + 1 : 0) : 0
    reviews[key] = { phraseId: pid, phraseVersion: 1, skill, stage, due: addDays(dayKey(now, s.settings.timeZone), s.settings.intervals[stage]),
      lastAt: now.toISOString(), lastSessionId: a.id, evidence, successes: (old?.successes ?? 0) + Number(success), practices: (old?.practices ?? 0) + 1 }
  }
  const meaning = attempts.filter(t => t.step === 'meaning')
  if (!a.audioSkipped && meaning.some(t => t.outcome === 'correct')) update('listening', !meaning.some(t => t.outcome === 'incorrect' || t.hints > 0), 'observed')
  if (attempts.some(t => t.step === 'speak' && t.outcome === 'self')) update('speaking', false, 'selfReported')
  const recall = attempts.findLast(t => t.step === 'recall')
  if (recall && recall.outcome !== 'skipped') update('recall', recall.outcome === 'remembered' && recall.hints === 0, 'selfReported')
  return { ...s, reviews }
}
export function answer(s: State, outcome: Attempt['outcome'], now: Date): State {
  const a = s.active
  if (!a) return s
  if (a.step === 'listen' && !['heard', 'skipped'].includes(outcome)) return s
  if (a.step === 'listen' && outcome === 'heard' && !a.heard) return s
  if (['meaning', 'arrange'].includes(a.step) && !['correct', 'incorrect'].includes(outcome)) return s
  if (a.step === 'speak' && !['self', 'skipped'].includes(outcome)) return s
  if (a.step === 'recall' && !['remembered', 'unsure', 'skipped'].includes(outcome)) return s
  let next = record(s, outcome, now)
  if (a.step === 'listen') { next = { ...next, active: { ...next.active!, audioSkipped: outcome === 'skipped' } }; return advance(next, 'meaning') }
  if (a.step === 'meaning') return outcome === 'correct' ? advance(next, 'arrange') : next
  if (a.step === 'arrange') return outcome === 'correct' ? advance(next, 'speak') : patchSession(next, { selectedTokens: [] })
  if (a.step === 'speak') return advance(next, 'recall')
  next = evaluatePhrase(next, now)
  if (a.phraseIndex + 1 < a.phraseIds.length) return { ...next, active: { ...a, phraseIndex: a.phraseIndex + 1, step: 'listen', heard: false, audioSkipped: false, hints: 0, revealed: false, selectedTokens: [] } }
  if (next.completions.some(c => c.sessionId === a.id)) return { ...next, active: null }
  return { ...next, active: null, completions: [...next.completions, { sessionId: a.id, lessonId: a.lessonId, lessonVersion: a.lessonVersion, mode: a.mode,
    at: now.toISOString(), day: dayKey(now, s.settings.timeZone), timeZone: s.settings.timeZone, phraseIds: a.phraseIds }] }
}
