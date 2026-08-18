import {
  readBulkImportTutorSourceNoteDraft,
  writeBulkImportTutorSourceNoteDraft,
} from '../bulkImportTutorSourceNoteDraft'

describe('bulk-import tutor source note draft', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('keeps a note in the current browser-tab session', () => {
    writeBulkImportTutorSourceNoteDraft('Official mock 3')

    expect(readBulkImportTutorSourceNoteDraft()).toBe('Official mock 3')
  })

  it('removes an empty note instead of persisting it', () => {
    writeBulkImportTutorSourceNoteDraft('Official mock 3')
    writeBulkImportTutorSourceNoteDraft('')

    expect(readBulkImportTutorSourceNoteDraft()).toBe('')
  })
})
