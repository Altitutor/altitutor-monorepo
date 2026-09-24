'use client';

import { useLayoutEffect, useState } from 'react';

import type { VisualViewportRect } from '../lib/visual-viewport-pin';

/** Live visual-viewport rect while `enabled`, used to pin mobile overlays above the iOS keyboard. */
export function useVisualViewportRect(enabled: boolean): VisualViewportRect | null {
  const [rect, setRect] = useState<VisualViewportRect | null>(null);

  useLayoutEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setRect(null);
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) return;

    const sync = () => {
      setRect({ offsetTop: viewport.offsetTop, height: viewport.height });
    };

    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);

    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [enabled]);

  return rect;
}
