"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMediaQuery, MediaQueryWidthProvider } from "@altitutor/ui";
const WidthContext = createContext<number | null>(null);
export function ResponsivePane({
  children,
  className = "",
  inactive = false,
}: {
  children: ReactNode;
  className?: string;
  inactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    ref.current?.toggleAttribute("inert", inactive);
  }, [inactive]);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden={inactive || undefined}
      className={`admin-responsive-pane min-w-0 ${className}`}
      style={{ containerType: "inline-size", containerName: "admin-pane" }}
    >
      <WidthContext.Provider value={width}>
        <MediaQueryWidthProvider width={width}>
          {children}
        </MediaQueryWidthProvider>
      </WidthContext.Provider>
    </div>
  );
}
export function usePanelMediaQuery(query: string) {
  const width = useContext(WidthContext);
  const viewport = useMediaQuery(query);
  if (width === null) return viewport;
  const min = query.match(/min-width:\s*([\d.]+)px/);
  const max = query.match(/max-width:\s*([\d.]+)px/);
  if (!min && !max) return viewport;
  return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
}
