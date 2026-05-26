import { useLayoutEffect, useEffect, useState, type RefObject } from 'react';

const MAX_TITLE_FONT_PX = 36; // text-4xl
const MIN_TITLE_FONT_PX = 18;

/**
 * Shrinks document title font size on md+ viewports so long single-line titles fit their container.
 * Clears inline font-size on smaller viewports so Tailwind responsive classes apply.
 */
export function useFitDocumentTitle(
  elementRef: RefObject<HTMLElement | null>,
  text: string,
): void {
  const [fitEnabled, setFitEnabled] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const update = () => setFitEnabled(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (!fitEnabled) {
      element.style.fontSize = '';
      return;
    }

    const fit = () => {
      element.style.fontSize = `${MAX_TITLE_FONT_PX}px`;
      let size = MAX_TITLE_FONT_PX;
      while (size > MIN_TITLE_FONT_PX && element.scrollWidth > element.clientWidth) {
        size -= 1;
        element.style.fontSize = `${size}px`;
      }
    };

    fit();

    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(element);
    const parent = element.parentElement;
    if (parent) resizeObserver.observe(parent);

    return () => resizeObserver.disconnect();
  }, [elementRef, text, fitEnabled]);
}
