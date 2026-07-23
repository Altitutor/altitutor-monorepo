"use client";

import { useLayoutEffect } from "react";

/** Keep generated product captures deterministic without changing a user's saved theme. */
export function MarketingPreviewLightMode() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousClassName = root.className;
    const previousColorScheme = root.style.colorScheme;

    const forceLight = () => {
      if (
        root.classList.contains("dark") ||
        !root.classList.contains("light")
      ) {
        root.classList.remove("dark");
        root.classList.add("light");
      }
      root.style.colorScheme = "light";
    };

    forceLight();
    const observer = new MutationObserver(forceLight);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      root.className = previousClassName;
      root.style.colorScheme = previousColorScheme;
    };
  }, []);

  return null;
}
