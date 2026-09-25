import { SiteFrame } from "@/features/marketing/components/site-frame";
import { Button, Eyebrow } from "@/features/marketing/components/primitives";
import styles from "@/features/marketing/marketing.module.css";

export default function NotFound() {
  return (
    <SiteFrame>
      <section
        className={`${styles.container} ${styles.hero} ${styles.centerHero}`}
      >
        <Eyebrow>404 · Page not found</Eyebrow>
        <h1>
          A little lost?<em>Let’s find your way.</em>
        </h1>
        <div className={styles.actions}>
          <Button href="/">Back to home</Button>
          <Button href="/classes/" secondary>
            Explore courses
          </Button>
        </div>
      </section>
    </SiteFrame>
  );
}
