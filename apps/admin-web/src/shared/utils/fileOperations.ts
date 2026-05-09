import { getSignedUrl } from '@/shared/lib/supabase/storage';
import type { Tables } from '@altitutor/shared';

/**
 * Utility functions for file operations (print, download)
 * Separated from UI components for reusability and testability
 */

/**
 * Checks if a file is a PDF based on mimetype or filename
 */
export function isPdfFile(file: Tables<'files'> | null): boolean {
  if (!file) return false;
  return (
    file.mimetype === 'application/pdf' ||
    file.filename.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Checks if a file is an image based on mimetype
 */
export function isImageFile(file: Tables<'files'> | null): boolean {
  if (!file) return false;
  return file.mimetype?.startsWith('image/') ?? false;
}

/**
 * Downloads a file by creating a temporary link and clicking it
 */
export async function downloadFile(
  file: Tables<'files'>,
  onProgress?: (isDownloading: boolean) => void,
  getSignedUrlFn?: (path: string) => Promise<string>
): Promise<void> {
  try {
    onProgress?.(true);
    const external = file.external_url?.trim();
    if (external) {
      window.open(external, '_blank', 'noopener,noreferrer');
      return;
    }
    const getUrlFn = getSignedUrlFn || getSignedUrl;
    if (!file.storage_path) {
      throw new Error('File has no storage path');
    }
    const signedUrl = await getUrlFn(file.storage_path);
    const link = document.createElement('a');
    link.href = signedUrl;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Failed to download file:', error);
    throw error;
  } finally {
    onProgress?.(false);
  }
}

/**
 * Prints a PDF file by opening it in a new window and triggering print
 */
export function printPdf(previewUrl: string): void {
  const printWindow = window.open(previewUrl, '_blank');
  if (printWindow) {
    printWindow.addEventListener('load', () => {
      printWindow.print();
    });
  }
}

/**
 * Sets up keyboard shortcut handler for printing PDFs (Command+P / Ctrl+P)
 */
export function setupPrintKeyboardHandler(
  isEnabled: boolean,
  previewUrl: string | null,
  file: Tables<'files'> | null,
  onPrint: () => void
): (() => void) | undefined {
  if (!isEnabled || !previewUrl || !isPdfFile(file)) {
    return undefined;
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault();
      onPrint();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}
