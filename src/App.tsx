import { useEffect, useRef, useState } from 'react'
import { lessons, phraseById, phrases } from './content'
import { answer, completedLessons, dayKey, duePhrases, emptyState, patchSession, plan, skillNames, startSession, type Attempt, type Mode, type State } from './model'
import { BACKUP_KEY, STORAGE_KEY, exportData, load, parseState, save } from './storage'
import { useOffline } from './pwa'
import { Icon } from './icons'
import { Study } from './Study'
import { Settings } from './Settings'

type Route = 'today' | 'study' | 'record' | 'settings' | 'complete'
const route = (): Route => ['study', 'record', 'settings', 'complete'].includes(location.hash.slice(1)) ? location.hash.slice(1) as Route : 'today'
export default function App() {
  const [initial] = useState(() => { try { return load(localStorage) } catch { return { state: emptyState(), warning: '이 브라우저에서는 기록을 저장할 수 없습니다. 설정에서 백업을 내려받아 주세요.', blocked: false } } })
  const [state, setState] = useState(initial.state)
  const current = useRef(initial.state)
  const [warning, setWarning] = useState(initial.warning)
  const [blocked, setBlocked] = useState(initial.blocked)
  const blockedRef = useRef(initial.blocked)
  const [page, setPage] = useState<Route>(route)
  const [now, setNow] = useState(new Date())
  const offline = useOffline()
  const navigate = (to: Route) => { location.hash = to }
  const update = (fn: (s: State) => State, explicitRecovery = false) => {
    if (blockedRef.current && !explicitRecovery) return
    const next = fn(current.current)
    if (next === current.current) return
    current.current = next; setState(next)
    try { setWarning(save(localStorage, next, explicitRecovery && blockedRef.current)) }
    catch { setWarning('진도를 저장하지 못했습니다. 설정에서 백업을 내려받아 주세요.') }
    if (explicitRecovery) { blockedRef.current = false; setBlocked(false) }
  }
  useEffect(() => {
    const changed = () => setPage(route())
    const refresh = () => setNow(new Date())
    const sync = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      try {
        const next = e.newValue ? parseState(e.newValue) : emptyState()
        current.current = next; setState(next); setWarning('다른 탭에서 바뀐 기록을 반영했습니다. 이어하기로 계속해 주세요.')
        blockedRef.current = false; setBlocked(false); location.hash = 'today'
      } catch { blockedRef.current = true; setBlocked(true); setWarning('다른 탭의 저장 기록을 읽지 못했습니다. 설정에서 백업을 복구해 주세요.') }
    }
    window.addEventListener('hashchange', changed); window.addEventListener('storage', sync); window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const timer = setInterval(refresh, 30000)
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('storage', sync); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); clearInterval(timer) }
  }, [])
  useEffect(() => {
    document.querySelector<HTMLElement>('main h1')?.focus()
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [page, state.active?.step, state.active?.phraseIndex])
  const begin = (mode: Mode, reviewOnly = false) => {
    if (blockedRef.current) { navigate('settings'); return }
    update(s => startSession(s, mode, new Date(), crypto.randomUUID(), reviewOnly)); navigate('study')
  }
  const respond = (outcome: Attempt['outcome']) => {
    const previous = current.current.active
    update(s => answer(s, outcome, new Date()))
    if (previous && !current.current.active) navigate('complete')
  }
  const done = completedLessons(state)
  const due = duePhrases(state, now)
  const nextPlan = plan(state, 'normal', now)
  const lesson = lessons.find(l => l.id === (state.active?.lessonId ?? nextPlan.lessonId))
  const todayCompleted = state.completions.some(c => c.day === dayKey(now, state.settings.timeZone))
  return <div className="app-shell">
    <a className="skip-link" href="#main">본문으로 건너뛰기</a>
    <aside className="sidebar">
      <a href="#today" className="brand" aria-label="my-en 오늘"><img src="/icon.svg" alt="" /><span>my-en<small>나의 작은 영어 습관</small></span></a>
      <nav aria-label="주 메뉴">
        <a href="#today" aria-current={['today', 'study', 'complete'].includes(page) ? 'page' : undefined}><Icon name="home" /><span>오늘 공부</span></a>
        <a href="#record" aria-current={page === 'record' ? 'page' : undefined}><Icon name="book" /><span>나의 기록</span></a>
        <a href="#settings" aria-current={page === 'settings' ? 'page' : undefined}><Icon name="settings" /><span>설정과 백업</span></a>
      </nav>
      <div className="sidebar-note"><p>조금씩, 내 속도로.</p><span>쉬어 가도 괜찮아요.<br />다시 누르면 이어집니다.</span></div>
    </aside>
    <main id="main" tabIndex={-1}>
      <div className="topline"><span>{new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: state.settings.timeZone }).format(now)}</span><span className={`connection ${offline.ready ? 'ready' : ''}`}>{!offline.online ? '오프라인' : offline.ready ? '오프라인 준비됨' : import.meta.env.DEV ? '개발 미리보기' : '오프라인 준비 중'}</span></div>
      {(warning || offline.error || (!offline.online && !offline.ready)) && <div className="notice" role="alert">{warning || offline.error || '아직 저장되지 않은 음성은 오프라인에서 재생되지 않을 수 있습니다. 소리 없이 계속하거나 연결 후 다시 시도해 주세요.'}{blocked && <button className="text-button" onClick={() => navigate('settings')}>복구 화면 열기</button>}</div>}
      {page === 'study' && state.active ? <Study session={state.active} attempts={state.attempts} onPatch={patch => update(s => patchSession(s, patch))} onAnswer={respond} onPause={() => navigate('today')} /> : page === 'settings' ? <Settings state={state} blocked={blocked} offline={offline} onExport={() => exportData(current.current)} onRestore={next => update(() => next, true)} onSettings={settings => update(s => ({ ...s, settings }))} onReset={() => update(() => emptyState(state.settings.timeZone), true)} onRecover={() => {
        try { const raw = localStorage.getItem(BACKUP_KEY); if (!raw) throw new Error('이전 저장본이 없습니다. 내려받은 백업을 가져와 주세요.'); update(() => parseState(raw), true) }
        catch (e) { setWarning(e instanceof Error ? e.message : '이전 저장본을 읽지 못했습니다.') }
      }} /> : page === 'record' ? <Record state={state} now={now} onBegin={() => begin('normal', true)} /> : page === 'complete' && state.completions.length ? <Complete state={state} onHome={() => navigate('today')} /> : <>
        <header className="home-heading"><span className="greeting"><Icon name="sun" />나를 위한 작은 시간</span><h1 tabIndex={-1}>{state.active ? '하던 곳부터 이어 가요.' : todayCompleted ? '오늘의 한 걸음, 잘 마쳤어요.' : '오늘은 영어 한마디부터.'}</h1><p>무엇을 공부할지 고민하지 않아도 돼요.<br className="mobile-break" /> 버튼을 누르면 한 단계씩 안내할게요.</p></header>
        <section className="today-lesson" aria-labelledby="today-title">
          <div className="lesson-copy"><span className="lesson-label">{state.active ? '진행 중인 공부' : lesson ? `${lesson.day}일차 · 새 표현 ${lesson.newPhraseIds.length}개` : '익숙한 표현 다시 만나기'}</span><h2 id="today-title">{lesson?.title ?? '기억을 깨우는 작은 복습'}</h2><p>{lesson?.goal ?? '오늘은 아는 표현을 듣고, 다시 떠올려 보세요.'}</p>
            <div className="lesson-meta"><Icon name="clock" /><span>{state.active ? `표현 ${state.active.phraseIndex + 1}/${state.active.phraseIds.length}에서 이어서` : `표현 ${nextPlan.phraseIds.length}개 · 내 속도로`}<small>짧게 끝나도 충분해요.</small></span></div>
            <button className="primary start-button" onClick={() => begin(state.active?.mode ?? 'normal')} disabled={blocked}>{state.active ? '이어서 공부하기' : todayCompleted ? '오늘 표현 다시 연습' : '오늘 공부 시작'}<Icon name="arrow" /></button>
            <span className="microcopy">듣기부터 시작해요. 녹음은 선택이에요.</span>
          </div>
          <div className="lesson-art" aria-hidden="true"><div className="speech-card">Hello.<span>안녕하세요.</span><div className="sound-bars">{[12, 25, 40, 28, 50, 35, 18].map((h, i) => <i key={i} style={{ height: h }} />)}</div></div><span className="art-caption">한마디가 시작이니까.</span></div>
        </section>
        <div className="home-secondary">
          <section className="quick-mode"><div className="round-icon"><Icon name="clock" /></div><div><h2>오늘 조금 바쁘다면</h2><p>표현 2개만, 약 5분. 여기까지만 해도 좋아요.</p></div><button className="secondary" onClick={() => begin('quick')} disabled={blocked || !!state.active}>5분만 공부하기</button>{state.active && <p className="small">진행 중인 공부를 마친 뒤 선택할 수 있어요.</p>}</section>
          <section className="review-line"><div><h2><Icon name="repeat" />다시 만날 표현</h2><p>{due.length ? `${due.length}개가 기다려요. 한 번에 최대 3개만.` : '지금 복습할 표현은 없어요.'}</p></div><button className="text-button" onClick={() => begin('normal', true)} disabled={!due.length || blocked || !!state.active}>복습 시작</button></section>
        </div>
        <section className="journey" aria-labelledby="journey-title"><div className="section-heading"><h2 id="journey-title">처음 7일의 작은 여정</h2><span>{done.size}/7 수업 경험</span></div><p className="small">여행과 일상을 가정한 첫 코스예요. 순서대로 자동 안내합니다.</p><ol className="lesson-list">{lessons.map(l => <li key={l.id} className={done.has(`${l.id}@${l.version}`) ? 'done' : lesson?.id === l.id ? 'current' : ''}><span className="day-number">{done.has(`${l.id}@${l.version}`) ? <Icon name="check" /> : l.day}</span><details><summary><span>{l.title}</span><span className="day-description">{l.newPhraseIds.length}개 표현{done.has(`${l.id}@${l.version}`) ? ' · 수업 경험함' : lesson?.id === l.id ? ' · 이번 수업' : ''}</span></summary><div className="lesson-preview"><p>{l.scene}</p>{l.newPhraseIds.map(id => <p key={id}><span lang="en">{phraseById[id].en}</span><br />{phraseById[id].ko}</p>)}</div></details></li>)}</ol></section>
        <p className="gentle-note">못 온 날은 그냥 쉬었던 날이에요. 밀린 숙제도, 벌점도 없어요.</p>
      </>}
    </main>
  </div>
}

function Record({ state, now, onBegin }: { state: State; now: Date; onBegin: () => void }) {
  const learned = phrases.filter(p => Object.values(state.reviews).some(r => r.phraseId === p.id))
  const due = duePhrases(state, now)
  return <><header className="page-heading"><h1 tabIndex={-1}>나의 기록</h1><p>잘 아는 부분과 더 연습할 부분을 따로 봐요.</p></header><div className="record-overview"><span><strong>{completedLessons(state).size}</strong> 경험한 수업</span><span><strong>{learned.length}</strong> 연습한 표현</span><span><strong>{due.length}</strong> 다시 만날 표현</span></div><p className="notice subtle">말하기와 회상은 내가 확인한 기록입니다. 정답 선택이나 녹음만으로 말하기 실력을 평가하지 않아요.</p>{due.length > 0 && <button className="primary" onClick={onBegin} disabled={!!state.active}>최대 3개만 복습하기<Icon name="repeat" /></button>}
      {learned.length ? <ul className="phrase-records">{learned.map(p => <li key={p.id}><h2>{p.ko}</h2><p className="english-small" lang="en">{p.en}</p><div className="skill-grid">{(Object.keys(skillNames) as (keyof typeof skillNames)[]).map(skill => {
        const r = state.reviews[`${p.id}:${skill}`]
        return <div key={skill}><span>{skillNames[skill]}</span><strong>{!r ? '아직 확인 전' : skill === 'speaking' ? '따라 말함 · 내 확인' : skill === 'recall' ? `${r.successes}회 떠올림 · 내 확인` : `${r.successes}회 뜻 확인`}</strong><small>{r ? `다음 확인 ${r.due.slice(5).replace('-', '/')} · ${r.practices}회 연습` : '다음에 확인해도 괜찮아요.'}</small></div>
      })}</div></li>)}</ul> : <section className="empty-state"><Icon name="book" /><h2>첫 한마디부터 기록이 쌓여요.</h2><p>오늘 공부를 마치면 여기에 남습니다.</p><a className="primary" href="#today">오늘 공부로 가기</a></section>}</>
}
function Complete({ state, onHome }: { state: State; onHome: () => void }) {
  const c = state.completions.at(-1)!
  const attempts = state.attempts.filter(a => a.sessionId === c.sessionId)
  const recalls = attempts.filter(a => a.step === 'recall' && a.outcome === 'remembered' && a.hints === 0).length
  return <section className="completion"><div className="completion-icon"><Icon name="check" /></div><h1 tabIndex={-1}>오늘의 한 걸음을 남겼어요.</h1><p>{c.phraseIds.length}개 표현을 만나고,<br />힌트 없이 {recalls}개를 떠올렸다고 확인했어요.</p><div className="completion-phrases">{c.phraseIds.map(id => <p key={id}>{phraseById[id].ko}<span lang="en">{phraseById[id].en}</span></p>)}</div><p className="small">{c.mode === 'quick' ? '5분 연습은 정규 수업 완료와 별도로 기록했어요.' : '수업을 마쳤다는 기록이에요. 영어를 완전히 익혔다는 뜻은 아니에요.'}<br />건너뛴 단계는 실수로 기록하지 않았어요. 복습은 적은 양으로 다시 안내할게요.</p><button className="primary" onClick={onHome}>오늘은 여기까지<Icon name="check" /></button><a className="text-button" href="#record">나의 기록 보기</a></section>
}
