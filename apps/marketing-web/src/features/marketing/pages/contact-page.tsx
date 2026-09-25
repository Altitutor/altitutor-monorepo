import { ArrowUpRight } from "lucide-react";
import { PRODUCT_LINKS } from "@/lib/site";
import { content } from "../content";
import { Button, Copy, Eyebrow } from "../components/primitives";
import styles from "../marketing.module.css";

export function ContactPage() {
  return (
    <div className={styles.container}>
      <section className={`${styles.hero} ${styles.contactHero}`}>
        <Eyebrow>Contact us</Eyebrow>
        <h1>
          A question?<em>Let’s talk.</em>
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
              Get directions ↗
            </a>
          </div>
        </div>
      </section>
      <section className={styles.contactNext}>
        <div>
          <h2>Ready to try a lesson?</h2>
          <p>
            Meet your tutor and see how we teach, with a free trial session.
          </p>
        </div>
        <Button href={PRODUCT_LINKS.trialBooking}>Book a free trial</Button>
      </section>
    </div>
  );
}
