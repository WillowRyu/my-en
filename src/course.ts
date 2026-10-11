import { z } from 'zod'
import { addDays, dayKey } from './calendar'
import { courseById, courseLessons, diagnosticQuestions, type CourseExercise } from './curriculum'
import type { State } from './model'
const lessonId = z.enum(courseLessons.map(l => l.id) as [string, ...string[]])
const recallKeys = courseLessons.flatMap(l => l.recalls.map((_, i) => `${l.id}:${i}`))
const recallKey = z.enum(recallKeys as [string, ...string[]])
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s
})
const feedback = z.enum(['matched', 'commonIssue', 'compare'])
const step = z.enum(['review', 'explain', 'dialogue', 'transform', 'respond'])
const activeSchema = z.object({
  id: z.string().min(1).max(100), version: z.literal(1), kind: z.enum(['lesson', 'review']), lessonId: lessonId.nullable(),
  step, index: z.number().int().min(0), reviewKeys: z.array(recallKey).max(2),
  input: z.string().max(2000), hints: z.number().int().min(0).max(1000), revealed: z.boolean(),
  feedback: feedback.nullable(), choice: z.number().int().min(0).max(2).nullable(), startedAt: z.string().datetime(),
}).refine(a => {
  const l = a.lessonId ? courseById[a.lessonId] : null
  if (new Set(a.reviewKeys).size !== a.reviewKeys.length) return false
  if (a.kind === 'review' && (l || a.step !== 'review')) return false
  if (a.kind === 'lesson' && !l) return false
  const count = a.step === 'review' ? a.reviewKeys.length : a.step === 'explain' ? 1 : a.step === 'dialogue' ? l?.checks.length : a.step === 'transform' ? l?.transforms.length : l?.responses.length
  return !!count && a.index < count
}, 'Invalid course position')
export const courseSchema = z.object({
  path: z.enum(['foundation', 'practical', 'stretch']), active: activeSchema.nullable(), lastFinishedKind: z.enum(['lesson', 'review']).nullable(),
  skipped: z.array(lessonId).max(courseLessons.length).refine(v => new Set(v).size === v.length),
  diagnostic: z.object({ answers: z.array(z.number().int().min(-1).max(2)).length(6), at: z.string().datetime() }).nullable(),
  attempts: z.array(z.object({
    id: z.string().max(160), sessionId: z.string().max(100), lessonId, version: z.literal(1), step: step.exclude(['explain']), index: z.number().int().min(0),
    input: z.string().max(2000), hints: z.number().int().min(0).max(1000), at: z.string().datetime(),
    result: z.enum(['matched', 'selfConfirmed', 'needsPractice', 'skipped']),
  }).refine(a => a.index < (a.step === 'review' ? courseById[a.lessonId].recalls : a.step === 'dialogue' ? courseById[a.lessonId].checks : a.step === 'transform' ? courseById[a.lessonId].transforms : courseById[a.lessonId].responses).length)).max(100000),
  completions: z.array(z.object({ id: z.string().max(100), lessonId, version: z.literal(1), at: z.string().datetime(), day: date })).max(100000),
  reviews: z.partialRecord(recallKey, z.object({
    due: date, stage: z.number().int().min(0).max(3), lastAt: z.string().datetime(),
    lastAdvancedDay: date.nullable(), successes: z.number().int().min(0), practices: z.number().int().min(0),
    lastOutcome: z.enum(['unconfirmed', 'selfConfirmed', 'needsPractice']),
  })),
}).refine(c => new Set(c.attempts.map(a => a.id)).size === c.attempts.length && new Set(c.completions.map(v => v.id)).size === c.completions.length)
export type CourseState = z.infer<typeof courseSchema>
export type CourseSession = NonNullable<CourseState['active']>
export type CoursePath = CourseState['path']
export function emptyCourse(): CourseState {
  return { path: 'practical', active: null, lastFinishedKind: null, skipped: [], diagnostic: null, attempts: [], completions: [], reviews: {} }
}
export function dueCourseKeys(s: State, now: Date): string[] {
  const today = dayKey(now, s.settings.timeZone)
  return Object.entries(s.course.reviews).filter(([, r]) => r && r.due <= today).sort(([, a], [, b]) => a!.due.localeCompare(b!.due)).map(([key]) => key)
}
export function nextCourseLesson(s: State) {
  const completed = new Set(s.course.completions.map(c => c.lessonId))
  return courseLessons.find(l => l.level === s.course.path && !completed.has(l.id) && !s.course.skipped.includes(l.id))
}
export function setCoursePath(s: State, path: CoursePath): State { return { ...s, course: { ...s.course, path } } }
export function toggleCourseSkip(s: State, id: string): State {
  if (!courseById[id] || s.course.active?.lessonId === id) return s
  const skipped = s.course.skipped.includes(id) ? s.course.skipped.filter(v => v !== id) : [...s.course.skipped, id]
  return { ...s, course: { ...s.course, skipped } }
}
export function saveDiagnostic(s: State, answers: number[], now: Date): State {
  const parsed = courseSchema.shape.diagnostic.unwrap().safeParse({ answers, at: now.toISOString() })
  return parsed.success ? { ...s, course: { ...s.course, diagnostic: parsed.data } } : s
}
export function diagnosticSuggestion(answers: number[]): { score: number; path: CoursePath } {
  const score = diagnosticQuestions.filter((q, i) => q.answer === answers[i]).length
  return { score, path: score >= 5 ? 'stretch' : score >= 2 ? 'practical' : 'foundation' }
}
export function startCourse(s: State, now: Date, id: string, reviewOnly = false, chosenId?: string): State {
  if (s.course.active) return s
  const lesson = chosenId ? courseById[chosenId] : nextCourseLesson(s)
  const reviewKeys = dueCourseKeys(s, now).slice(0, 2)
  if (reviewOnly ? !reviewKeys.length : !lesson) return s
  const active: CourseSession = { id, version: 1, kind: reviewOnly ? 'review' : 'lesson', lessonId: reviewOnly ? null : lesson!.id,
    step: reviewKeys.length ? 'review' : 'explain', index: 0, reviewKeys, input: '', hints: 0, revealed: false, feedback: null, choice: null, startedAt: now.toISOString() }
  return { ...s, course: { ...s.course, active } }
}
export function currentCourseExercise(a: CourseSession): CourseExercise | null {
  if (a.step === 'review') { const [id, index] = a.reviewKeys[a.index].split(':'); return courseById[id].recalls[Number(index)] }
  const l = a.lessonId ? courseById[a.lessonId] : null
  return a.step === 'transform' ? l!.transforms[a.index] : a.step === 'respond' ? l!.responses[a.index] : null
}
export function normalizeSentence(input: string): string {
  return input.normalize('NFKC').toLowerCase().replace(/[‘’]/g, "'").replace(/café/g, 'cafe')
    .replace(/\b(i'm)\b/g, 'i am').replace(/\b(we're)\b/g, 'we are').replace(/\b(you're)\b/g, 'you are')
    .replace(/\b(i've)\b/g, 'i have').replace(/\b(we've)\b/g, 'we have').replace(/\b(i'd)\b/g, 'i would')
    .replace(/\b(i'll)\b/g, 'i will').replace(/\b(we'll)\b/g, 'we will').replace(/\b(let's)\b/g, 'let us')
    .replace(/\b(it's)\b/g, 'it is').replace(/\b(didn't)\b/g, 'did not').replace(/\b(don't)\b/g, 'do not')
    .replace(/\b(isn't)\b/g, 'is not').replace(/\b(haven't)\b/g, 'have not').replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim()
}
export function assessCourseInput(input: string, exercise: CourseExercise, free = false) {
  // Free writing is always a comparison prompt, never a grammar/proficiency verdict.
  if (free) return { kind: 'compare' as const, reason: '자유 답변은 자동으로 문법·자연스러움을 판정하지 않아요. 내 의도와 예문을 비교하고 아래 기준을 스스로 확인해 주세요.' }
  if (exercise.samples.some(sample => normalizeSentence(sample) === normalizeSentence(input))) return { kind: 'matched' as const, reason: exercise.why }
  const error = exercise.errors?.find(e => new RegExp(e.pattern, 'i').test(input.replace(/[‘’]/g, "'")))
  if (error) return { kind: 'commonIssue' as const, reason: error.why }
  return { kind: 'compare' as const, reason: '작성된 확인 답안과는 달라요. 다른 자연스러운 표현일 수 있어 자동 오답 처리하지 않았어요. 요구한 의미·문장 구조를 예문과 비교해 주세요.' }
}
export function patchCourseInput(s: State, input: string): State {
  const a = s.course.active
  if (!a || input.length > 2000) return s
  return { ...s, course: { ...s.course, active: { ...a, input, feedback: null, hints: a.feedback ? Math.max(1, a.hints) : a.hints } } }
}
export function revealCourse(s: State): State {
  const a = s.course.active
  return a ? { ...s, course: { ...s.course, active: { ...a, revealed: true, hints: Math.min(1000, a.hints + 1) } } } : s
}
export function submitCourse(s: State, choice?: number): State {
  const a = s.course.active
  if (!a || a.step === 'explain') return s
  if (a.step === 'dialogue') {
    const q = courseById[a.lessonId!].checks[a.index]
    if (choice === undefined || choice < 0 || choice >= q.choices.length) return s
    return { ...s, course: { ...s.course, active: { ...a, choice, feedback: choice === q.answer ? 'matched' : 'commonIssue' } } }
  }
  const exercise = currentCourseExercise(a)
  if (!exercise || !a.input.trim()) return s
  return { ...s, course: { ...s.course, active: { ...a, feedback: assessCourseInput(a.input, exercise, a.step === 'respond').kind } } }
}
export function advanceCourse(s: State, decision: 'ready' | 'practice' | 'skip', now: Date): State {
  const a = s.course.active
  if (!a || (a.step !== 'explain' && decision !== 'skip' && !a.feedback)) return s
  const course = { ...s.course, reviews: { ...s.course.reviews } }
  if (a.step !== 'explain') {
    const [lessonId, recallIndex] = a.step === 'review' ? a.reviewKeys[a.index].split(':') : [a.lessonId!, String(a.index)]
    const result = decision === 'skip' ? 'skipped' as const : decision === 'practice' || a.feedback === 'commonIssue' ? 'needsPractice' as const : a.feedback === 'matched' ? 'matched' as const : 'selfConfirmed' as const
    course.attempts = [...course.attempts, { id: `${a.id}:${course.attempts.length}`, sessionId: a.id, lessonId, version: 1, step: a.step,
      index: Number(recallIndex), input: a.step === 'dialogue' ? String(a.choice) : a.input, hints: a.hints, at: now.toISOString(), result }]
    if (a.step === 'review' && result !== 'skipped') {
      const key = a.reviewKeys[a.index], old = course.reviews[key]
      if (old) {
        const today = dayKey(now, s.settings.timeZone)
        const success = result !== 'needsPractice' && a.hints === 0
        const eligible = old.due <= today && dayKey(new Date(old.lastAt), s.settings.timeZone) !== today && old.lastAdvancedDay !== today
        const stage = success ? eligible ? Math.min(3, old.stage + 1) : old.stage : 0
        course.reviews[key] = { ...old, stage,
          due: success ? eligible ? addDays(today, s.settings.intervals[stage]) : old.due : addDays(today, s.settings.intervals[0]),
          lastAt: now.toISOString(), lastAdvancedDay: success && eligible ? today : old.lastAdvancedDay,
          successes: old.successes + Number(success), practices: old.practices + 1, lastOutcome: success ? 'selfConfirmed' : 'needsPractice' }
      }
    }
  }
  const l = a.lessonId ? courseById[a.lessonId] : null
  const count = a.step === 'review' ? a.reviewKeys.length : a.step === 'dialogue' ? l!.checks.length : a.step === 'transform' ? l!.transforms.length : a.step === 'respond' ? l!.responses.length : 1
  let nextStep = a.step, index = a.index + 1
  if (index >= count) {
    index = 0
    if (a.step === 'review') {
      if (a.kind === 'review') return { ...s, course: { ...course, active: null, lastFinishedKind: 'review' } }
      nextStep = 'explain'
    } else if (a.step === 'explain') nextStep = 'dialogue'
    else if (a.step === 'dialogue') nextStep = 'transform'
    else if (a.step === 'transform') nextStep = 'respond'
    else {
      if (!course.completions.some(c => c.id === a.id)) {
        const today = dayKey(now, s.settings.timeZone)
        course.completions = [...course.completions, { id: a.id, lessonId: l!.id, version: 1, at: now.toISOString(), day: today }]
        for (let i = 0; i < l!.recalls.length; i++) {
          const key = `${l!.id}:${i}`
          // Repeating a lesson must not move an already scheduled recall further away.
          if (!course.reviews[key]) course.reviews[key] = { due: addDays(today, s.settings.intervals[1]), stage: 1, lastAt: now.toISOString(),
            lastAdvancedDay: null, successes: 0, practices: 0, lastOutcome: 'unconfirmed' }
        }
      }
      return { ...s, course: { ...course, active: null, lastFinishedKind: 'lesson' } }
    }
  }
  return { ...s, course: { ...course, active: { ...a, step: nextStep, index, input: '', hints: 0, revealed: false, feedback: null, choice: null } } }
}
