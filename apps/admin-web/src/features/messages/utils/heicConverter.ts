import heic2any from 'heic2any';

/**
 * Check if a file is HEIC/HEIF format
 */
export function isHeicFile(file: File | { mimeType?: string; filename?: string }): boolean {
  if (file instanceof File) {
    const mimeType = file.type?.toLowerCase();
    const filename = file.name?.toLowerCase() || '';
    return (
      mimeType === 'image/heic' ||
      mimeType === 'image/heif' ||
      filename.endsWith('.heic') ||
      filename.endsWith('.heif')
    );
  }
  
  const mimeType = file.mimeType?.toLowerCase();
  const filename = file.filename?.toLowerCase() || '';
  return (
    mimeType === 'image/heic' ||
    mimeType === 'image/heif' ||
    filename.endsWith('.heic') ||
    filename.endsWith('.heif')
  );
}

/**
 * Convert HEIC file to JPEG blob URL for browser preview
 * Returns a blob URL that can be used as image src
 */
export async function convertHeicToPreview(file: File): Promise<string> {
  try {
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92, // High quality but smaller file size
    });

    // heic2any can return an array if there are multiple images (HEIC bursts)
    // We'll take the first one for preview
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
    
    if (!blob) {
      throw new Error('Conversion failed - no blob returned');
    }

    // Create object URL for preview
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('HEIC conversion error:', error);
    throw new Error('Failed to convert HEIC image for preview');
  }
}

/**
 * Convert HEIC file from URL to JPEG blob URL
 * Fetches the file first, then converts it
 */
export async function convertHeicUrlToPreview(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch HEIC file: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const file = new File([blob], 'image.heic', { type: 'image/heic' });
    
    return convertHeicToPreview(file);
  } catch (error) {
    console.error('HEIC URL conversion error:', error);
    throw new Error('Failed to convert HEIC image from URL');
  }
}
