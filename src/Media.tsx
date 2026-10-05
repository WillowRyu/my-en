import { useEffect, useRef, useState } from 'react'
import { FileAudioAdapter } from './audio'
import type { Phrase } from './content'
import { Icon } from './icons'

export function ListenButton({ phrase, onHeard }: { phrase: Phrase; onHeard?: () => void }) {
  const adapter = useRef<FileAudioAdapter | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing'>('idle')
  const [error, setError] = useState('')
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; adapter.current?.stop() } }, [])
  const play = async (slow: boolean) => {
    adapter.current ??= new FileAudioAdapter()
    setError(''); setStatus('loading')
    try {
      await adapter.current.play(phrase, slow, () => { if (alive.current) { setStatus('idle'); onHeard?.() } })
      if (alive.current) setStatus('playing')
    } catch (e) { if (alive.current) { setStatus('idle'); setError(e instanceof Error ? e.message : '다시 듣기를 눌러 주세요.') } }
  }
  return <div className="listening">
    <div className="button-row">
      <button className="audio-button" onClick={() => void play(false)} disabled={status !== 'idle'}><Icon name="volume" />{status === 'loading' ? '음성 준비 중' : status === 'playing' ? '듣는 중…' : '모범 음성 듣기'}</button>
      <button className="secondary" onClick={() => void play(true)} disabled={status !== 'idle'}>천천히 듣기</button>
      {status !== 'idle' && <button className="text-button" onClick={() => { adapter.current?.stop(); setStatus('idle') }}>재생 멈추기</button>}
    </div>
    {error && <p role="alert" className="notice">{error}</p>}
  </div>
}

export function Recorder() {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'recording' | 'recorded'>('idle')
  const [error, setError] = useState('')
  const [url, setUrl] = useState('')
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const generation = useRef(0)
  const blobUrl = useRef('')
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const stopTracks = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null }
  const discard = () => {
    generation.current++; clearTimeout(timeout.current)
    if (recorder.current?.state === 'recording') recorder.current.stop()
    recorder.current = null; stopTracks()
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
    blobUrl.current = ''; setUrl(''); setStatus('idle'); setSeconds(0)
  }
  useEffect(() => () => {
    generation.current++; clearTimeout(timeout.current)
    if (recorder.current?.state === 'recording') recorder.current.stop()
    stream.current?.getTracks().forEach(t => t.stop())
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
  }, [])
  useEffect(() => {
    if (status !== 'recording') return
    const timer = setInterval(() => setSeconds(n => n + 1), 1000)
    return () => clearInterval(timer)
  }, [status])
  const start = async () => {
    discard(); setError('')
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('이 환경에서는 녹음을 사용할 수 없습니다. 지원되는 브라우저의 HTTPS 또는 localhost에서 열거나, 녹음 없이 따라 말해 주세요.'); return
    }
    setStatus('requesting')
    const token = ++generation.current
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (token !== generation.current) { input.getTracks().forEach(t => t.stop()); return }
      stream.current = input
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t))
      const r = new MediaRecorder(input, mime ? { mimeType: mime } : undefined)
      recorder.current = r
      const chunks: BlobPart[] = []
      r.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      r.onerror = () => { if (token === generation.current) { discard(); setError('녹음 중 문제가 생겼습니다. 다시 녹음하거나 녹음 없이 말해 주세요.') } }
      r.onstop = () => {
        if (token !== generation.current) return
        stopTracks(); clearTimeout(timeout.current)
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' })
        if (!blob.size) { setStatus('idle'); setError('녹음된 소리가 없습니다. 다시 녹음하거나 건너뛰어 주세요.'); return }
        blobUrl.current = URL.createObjectURL(blob); setUrl(blobUrl.current); setStatus('recorded')
      }
      r.start(); setStatus('recording')
      timeout.current = setTimeout(() => { if (r.state === 'recording') r.stop() }, 30000)
    } catch (e) {
      if (token !== generation.current) return
      stopTracks(); setStatus('idle')
      setError(e instanceof DOMException && e.name === 'NotAllowedError'
        ? '마이크 사용이 허용되지 않았습니다. 브라우저 권한을 바꾼 뒤 다시 시도하거나, 녹음 없이 말해 주세요.'
        : '마이크를 열지 못했습니다. 다른 앱의 마이크 사용을 확인하거나, 녹음 없이 말해 주세요.')
    }
  }
  return <section className="recorder" aria-label="내 목소리 녹음">
    <p>내 목소리를 들어 볼까요? <span className="optional">선택</span></p>
    <p className="small">이 기기에서만 재생합니다. 업로드하지 않고, 이 단계를 나가면 지웁니다. 최대 30초.</p>
    <div className="button-row">
      {(status === 'idle' || status === 'recorded') && <button className="secondary" onClick={() => void start()}><Icon name="mic" />{status === 'recorded' ? '다시 녹음하기' : '녹음 시작'}</button>}
      {status === 'requesting' && <><span role="status">마이크 권한을 기다립니다.</span><button className="secondary" onClick={discard}>녹음 요청 취소</button></>}
      {status === 'recording' && <><span className="recording" role="status">녹음 중 {seconds}초</span><button className="secondary" onClick={() => recorder.current?.stop()}>녹음 끝내기</button><button className="text-button" onClick={discard}>녹음 취소</button></>}
    </div>
    {url && <><audio src={url} controls aria-label="내 녹음 재생" onError={() => setError('녹음을 재생하지 못했습니다. 다시 녹음하거나 녹음 없이 계속해 주세요.')} /><button className="text-button" onClick={discard}>내 녹음 지우기</button></>}
    {error && <p className="notice" role="alert">{error}</p>}
  </section>
}
