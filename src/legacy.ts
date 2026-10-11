import { z } from 'zod'
import { lessons, phraseById, phrases } from './content'

const steps = ['listen', 'meaning', 'arrange', 'speak', 'recall'] as const
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
export const legacyStateSchema = z.object({
  schemaVersion: z.literal(1),
  settings: z.object({ timeZone: timezoneSchema, intervals: z.array(z.number().int().min(1).max(90)).length(4).refine(a => a.every((n, i) => !i || n > a[i - 1])) }),
  active: sessionSchema.nullable(), attempts: z.array(attemptSchema).max(100000),
  reviews: z.record(z.string(), reviewSchema).refine(r => Object.entries(r).every(([key, v]) => key === `${v.phraseId}:${v.skill}`)),
  completions: z.array(z.object({ sessionId: z.string().max(100), lessonId: z.string().max(50).nullable(), lessonVersion: z.literal(1),
    mode: z.enum(['normal', 'quick']), at: timeSchema, day: dateSchema, timeZone: timezoneSchema, phraseIds: z.array(phraseIdSchema).min(1).max(8) })).max(10000),
}).refine(s => new Set(s.attempts.map(a => a.id)).size === s.attempts.length && new Set(s.completions.map(c => c.sessionId)).size === s.completions.length, 'Duplicate records')
