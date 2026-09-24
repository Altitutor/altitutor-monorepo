import type { ImageOcclusionData, ImageOcclusionMask } from './types';
import { hasClozeMarker } from './cloze';

export const IMAGE_OCCLUSION_MAX_MASKS = 100;
export const IMAGE_OCCLUSION_MAX_PIXELS = 25_000_000;
export const IMAGE_OCCLUSION_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const IMAGE_OCCLUSION_MIN_NORMALIZED_SIZE = 0.002;
export const IMAGE_OCCLUSION_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function getImageOcclusionIndexes(data: ImageOcclusionData | null | undefined): number[] {
  if (!data) return [];
  return [...new Set(data.masks.map((mask) => mask.clozeIndex))].sort((a, b) => a - b);
}

export function getNextImageOcclusionIndex(data: ImageOcclusionData | null | undefined): number {
  const indexes = new Set(getImageOcclusionIndexes(data));
  let index = 1;
  while (indexes.has(index)) index += 1;
  return index;
}

export function clampImageOcclusionMask(mask: ImageOcclusionMask): ImageOcclusionMask {
  const width = Math.min(1, Math.max(IMAGE_OCCLUSION_MIN_NORMALIZED_SIZE, mask.width));
  const height = Math.min(1, Math.max(IMAGE_OCCLUSION_MIN_NORMALIZED_SIZE, mask.height));
  return {
    ...mask,
    clozeIndex: Math.max(1, Math.trunc(mask.clozeIndex)),
    width,
    height,
    x: Math.min(1 - width, Math.max(0, mask.x)),
    y: Math.min(1 - height, Math.max(0, mask.y)),
  };
}

export function validateImageOcclusionData(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Occlusion data is required.'];
  const data = value as Partial<ImageOcclusionData>;
  const errors: string[] = [];

  if (data.version !== 1) errors.push('Unsupported occlusion data version.');
  if (!Number.isInteger(data.naturalWidth) || (data.naturalWidth ?? 0) <= 0) errors.push('Image width is invalid.');
  if (!Number.isInteger(data.naturalHeight) || (data.naturalHeight ?? 0) <= 0) errors.push('Image height is invalid.');
  if (isFiniteNumber(data.naturalWidth) && isFiniteNumber(data.naturalHeight)
    && data.naturalWidth * data.naturalHeight > IMAGE_OCCLUSION_MAX_PIXELS) {
    errors.push('Image exceeds the 25 megapixel limit.');
  }

  if (!Array.isArray(data.masks) || data.masks.length === 0) {
    errors.push('Add at least one occlusion box.');
    return errors;
  }
  if (data.masks.length > IMAGE_OCCLUSION_MAX_MASKS) errors.push('A flashcard can contain at most 100 boxes.');

  const ids = new Set<string>();
  data.masks.forEach((mask, index) => {
    if (!mask || typeof mask !== 'object') {
      errors.push(`Box ${index + 1} is invalid.`);
      return;
    }
    if (typeof mask.id !== 'string' || !mask.id.trim() || ids.has(mask.id)) {
      errors.push(`Box ${index + 1} needs a unique ID.`);
    } else {
      ids.add(mask.id);
    }
    if (!Number.isInteger(mask.clozeIndex) || mask.clozeIndex <= 0) errors.push(`Box ${index + 1} has an invalid cloze number.`);
    const values = [mask.x, mask.y, mask.width, mask.height];
    if (!values.every(isFiniteNumber)) {
      errors.push(`Box ${index + 1} has invalid geometry.`);
      return;
    }
    if (mask.x < 0 || mask.y < 0 || mask.width < IMAGE_OCCLUSION_MIN_NORMALIZED_SIZE
      || mask.height < IMAGE_OCCLUSION_MIN_NORMALIZED_SIZE || mask.x + mask.width > 1.000001
      || mask.y + mask.height > 1.000001) {
      errors.push(`Box ${index + 1} must stay inside the image.`);
    }
  });

  if (data.groupDescriptions !== undefined) {
    if (!data.groupDescriptions || typeof data.groupDescriptions !== 'object' || Array.isArray(data.groupDescriptions)) {
      errors.push('Group descriptions are invalid.');
    } else if (Object.values(data.groupDescriptions).some((description) => typeof description !== 'string')) {
      errors.push('Every group description must be text.');
    }
  }
  return errors;
}

export function isImageOcclusionData(value: unknown): value is ImageOcclusionData {
  return validateImageOcclusionData(value).length === 0;
}

export function getImageOcclusionGroupDescription(
  data: ImageOcclusionData | null | undefined,
  clozeIndex: number,
): string | null {
  const description = data?.groupDescriptions?.[String(clozeIndex)]?.trim();
  return description || null;
}

export function validateFlashcardContent(input: {
  cardType: unknown;
  clozeText: unknown;
  imageFileId: unknown;
  occlusionData: unknown;
}): string | null {
  if (input.cardType === 'text_cloze') {
    return typeof input.clozeText === 'string' && hasClozeMarker(input.clozeText)
      ? null
      : 'Flashcard text must contain a cloze marker.';
  }
  if (input.cardType !== 'image_occlusion') return 'Unsupported flashcard type.';
  if (typeof input.imageFileId !== 'string' || !input.imageFileId) return 'An uploaded source image is required.';
  return validateImageOcclusionData(input.occlusionData)[0] ?? null;
}
