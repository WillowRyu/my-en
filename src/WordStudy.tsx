import { useState } from 'react'
import { matchesWord, phraseById, phraseWordIds, shuffledIndices, wordById } from './content'
import { wordSteps, type Session, type WordAttempt, type WordStudy as WordProgress } from './model'
import { ListenButton } from './Media'
import { Icon } from './icons'

type Patch = Partial<Pick<WordProgress, 'heard' | 'hints' | 'revealed' | 'input'>>
export function WordStudy({ session, onPatch, onAnswer, onSkip, onPause }: {
  session: Session; onPatch: (patch: Patch) => void; onAnswer: (outcome: WordAttempt['outcome']) => void
  onSkip: () => void; onPause: () => void
}) {
  return <WordContent key={`${session.id}:${session.wordStudy!.wordIndex}:${session.wordStudy!.step}`} session={session} onPatch={onPatch} onAnswer={onAnswer} onSkip={onSkip} onPause={onPause} />
}
function WordContent({ session, onPatch, onAnswer, onSkip, onPause }: {
  session: Session; onPatch: (patch: Patch) => void; onAnswer: (outcome: WordAttempt['outcome']) => void
  onSkip: () => void; onPause: () => void
}) {
  const w = session.wordStudy!, word = wordById[w.wordIds[w.wordIndex]]
  const relatedId = session.phraseIds.find(id => phraseWordIds[id]?.includes(word.id)) ?? word.examplePhraseId
  const example = phraseById[relatedId]
  const [message, setMessage] = useState('')
  const sequence = wordSteps(w)
  const check = () => {
    const correct = matchesWord(w.input, word)
    onAnswer(correct ? 'correct' : 'incorrect')
    if (!correct) setMessage(`아직 조금 달라요. ${word.explanation} 첫 글자 힌트나 단어 다시 보기를 사용해도 좋아요.`)
  }
  return <section className="study word-study">
    <div className="study-top"><span>문장에 쓰는 작은 단어 · {w.wordIndex + 1}/{w.wordIds.length}</span><button className="text-button" onClick={onPause}>잠깐 쉬기</button></div>
    <ol className="step-list word-steps" aria-label="단어 학습 단계">{sequence.map((step, i) => <li key={step} className={w.step === step ? 'active' : sequence.indexOf(w.step) > i ? 'past' : ''} aria-current={w.step === step ? 'step' : undefined}><span>{i + 1}</span>{step === 'learn' ? '뜻과 소리' : step === 'meaning' ? '영어에서 뜻' : '뜻에서 영어'}</li>)}</ol>
    <div className="study-content">
      {w.step === 'learn' && <>
        <h1 tabIndex={-1}>이 단어부터 만나 볼까요?</h1><p className="instruction">글로 뜻을 확인하고, 짧은 문장에 써 볼 거예요. 소리 듣기는 선택이에요.</p>
        <div className="phrase-display"><span lang="en">{word.en}</span><p>{word.ko}</p></div>
        <div className="study-actions"><button className="primary" onClick={() => onAnswer(w.heard ? 'heard' : 'skipped')}>단어 뜻 확인하기<Icon name="arrow" /></button></div>
        <ListenButton phrase={word} onHeard={() => onPatch({ heard: true })} />
        <p className="word-explanation">{word.explanation}</p>
        <div className="word-example"><span lang="en">{example.en}</span><p>{example.ko}</p><small>이 표현에서 다시 만나요.</small></div>

      </>}
      {w.step === 'meaning' && <>
        <h1 tabIndex={-1}>이 단어는 어떤 뜻인가요?</h1><p className="english-inline" lang="en">{word.en}</p><ListenButton phrase={word} />
        <div className="choices">{shuffledIndices(word.choices.length, word.id + session.id).map(i => <button key={i} className="choice" onClick={() => {
          onAnswer(i === 0 ? 'correct' : 'incorrect')
          if (i !== 0) setMessage(`뜻이 조금 달라요. ${word.explanation} 다시 골라 보세요.`)
        }}>{word.choices[i]}<span aria-hidden="true">›</span></button>)}</div>
        <button className="text-button" onClick={() => onPatch({ revealed: true, hints: w.hints + 1 })}>단어 뜻 힌트 보기</button>
        {w.revealed && <p className="word-explanation">{word.ko}. {word.explanation} 힌트를 사용한 연습으로 기록해요.</p>}
      </>}
      {w.step === 'produce' && <>
        <h1 tabIndex={-1}>뜻을 보고 영어를 떠올려요.</h1><p className="instruction">짧은 단어 하나를 써 보세요. 대소문자는 달라도 괜찮아요.</p>
        <div className="recall-prompt">{word.ko}</div>
        <form className="word-answer" onSubmit={e => { e.preventDefault(); if (w.input.trim()) check() }}>
          <label className="field-label" htmlFor="word-answer">영어 단어</label>
          <input id="word-answer" lang="en" value={w.input} onChange={e => onPatch({ input: e.target.value.slice(0, 80) })} autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} />
          <button className="primary" disabled={!w.input.trim()} type="submit">단어 확인<Icon name="check" /></button>
        </form>
        <div className="hint-row"><button className="text-button" onClick={() => { onPatch({ hints: w.hints + 1 }); setMessage('') }}>첫 글자 힌트</button><button className="text-button" onClick={() => onPatch({ revealed: true, hints: w.hints + 1 })}>단어 다시 보기</button></div>
        {w.hints > 0 && !w.revealed && <p className="word-explanation">첫 글자는 {word.en[0]}예요. 힌트를 사용한 연습으로 기록해요.</p>}
        {w.revealed && <div className="recall-answer"><p lang="en" className="english-inline">{word.en}</p><ListenButton phrase={word} /><p>{word.explanation} 보고 다시 써도 괜찮아요. 다음에 다시 확인할게요.</p></div>}
      </>}
      {message && <p className="notice" role="status">{message}</p>}
    </div>
    <p className="study-footer">단어 진도와 쓴 내용도 자동 저장해요. 다음에는 영어 표현으로 이어집니다.</p>
    <button className="text-button" onClick={onSkip}>남은 단어는 다음에, 문장으로 가기</button>
  </section>
}
