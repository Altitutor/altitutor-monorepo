export interface ProfileImageCrop {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_PROFILE_IMAGE_CROP: ProfileImageCrop = {
  x: 50,
  y: 50,
  zoom: 1,
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function normalizeProfileImageCrop(value: unknown): ProfileImageCrop {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_PROFILE_IMAGE_CROP;
  }

  const crop = value as Record<string, unknown>;
  if (
    typeof crop.x !== 'number' ||
    !Number.isFinite(crop.x) ||
    typeof crop.y !== 'number' ||
    !Number.isFinite(crop.y) ||
    typeof crop.zoom !== 'number' ||
    !Number.isFinite(crop.zoom)
  ) {
    return DEFAULT_PROFILE_IMAGE_CROP;
  }

  return {
    x: clamp(crop.x, 0, 100),
    y: clamp(crop.y, 0, 100),
    zoom: clamp(crop.zoom, 1, 3),
  };
}

export function profileImageCropStyle(crop: ProfileImageCrop) {
  return {
    objectPosition: `${crop.x}% ${crop.y}%`,
    transform: `scale(${crop.zoom})`,
    transformOrigin: `${crop.x}% ${crop.y}%`,
  };
}
