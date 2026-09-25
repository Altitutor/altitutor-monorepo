import { PRODUCT_LINKS } from "@/lib/site";
import { content, pageContent } from "../content";
import {
  Button,
  Copy,
  Eyebrow,
  PageLinks,
  Questions,
  Quotes,
  SectionTitle,
  TrialCTA,
} from "../components/primitives";
import styles from "../marketing.module.css";

export function TestimonialsPage() {
  const blocks = pageContent("/about/testimonials/");
  const years = blocks.filter(
    (b) => b.kind === "heading" && /^20\d\d results$/.test(b.title ?? ""),
  );
  const reviews = blocks
    .filter((b) => b.kind === "testimonial-carousel")
    .flatMap((b) => b.items ?? []);
  return (
    <>
      <section
        className={`${styles.container} ${styles.hero} ${styles.editorialHero}`}
      >
        <Eyebrow>Results & testimonials</Eyebrow>
        <h1>
          Their progress.<em>In their own words.</em>
        </h1>
        <Copy block={content("/about/testimonials/", "24797af")} />
      </section>
      <div className={styles.container}>
        <PageLinks
          links={[
            ["#results", "Student results"],
            ["#testimonials", "Student reviews"],
            ["#review", "Write a review"],
          ]}
        />
      </div>
      <section id="results" className={`${styles.container} ${styles.section}`}>
        <SectionTitle eyebrow="Student results">
          A look back.
          <br />
          <em>A lot to be proud of.</em>
        </SectionTitle>
        {years.map((year, i) => {
          const start = blocks.indexOf(year);
          const end =
            i + 1 < years.length
              ? blocks.indexOf(years[i + 1])
              : blocks.findIndex((b) => b.id === "8774f44");
          const stats = blocks
            .slice(start, end)
            .filter((b) => b.kind === "counter");
          return (
            <div key={year.id} className={styles.resultsYear}>
              <h3>{year.title}</h3>
              <div className={styles.stats}>
                {stats.map((stat, index) => (
                  <div key={stat.id}>
                    <span className={styles.statValue}>{stat.value}</span>
                    <p className={styles.copy}>
                      {stat.title ||
                        (index === 4
                          ? "Average tutor rating"
                          : "Average course rating")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <Questions
          items={content("/about/testimonials/", "8774f44").items ?? []}
        />
      </section>
      <section
        id="testimonials"
        className={`${styles.processSection} ${styles.section}`}
      >
        <div className={styles.container}>
          <div className={styles.split}>
            <SectionTitle eyebrow="Our students, unfiltered">
              Every experience
              <br />
              <em>has a voice.</em>
            </SectionTitle>
            <Copy block={content("/about/testimonials/", "9aaac8f")} />
          </div>
          <Quotes items={reviews.slice(0, 9)} />
          <details className={styles.moreReviews}>
            <summary>Read all {reviews.length} student reviews</summary>
            <Quotes items={reviews.slice(9)} />
          </details>
        </div>
      </section>
      <section
        id="review"
        className={`${styles.container} ${styles.section} ${styles.split}`}
      >
        <SectionTitle eyebrow="Write us a review">
          Your story
          <br />
          <em>belongs here, too.</em>
        </SectionTitle>
        <div>
          <Copy block={content("/about/testimonials/", "34760bf")} />
          <div className={styles.actions}>
            <Button href={PRODUCT_LINKS.student}>
              Open your student account
            </Button>
          </div>
        </div>
      </section>
      <TrialCTA />
    </>
  );
}
