/**
 * Tests for file operation utilities
 * Tests pure functions: isPdfFile, isImageFile
 */

import { isPdfFile, isImageFile } from '../fileOperations';
import type { Tables } from '@altitutor/shared';

const createMockFile = (
  overrides: Partial<Tables<'files'>> = {}
): Tables<'files'> =>
  ({
    id: 'file-1',
    bucket: 'bucket',
    filename: 'document.pdf',
    mimetype: 'application/pdf',
    size_bytes: 1024,
    storage_path: 'path/document.pdf',
    external_url: null,
    storage_provider: 'supabase',
    created_at: null,
    created_by: null,
    deleted_at: null,
    metadata: null,
    updated_at: null,
    ...overrides,
  }) as Tables<'files'>;

describe('isPdfFile', () => {
  it('should return true when mimetype is application/pdf', () => {
    const file = createMockFile({ mimetype: 'application/pdf' });
    expect(isPdfFile(file)).toBe(true);
  });

  it('should return true when filename ends with .pdf (case insensitive)', () => {
    const file = createMockFile({
      mimetype: 'application/octet-stream',
      filename: 'document.PDF',
    });
    expect(isPdfFile(file)).toBe(true);
  });

  it('should return true when filename ends with .pdf lowercase', () => {
    const file = createMockFile({
      mimetype: 'text/plain',
      filename: 'notes.pdf',
    });
    expect(isPdfFile(file)).toBe(true);
  });

  it('should return false when file is not a PDF', () => {
    const file = createMockFile({
      mimetype: 'image/png',
      filename: 'image.png',
    });
    expect(isPdfFile(file)).toBe(false);
  });

  it('should return false when file is null', () => {
    expect(isPdfFile(null)).toBe(false);
  });

  it('should return false when filename contains .pdf but does not end with it', () => {
    const file = createMockFile({
      mimetype: 'text/plain',
      filename: 'pdf-document.txt',
    });
    expect(isPdfFile(file)).toBe(false);
  });
});

describe('isImageFile', () => {
  it('should return true when mimetype starts with image/', () => {
    const file = createMockFile({ mimetype: 'image/png' });
    expect(isImageFile(file)).toBe(true);
  });

  it('should return true for image/jpeg', () => {
    const file = createMockFile({ mimetype: 'image/jpeg' });
    expect(isImageFile(file)).toBe(true);
  });

  it('should return true for image/webp', () => {
    const file = createMockFile({ mimetype: 'image/webp' });
    expect(isImageFile(file)).toBe(true);
  });

  it('should return false when mimetype is not image', () => {
    const file = createMockFile({ mimetype: 'application/pdf' });
    expect(isImageFile(file)).toBe(false);
  });

  it('should return false when file is null', () => {
    expect(isImageFile(null)).toBe(false);
  });

  it('should return false when mimetype is undefined', () => {
    const file = createMockFile({ mimetype: undefined as unknown as string });
    expect(isImageFile(file)).toBe(false);
  });
});
