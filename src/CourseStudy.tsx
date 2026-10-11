import { assessCourseInput, currentCourseExercise, type CourseSession } from './course'
import { courseById } from './curriculum'
import type { State } from './model'
import { Icon } from './icons'

const stepNames = { review: '회상 복습', explain: '설명·예문', dialogue: '상황 대화', transform: '문장 변형', respond: '직접 답하기' }
export function CourseStudy({ session: a, onInput, onReveal, onSubmit, onNext, onPause }: {
  session: CourseSession; onInput: (text: string) => void; onReveal: () => void; onSubmit: (choice?: number) => void
  onNext: (decision: 'ready' | 'practice' | 'skip') => void; onPause: () => void
}) {
  const l = a.lessonId ? courseById[a.lessonId] : null
  const reviewTitle = a.step === 'review' ? courseById[a.reviewKeys[a.index].split(':')[0]].title : null
  const exercise = currentCourseExercise(a)
  const q = a.step === 'dialogue' ? l!.checks[a.index] : null
  const sequence = a.kind === 'review' ? ['review'] as const : [...(a.reviewKeys.length ? ['review' as const] : []), 'explain', 'dialogue', 'transform', 'respond'] as const
  const count = a.step === 'review' ? a.reviewKeys.length : a.step === 'transform' ? l!.transforms.length : a.step === 'respond' ? l!.responses.length : a.step === 'dialogue' ? l!.checks.length : 1
  const assessed = exercise && a.feedback ? assessCourseInput(a.input, exercise, a.step === 'respond') : null
  return <section className="study course-study"><div className="study-top"><span>{reviewTitle ?? l?.title ?? '며칠 뒤의 회상 확인'} · {stepNames[a.step]} {a.index + 1}/{count}</span><button className="text-button" onClick={onPause}>잠깐 쉬기</button></div><ol className="step-list">{sequence.map((s, i) => <li key={s} className={s === a.step ? 'active' : ''}><span>{i + 1}</span>{stepNames[s]}</li>)}</ol>
    <div className="study-content">
      {a.step === 'explain' && l && <><h1 tabIndex={-1}>{l.title}</h1><p className="instruction">{l.scene}</p><p className="small">설명 4~6분 → 대화 4~6분 → 변형·직접 답변 7~11분의 설계 목표예요. 시간 제한이나 학습효과 보장은 없어요.</p>{l.rules.map(r => <section className="grammar-note" key={r.title}><h2>{r.title}</h2><p>{r.body}</p><p className="grammar-contrast">{r.contrast}</p></section>)}<h2 className="course-subtitle">문장에서 확인하기</h2>{l.examples.map(e => <div className="course-example" key={e.en}><p lang="en">{e.en}</p><p>{e.ko}</p></div>)}<details className="course-glossary"><summary>이 수업의 단어·덩어리</summary><ul>{l.glossary.map(word => <li key={word}>{word}</li>)}</ul></details><div className="study-actions"><button className="primary" onClick={() => onNext('ready')}>대화에서 써 보기<Icon name="arrow" /></button></div></>}
      {a.step === 'dialogue' && l && q && <><h1 tabIndex={-1}>한 상황을 끝까지 읽어 봐요.</h1><p className="instruction">{l.scene} 내가 {l.dialogue[1].speaker}라면 어떻게 답할지 생각해 보세요. 소리 내어 역할을 읽는 것은 선택이에요.</p><ol className="dialogue-lines">{l.dialogue.map((t, i) => <li key={i} className={i % 2 ? 'my-turn' : ''}><span>{t.speaker}</span><p lang="en">{t.en}</p><details><summary>한국어 뜻</summary><p>{t.ko}</p></details></li>)}</ol><h2 className="course-subtitle">대화 확인 {a.index + 1}/{l.checks.length}</h2><p>{q.question}</p><div className="choices">{q.choices.map((text, i) => <button className="choice" key={text} disabled={a.feedback !== null} onClick={() => onSubmit(i)}>{text}</button>)}</div>{a.feedback && <div className="course-feedback" role="status"><p>{a.feedback === 'matched' ? '대화에서 확인했어요.' : '이 부분을 다시 읽어 봐요.'} {q.why}</p><button className="primary" onClick={() => onNext(a.feedback === 'matched' ? 'ready' : 'practice')}>다음 연습</button></div>}</>}
      {exercise && <><h1 tabIndex={-1}>{a.step === 'review' ? '문장을 가리고, 다시 떠올려요.' : a.step === 'transform' ? '같은 구조를 바꿔 써 볼까요?' : '이번에는 내 답변을 만들어요.'}</h1><p className="recall-prompt">{exercise.prompt}</p><p className="instruction">{exercise.instruction}</p><p className="small">{a.step === 'respond' ? '다른 답도 가능해요. 예문은 참고이며 자동 문법·자연스러움 평가는 하지 않아요.' : '작성된 답안 범위에서 구조를 확인해요. 다른 표현은 오답으로 단정하지 않고 직접 비교해요.'}</p><form className="course-answer" onSubmit={e => { e.preventDefault(); onSubmit() }}><label className="field-label" htmlFor="course-answer">내 영어 답변</label><textarea id="course-answer" lang="en" autoCapitalize="sentences" spellCheck={false} maxLength={2000} rows={a.step === 'respond' ? 4 : 3} value={a.input} onChange={e => onInput(e.target.value)} /><button className="primary" type="submit" disabled={!a.input.trim()}>답변 비교하기</button></form>
        <div className="hint-row"><button className="text-button" onClick={onReveal}>{a.step === 'review' ? '힌트·예문 보기' : '막힐 때 힌트·예문'}</button>{a.revealed && <div><p>{exercise.hint}</p>{exercise.samples.map(text => <p className="english-small" lang="en" key={text}>{text}</p>)}</div>}</div>
        {a.feedback && assessed && <div className="course-feedback" role="status"><h2>{a.feedback === 'matched' ? '작성된 확인 답안과 맞아요.' : a.feedback === 'commonIssue' ? '이 구조를 다시 확인해요.' : '내 답변과 예문을 비교해요.'}</h2><p>{assessed.reason}</p>{exercise.samples.map(text => <p className="english-small" lang="en" key={text}>{text}</p>)}<p>{exercise.why}</p><ul className="self-checks"><li>질문에서 요구한 의도·시간·상황을 전달했나요?</li><li>설명한 문장 구조를 내 문장에도 쓸 수 있나요?</li>{a.step === 'respond' && <li>이유나 세부 내용을 더해 두 문장 이상으로 답했나요?</li>}</ul><div className="study-actions"><button className="primary" onClick={() => onNext(a.feedback === 'commonIssue' ? 'practice' : 'ready')}>{a.feedback === 'matched' ? '확인하고 다음으로' : a.feedback === 'commonIssue' ? '설명 확인 · 다시 연습할 부분으로' : '의도와 구조를 확인했어요'}</button><button className="secondary" onClick={() => onNext('practice')}>더 연습할 부분으로 남기기</button></div><p className="small">자유 답변·회상 확인은 내 확인 기록이에요. 문법·말하기 숙달 점수는 아닙니다.</p></div>}
      </>}
      {a.step !== 'explain' && <div className="study-actions"><button className="text-button" onClick={() => onNext('skip')}>이 연습은 다음에 할게요</button></div>}
    </div><p className="study-footer">입력·힌트·단계가 자동 저장돼요. 다른 표현을 쓸 때는 의도와 구조를 직접 비교해 주세요.</p>
  </section>
}

export function CourseComplete({ state, onHome }: { state: State; onHome: () => void }) {
  const c = state.course.lastFinishedKind === 'review' ? undefined : state.course.completions.at(-1)
  const attempts = c ? state.course.attempts.filter(a => a.sessionId === c.id) : []
  const l = c ? courseById[c.lessonId] : null
  return <section className="completion"><div className="completion-icon"><Icon name="check" /></div><h1 tabIndex={-1}>{l ? '오늘의 문장 수업을 기록했어요.' : '회상 확인을 남겼어요.'}</h1><p>{l?.title ?? '필요한 문장을 나눠 확인했어요.'}</p>{l && <><p className="small">대화·응용 {attempts.filter(a => a.result !== 'skipped').length}회 확인 · 다시 연습 {attempts.filter(a => a.result === 'needsPractice' || a.hints > 0).length}개 · 건너뜀 {attempts.filter(a => a.result === 'skipped').length}개</p><div className="completion-phrases">{l.rules.map(r => <p key={r.title}>{r.title}<span>{r.contrast}</span></p>)}</div><p className="small">수업 경험을 기록했어요. 기본 3일 뒤, 문장을 가린 회상 2개로 다시 확인합니다. 회상 결과는 내 확인이며 숙달 점수가 아니에요.</p></>}<button className="primary" onClick={onHome}>오늘 공부로 돌아가기</button><a className="text-button" href="#record">나의 기록 보기</a></section>
}
