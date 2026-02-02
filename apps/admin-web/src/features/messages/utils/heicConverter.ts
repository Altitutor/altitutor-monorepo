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
 * Dynamically import heic2any only on the client side
 * This prevents SSR errors since heic2any is a browser-only library
 */
async function getHeic2Any() {
  // Only import on client side
  if (typeof window === 'undefined') {
    throw new Error('heic2any can only be used in the browser');
  }
  
  // Dynamic import to prevent SSR bundling
  const heic2any = (await import('heic2any')).default;
  return heic2any;
}

/**
 * Convert HEIC file to JPEG blob URL for browser preview
 * Returns a blob URL that can be used as image src
 * Only works in the browser (client-side)
 */
export async function convertHeicToPreview(file: File): Promise<string> {
  // Guard against SSR
  if (typeof window === 'undefined') {
    throw new Error('HEIC conversion is only available in the browser');
  }

  try {
    const heic2any = await getHeic2Any();
    
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
 * Only works in the browser (client-side)
 */
export async function convertHeicUrlToPreview(url: string): Promise<string> {
  // Guard against SSR
  if (typeof window === 'undefined') {
    throw new Error('HEIC conversion is only available in the browser');
  }

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
