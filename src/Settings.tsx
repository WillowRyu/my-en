import { useState, type ChangeEvent } from 'react'
import { emptyState, type State } from './model'
import { MIGRATION_KEY, V2_MIGRATION_KEY, STORAGE_KEY, parseState } from './storage'
import { Icon } from './icons'

export function Settings({ state, blocked, offline, onExport, onRestore, onSettings, onReset, onRecover }: {
  state: State; blocked: boolean; offline: { ready: boolean; online: boolean; error: string }
  onExport: () => void; onRestore: (s: State) => boolean; onSettings: (s: State['settings']) => boolean; onReset: () => boolean; onRecover: () => boolean
}) {
  const [pending, setPending] = useState<State | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [reset, setReset] = useState(false)
  const [wordLimit, setWordLimit] = useState(state.settings.newWordsPerDay)
  const [intervals, setIntervals] = useState(state.settings.intervals.join(', '))
  const read = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setError(''); setPending(null)
    if (file.size > 8_000_000) { setError('8MB 이하의 my-en 백업을 선택해 주세요.'); return }
    try { setPending(parseState(await file.text())) } catch (e) { setError(e instanceof Error ? e.message : '파일을 읽지 못했습니다.') }
  }
  const exportOriginal = (migration: false | 'v1' | 'v2' = false) => {
    try {
      const raw = localStorage.getItem(migration === 'v2' ? V2_MIGRATION_KEY : migration === 'v1' ? MIGRATION_KEY : STORAGE_KEY)
      if (!raw) { setError('보존된 원본이 없습니다.'); return }
      const url = URL.createObjectURL(new Blob([raw], { type: 'text/plain' })), a = document.createElement('a')
      a.href = url; a.download = migration ? `my-en-before-update-${migration}.json` : 'my-en-preserved-record.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('브라우저 저장소를 읽지 못했습니다.') }
  }
  return <><header className="page-heading"><h1 tabIndex={-1}>설정과 백업</h1><p>내 기기에 남는 기록, 안전하게 간직해요.</p></header>
    <section className="settings-section"><h2>진도 백업</h2><p>기록은 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우거나 다른 기기로 바꿀 때를 대비해 백업해 주세요. 녹음 파일은 백업에 포함되지 않아요.</p><div className="button-row"><button className="secondary" onClick={() => { onExport(); setInfo('백업 파일 다운로드를 시작했습니다.') }}><Icon name="download" />백업 내려받기</button><label className="secondary file-input">백업 가져오기<input type="file" accept=".json,application/json" onChange={e => void read(e)} /></label></div>
      {pending && <div className="confirm-box" role="region" aria-label="백업 복원 확인"><h3>이 백업으로 바꿀까요?</h3><p>기초 수업·연습 {pending.completions.length}회, 설명·응용 수업 {pending.course.completions.length}회, 문장 시도 {pending.attempts.length + pending.course.attempts.length}개가 들어 있어요. 현재 기록 대신 복원합니다. 현재 기록은 먼저 백업해 두세요.</p><div className="button-row"><button className="secondary" onClick={onExport}>현재 기록 먼저 백업</button><button className="primary" onClick={() => { setInfo(''); if (onRestore(pending)) { setPending(null); setIntervals(pending.settings.intervals.join(', ')); setWordLimit(pending.settings.newWordsPerDay); setError(''); setInfo('백업을 복원하고 저장했습니다. 오늘 공부에서 이어갈 수 있어요.') } else setError('복원 내용을 저장하지 못했습니다. 화면을 닫기 전에 백업을 내려받거나 저장소를 확인한 뒤 다시 복원해 주세요.') }}>이 백업으로 복원</button><button className="text-button" onClick={() => setPending(null)}>취소</button></div></div>}
      <div className="recovery-row"><button className="text-button" onClick={() => { setInfo(''); if (onRecover()) setError('') }}>직전 저장본 복구</button>{blocked && <button className="text-button" onClick={() => exportOriginal()}>읽지 못한 원본 내려받기</button>}<button className="text-button" onClick={() => exportOriginal('v1')}>업데이트 전 원본 내려받기</button><button className="text-button" onClick={() => exportOriginal('v2')}>단어·표현 v2 원본 내려받기</button><p className="small">자동 저장 직전의 기록 한 개를 보관합니다. 처음 업데이트할 때 이전 형식의 원본도 따로 남깁니다. 기기 밖 백업을 대신하지는 않아요.</p></div>
    </section>
    <section className="settings-section"><h2>하루에 만나는 새 단어</h2><p>시작 설정은 2개예요. 1~3개 중 편한 양으로 바꿀 수 있어요. 이미 배운 단어 복습은 정규 공부에서 최대 2개, 짧은 공부에서 최대 1개를 함께 확인해요. 처음에는 적게 시작하고, 부담에 맞게 조절하세요.</p><label className="field-label" htmlFor="word-limit">새 단어 수</label><div className="button-row"><select id="word-limit" value={wordLimit} disabled={blocked} onChange={e => setWordLimit(Number(e.target.value))}>{[1, 2, 3].map(n => <option key={n} value={n}>{n}개</option>)}</select><button className="secondary" disabled={blocked} onClick={() => { setInfo(''); if (onSettings({ ...state.settings, newWordsPerDay: wordLimit })) { setError(''); setInfo('하루 새 단어 수를 저장했습니다. 다음 공부부터 적용해요.') } else setError('새 단어 수를 저장하지 못했습니다.') }}>단어 수 저장</button></div><p className="small">5분 공부에서는 하루 설정 안에서 새 단어 최대 1개만 만나요. 같은 날 여러 번 공부해도 하루 새 단어 수는 늘어나지 않아요. 진행 중인 공부의 수량은 바꾸지 않아요.</p></section>
    <section className="settings-section"><h2>복습 간격</h2><p>처음 규칙은 1, 3, 7, 14일이에요. 예약일 이후 다른 날에 정답·힌트 없는 회상을 확인하면 다음 간격으로 넘어갑니다. 같은 날 반복이나 예약일 전 재연습은 간격을 늘리지 않아요. 어려웠던 표현은 다음 날 다시 만나요. 따라 말하기는 스스로 확인한 연습으로만 기록해요.</p><label className="field-label" htmlFor="intervals">간격 4개 (일)</label><div className="button-row"><input id="intervals" value={intervals} onChange={e => setIntervals(e.target.value)} inputMode="text" placeholder="1, 3, 7, 14" disabled={blocked} /><button className="secondary" disabled={blocked} onClick={() => {
        const ns = intervals.split(',').map(n => Number(n.trim()))
        if (ns.length !== 4 || ns.some((n, i) => !Number.isInteger(n) || n < 1 || n > 90 || (i > 0 && n <= ns[i - 1]))) { setError('1~90 사이의 정수 4개를 작은 순서대로, 쉼표로 구분해 주세요.'); return }
        setInfo(''); if (onSettings({ ...state.settings, intervals: ns })) { setError(''); setInfo('복습 간격을 저장했습니다. 다음 연습부터 적용합니다.') } else setError('복습 간격을 저장하지 못했습니다.')
      }}>간격 저장</button></div><p className="small">최적 간격을 보장하는 규칙이 아닙니다. 이미 예약된 복습 날짜는 유지하며 다음 연습부터 적용해요. 설명·응용 수업의 첫 회상은 두 번째 간격(기본 3일) 뒤에 예약하며, 어려웠던 회상은 첫 간격으로 다시 확인해요.</p>
      <p className="small">날짜 기준: {state.settings.timeZone}. 자정을 넘겨 마친 공부는 완료한 날에 기록해요.</p>{Intl.DateTimeFormat().resolvedOptions().timeZone !== state.settings.timeZone && <button className="text-button" disabled={blocked} onClick={() => { setInfo(''); if (onSettings({ ...state.settings, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })) { setError(''); setInfo('현재 기기의 시간대로 바꿨습니다. 예약된 날짜 표기는 유지됩니다.') } else setError('시간대를 저장하지 못했습니다.') }}>현재 기기의 시간대로 바꾸기</button>}
    </section>
    <section className="settings-section"><h2>소리와 오프라인</h2><p>{offline.ready ? '이 버전의 화면과 표현·단어 모범 음성을 모두 저장했습니다. 인터넷 없이 다시 열고 공부할 수 있어요.' : '온라인에서 앱을 한 번 열어 화면과 모범 음성을 모두 저장한 뒤, “오프라인 준비됨” 표시를 확인해 주세요. 아직 다운로드되지 않은 음성은 오프라인에서 들을 수 없어요.'}</p><p>휴대폰에서는 소리 크기를 확인하고 듣기 버튼을 눌러 주세요. 녹음은 마이크 권한과 지원되는 브라우저가 필요해요. iPhone은 Safari에서 공유 → 홈 화면에 추가로 설치할 수 있어요. 다른 지원 브라우저는 메뉴의 앱 설치를 사용하세요.</p><p className="small">Mac 시스템 음성으로 만든 개인 학습용 합성 음성이에요. 공개 배포 전에 음성 자산을 교체해야 합니다. 음성이 실패하면 다시 듣기나 소리 없이 보기로 계속할 수 있어요.</p></section>
    <section className="settings-section"><h2>개인정보</h2><p>로그인, 분석 추적, 외부 AI 호출이 없습니다. 녹음은 브라우저 메모리에만 잠깐 남고 단계 이동·새로고침 시 지웁니다. 음성 인식이나 자동 발음 평가는 사용하지 않아요.</p></section>
    <section className="settings-section"><h2>다시 시작하기</h2><p>이 브라우저의 진도를 비웁니다. 먼저 백업을 내려받아 두세요.</p>{!reset ? <button className="text-button danger" onClick={() => setReset(true)}>진도 초기화 열기</button> : <div className="confirm-box"><h3>현재 진도를 비울까요?</h3><p>기초 수업·연습 {state.completions.length}회, 설명·응용 수업 {state.course.completions.length}회와 각 시도·단어 기록이 초기화됩니다. 다운로드한 백업은 다시 가져올 수 있어요.</p><div className="button-row"><button className="secondary" onClick={onExport}>먼저 백업 내려받기</button><button className="secondary danger" onClick={() => { setInfo(''); if (onReset()) { setReset(false); setIntervals(emptyState().settings.intervals.join(', ')); setWordLimit(2); setError(''); setInfo('진도를 초기화하고 저장했습니다. 직전 저장본 복구도 가능합니다.') } else setError('초기화 내용을 저장하지 못했습니다. 화면을 닫기 전에 백업을 내려받아 주세요.') }}>진도 비우기 확인</button><button className="text-button" onClick={() => setReset(false)}>취소</button></div></div>}</section>
    {error && <p className="notice" role="alert">{error}</p>}{info && <p className="success" role="status">{info}</p>}
  </>
}
