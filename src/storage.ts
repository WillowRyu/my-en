import { emptyState, migrateLegacy, migrateV2, stateSchema, type State } from './model'

export const STORAGE_KEY = 'my-en:progress:v1'
export const BACKUP_KEY = 'my-en:previous:v1'
export const MIGRATION_KEY = 'my-en:migration:v1'
export const V2_MIGRATION_KEY = 'my-en:migration:v2'
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export function parseState(raw: string): State {
  if (raw.length > 8_000_000) throw new Error('파일이 너무 큽니다. 8MB 이하의 my-en 백업을 선택해 주세요.')
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed && parsed.schemaVersion === 1) {
    try { return migrateLegacy(parsed) } catch { throw new Error('이전 기록을 이관하지 못했습니다. 원본은 그대로 보존했습니다.') }
  }
  if (typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed && parsed.schemaVersion === 2) {
    try { return migrateV2(parsed) } catch { throw new Error('이전 단어·표현 기록을 이관하지 못했습니다. 원본은 그대로 보존했습니다.') }
  }
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
export interface SaveResult { saved: boolean; warning: string; backupSaved: boolean }
export function save(storage: StorageLike, state: State, preserveBackup = false): SaveResult {
  let backupSaved = true
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw) {
      let oldVersion = 0
      try { const version = JSON.parse(raw).schemaVersion; if ([1, 2].includes(version) && parseState(raw)) oldVersion = version } catch { /* Unsupported bytes are not migrated. */ }
      const archiveKey = oldVersion === 2 ? V2_MIGRATION_KEY : MIGRATION_KEY
      if (oldVersion && !storage.getItem(archiveKey)) {
        try { storage.setItem(archiveKey, raw) }
        catch { return { saved: false, backupSaved: false, warning: '업데이트 전 원본을 보관하지 못해 새 형식 저장을 중단했습니다. 설정에서 백업을 내려받고 브라우저 저장 공간을 확인해 주세요.' } }
      }
    }
    if (raw && !preserveBackup) {
      let valid = false
      try { parseState(raw); valid = true } catch { /* Preserve incompatible recovery bytes until explicit recovery. */ }
      if (valid) { try { storage.setItem(BACKUP_KEY, raw) } catch { backupSaved = false } }
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return { saved: true, backupSaved, warning: backupSaved ? '' : '진도는 저장했지만 직전 저장본을 보관하지 못했습니다. 설정에서 기기 밖 백업을 내려받아 주세요.' }
  } catch { return { saved: false, backupSaved, warning: '기록을 브라우저에 저장하지 못했습니다. 화면을 닫으면 이번 변경이 사라집니다. 닫기 전에 설정에서 백업을 내려받아 주세요.' } }
}
export function exportData(state: State): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url; a.download = `my-en-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
