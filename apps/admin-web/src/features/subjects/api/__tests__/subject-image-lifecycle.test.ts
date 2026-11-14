import { subjectsApi } from '../subjects';

let mockLinkedFile = 'old-file';
let mockOldFileDeleteFails = false;
let mockLinkFails = false;
const mockObjects = new Set<string>();
const mockSoftDeleted = new Set<string>();
const path = 'subject/_subject_image/new.png';
const mockDelete = jest.fn(async (_bucket: string, key: string) => { mockObjects.delete(key); });
jest.mock('@/shared/lib/supabase/storage', () => ({
  uploadSubjectImage: async () => { mockObjects.add(path); return { path }; },
  deleteFromBucket: (...args: [string, string]) => mockDelete(...args),
}));
jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'link', file_id: mockLinkedFile }, error: null }) }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'new-file', storage_path: path }, error: null }) }) }),
      update: (patch: { file_id?: string }) => ({ eq: async (_column: string, id: string) => {
        if (table === 'subjects_files') {
          if (mockLinkFails) return { error: new Error('link write failed') };
          mockLinkedFile = patch.file_id!;
        } else {
          if (id === 'old-file' && mockOldFileDeleteFails) return { error: new Error('old-file cleanup failed') };
          mockSoftDeleted.add(id);
        }
        return { error: null };
      } }),
    }),
  }),
}));

beforeEach(() => {
  mockLinkedFile = 'old-file';
  mockOldFileDeleteFails = false;
  mockLinkFails = false;
  mockObjects.clear();
  mockSoftDeleted.clear();
  mockDelete.mockClear();
});

it('keeps the visible replacement signable when retiring the old file fails', async () => {
  mockOldFileDeleteFails = true;
  await expect(subjectsApi.setSubjectImage('subject', new File(['x'], 'cover.png', { type: 'image/png' }))).rejects.toThrow('old-file cleanup failed');
  expect(mockLinkedFile).toBe('new-file');
  // A resource card already holding this path must still be able to sign it.
  expect(mockObjects.has(path)).toBe(true);
  expect(mockSoftDeleted.has('new-file')).toBe(false);
  expect(mockDelete).not.toHaveBeenCalled();
});

it('removes an upload that never became the linked cover', async () => {
  mockLinkFails = true;
  await expect(subjectsApi.setSubjectImage('subject', new File(['x'], 'cover.png', { type: 'image/png' }))).rejects.toThrow('link write failed');
  expect(mockLinkedFile).toBe('old-file');
  expect(mockObjects.has(path)).toBe(false);
  expect(mockSoftDeleted.has('new-file')).toBe(true);
});

it('retains the uploaded object and retires the previous file after replacement', async () => {
  await subjectsApi.setSubjectImage('subject', new File(['x'], 'cover.png', { type: 'image/png' }));
  expect(mockLinkedFile).toBe('new-file');
  expect(mockObjects.has(path)).toBe(true);
  expect(mockSoftDeleted.has('old-file')).toBe(true);
});
