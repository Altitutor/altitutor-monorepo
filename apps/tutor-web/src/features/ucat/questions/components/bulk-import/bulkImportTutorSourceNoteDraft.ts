const BULK_IMPORT_TUTOR_SOURCE_NOTE_SESSION_KEY =
  'altitutor:tutor-web:ucat-bulk-import:tutor-source-note'

export function readBulkImportTutorSourceNoteDraft(): string {
  if (typeof window === 'undefined') return ''

  try {
    return window.sessionStorage.getItem(BULK_IMPORT_TUTOR_SOURCE_NOTE_SESSION_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeBulkImportTutorSourceNoteDraft(value: string): void {
  if (typeof window === 'undefined') return

  try {
    if (value.length === 0) {
      window.sessionStorage.removeItem(BULK_IMPORT_TUTOR_SOURCE_NOTE_SESSION_KEY)
      return
    }
    window.sessionStorage.setItem(BULK_IMPORT_TUTOR_SOURCE_NOTE_SESSION_KEY, value)
  } catch {
    // Session storage can be unavailable in privacy-restricted browser contexts.
  }
}
