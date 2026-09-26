"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "../marketing.module.css";

export type ResultYear = {
  id: string;
  title: string;
  stats: { id: string; value: string; label: string }[];
};

function navBottom(): number {
  const nav = document.querySelector<HTMLElement>("[data-marketing-nav]");
  return nav?.getBoundingClientRect().bottom ?? 90;
}

/** Sticky offset that centres the card between the nav pill and the viewport bottom. */
function pinTop(card: HTMLElement): number {
  const above = navBottom();
  const available = window.innerHeight - above;
  return Math.max(above + 12, above + (available - card.offsetHeight) / 2);
}

export function ResultYearStack({ years }: { years: ResultYear[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLElement | null)[]>([]);

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const stack = () =>
      cardsRef.current.filter((card): card is HTMLElement => card !== null);

    const placeCards = () => {
      stack().forEach((card) => {
        card.style.top = `${pinTop(card)}px`;
      });
    };

    const context = gsap.context(() => {
      placeCards();
      const cards = stack();
      cards.forEach((card, index) => {
        const next = cards[index + 1];
        if (!next) return;
        gsap.to(card, {
          scrollTrigger: {
            trigger: next,
            start: () => {
              const pin = pinTop(next);
              return `top ${pin + Math.min(240, window.innerHeight * 0.28)}px`;
            },
            end: () => `top ${pinTop(next)}px`,
            scrub: true,
            invalidateOnRefresh: true,
          },
          scale: 0.9,
          filter: "blur(20px)",
          opacity: 0.5,
          ease: "none",
        });
      });
    }, containerRef);
    ScrollTrigger.addEventListener("refreshInit", placeCards);
    const refresh = () => {
      placeCards();
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", refresh);
    const refreshTimer = window.setTimeout(refresh, 100);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener("resize", refresh);
      ScrollTrigger.removeEventListener("refreshInit", placeCards);
      stack().forEach((card) => {
        card.style.top = "";
      });
      context.revert();
    };
  }, [years]);

  return (
    <div className={`${styles.container} ${styles.resultStack}`} ref={containerRef}>
      {years.map((year, index) => (
        <article
          key={year.id}
          className={`${styles.resultsYear} ${styles.resultStackCard}`}
          style={{ zIndex: index + 1 }}
          ref={(element) => {
            cardsRef.current[index] = element;
          }}
        >
          <h3>{year.title}</h3>
          <div className={styles.stats}>
            {year.stats.map((stat) => (
              <div key={stat.id}>
                <span className={styles.statValue}>{stat.value}</span>
                <p className={styles.copy}>{stat.label}</p>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
