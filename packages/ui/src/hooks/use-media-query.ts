"use client";

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
const MediaQueryWidthContext = createContext<number | null>(null);
/** Optional measured content width for split-pane applications. */
export function MediaQueryWidthProvider({ width, children }: { width: number | null; children: ReactNode }) {
  return createElement(MediaQueryWidthContext.Provider, { value: width }, children);
}
export function useMediaQuery(query: string) {
  const width = useContext(MediaQueryWidthContext);
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  if (width !== null) {
    const min = query.match(/min-width:\s*([\d.]+)px/);
    const max = query.match(/max-width:\s*([\d.]+)px/);
    if (min || max) return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
  }
  return matches;
}
