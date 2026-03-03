import {
  isPdfFile,
  isImageFile,
  downloadFile,
  printPdf,
  setupPrintKeyboardHandler,
} from '@/shared/utils/fileOperations';
import type { Tables } from '@altitutor/shared';

// Mock the storage module
jest.mock('@/shared/lib/supabase/storage', () => ({
  getSignedUrl: jest.fn(),
}));

import { getSignedUrl } from '@/shared/lib/supabase/storage';

describe('fileOperations utilities', () => {
  const createMockFile = (
    mimetype: string | null,
    filename: string
  ): Tables<'files'> => ({
    id: 'file-1',
    filename,
    mimetype: mimetype ?? 'application/octet-stream',
    size_bytes: 1000,
    storage_path: 'path/to/file.pdf',
    storage_provider: 'supabase',
    bucket: 'resources',
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    deleted_at: null,
  });

  describe('isPdfFile', () => {
    it('should return true for PDF mimetype', () => {
      const file = createMockFile('application/pdf', 'document.pdf');
      expect(isPdfFile(file)).toBe(true);
    });

    it('should return true for PDF filename even without mimetype', () => {
      const file = createMockFile(null, 'document.PDF');
      expect(isPdfFile(file)).toBe(true);
    });

    it('should return true for PDF filename with lowercase extension', () => {
      const file = createMockFile(null, 'document.pdf');
      expect(isPdfFile(file)).toBe(true);
    });

    it('should return false for non-PDF files', () => {
      const file = createMockFile('image/png', 'image.png');
      expect(isPdfFile(file)).toBe(false);
    });

    it('should return false for null file', () => {
      expect(isPdfFile(null)).toBe(false);
    });

    it('should return false for file with PDF in name but wrong extension', () => {
      const file = createMockFile(null, 'pdf-document.txt');
      expect(isPdfFile(file)).toBe(false);
    });
  });

  describe('isImageFile', () => {
    it('should return true for image mimetypes', () => {
      const imageTypes = [
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'image/svg+xml',
      ];

      imageTypes.forEach((mimetype) => {
        const file = createMockFile(mimetype, 'image.png');
        expect(isImageFile(file)).toBe(true);
      });
    });

    it('should return false for non-image mimetypes', () => {
      const file = createMockFile('application/pdf', 'document.pdf');
      expect(isImageFile(file)).toBe(false);
    });

    it('should return false for null mimetype', () => {
      const file = createMockFile(null, 'file.txt');
      expect(isImageFile(file)).toBe(false);
    });

    it('should return false for null file', () => {
      expect(isImageFile(null)).toBe(false);
    });
  });

  describe('downloadFile', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Mock DOM methods
      document.createElement = jest.fn(() => ({
        href: '',
        download: '',
        click: jest.fn(),
      })) as jest.Mock;
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();
    });

    it('should download file successfully', async () => {
      const file = createMockFile('application/pdf', 'document.pdf');
      const mockSignedUrl = 'https://example.com/signed-url';
      (getSignedUrl as jest.Mock).mockResolvedValue(mockSignedUrl);

      const onProgress = jest.fn();

      await downloadFile(file, onProgress);

      expect(getSignedUrl).toHaveBeenCalledWith(file.storage_path);
      expect(onProgress).toHaveBeenCalledWith(true);
      expect(onProgress).toHaveBeenCalledWith(false);
    });

    it('should handle download errors', async () => {
      const file = createMockFile('application/pdf', 'document.pdf');
      const error = new Error('Failed to get signed URL');
      (getSignedUrl as jest.Mock).mockRejectedValue(error);

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(downloadFile(file)).rejects.toThrow('Failed to get signed URL');

      consoleSpy.mockRestore();
    });

    it('should work without progress callback', async () => {
      const file = createMockFile('application/pdf', 'document.pdf');
      const mockSignedUrl = 'https://example.com/signed-url';
      (getSignedUrl as jest.Mock).mockResolvedValue(mockSignedUrl);

      await expect(downloadFile(file)).resolves.not.toThrow();
    });
  });

  describe('printPdf', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Mock window.open
      global.window.open = jest.fn(() => ({
        addEventListener: jest.fn(),
        print: jest.fn(),
      })) as jest.Mock;
    });

    it('should open PDF in new window and trigger print', () => {
      const previewUrl = 'https://example.com/file.pdf';

      printPdf(previewUrl);

      expect(window.open).toHaveBeenCalledWith(previewUrl, '_blank');
    });

    it('should handle null window.open return', () => {
      global.window.open = jest.fn(() => null) as jest.Mock;
      const previewUrl = 'https://example.com/file.pdf';

      expect(() => printPdf(previewUrl)).not.toThrow();
    });
  });

  describe('setupPrintKeyboardHandler', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      window.addEventListener = jest.fn();
      window.removeEventListener = jest.fn();
    });

    it('should return cleanup function when conditions are met', () => {
      const file = createMockFile('application/pdf', 'document.pdf');
      const onPrint = jest.fn();

      const cleanup = setupPrintKeyboardHandler(true, 'https://example.com/file.pdf', file, onPrint);

      expect(cleanup).toBeDefined();
      expect(typeof cleanup).toBe('function');
      expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should return undefined when modal is not open', () => {
      const file = createMockFile('application/pdf', 'document.pdf');
      const onPrint = jest.fn();

      const cleanup = setupPrintKeyboardHandler(false, 'https://example.com/file.pdf', file, onPrint);

      expect(cleanup).toBeUndefined();
      expect(window.addEventListener).not.toHaveBeenCalled();
    });

    it('should return undefined when previewUrl is null', () => {
      const file = createMockFile('application/pdf', 'document.pdf');
      const onPrint = jest.fn();

      const cleanup = setupPrintKeyboardHandler(true, null, file, onPrint);

      expect(cleanup).toBeUndefined();
    });

    it('should return undefined when file is not PDF', () => {
      const file = createMockFile('image/png', 'image.png');
      const onPrint = jest.fn();

      const cleanup = setupPrintKeyboardHandler(true, 'https://example.com/file.png', file, onPrint);

      expect(cleanup).toBeUndefined();
    });

    it('should call cleanup function to remove event listener', () => {
      const file = createMockFile('application/pdf', 'document.pdf');
      const onPrint = jest.fn();

      const cleanup = setupPrintKeyboardHandler(true, 'https://example.com/file.pdf', file, onPrint);

      expect(cleanup).toBeDefined();
      cleanup?.();

      expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should trigger onPrint when Command+P is pressed', () => {
      const file = createMockFile('application/pdf', 'document.pdf');
      const onPrint = jest.fn();
      let handler: ((e: KeyboardEvent) => void) | undefined;

      window.addEventListener = jest.fn((event, callback) => {
        if (event === 'keydown') {
          handler = callback as (e: KeyboardEvent) => void;
        }
      });

      setupPrintKeyboardHandler(true, 'https://example.com/file.pdf', file, onPrint);

      expect(handler).toBeDefined();

      // Simulate Command+P press
      const event = new KeyboardEvent('keydown', {
        key: 'p',
        metaKey: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn(),
      });

      handler?.(event);

      expect(onPrint).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should trigger onPrint when Ctrl+P is pressed', () => {
      const file = createMockFile('application/pdf', 'document.pdf');
      const onPrint = jest.fn();
      let handler: ((e: KeyboardEvent) => void) | undefined;

      window.addEventListener = jest.fn((event, callback) => {
        if (event === 'keydown') {
          handler = callback as (e: KeyboardEvent) => void;
        }
      });

      setupPrintKeyboardHandler(true, 'https://example.com/file.pdf', file, onPrint);

      // Simulate Ctrl+P press
      const event = new KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn(),
      });

      handler?.(event);

      expect(onPrint).toHaveBeenCalled();
    });

    it('should not trigger onPrint for other keys', () => {
      const file = createMockFile('application/pdf', 'document.pdf');
      const onPrint = jest.fn();
      let handler: ((e: KeyboardEvent) => void) | undefined;

      window.addEventListener = jest.fn((event, callback) => {
        if (event === 'keydown') {
          handler = callback as (e: KeyboardEvent) => void;
        }
      });

      setupPrintKeyboardHandler(true, 'https://example.com/file.pdf', file, onPrint);

      // Simulate other key press
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        metaKey: true,
        cancelable: true,
      });

      handler?.(event);

      expect(onPrint).not.toHaveBeenCalled();
    });
  });
});
