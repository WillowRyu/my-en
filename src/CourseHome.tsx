import { useState } from 'react'
import { courseLessons, diagnosticQuestions, levelLabels } from './curriculum'
import { diagnosticSuggestion, dueCourseKeys, nextCourseLesson, type CoursePath } from './course'
import type { State } from './model'
import { Icon } from './icons'

export function LearningPathControls({ state, blocked, onPath, onDiagnostic }: {
  state: State; blocked: boolean; onPath: (path: CoursePath) => void; onDiagnostic: (answers: number[]) => void
}) {
  const [diagnosing, setDiagnosing] = useState(false)
  const [answers, setAnswers] = useState<number[]>([])
  const [choice, setChoice] = useState<number | null>(null)
  const q = diagnosticQuestions[answers.length]
  const last = state.course.diagnostic
  const result = last ? diagnosticSuggestion(last.answers) : null
  return <section className="path-controls" aria-label="학습 난이도 선택"><details><summary className="path-summary">난이도와 시작점 바꾸기 · 현재 {levelLabels[state.course.path]}</summary><h2>어떤 문장부터 공부할까요?</h2><p className="small">기초가 쉽다면 실용 문장부터 시작하세요. 언제든 바꿔도 기존 단어·수업 기록은 남아요.</p>
    <div className="button-row">{(Object.keys(levelLabels) as CoursePath[]).map(path => <button key={path} className={state.course.path === path ? 'primary' : 'secondary'} aria-pressed={state.course.path === path} disabled={blocked} onClick={() => onPath(path)}>{levelLabels[path]}</button>)}</div>
    <button className="text-button" disabled={blocked} onClick={() => { setDiagnosing(!diagnosing); setAnswers([]); setChoice(null) }}>{diagnosing ? '수준 확인 닫기' : '6문제로 시작점 확인'}</button>
    {!diagnosing && result && <p className="small">지난 확인 {result.score}/6 · 제안: {levelLabels[result.path]}. 제한된 문장 구조 확인이며 공인 영어 수준이나 말하기 점수가 아니에요.</p>}
    {diagnosing && q && <div className="diagnostic"><h3>시작점 확인 {answers.length + 1}/6</h3><p>{q.question}에 맞는 문장을 골라요.</p><div className="choices">{q.choices.map((text, i) => <button className="choice" key={text} disabled={choice !== null} onClick={() => setChoice(i)}><span lang="en">{text}</span></button>)}<button className="text-button" disabled={choice !== null} onClick={() => setChoice(-1)}>잘 모르겠어요</button></div>{choice !== null && <div role="status"><p>{choice === q.answer ? '이 구조를 알아봤어요. ' : '이 부분을 설명과 함께 연습해 볼 수 있어요. '}{q.why}</p><button className="primary" onClick={() => {
      const next = [...answers, choice]; setAnswers(next); setChoice(null)
      if (next.length === diagnosticQuestions.length) onDiagnostic(next)
    }}>다음 확인</button></div>}</div>}
    {diagnosing && answers.length === 6 && <div className="diagnostic" role="status"><h3>시작점 제안: {levelLabels[diagnosticSuggestion(answers).path]}</h3><p>작성된 구조 {diagnosticSuggestion(answers).score}/6개를 알아봤어요. 익숙한 구조 확인이며 영어 전체 능력을 확정하는 결과가 아니에요.</p><div className="button-row"><button className="primary" onClick={() => { onPath(diagnosticSuggestion(answers).path); setDiagnosing(false) }}>제안한 과정 선택</button><button className="secondary" onClick={() => setDiagnosing(false)}>지금 선택한 과정 유지</button></div></div>}
  </details></section>
}

export function CourseHome({ state, now, blocked, onBegin, onSkip, onBasic }: {
  state: State; now: Date; blocked: boolean; onBegin: (review?: boolean, id?: string) => void; onSkip: (id: string) => void; onBasic: () => void
}) {
  const active = state.course.active
  const lesson = active?.lessonId ? courseLessons.find(l => l.id === active.lessonId) : nextCourseLesson(state)
  const due = dueCourseKeys(state, now)
  const selected = courseLessons.filter(l => l.level === state.course.path)
  const completed = new Set(state.course.completions.map(c => c.lessonId))
  return <>
    <header className="home-heading"><span className="greeting"><Icon name="sun" />이해하고, 바꿔 보고, 다시 떠올리기</span><h1 tabIndex={-1}>{active ? '하던 문장부터 이어 가요.' : '설명과 함께, 내 문장으로.'}</h1><p>짧은 인사를 넘어 이유·경험·계획을 말해요.<br />문법은 사용할 문장 속에서 확인합니다.</p></header>
    <section className="today-lesson" aria-labelledby="course-today-title"><div className="lesson-copy"><span className="lesson-label">{active?.kind === 'review' ? '힌트 없는 회상 복습' : `${levelLabels[lesson?.level ?? state.course.path]} · ${selected.length}개 수업`}</span><h2 id="course-today-title">{active?.kind === 'review' ? '며칠 뒤, 기억을 다시 확인해요.' : lesson?.title ?? '이 과정의 수업을 모두 살펴봤어요.'}</h2><p>{lesson?.goal ?? '아는 수업을 다시 응용하거나 다른 난이도를 선택할 수 있어요.'}</p>
      <div className="lesson-meta"><Icon name="clock" /><span>{active ? '저장된 단계와 입력에서 이어서' : '한 회차 15~25분을 목표로 구성'}<small>설명 · 8턴 대화 · 변형 3개 · 직접 답변 2개. 소요 시간은 내 속도에 따라 달라요.</small></span></div>
      <button className="primary start-button" disabled={blocked || (!active && !lesson)} onClick={() => onBegin()}>{active ? '이어서 공부하기' : '오늘 공부 시작'}<Icon name="arrow" /></button><span className="microcopy">읽고 써서 진행해요. 소리 내어 말해 보는 것은 선택이에요.</span>
    </div><div className="lesson-art" aria-hidden="true"><div className="speech-card">I stayed home<br />because I was tired.<span>피곤해서 집에 있었어요.</span></div><span className="art-caption">한 문장에, 내 이유를 더해요.</span></div></section>
    {state.active && <p className="notice subtle">이전에 하던 기초 단어·표현도 저장되어 있어요. 기초 과정을 선택하면 그 자리부터 이어집니다.</p>}
    <div className="home-secondary"><section className="review-line"><div><h2><Icon name="repeat" />문장을 가린 회상</h2><p>{due.length ? `${due.length}개가 확인할 날이에요. 한 번에 최대 2개만 확인해요.` : '아직 확인할 날이 된 문장은 없어요. 수업 후 기본 3일 뒤에 다시 만나요.'}</p></div><button className="text-button" disabled={!due.length || blocked || !!active} onClick={() => onBegin(true)}>회상 복습 시작</button></section><section className="quick-mode"><div className="round-icon"><Icon name="book" /></div><div><h2>기존 단어·표현도 계속 연습해요</h2><p>16개 단어와 7일 기초 과정의 기록·복습을 유지해요.</p></div><button className="secondary" disabled={blocked} onClick={onBasic}>기초 단어·표현 연습</button></section></div>
    <section className="journey"><div className="section-heading"><h2>{levelLabels[state.course.path]} 수업 고르기</h2><span>{selected.filter(l => completed.has(l.id)).length}/{selected.length} 수업 경험</span></div><p className="small">순서대로 안내하지만 아는 수업은 넘기거나 원하는 수업부터 시작할 수 있어요. 건너뛰기는 완료나 숙달로 계산하지 않아요.</p><ol className="lesson-list">{selected.map((l, i) => <li key={l.id} className={completed.has(l.id) ? 'done' : lesson?.id === l.id ? 'current' : ''}><span className="day-number">{i + 1}</span><details><summary><span>{l.title}</span><span className="day-description">{completed.has(l.id) ? '수업 경험함' : state.course.skipped.includes(l.id) ? '아는 수업으로 건너뜀' : '8턴 대화 · 변형 · 직접 답변'}</span></summary><div className="lesson-preview"><p>{l.scene}</p><p>{l.goal}</p><div className="button-row"><button className="secondary" disabled={blocked || !!active} onClick={() => onBegin(false, l.id)}>이 수업 공부</button><button className="text-button" disabled={blocked || active?.lessonId === l.id} onClick={() => onSkip(l.id)}>{state.course.skipped.includes(l.id) ? '건너뛰기 되돌리기' : '아는 수업 건너뛰기'}</button></div></div></details></li>)}</ol></section>
  </>
}

export function CourseRecord({ state, now }: { state: State; now: Date }) {
  const done = new Set(state.course.completions.map(c => c.lessonId))
  return <section className="word-record-section"><h2>설명·응용 수업과 회상</h2><p className="small">{done.size}개 수업 경험 · {state.course.skipped.length}개 건너뜀 · {dueCourseKeys(state, now).length}개 회상 대기. 수업 경험과 실제 회상 확인은 별도예요.</p><ul className="phrase-records">{courseLessons.filter(l => done.has(l.id) || state.course.skipped.includes(l.id)).map(l => <li key={l.id}><h3>{l.title}</h3><p>{state.course.skipped.includes(l.id) && !done.has(l.id) ? '건너뜀 · 회상 확인 없음' : '수업 경험함'}</p>{l.recalls.map((q, i) => { const r = state.course.reviews[`${l.id}:${i}`]; return r && <div className="course-review-record" key={i}><p>{q.prompt}</p><span>{r.lastOutcome === 'unconfirmed' ? '수업 후 회상 확인 전' : r.lastOutcome === 'needsPractice' ? '다시 연습할 부분' : '힌트 없이 회상 · 내 확인'} · 다음 {r.due} · {r.successes}회 내 확인</span></div> })}</li>)}</ul></section>
}
