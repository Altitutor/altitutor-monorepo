import { content } from "../content";
import { Button, Copy, Eyebrow, SectionTitle } from "../components/primitives";
import { PRODUCT_LINKS } from "@/lib/site";
import styles from "../marketing.module.css";

export function SubsidyPage() {
  return (
    <>
      <section
        className={`${styles.container} ${styles.hero} ${styles.editorialHero}`}
      >
        <Eyebrow>Tuition subsidy program</Eyebrow>
        <h1>
          Can’t afford tuition?<em>Not a problem.</em>
        </h1>
        <Copy block={content("/about/subsidy/", "df24ab3")} />
        <div className={styles.actions}>
          <Button href="#apply">How to apply</Button>
        </div>
      </section>
      <section
        className={`${styles.container} ${styles.section} ${styles.split}`}
      >
        <div>
          <SectionTitle eyebrow="How it works">
            A conversation first.
            <br />
            <em>Support from there.</em>
          </SectionTitle>
          <Copy block={content("/about/subsidy/", "1c95c56")} />
        </div>
        <div id="apply" className={styles.application}>
          <Eyebrow>Your application</Eyebrow>
          <h2>
            Tell us a little
            <br />
            about yourself.
          </h2>
          <p>
            Book a subsidy interview and tell us about your situation. We will
            meet you, work out what you can afford, and register the subsidised
            fee from there.
          </p>
          <div className={styles.actions}>
            <Button href={PRODUCT_LINKS.subsidyBooking}>
              Apply for a subsidy
            </Button>
          </div>
        </div>
      </section>
      <section className={styles.cta}>
        <Eyebrow>We’re here to help</Eyebrow>
        <h2>
          Still have questions?
          <br />
          <em>Get in touch.</em>
        </h2>
        <div className={styles.actions}>
          <Button href="/about/contact/">Contact us</Button>
        </div>
      </section>
    </>
  );
}
