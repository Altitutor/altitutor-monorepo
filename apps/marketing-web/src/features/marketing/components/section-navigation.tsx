"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./section-navigation.module.css";

type Section = { id: string; label: string };

/** The course templates already provide their own section navigation. */
export function SectionNavigation() {
  const pathname = usePathname();
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main || main.querySelector('[aria-label="Course sections"]')) {
      setSections([]);
      return;
    }
    const headings = Array.from(
      main.querySelectorAll<HTMLElement>("h1, h2"),
    ).filter(
      (heading) =>
        !heading.closest(
          '[role="dialog"], dialog, [aria-hidden="true"], .marketing-product-ui',
        ),
    );
    const seen = new Set<HTMLElement>();
    const targets = headings.flatMap((heading, index) => {
      const target = heading.closest<HTMLElement>("section") ?? heading;
      const eyebrow = heading.previousElementSibling;
      const eyebrowLabel =
        eyebrow instanceof HTMLElement && eyebrow.tagName === "P"
          ? eyebrow.textContent?.replace(/\s+/g, " ").trim()
          : "";
      const alreadySeen = seen.has(target);
      seen.add(target);
      if (alreadySeen && !eyebrowLabel) return [];
      const element = alreadySeen ? heading : target;
      const label =
        (!alreadySeen ? element.dataset.navLabel : "")?.replace(/\s+/g, " ").trim() ||
        eyebrowLabel ||
        heading.textContent?.replace(/\s+/g, " ").trim();
      if (!label) return [];
      if (!element.id) element.id = `section-${index + 1}`;
      return [{ element, id: element.id, label }];
    });
    setSections(targets.map(({ id, label }) => ({ id, label })));
    setActive(targets[0]?.id ?? "");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -65% 0px" },
    );
    targets.forEach(({ element }) => observer.observe(element));
    return () => observer.disconnect();
  }, [pathname]);

  if (!sections.length) return null;
  return (
    <nav className={styles.rail} aria-label="Page sections">
      {sections.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-label={label}
          aria-current={active === id ? "location" : undefined}
        >
          <span className={styles.label}>{label}</span>
          <span className={styles.chip} aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}
