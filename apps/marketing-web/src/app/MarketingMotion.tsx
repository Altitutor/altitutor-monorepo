"use client";

import { gsap } from "gsap";
import { useEffect, useRef } from "react";

export function MarketingMotion({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const nav = root.querySelector<HTMLElement>("[data-marketing-nav]");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    root.classList.add("marketing-motion-ready");

    let ticking = false;
    const updateNav = () => {
      ticking = false;
      if (window.scrollY > 100) {
        nav?.setAttribute("data-scrolled", "true");
      } else {
        nav?.removeAttribute("data-scrolled");
      }
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateNav);
    };

    updateNav();
    window.addEventListener("scroll", onScroll, { passive: true });

    const heroElements = Array.from(root.querySelectorAll<HTMLElement>("[data-hero-reveal]"));

    if (reduceMotion) {
      heroElements.forEach((element) => element.classList.add("is-revealed"));
      return () => {
        window.removeEventListener("scroll", onScroll);
        root.classList.remove("marketing-motion-ready");
      };
    }

    const heroTween = gsap.fromTo(
      heroElements,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 1.2,
        stagger: 0.08,
        ease: "power3.out",
        delay: 0.2,
        clearProps: "opacity,transform",
        onComplete: () => heroElements.forEach((element) => element.classList.add("is-revealed")),
      },
    );

    return () => {
      heroTween.kill();
      window.removeEventListener("scroll", onScroll);
      root.classList.remove("marketing-motion-ready");
    };
  }, []);

  return <div ref={rootRef}>{children}</div>;
}
