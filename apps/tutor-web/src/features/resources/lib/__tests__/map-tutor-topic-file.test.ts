import { mapTutorTopicFile } from '../map-tutor-topic-file';
import type { TutorTopicFileRow } from '../types';

function row(overrides: Partial<TutorTopicFileRow> = {}): TutorTopicFileRow {
  return {
    id: 'tf-1',
    topic_id: 'topic-1',
    code: '1.1N.1',
    index: 1,
    filename: 'notes.pdf',
    mimetype: 'application/pdf',
    storage_path: 'path/notes.pdf',
    bucket: 'files',
    external_url: null,
    type: 'NOTES',
    is_solutions: false,
    is_solutions_of_id: null,
    file_id: 'file-1',
    created_at: null,
    created_by: null,
    deleted_at: null,
    file_metadata: null,
    size_bytes: null,
    storage_provider: null,
    updated_at: null,
    ...overrides,
  };
}

describe('mapTutorTopicFile', () => {
  it('keeps files.id so office print can enqueue the stored PDF', () => {
    const mapped = mapTutorTopicFile(row());
    expect(mapped?.fileId).toBe('file-1');
    expect(mapped?.filename).toBe('notes.pdf');
  });
});
