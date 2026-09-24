import { focusCommandPaletteInput } from '../focus';

describe('focusCommandPaletteInput', () => {
  const originalRaf = globalThis.requestAnimationFrame;

  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof requestAnimationFrame;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    jest.useRealTimers();
  });

  it('focuses on the next frames and default retries without scrolling', () => {
    const focus = jest.fn();
    focusCommandPaletteInput({ focus } as unknown as HTMLElement);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });

    jest.advanceTimersByTime(50);
    expect(focus).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(100);
    expect(focus).toHaveBeenCalledTimes(3);
  });

  it('can defer focus until after a mobile slide-in animation', () => {
    const focus = jest.fn();
    focusCommandPaletteInput({ focus } as unknown as HTMLElement, { delaysMs: [350] });

    expect(focus).not.toHaveBeenCalled();

    jest.advanceTimersByTime(349);
    expect(focus).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});
