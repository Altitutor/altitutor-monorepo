"use client";
import { useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMediaQuery, MediaQueryWidthProvider } from "@altitutor/ui";
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
      <MediaQueryWidthProvider width={width}>
        {children}
      </MediaQueryWidthProvider>
    </div>
  );
}
export function usePanelMediaQuery(query: string) {
  return useMediaQuery(query);
}
