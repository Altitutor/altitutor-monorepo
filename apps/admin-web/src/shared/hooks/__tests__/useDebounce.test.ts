/**
 * Tests for useDebounce hook
 * Tests debouncing behavior for values
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    expect(result.current).toBe('initial');

    // Change value
    rerender({ value: 'updated', delay: 500 });
    
    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time by less than delay
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe('initial');

    // Fast-forward to complete delay
    act(() => {
      jest.advanceTimersByTime(100);
    });
    
    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });

  it('should reset timer on rapid value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'value1', delay: 500 },
      }
    );

    // Rapidly change values
    rerender({ value: 'value2', delay: 500 });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    rerender({ value: 'value3', delay: 500 });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Value should still be initial
    expect(result.current).toBe('value1');

    // Complete the delay after last change
    act(() => {
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current).toBe('value3');
    });
  });

  it('should handle different delay values', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 1000 },
      }
    );

    rerender({ value: 'updated', delay: 1000 });

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe('initial');

    act(() => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });

  it('should handle number values', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 0, delay: 500 },
      }
    );

    rerender({ value: 100, delay: 500 });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(result.current).toBe(100);
    });
  });

  it('should handle object values', async () => {
    const initialObj = { name: 'John', age: 30 };
    const updatedObj = { name: 'Jane', age: 25 };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: initialObj, delay: 500 },
      }
    );

    rerender({ value: updatedObj, delay: 500 });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(result.current).toEqual(updatedObj);
    });
  });

  it('should cleanup timeout on unmount', () => {
    const { unmount } = renderHook(() => useDebounce('value', 500));
    
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    
    unmount();
    
    // Should have called clearTimeout for cleanup
    expect(clearTimeoutSpy).toHaveBeenCalled();
    
    clearTimeoutSpy.mockRestore();
  });
});
