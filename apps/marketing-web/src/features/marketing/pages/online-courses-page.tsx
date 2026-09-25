import { PRODUCT_LINKS } from "@/lib/site";
import {
  Button,
  Copy,
  Eyebrow,
  ResourceImage,
  SectionTitle,
} from "../components/primitives";
import { content } from "../content";
import styles from "../marketing.module.css";

export function OnlineCoursesPage() {
  return (
    <>
      <section
        className={`${styles.container} ${styles.hero} ${styles.editorialHero}`}
      >
        <Eyebrow>Online courses</Eyebrow>
        <h1>
          Your goals.<em>Your place. Your pace.</em>
        </h1>
        <p className={styles.lede}>
          Keep learning beyond the classroom. Explore online SACE and IB study
          resources, or build a personalised plan for UCAT preparation.
        </p>
        <div className={styles.actions}>
          <Button href="#school-resources">SACE & IB resources</Button>
          <Button href="#online-ucat" secondary>
            Altitutor UCAT
          </Button>
        </div>
      </section>
      <section
        className={`${styles.container} ${styles.section}`}
        id="school-resources"
      >
        <SectionTitle eyebrow="School subjects">
          Support for your studies.
          <br />
          <em>Whenever you need it.</em>
        </SectionTitle>
        <div className={styles.courseList}>
          <article className={styles.courseChoice}>
            <ResourceImage
              src="/images/marketing/resources-devices.png"
              alt="SACE and IB study resources on a tablet and phone"
            />
            <div>
              <Eyebrow>01 / Online resources</Eyebrow>
              <h3>Online SACE & IB resources</h3>
              <Copy block={content("/resources/", "29b2be3")} />
              <p className={styles.copy}>
                Explore notes, video lessons, practice questions and exams, with
                study tools and tutor support through the student portal.
              </p>
              <div className={styles.actions}>
                <Button href="/online-courses/sace-ib-resources/">
                  Explore the resources
                </Button>
              </div>
            </div>
          </article>
        </div>
      </section>
      <section
        id="online-ucat"
        className={`${styles.processSection} ${styles.section}`}
      >
        <div className={styles.container}>
          <SectionTitle eyebrow="Your pathway to medicine">
            UCAT preparation.
            <br />
            <em>Planned around you.</em>
          </SectionTitle>
          <div className={styles.courseList}>
            <article className={styles.courseChoice}>
              <ResourceImage
                src="/images/marketing/ucat-qr-online.png"
                alt="Altitutor UCAT online practice questions"
              />
              <div>
                <Eyebrow>02 / Altitutor UCAT</Eyebrow>
                <h3>A personalised plan for your target score</h3>
                <p className={styles.copy}>
                  Altitutor UCAT plans your practice around your strengths,
                  weaknesses and test date. Build your skills with learning
                  modules, 10,000+ questions and 30+ full mocks, then use your
                  results to guide what comes next.
                </p>
                <p className={styles.copy}>
                  Start with ongoing Free access, with allowances that reset.
                </p>
                <div className={styles.actions}>
                  <Button href="/ucat/">Explore Altitutor UCAT</Button>
                  <Button href={PRODUCT_LINKS.ucatSignup} secondary>
                    Start preparing free
                  </Button>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section className={`${styles.container} ${styles.section}`}>
        <SectionTitle eyebrow="Learn with a tutor">
          Prefer to learn in person?
          <br />
          <em>Find your course in Adelaide.</em>
        </SectionTitle>
        <div className={styles.actions}>
          <Button href="/classes/">In person courses</Button>
          <Button href="/about/contact/" secondary>
            Talk to us
          </Button>
        </div>
      </section>
    </>
  );
}
