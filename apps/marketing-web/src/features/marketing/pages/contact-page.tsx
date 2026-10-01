import { ArrowUpRight } from "lucide-react";
import { content } from "../content";
import { Copy, Eyebrow } from "../components/primitives";
import { TrialCTA } from "../components/trial-cta-section";
import styles from "../marketing.module.css";

export function ContactPage() {
  return (
    <>
      <div className={styles.container}>
      <section className={`${styles.hero} ${styles.contactHero}`}>
        <Eyebrow>Contact us</Eyebrow>
        <h1>
          Got a question?<em>Let’s talk.</em>
        </h1>
        <Copy
          block={content("/about/contact/", "2cc856f5")}
          className={styles.lede}
        />
      </section>
      <section
        className={styles.contactGrid}
        aria-label="Contact details and location"
      >
        <div className={styles.contactDetails}>
          <Eyebrow>We’re here to help</Eyebrow>
          <h2>Our details</h2>
          <div className={styles.contactMethod}>
            <span>Email us</span>
            <a href="mailto:admin@altitutor.com">
              admin@altitutor.com
              <ArrowUpRight size={19} aria-hidden="true" />
            </a>
          </div>
          <div className={styles.contactMethod}>
            <span>Send us an SMS</span>
            <a href="sms:+61483849842">
              0483 849 842
              <ArrowUpRight size={19} aria-hidden="true" />
            </a>
          </div>
          <div className={styles.contactMethod}>
            <span>Find us in Adelaide</span>
            <address>
              Level 1, 17A Solomon St
              <br />
              Adelaide SA 5000
            </address>
          </div>
        </div>
        <div className={styles.mapPanel}>
          <iframe
            title="Altitutor at 17A Solomon Street, Adelaide"
            src={content("/about/contact/", "3dc4ef37").href}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className={styles.mapCaption}>
            <span>Your next chapter starts here.</span>
            <a href="https://www.google.com/maps/search/?api=1&query=Altitutor+17A+Solomon+St+Adelaide">
              Get directions <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
      </div>
      <TrialCTA />
    </>
  );
}
