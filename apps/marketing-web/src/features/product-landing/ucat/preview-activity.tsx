"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

const PreviewActivity = createContext(true);

/** Stop demo work offscreen without unmounting or hiding its content. */
export function usePreviewVisibility(ref: RefObject<HTMLElement>) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let intersecting = false;
    const sync = () => setActive(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [ref]);
  return active;
}

export function PreviewActivityBoundary({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const active = usePreviewVisibility(ref);
  return (
    <div ref={ref} className={className}>
      <PreviewActivity.Provider value={active}>
        {children}
      </PreviewActivity.Provider>
    </div>
  );
}

export function usePreviewActivity() {
  return useContext(PreviewActivity);
}
