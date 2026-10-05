import type { Phrase } from './content'

// Future providers must implement this contract. The MVP only uses same-origin files.
// No keys, speech upload, network speech recognition, or pronunciation scoring.
export interface LessonAudioAdapter {
  play(phrase: Phrase, slow: boolean, ended: () => void): Promise<void>
  stop(): void
}
export class FileAudioAdapter implements LessonAudioAdapter {
  private audio: HTMLAudioElement | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  play(phrase: Phrase, slow: boolean, ended: () => void): Promise<void> {
    this.stop()
    return new Promise((resolve, reject) => {
      const audio = new Audio(phrase.audio)
      this.audio = audio
      audio.playbackRate = slow ? 0.75 : 1
      audio.onended = () => { clearTimeout(this.timer); ended() }
      audio.onerror = () => { this.stop(); reject(new Error('음성을 불러오지 못했습니다. 연결을 확인해 다시 듣거나, 소리 없이 계속해 주세요.')) }
      audio.onplaying = () => { clearTimeout(this.timer); resolve() }
      this.timer = setTimeout(() => { this.stop(); reject(new Error('음성 재생이 늦어지고 있습니다. 다시 듣거나 소리 없이 계속해 주세요.')) }, 10000)
      audio.play().catch(() => { this.stop(); reject(new Error('음성 재생을 시작하지 못했습니다. 음량과 브라우저 설정을 확인하고 다시 눌러 주세요.')) })
    })
  }
  stop(): void {
    clearTimeout(this.timer)
    if (this.audio) { this.audio.pause(); this.audio.onended = null; this.audio.onerror = null; this.audio.onplaying = null; this.audio = null }
  }
}
