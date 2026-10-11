import { useState } from 'react'
import { phraseById, shuffledIndices } from './content'
import { stepsForPhrase, type Attempt, type Session } from './model'
import { ListenButton, Recorder } from './Media'
import { Icon } from './icons'

const labels = { listen: '듣기', meaning: '뜻 확인', arrange: '문장 맞추기', speak: '따라 말하기', recall: '떠올리기' }
type Patch = Partial<Pick<Session, 'heard' | 'hints' | 'revealed' | 'selectedTokens'>>
export function Study(props: { session: Session; attempts: Attempt[]; onPatch: (patch: Patch) => void; onAnswer: (outcome: Attempt['outcome']) => void; onPause: () => void }) {
  return <StudyContent key={`${props.session.id}:${props.session.phraseIndex}:${props.session.step}`} {...props} />
}
function StudyContent({ session: a, attempts, onPatch, onAnswer, onPause }: { session: Session; attempts: Attempt[]; onPatch: (patch: Patch) => void; onAnswer: (outcome: Attempt['outcome']) => void; onPause: () => void }) {
  const p = phraseById[a.phraseIds[a.phraseIndex]]
  const [message, setMessage] = useState('')
  const [hintVisible, setHintVisible] = useState(false)
  const steps = stepsForPhrase(a)
  const stepIndex = steps.indexOf(a.step)
  const counts = a.phraseIds.map((_, phraseIndex) => stepsForPhrase({ ...a, phraseIndex }).length)
  const progress = (counts.slice(0, a.phraseIndex).reduce((sum, count) => sum + count, 0) + stepIndex) / counts.reduce((sum, count) => sum + count, 0)
  const wrongAttempts = attempts.filter(t => t.sessionId === a.id && t.phraseId === p.id && t.step === a.step && t.outcome === 'incorrect').length
  const showHint = () => { onPatch({ hints: a.hints + 1 }); setHintVisible(true) }
  return <section className="study">
    <div className="study-top"><span>{a.mode === 'quick' ? '5분 연습' : a.lessonId ? '오늘의 공부' : '작은 복습'} · 표현 {a.phraseIndex + 1}/{a.phraseIds.length}</span><button className="text-button" onClick={onPause}>잠깐 쉬기</button></div>
    <div className="progress-track" role="progressbar" aria-label="이번 공부 진행" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress * 100}%` }} /></div>
    <ol className="step-list" aria-label="학습 단계">{steps.map((s, i) => <li key={s} className={i === stepIndex ? 'active' : i < stepIndex ? 'past' : ''} aria-current={s === a.step ? 'step' : undefined}><span>{i < stepIndex ? '✓' : i + 1}</span>{labels[s]}</li>)}</ol>
    {a.reviewSkills[p.id] && <p className="notice subtle">이번에는 복습할 단계만 확인해요. 다른 단계의 예약은 그대로 두어요.</p>}
    <div className="study-content">
      {a.step === 'listen' && <><h1 tabIndex={-1}>먼저, 소리를 들어 보세요.</h1><p className="instruction">{p.context}</p><div className="phrase-display"><span lang="en">{p.en}</span><p>{p.ko}</p></div><ListenButton phrase={p} onHeard={() => onPatch({ heard: true })} /><p className="small">앱에 포함된 합성 영어 음성이에요. 한 번 듣고, 뜻을 확인할게요.</p>{a.heard && <p className="success" role="status"><Icon name="check" />끝까지 들었어요. 다음으로 가 볼까요?</p>}<div className="study-actions"><button className="primary" disabled={!a.heard} onClick={() => onAnswer('heard')}>뜻 확인하기<Icon name="arrow" /></button><button className="text-button" onClick={() => onAnswer('skipped')}>소리 없이 뜻부터 보기</button></div></>}
      {a.step === 'meaning' && <><h1 tabIndex={-1}>방금 표현은 어떤 뜻일까요?</h1><p className="instruction">{a.audioSkipped ? '소리를 건너뛰었으니 문장을 보고 골라요. 듣기 확인으로는 기록하지 않아요.' : '영어 문장을 가리고, 들은 소리를 떠올려 보세요.'}</p>{a.audioSkipped && <p className="english-inline" lang="en">{p.en}</p>}{!a.audioSkipped && <ListenButton phrase={p} />}<div className="choices">{shuffledIndices(p.choices.length, p.id + a.id).map(i => <button key={i} className="choice" onClick={() => { if (i === 0) onAnswer('correct'); else { onAnswer('incorrect'); setMessage(`조금 달랐어요. ${p.context} ${p.hint} 다시 듣고 골라 보세요.`) } }}>{p.choices[i]}<span aria-hidden="true">›</span></button>)}</div><div className="hint-row"><button className="text-button" onClick={showHint}>뜻 힌트 보기</button>{hintVisible && <p>{p.context}<br />{p.hint}<br />정답은 “{p.ko}”예요.</p>}</div>{wrongAttempts > 0 && <p className="small">다시 선택해도 괜찮아요.</p>}</>}
      {a.step === 'arrange' && <><h1 tabIndex={-1}>짧은 문장을 만들어 볼까요?</h1><p className="instruction">“{p.ko}” 단어를 순서대로 눌러 주세요.</p><div className="sentence-slots" aria-label="내가 만든 문장" aria-live="polite">{a.selectedTokens.length ? a.selectedTokens.map(i => <button key={i} lang="en" onClick={() => onPatch({ selectedTokens: a.selectedTokens.filter(t => t !== i) })} aria-label={`${p.tokens[i]} 빼기`}>{p.tokens[i]}</button>) : <span>단어를 누르면 여기에 놓여요.</span>}</div><div className="word-bank">{shuffledIndices(p.tokens.length, p.id).map(i => <button key={i} lang="en" disabled={a.selectedTokens.includes(i)} onClick={() => onPatch({ selectedTokens: [...a.selectedTokens, i] })}>{p.tokens[i]}</button>)}</div><div className="hint-row"><button className="text-button" onClick={showHint}>문장 힌트 보기</button><button className="text-button" disabled={!a.selectedTokens.length} onClick={() => onPatch({ selectedTokens: [] })}>다시 놓기</button>{hintVisible && <p><span lang="en" className="english-inline">{p.en}</span><br />{p.hint}</p>}</div><button className="primary" disabled={a.selectedTokens.length !== p.tokens.length} onClick={() => { const correct = a.selectedTokens.every((v, i) => v === i); onAnswer(correct ? 'correct' : 'incorrect'); if (!correct) setMessage(`순서가 조금 달라요. ${p.hint} 힌트를 보고 다시 놓아 보세요.`) }}>문장 확인<Icon name="check" /></button></>}
      {a.step === 'speak' && <><h1 tabIndex={-1}>보고, 한 번 따라 말해요.</h1><p className="instruction">속도보다 한마디를 입으로 꺼내 보는 게 목표예요.</p><div className="phrase-display"><span lang="en">{p.en}</span><p>{p.ko}</p></div><ListenButton phrase={p} /><Recorder /><p className="small">발음 점수는 매기지 않아요. 모범 음성과 내 목소리를 비교해 보세요.</p><div className="study-actions"><button className="primary" onClick={() => onAnswer('self')}>따라 말했어요<Icon name="check" /></button><button className="text-button" onClick={() => onAnswer('skipped')}>말하기는 다음에 할게요</button></div></>}
      {a.step === 'recall' && <><h1 tabIndex={-1}>이제, 힌트 없이 떠올려요.</h1><p className="instruction">이 뜻을 영어로 어떻게 말했나요?<br />문장을 보지 않고 말하거나 마음속으로 떠올려 보세요.</p><div className="recall-prompt"><span>{p.ko}</span></div>{a.revealed && <div className="recall-answer"><p className="english-inline" lang="en">{p.en}</p><p>{p.hint}</p><p>보고 다시 연습해도 좋아요. 힌트를 사용한 회상으로 기록할게요.</p></div>}<div className="study-actions"><button className="primary" onClick={() => onAnswer('remembered')}>{a.revealed ? '보고 다시 연습했어요' : '스스로 떠올렸어요'}<Icon name="check" /></button><button className="secondary" onClick={() => onAnswer('unsure')}>아직 잘 안 떠올라요</button>{!a.revealed && <button className="text-button" onClick={() => onPatch({ revealed: true, hints: a.hints + 1 })}>표현 다시 보기</button>}<button className="text-button" onClick={() => onAnswer('skipped')}>회상은 다음에 할게요</button></div><p className="small">내가 확인한 기록이에요. 다시 연습할 표현을 고르는 데만 사용합니다.</p></>}
      {message && <p className="notice" role="status">{message}</p>}
    </div>
    <p className="study-footer">진도는 자동으로 저장해요. 쉬었다 와도 이 단계에서 이어집니다.</p>
  </section>
}
