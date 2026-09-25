import { content } from "../content";
import { Button, Copy, Eyebrow, SectionTitle } from "../components/primitives";
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
          <Copy block={content("/about/subsidy/", "6d7097b")} />
          <div className={styles.actions}>
            <Button href="mailto:admin@altitutor.com?subject=Tuition%20subsidy%20application">
              Email your application
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
