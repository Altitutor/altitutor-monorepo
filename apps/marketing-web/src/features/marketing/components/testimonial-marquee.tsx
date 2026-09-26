import { Star } from "lucide-react";
import type { ContentItem } from "../content";
import { Copy } from "./primitives";
import styles from "../marketing.module.css";

function StarRating() {
  return (
    <div className={styles.starRating} aria-label="5 star review">
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={15} aria-hidden="true" />
      ))}
    </div>
  );
}

function TestimonialCard({ item }: { item: ContentItem }) {
  return (
    <figure className={styles.quote}>
      <StarRating />
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
  );
}

export function TestimonialMarquee({ items }: { items: ContentItem[] }) {
  const rows = [
    items.filter((_, index) => index % 2 === 0),
    items.filter((_, index) => index % 2 === 1),
  ].filter((row) => row.length > 0);

  return (
    <div className={styles.marquee}>
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={`${styles.marqueeRow} ${rowIndex === 1 ? styles.marqueeRowReverse : ""}`}
        >
          <div className={styles.marqueeTrack}>
            {[false, true].map((duplicate) => (
              <ul
                key={duplicate ? "duplicate" : "original"}
                className={styles.marqueeSet}
                aria-hidden={duplicate ? true : undefined}
              >
                {row.map((item, index) => (
                  <li key={`${item.title}-${item.role ?? ""}-${index}`}>
                    <TestimonialCard item={item} />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
