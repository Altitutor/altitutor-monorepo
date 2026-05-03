"use client";

export function NoiseOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] h-dvh w-screen opacity-5 mix-blend-multiply">
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <filter id="noiseFilterUcat">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilterUcat)" />
      </svg>
    </div>
  );
}
