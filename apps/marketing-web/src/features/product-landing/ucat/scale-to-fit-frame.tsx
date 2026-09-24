"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const DemoScaleContext = createContext(1);

export function useDemoScale(): number {
  return useContext(DemoScaleContext);
}

/** 16:9 design canvas for the practice-card simulator preview. */
export const SIMULATOR_CARD_DESIGN_WIDTH = 960;
export const SIMULATOR_CARD_DESIGN_HEIGHT = 540;

type ScaleToFitFrameProps = {
  children: ReactNode;
  className?: string;
  designWidth?: number;
  designHeight?: number;
  /** Scale to fit width only (default), or fit within width and height. */
  fitMode?: "width" | "contain";
};

export function ScaleToFitFrame({
  children,
  className = "",
  designWidth = SIMULATOR_CARD_DESIGN_WIDTH,
  designHeight = SIMULATOR_CARD_DESIGN_HEIGHT,
  fitMode = "width",
}: ScaleToFitFrameProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const update = () => {
      const rect = viewport.getBoundingClientRect();
      if (rect.width <= 0) return;

      const scaleW = rect.width / designWidth;
      const scaleH =
        rect.height > 0 ? rect.height / designHeight : Number.POSITIVE_INFINITY;
      const nextScale =
        fitMode === "contain"
          ? Math.min(scaleW, scaleH, 1)
          : Math.min(scaleW, 1);
      const scaledWidth = designWidth * nextScale;
      const scaledHeight = designHeight * nextScale;
      setScale(nextScale);
      setOffset({
        x: fitMode === "contain" ? Math.max(0, (rect.width - scaledWidth) / 2) : 0,
        y: fitMode === "contain" ? Math.max(0, (rect.height - scaledHeight) / 2) : 0,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [designWidth, designHeight, fitMode]);

  return (
    <DemoScaleContext.Provider value={scale}>
      <div
        ref={viewportRef}
        className={`relative w-full min-w-0 overflow-hidden ${className}`}
        style={
          fitMode === "contain"
            ? { height: "100%" }
            : { aspectRatio: `${designWidth} / ${designHeight}` }
        }
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: designWidth,
            height: designHeight,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </DemoScaleContext.Provider>
  );
}
