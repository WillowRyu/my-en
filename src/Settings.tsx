import { useState, type ChangeEvent } from 'react'
import { emptyState, type State } from './model'
import { STORAGE_KEY, parseState } from './storage'
import { Icon } from './icons'

export function Settings({ state, blocked, offline, onExport, onRestore, onSettings, onReset, onRecover }: {
  state: State; blocked: boolean; offline: { ready: boolean; online: boolean; error: string }
  onExport: () => void; onRestore: (s: State) => void; onSettings: (s: State['settings']) => void; onReset: () => void; onRecover: () => void
}) {
  const [pending, setPending] = useState<State | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [reset, setReset] = useState(false)
  const [intervals, setIntervals] = useState(state.settings.intervals.join(', '))
  const read = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setError(''); setPending(null)
    if (file.size > 8_000_000) { setError('8MB 이하의 my-en 백업을 선택해 주세요.'); return }
    try { setPending(parseState(await file.text())) } catch (e) { setError(e instanceof Error ? e.message : '파일을 읽지 못했습니다.') }
  }
  const exportOriginal = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) { setError('보존된 원본이 없습니다.'); return }
      const url = URL.createObjectURL(new Blob([raw], { type: 'text/plain' })), a = document.createElement('a')
      a.href = url; a.download = 'my-en-preserved-record.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('브라우저 저장소를 읽지 못했습니다.') }
  }
  return <><header className="page-heading"><h1 tabIndex={-1}>설정과 백업</h1><p>내 기기에 남는 기록, 안전하게 간직해요.</p></header>
    <section className="settings-section"><h2>진도 백업</h2><p>기록은 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우거나 다른 기기로 바꿀 때를 대비해 백업해 주세요. 녹음 파일은 백업에 포함되지 않아요.</p><div className="button-row"><button className="secondary" onClick={() => { onExport(); setInfo('백업 파일 다운로드를 시작했습니다.') }}><Icon name="download" />백업 내려받기</button><label className="secondary file-input">백업 가져오기<input type="file" accept=".json,application/json" onChange={e => void read(e)} /></label></div>
      {pending && <div className="confirm-box" role="region" aria-label="백업 복원 확인"><h3>이 백업으로 바꿀까요?</h3><p>수업·연습 {pending.completions.length}회, 시도 {pending.attempts.length}개가 들어 있어요. 현재 기록 대신 복원합니다. 현재 기록은 먼저 백업해 두세요.</p><div className="button-row"><button className="secondary" onClick={onExport}>현재 기록 먼저 백업</button><button className="primary" onClick={() => { onRestore(pending); setPending(null); setInfo('백업을 복원했습니다. 오늘 공부에서 이어갈 수 있어요.') }}>이 백업으로 복원</button><button className="text-button" onClick={() => setPending(null)}>취소</button></div></div>}
      <div className="recovery-row"><button className="text-button" onClick={onRecover}>직전 저장본 복구</button>{blocked && <button className="text-button" onClick={exportOriginal}>읽지 못한 원본 내려받기</button>}<p className="small">자동 저장 직전의 기록 한 개를 보관합니다. 기기 밖 백업을 대신하지는 않아요.</p></div>
    </section>
    <section className="settings-section"><h2>복습 간격</h2><p>처음 규칙은 1, 3, 7, 14일이에요. 정답·힌트 없는 회상 후 다음 간격으로 넘어갑니다. 어려웠던 표현은 다음 날 다시 만나요. 따라 말하기는 스스로 확인한 연습으로만 기록해요.</p><label className="field-label" htmlFor="intervals">간격 4개 (일)</label><div className="button-row"><input id="intervals" value={intervals} onChange={e => setIntervals(e.target.value)} inputMode="text" placeholder="1, 3, 7, 14" disabled={blocked} /><button className="secondary" disabled={blocked} onClick={() => {
        const ns = intervals.split(',').map(n => Number(n.trim()))
        if (ns.length !== 4 || ns.some((n, i) => !Number.isInteger(n) || n < 1 || n > 90 || (i > 0 && n <= ns[i - 1]))) { setError('1~90 사이의 정수 4개를 작은 순서대로, 쉼표로 구분해 주세요.'); return }
        onSettings({ ...state.settings, intervals: ns }); setError(''); setInfo('복습 간격을 저장했습니다. 다음 연습부터 적용합니다.')
      }}>간격 저장</button></div><p className="small">최적 간격을 보장하는 규칙이 아닙니다. 이미 예약된 복습 날짜는 유지하며 다음 연습부터 적용해요.</p>
      <p className="small">날짜 기준: {state.settings.timeZone}. 자정을 넘겨 마친 공부는 완료한 날에 기록해요.</p>{Intl.DateTimeFormat().resolvedOptions().timeZone !== state.settings.timeZone && <button className="text-button" disabled={blocked} onClick={() => { onSettings({ ...state.settings, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }); setInfo('현재 기기의 시간대로 바꿨습니다. 예약된 날짜 표기는 유지됩니다.') }}>현재 기기의 시간대로 바꾸기</button>}
    </section>
    <section className="settings-section"><h2>소리와 오프라인</h2><p>{offline.ready ? '이 버전의 화면과 15개 모범 음성을 모두 저장했습니다. 인터넷 없이 다시 열고 공부할 수 있어요.' : '온라인에서 앱을 한 번 열어 화면과 모범 음성을 모두 저장한 뒤, “오프라인 준비됨” 표시를 확인해 주세요. 아직 다운로드되지 않은 음성은 오프라인에서 들을 수 없어요.'}</p><p>휴대폰에서는 소리 크기를 확인하고 듣기 버튼을 눌러 주세요. 녹음은 마이크 권한과 지원되는 브라우저가 필요해요. iPhone은 Safari에서 공유 → 홈 화면에 추가로 설치할 수 있어요. 다른 지원 브라우저는 메뉴의 앱 설치를 사용하세요.</p><p className="small">Mac 시스템 음성으로 만든 개인 학습용 합성 음성이에요. 공개 배포 전에 음성 자산을 교체해야 합니다. 음성이 실패하면 다시 듣기나 소리 없이 보기로 계속할 수 있어요.</p></section>
    <section className="settings-section"><h2>개인정보</h2><p>로그인, 분석 추적, 외부 AI 호출이 없습니다. 녹음은 브라우저 메모리에만 잠깐 남고 단계 이동·새로고침 시 지웁니다. 음성 인식이나 자동 발음 평가는 사용하지 않아요.</p></section>
    <section className="settings-section"><h2>다시 시작하기</h2><p>이 브라우저의 진도를 비웁니다. 먼저 백업을 내려받아 두세요.</p>{!reset ? <button className="text-button danger" onClick={() => setReset(true)}>진도 초기화 열기</button> : <div className="confirm-box"><h3>현재 진도를 비울까요?</h3><p>수업·연습 {state.completions.length}회와 시도 {state.attempts.length}개가 초기화됩니다. 다운로드한 백업은 다시 가져올 수 있어요.</p><div className="button-row"><button className="secondary" onClick={onExport}>먼저 백업 내려받기</button><button className="secondary danger" onClick={() => { onReset(); setReset(false); setIntervals(emptyState().settings.intervals.join(', ')); setInfo('진도를 초기화했습니다. 직전 저장본 복구도 가능합니다.') }}>진도 비우기 확인</button><button className="text-button" onClick={() => setReset(false)}>취소</button></div></div>}</section>
    {error && <p className="notice" role="alert">{error}</p>}{info && <p className="success" role="status">{info}</p>}
  </>
}
