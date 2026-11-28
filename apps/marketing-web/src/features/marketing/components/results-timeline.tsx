"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import styles from "./results-timeline.module.css";

type ResultYear = {
  id: string;
  title: string;
  stats: { id: string; value: string; label: string }[];
};

function Clipping() {
  return (
    <figure className={styles.clipping}>
      <a
        href="/images/marketing/newspaper-article.webp"
        aria-label="Open the full newspaper clipping"
      >
        <Image
          src="/images/marketing/newspaper-article.webp"
          alt="The Aces of SACE newspaper front page"
          width={1079}
          height={1237}
          sizes="(max-width: 640px) 75vw, 320px"
        />
      </a>
      <figcaption>
        Four students earned a 99.95 ATAR. Three studied with us.
      </figcaption>
    </figure>
  );
}

function PressStory() {
  return (
    <div className={styles.story}>
      <p className={styles.kicker}>In the press</p>
      <h3>
        Four perfect ATARs.
        <br />
        <em>One front page.</em>
      </h3>
    </div>
  );
}

function Stats({ year }: { year: ResultYear }) {
  return (
    <dl className={styles.stats}>
      {year.stats.map((stat) => (
        <div key={stat.id}>
          <dt>{stat.label}</dt>
          <dd>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Cohort() {
  return (
    <div className={styles.cohort} data-milestone>
      <p className={styles.kicker}>Beyond Year 12</p>
      <h3>
        Life after <em>Altitutor.</em>
      </h3>
      <p>
        Our first Year 12 cohort has now finished university, with former
        students working as doctors, dentists, and other professionals.
      </p>
    </div>
  );
}

function YearRows({ years }: { years: ResultYear[] }) {
  return (
    <ol className={styles.years}>
      {years.map((year) => (
        <li key={year.id} data-milestone>
          <h3>{year.title.slice(0, 4)}</h3>
          <Stats year={year} />
        </li>
      ))}
    </ol>
  );
}

export function ResultsTimeline({ years }: { years: ResultYear[] }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-reached", "");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    el.querySelectorAll("[data-milestone]").forEach((node) =>
      observer.observe(node),
    );
    return () => observer.disconnect();
  }, [years]);
  const ordered = [...years].reverse();
  return (
    <div ref={root} className={styles.timeline}>
      <header className={styles.heading}>
        <p className={styles.kicker}>Student results</p>
        <h2>
          From Year 12 <em>onwards.</em>
        </h2>
      </header>
      <div className={styles.spread}>
        <PressStory />
        <Clipping />
      </div>
      <YearRows years={ordered} />
      <Cohort />
    </div>
  );
}
