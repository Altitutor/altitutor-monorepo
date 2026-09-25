import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { ContentBlock, ContentItem } from "../content";
import motion from "./magnetic-button.module.css";
import styles from "../marketing.module.css";

export function Copy({
  block,
  html,
  className = "",
}: {
  block?: ContentBlock;
  html?: string;
  className?: string;
}) {
  // Only checked-in, allowlisted marketing content supplies HTML.
  return (
    <div
      className={`${styles.copy} ${className}`}
      dangerouslySetInnerHTML={{
        __html: (html ?? block?.html ?? "")
          .replaceAll(
            'href="/resources/"',
            'href="/online-courses/sace-ib-resources/"',
          )
          .replaceAll(
            'href="/classes/english-assignment-drafting/"',
            'href="/classes/assignment-drafting/"',
          ),
      }}
    />
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>;
}

export function Button({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`${motion.magnetic} ${styles.button} ${secondary ? styles.secondaryButton : ""}`}
    >
      <span className={motion.fill} aria-hidden="true" />
      {children}
      <ArrowRight size={17} aria-hidden="true" />
    </Link>
  );
}

export function SectionTitle({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.sectionHeading}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2>{children}</h2>
    </div>
  );
}

export function ContentCard({
  block,
  number,
}: {
  block: ContentBlock;
  number?: number;
}) {
  return (
    <article className={styles.contentCard}>
      {number !== undefined ? (
        <span className={styles.number}>{String(number).padStart(2, "0")}</span>
      ) : null}
      <h3>{block.title}</h3>
      <Copy block={block} />
    </article>
  );
}

export function ResourceImage({
  src,
  alt,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`${styles.resourceImage} ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={900}
        height={760}
        sizes="(max-width: 700px) 90vw, 45vw"
        priority={priority}
      />
    </div>
  );
}

export function Questions({ items }: { items: ContentItem[] }) {
  return (
    <div className={styles.questions}>
      {items.map((item) => (
        <details key={item.title}>
          <summary>
            {item.title}
            <Plus size={20} aria-hidden="true" />
          </summary>
          <Copy html={item.html} />
        </details>
      ))}
    </div>
  );
}

export function Quotes({ items }: { items: ContentItem[] }) {
  return (
    <div className={styles.quotes}>
      {items.map((item, index) => (
        <figure key={`${item.title}-${index}`} className={styles.quote}>
          <span className={styles.quoteMark} aria-hidden="true">
            “
          </span>
          <blockquote>
            <Copy html={item.html} />
          </blockquote>
          <figcaption>
            <span className={styles.avatar} aria-hidden="true">
              {item.title.charAt(0)}
            </span>
            <div>
              <strong>{item.title}</strong>
              <span>{item.role}</span>
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function PageLinks({ links }: { links: Array<[string, string]> }) {
  return (
    <nav className={styles.pageLinks} aria-label="On this page">
      {links.map(([href, label]) => (
        <a key={href} href={href}>
          {label}
          <span aria-hidden="true">↗</span>
        </a>
      ))}
    </nav>
  );
}
