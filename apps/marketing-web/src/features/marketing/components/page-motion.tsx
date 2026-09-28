"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Progressive enhancement: content stays visible without JavaScript or motion. */
export function PageMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches || !root.current) return;
    const animations = new Set<Animation>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          const parent = entry.target.parentElement;
          const staggered = parent?.hasAttribute("data-scroll-stagger") ?? false;
          const staggerIndex = staggered && parent
            ? Array.from(parent.children).indexOf(entry.target)
            : 0;
          const delay = Math.min(staggerIndex, 3) * 70;
          const animation = entry.target.animate(
            [
              { opacity: 0, transform: "translateY(12px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            {
              duration: staggered ? 420 : 360,
              delay,
              easing: "cubic-bezier(.22,1,.36,1)",
              fill: delay ? "backwards" : "none",
            },
          );
          animations.add(animation);
          void animation.finished.then(
            () => animations.delete(animation),
            () => animations.delete(animation),
          );
        }
      },
      { threshold: 0, rootMargin: "0px 0px 100px 0px" },
    );
    root.current
      .querySelectorAll("section > div, section > h2, section > p")
      .forEach((element) => {
        // Explicit sequences reveal their individual items, never the whole
        // section at once (which consumes the effect before later items arrive).
        if (element.closest("[data-scroll-sequence]")) return;
        // Reveal smaller elements on every device without promoting an entire
        // tall section into a large composited layer.
        if (element.getBoundingClientRect().height > window.innerHeight) return;
        // Never delay visible hero content or animate its image during LCP.
        if (element.getBoundingClientRect().top >= window.innerHeight)
          observer.observe(element);
      });
    root.current
      .querySelectorAll(
        "[data-scroll-reveal], [data-scroll-items] > *, [data-scroll-stagger] > *",
      )
      .forEach((element) => observer.observe(element));
    const stop = () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
    };
    media.addEventListener("change", stop);
    return () => {
      stop();
      media.removeEventListener("change", stop);
    };
  }, [pathname]);

  return (
    <main id="main-content" ref={root}>
      {children}
    </main>
  );
}
