import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { courseById, diagnosticQuestions } from '../src/curriculum'
import { advanceCourse, currentCourseExercise, patchCourseInput, startCourse, submitCourse } from '../src/course'
import { emptyState, patchWordStudy, startSession, type State } from '../src/model'
const key = 'my-en:progress:v1'
async function stored(page: Page): Promise<State> { return page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key) }
async function finishStudy(page: Page) {
  for (let i = 0; i < 12; i++) {
    const a = (await stored(page)).course.active
    if (!a) return
    if (a.step === 'explain') await page.getByRole('button', { name: '대화에서 써 보기' }).click()
    else if (a.step === 'dialogue') {
      const q = courseById[a.lessonId!].checks[a.index]
      await page.getByRole('button', { name: q.choices[q.answer], exact: true }).click()
      await page.getByRole('button', { name: '다음 연습', exact: true }).click()
    } else {
      const ex = currentCourseExercise(a)!
      await page.getByLabel('내 영어 답변', { exact: true }).fill(a.step === 'respond' ? 'I spent Saturday reading. I went hiking with a neighbour on Sunday.' : ex.samples[0])
      await page.getByRole('button', { name: '답변 비교하기' }).click()
      await page.getByRole('button', { name: a.step === 'respond' ? '의도와 구조를 확인했어요' : '확인하고 다음으로', exact: true }).click()
    }
  }
  throw new Error('Study did not finish')
}
test('course: longer explanations/dialogue, flexible free response, draft resume and completion', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/')
  await expect(page.locator('.path-summary')).toContainText('현재 실용 문장')
  await expect(page.getByRole('heading', { name: '설명과 함께, 내 문장으로.' })).toBeVisible()
  mkdirSync('docs/screenshots', { recursive: true })
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-course-home.png`, fullPage: true })
  await page.getByRole('button', { name: '오늘 공부 시작', exact: true }).click()
  await expect(page.getByRole('heading', { name: '부정과 질문: did 뒤에는 동사 원형' })).toBeVisible()
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-course-explain.png`, fullPage: true })
  await page.getByRole('button', { name: '대화에서 써 보기' }).click()
  await expect(page.locator('.dialogue-lines>li')).toHaveCount(8)
  await page.getByRole('button', { name: '피곤해서', exact: true }).click(); await page.getByRole('button', { name: '다음 연습', exact: true }).click()
  await page.getByRole('button', { name: '친구 집 근처 식당', exact: true }).click(); await page.getByRole('button', { name: '다음 연습', exact: true }).click()
  await page.getByLabel('내 영어 답변').fill('I visited a friend')
  await page.reload(); await expect(page.getByLabel('내 영어 답변')).toHaveValue('I visited a friend')
  await page.getByRole('button', { name: '잠깐 쉬기', exact: true }).click()
  await page.getByRole('button', { name: '이어서 공부하기', exact: true }).click()
  await expect(page.getByLabel('내 영어 답변')).toHaveValue('I visited a friend')
  await finishStudy(page)
  await expect(page.getByRole('heading', { name: '오늘의 문장 수업을 기록했어요.' })).toBeVisible()
  const s = await stored(page)
  expect(s.course.completions).toHaveLength(1); expect(s.completions).toHaveLength(0)
  expect(s.course.attempts.filter(a => a.step === 'respond').every(a => a.result === 'selfConfirmed')).toBe(true)
  expect(s.course.reviews['past-weekend:0']?.successes).toBe(0)
  expect(errors).toEqual([])
})

test('course: optional diagnostic, higher difficulty and reversible skipping preserve v2 words/settings', async ({ page }) => {
  let s = startSession(emptyState('UTC'), 'normal', new Date(), 'old-words')
  s = patchWordStudy(s, { input: 'hel', hints: 1 }); s.settings.newWordsPerDay = 3
  const { course: _course, ...original } = s; void _course
  const v2 = { ...original, schemaVersion: 2 }, raw = JSON.stringify(v2, null, 2)
  await page.addInitScript(({ key, raw }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, raw) }, { key, raw })
  await page.goto('/')
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(raw)
  await page.locator('.path-summary').click()
  await page.getByRole('button', { name: '6문제로 시작점 확인' }).click()
  for (const q of diagnosticQuestions) {
    await page.getByRole('button', { name: q.choices[q.answer], exact: true }).click()
    await page.getByRole('button', { name: '다음 확인', exact: true }).click()
  }
  await page.getByRole('button', { name: '제안한 과정 선택' }).click()
  await expect(page.getByRole('button', { name: '문장 확장', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const lesson = page.locator('.lesson-list li').first()
  await lesson.locator('summary').click(); await lesson.getByRole('button', { name: '아는 수업 건너뛰기' }).click()
  expect((await stored(page)).course.skipped).toEqual(['past-interruption'])
  expect((await stored(page)).course.completions).toEqual([])
  await lesson.getByRole('button', { name: '건너뛰기 되돌리기' }).click()
  await page.getByRole('button', { name: '오늘 공부 시작', exact: true }).click()
  await expect(page.getByRole('heading', { name: '과거 진행: was/were + ing' })).toBeVisible()
  const next = await stored(page)
  expect(next.active).toEqual(v2.active); expect(next.settings).toEqual(v2.settings)
  expect(await page.evaluate(() => localStorage.getItem('my-en:migration:v2'))).toBe(raw)
  await page.getByRole('link', { name: '설정과 백업', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '단어·표현 v2 원본 내려받기' }).click()
  expect(readFileSync((await (await download).path())!, 'utf8')).toBe(raw)
})

test('course: due recall hides examples, alternative wording stays ungraded, hints and mobile fit', async ({ page }, info) => {
  const yesterday = new Date(Date.now() - 4 * 86400000)
  let s = startCourse(emptyState('UTC'), yesterday, 'completed')
  while (s.course.active) {
    const a = s.course.active
    if (a.step === 'explain') s = advanceCourse(s, 'ready', yesterday)
    else if (a.step === 'dialogue') { s = submitCourse(s, courseById[a.lessonId!].checks[a.index].answer); s = advanceCourse(s, 'ready', yesterday) }
    else { s = patchCourseInput(s, currentCourseExercise(a)!.samples[0]); s = submitCourse(s); s = advanceCourse(s, 'ready', yesterday) }
  }
  await page.addInitScript(({ key, s }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s)) }, { key, s })
  await page.goto('/')
  await page.getByRole('button', { name: '회상 복습 시작', exact: true }).click()
  await expect(page.locator('.study-content').getByText('I visited a friend last weekend.', { exact: true })).toHaveCount(0)
  await page.getByLabel('내 영어 답변').fill('Last weekend I dropped by to see a friend.')
  await page.getByRole('button', { name: '답변 비교하기' }).click()
  await expect(page.getByText('다른 자연스러운 표현일 수 있어 자동 오답 처리하지 않았어요.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '의도와 구조를 확인했어요', exact: true }).click()
  await page.getByRole('button', { name: '힌트·예문 보기', exact: true }).click()
  await page.getByLabel('내 영어 답변').fill("I didn't go out on Sunday.")
  await page.screenshot({ path: `docs/screenshots/${info.project.name}-course-recall.png`, fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '답변 비교하기' }).click(); await page.getByRole('button', { name: '확인하고 다음으로', exact: true }).click()
  await expect(page.getByRole('heading', { name: '회상 확인을 남겼어요.' })).toBeVisible()
  const next = await stored(page)
  expect(next.course.reviews['past-weekend:0']?.lastOutcome).toBe('selfConfirmed')
  expect(next.course.reviews['past-weekend:1']?.lastOutcome).toBe('needsPractice')
  expect(next.course.completions).toHaveLength(1)
})
