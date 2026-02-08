import { useState, useEffect, useRef, RefObject } from 'react';

interface Size {
  width: number;
  height: number;
}

export function useElementSize<T extends HTMLElement = HTMLDivElement>(): [RefObject<T>, Size] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const elementRef = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    
    // If element changed, update observer
    if (element !== elementRef.current) {
      // Clean up previous observer
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      elementRef.current = element;
      
      if (!element) {
        setSize({ width: 0, height: 0 });
        return;
      }

      // Set up new observer
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setSize({ width, height });
        }
      });

      resizeObserver.observe(element);
      resizeObserverRef.current = resizeObserver;

      // Initial measurement
      setSize({
        width: element.offsetWidth,
        height: element.offsetHeight,
      });
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
    // Intentionally empty dependency array - effect should run on every render
    // to check if ref.current has changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, size];
}

