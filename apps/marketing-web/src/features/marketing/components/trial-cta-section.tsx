import { PRODUCT_LINKS } from "@/lib/site";
import { Button, Eyebrow } from "./primitives";
import styles from "../marketing.module.css";

const EYEBROW = "Free trial session";

/** Closing CTA: home, course pages, testimonials, contact. */
export function TrialCTA({ href = PRODUCT_LINKS.trialBooking }: { href?: string }) {
  return (
    <section className={styles.cta} data-nav-label={EYEBROW}>
      <Eyebrow>{EYEBROW}</Eyebrow>
      <h2>
        Interested?
        <br />
        <em>Book a free trial session.</em>
      </h2>
      <p>
        Meet your tutor, ask questions and try a lesson. Your first trial
        session is free.
      </p>
      <div className={styles.actions}>
        <Button href={href}>Book a free trial</Button>
      </div>
    </section>
  );
}
