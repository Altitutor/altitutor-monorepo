import { overlayPinStyle } from '../visual-viewport-pin';

describe('overlayPinStyle', () => {
  it('returns undefined when there is nothing to pin or drag', () => {
    expect(overlayPinStyle({ viewport: null })).toBeUndefined();
    expect(overlayPinStyle({ viewport: null, dragOffset: 0 })).toBeUndefined();
  });

  it('pins a sheet to the visual viewport so a keyboard pan cannot hide the input', () => {
    expect(
      overlayPinStyle({
        viewport: { offsetTop: 280, height: 420 },
      }),
    ).toEqual({
      top: 280,
      height: 420,
      bottom: 'auto',
    });
  });

  it('keeps a dismiss-drag transform without dropping the viewport pin', () => {
    expect(
      overlayPinStyle({
        viewport: { offsetTop: 120, height: 500 },
        dragOffset: 40,
      }),
    ).toEqual({
      top: 120,
      height: 500,
      bottom: 'auto',
      transform: 'translateY(40px)',
    });
  });
});
