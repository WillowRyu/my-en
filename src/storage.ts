import { emptyState, stateSchema, type State } from './model'

export const STORAGE_KEY = 'my-en:progress:v1'
export const BACKUP_KEY = 'my-en:previous:v1'
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export function parseState(raw: string): State {
  if (raw.length > 8_000_000) throw new Error('파일이 너무 큽니다. 8MB 이하의 my-en 백업을 선택해 주세요.')
  const parsed: unknown = JSON.parse(raw)
  const result = stateSchema.safeParse(parsed)
  if (!result.success) throw new Error('호환되는 my-en 백업이 아닙니다. 현재 기록은 그대로 보존했습니다.')
  return result.data
}
export function load(storage: StorageLike): { state: State; warning: string; blocked: boolean } {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return { state: emptyState(), warning: '', blocked: false }
    try { return { state: parseState(raw), warning: '', blocked: false } }
    catch { return { state: emptyState(), warning: '저장 기록을 읽지 못했습니다. 원본을 보존했습니다. 설정에서 이전 저장본을 복구하거나 백업을 가져와 주세요.', blocked: true } }
  } catch { return { state: emptyState(), warning: '브라우저 저장소를 사용할 수 없습니다. 이 화면에서는 공부할 수 있지만, 닫으면 기록이 사라집니다. 설정에서 백업을 내려받아 주세요.', blocked: false } }
}
export function save(storage: StorageLike, state: State, preserveBackup = false): string {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    // Never replace the recovery backup with invalid or incompatible bytes.
    if (raw && !preserveBackup) { try { parseState(raw); storage.setItem(BACKUP_KEY, raw) } catch { /* corrupt original is left intact until explicit recovery */ } }
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return ''
  } catch { return '기록을 브라우저에 저장하지 못했습니다. 공부는 계속할 수 있습니다. 화면을 닫기 전에 설정에서 백업을 내려받아 주세요.' }
}
export function exportData(state: State): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url; a.download = `my-en-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
