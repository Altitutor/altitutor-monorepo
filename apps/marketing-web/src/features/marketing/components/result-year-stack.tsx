"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "../marketing.module.css";

export type ResultYear = {
  id: string;
  title: string;
  stats: { id: string; value: string; label: string }[];
};

export function ResultYearStack({ years }: { years: ResultYear[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      const cards = cardsRef.current.filter(
        (card): card is HTMLElement => card !== null,
      );
      cards.forEach((card, index) => {
        const next = cards[index + 1];
        if (!next) return;
        gsap.to(card, {
          scrollTrigger: {
            trigger: next,
            start: "top 65%",
            end: "top top+=10%",
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
    const refreshTimer = window.setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);
    return () => {
      window.clearTimeout(refreshTimer);
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
