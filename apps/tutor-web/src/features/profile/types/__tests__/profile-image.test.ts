import {
  DEFAULT_PROFILE_IMAGE_CROP,
  normalizeProfileImageCrop,
} from '../profile-image';

describe('normalizeProfileImageCrop', () => {
  it('uses the default crop for missing or malformed metadata', () => {
    expect(normalizeProfileImageCrop(null)).toEqual(DEFAULT_PROFILE_IMAGE_CROP);
    expect(normalizeProfileImageCrop({ x: '50', y: 50, zoom: 1 })).toEqual(
      DEFAULT_PROFILE_IMAGE_CROP,
    );
  });

  it('clamps saved crop values to the supported range', () => {
    expect(normalizeProfileImageCrop({ x: -20, y: 140, zoom: 4 })).toEqual({
      x: 0,
      y: 100,
      zoom: 3,
    });
  });
});
