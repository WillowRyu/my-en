import { useEffect, useState } from 'react'
export function useOffline() {
  const [online, setOnline] = useState(navigator.onLine)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    let alive = true
    let guard: ReturnType<typeof setTimeout> | undefined
    if (import.meta.env.PROD && navigator.serviceWorker) {
      guard = setTimeout(() => { if (alive) setError('오프라인 준비가 아직 끝나지 않았습니다. 연결을 확인하고 새로고침하거나 온라인으로 공부해 주세요.') }, 15000)
      void navigator.serviceWorker.register('/sw.js').then(async () => {
        const reg = await navigator.serviceWorker.ready
        if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
        const channel = new MessageChannel()
        channel.port1.onmessage = e => { clearTimeout(guard); if (alive) { setReady(e.data?.ready === true); setError(e.data?.ready === true ? '' : '오프라인 저장이 완전하지 않습니다. 연결된 상태에서 새로고침해 주세요.') } channel.port1.close() }
        reg.active?.postMessage({ type: 'CHECK_READY' }, [channel.port2])
      }).catch(() => { clearTimeout(guard); if (alive) setError('오프라인 준비에 실패했습니다. 연결된 상태에서 새로고침해 주세요.') })
    } else if (import.meta.env.PROD) {
      queueMicrotask(() => { if (alive) setError('이 브라우저는 오프라인 저장을 지원하지 않습니다. 연결된 상태에서 공부해 주세요.') })
    }
    return () => { alive = false; clearTimeout(guard); window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return { online, ready, error }
}
