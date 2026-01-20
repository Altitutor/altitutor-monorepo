/**
 * Tests for useElementSize hook
 * Tests element size tracking with ResizeObserver
 */

import { renderHook, act } from '@testing-library/react';
import { useElementSize } from '../useElementSize';

// Mock ResizeObserver
let resizeCallback: (entries: ResizeObserverEntry[]) => void;
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

class MockResizeObserver {
  constructor(callback: (entries: ResizeObserverEntry[]) => void) {
    resizeCallback = callback;
  }
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = jest.fn();
}

global.ResizeObserver = MockResizeObserver as any;

describe('useElementSize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with zero size', () => {
    const { result } = renderHook(() => useElementSize());

    expect(result.current[0].current).toBeNull();
    expect(result.current[1]).toEqual({ width: 0, height: 0 });
  });

  it('should observe element when ref is attached', () => {
    const { result, rerender } = renderHook(() => useElementSize<HTMLDivElement>());

    const mockElement = {
      offsetWidth: 100,
      offsetHeight: 200,
    } as HTMLDivElement;

    // Attach ref to element and force re-render
    act(() => {
      (result.current[0] as any).current = mockElement;
      rerender();
    });

    // ResizeObserver should be created and observe should be called
    expect(mockObserve).toHaveBeenCalledWith(mockElement);
  });

  it('should set initial size from element dimensions', () => {
    const { result, rerender } = renderHook(() => useElementSize<HTMLDivElement>());

    const mockElement = {
      offsetWidth: 150,
      offsetHeight: 300,
    } as HTMLDivElement;

    act(() => {
      (result.current[0] as any).current = mockElement;
      rerender();
    });

    // The hook sets initial size synchronously in the effect
    // After the effect runs, size should reflect offsetWidth/offsetHeight
    expect(result.current[1]).toEqual({ width: 150, height: 300 });
  });

  it('should update size when ResizeObserver fires', () => {
    const { result, rerender } = renderHook(() => useElementSize<HTMLDivElement>());

    const mockElement = {
      offsetWidth: 100,
      offsetHeight: 200,
    } as HTMLDivElement;

    act(() => {
      (result.current[0] as any).current = mockElement;
      rerender();
    });

    // Simulate ResizeObserver callback
    act(() => {
      if (resizeCallback) {
        resizeCallback([
          {
            contentRect: { width: 250, height: 400 },
            target: mockElement,
          } as unknown as ResizeObserverEntry,
        ]);
      }
    });

    // Size should be updated
    expect(result.current[1]).toEqual({ width: 250, height: 400 });
  });

  it('should disconnect ResizeObserver on unmount', () => {
    const mockElement = {
      offsetWidth: 100,
      offsetHeight: 200,
    } as HTMLDivElement;

    const { result, rerender, unmount } = renderHook(() => useElementSize<HTMLDivElement>());

    act(() => {
      (result.current[0] as any).current = mockElement;
      rerender();
    });

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should handle null element gracefully', () => {
    const { result } = renderHook(() => useElementSize());

    expect(result.current[0].current).toBeNull();
    expect(result.current[1]).toEqual({ width: 0, height: 0 });
  });

  it('should work with different HTML element types', () => {
    const { result: divResult } = renderHook(() => useElementSize<HTMLDivElement>());
    const { result: spanResult } = renderHook(() => useElementSize<HTMLSpanElement>());
    const { result: buttonResult } = renderHook(() => useElementSize<HTMLButtonElement>());

    expect(divResult.current[1]).toEqual({ width: 0, height: 0 });
    expect(spanResult.current[1]).toEqual({ width: 0, height: 0 });
    expect(buttonResult.current[1]).toEqual({ width: 0, height: 0 });
  });

  it('should handle multiple resize events', () => {
    const { result, rerender } = renderHook(() => useElementSize<HTMLDivElement>());

    const mockElement = {
      offsetWidth: 100,
      offsetHeight: 200,
    } as HTMLDivElement;

    act(() => {
      (result.current[0] as any).current = mockElement;
      rerender();
    });

    // First resize
    act(() => {
      if (resizeCallback) {
        resizeCallback([
          {
            contentRect: { width: 200, height: 300 },
            target: mockElement,
          } as unknown as ResizeObserverEntry,
        ]);
      }
    });

    expect(result.current[1]).toEqual({ width: 200, height: 300 });

    // Second resize
    act(() => {
      if (resizeCallback) {
        resizeCallback([
          {
            contentRect: { width: 300, height: 400 },
            target: mockElement,
          } as unknown as ResizeObserverEntry,
        ]);
      }
    });

    expect(result.current[1]).toEqual({ width: 300, height: 400 });
  });
});
