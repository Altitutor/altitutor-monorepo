import type { CSSProperties } from 'react';

export type VisualViewportRect = {
  offsetTop: number;
  height: number;
};

/**
 * Keep a `position: fixed` overlay inside iOS Safari's visual viewport.
 *
 * When the software keyboard opens, Safari pans `visualViewport` (not the
 * layout viewport). Bottom-anchored sheets then appear to shoot off the top
 * of the screen. Pinning `top`/`height` to the visual viewport keeps the
 * overlay — and its focused input — on screen.
 */
export function overlayPinStyle(options: {
  viewport: VisualViewportRect | null;
  dragOffset?: number;
}): CSSProperties | undefined {
  const { viewport, dragOffset = 0 } = options;
  if (!viewport && dragOffset <= 0) return undefined;

  return {
    ...(viewport
      ? {
          top: viewport.offsetTop,
          height: viewport.height,
          bottom: 'auto',
        }
      : {}),
    ...(dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : {}),
  };
}

/** Freeze the document so iOS Safari cannot pan the page under a focused overlay input. */
export function lockOverlayPageScroll(): () => void {
  const scrollY = window.scrollY;
  const { body, documentElement } = document;
  const previous = {
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    rootOverflow: documentElement.style.overflow,
  };

  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  documentElement.style.overflow = 'hidden';

  return () => {
    body.style.overflow = previous.bodyOverflow;
    body.style.position = previous.bodyPosition;
    body.style.top = previous.bodyTop;
    body.style.left = previous.bodyLeft;
    body.style.right = previous.bodyRight;
    body.style.width = previous.bodyWidth;
    documentElement.style.overflow = previous.rootOverflow;
    window.scrollTo(0, scrollY);
  };
}
