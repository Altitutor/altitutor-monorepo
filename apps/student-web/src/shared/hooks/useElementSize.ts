import { useState, useEffect, useRef, RefObject } from 'react';

interface Size {
  width: number;
  height: number;
}

export function useElementSize<T extends HTMLElement = HTMLDivElement>(): [RefObject<T>, Size] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });

    resizeObserver.observe(element);

    // Initial measurement
    setSize({
      width: element.offsetWidth,
      height: element.offsetHeight,
    });

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return [ref, size];
}
