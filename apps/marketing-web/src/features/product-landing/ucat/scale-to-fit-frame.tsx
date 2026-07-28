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
};

export function ScaleToFitFrame({
  children,
  className = "",
  designWidth = SIMULATOR_CARD_DESIGN_WIDTH,
  designHeight = SIMULATOR_CARD_DESIGN_HEIGHT,
}: ScaleToFitFrameProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const update = () => {
      const width = viewport.getBoundingClientRect().width;
      if (width <= 0) return;

      // Match width only — viewport aspect ratio is locked to the design canvas.
      // Avoid min(width, height) here: height can be 0 before layout settles, which
      // previously forced scale back to 1 and clipped the 960px canvas on mobile.
      const nextScale = Math.min(width / designWidth, 1);
      setScale(nextScale);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [designWidth]);

  return (
    <DemoScaleContext.Provider value={scale}>
      {/*
        Keep the fixed-size design canvas out of document flow so its 960px
        width never becomes the grid item's min-content width on narrow viewports.
      */}
      <div
        ref={viewportRef}
        className={`relative w-full min-w-0 overflow-hidden ${className}`}
        style={{ aspectRatio: `${designWidth} / ${designHeight}` }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: designWidth,
            height: designHeight,
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </DemoScaleContext.Provider>
  );
}
