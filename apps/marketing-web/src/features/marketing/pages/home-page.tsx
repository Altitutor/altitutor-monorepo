import Image from "next/image";
import Link from "next/link";
import { ArrowRight, HeartHandshake } from "lucide-react";
import { PRODUCT_LINKS } from "@/lib/site";
import { content, pageContent } from "../content";
import { TestimonialMarquee } from "../components/testimonial-marquee";
import { WhyChooseUs } from "../components/why-choose-us";
import {
  Button,
  Copy,
  Eyebrow,
  SectionTitle,
} from "../components/primitives";
import { TrialCTA } from "../components/trial-cta-section";
import { SubsidyLearnMoreDialog } from "../components/subsidy-learn-more-dialog";
import styles from "../marketing.module.css";

const home = (id: string) => content("/", id);
const steps = [
  ["4b948c6", "Meet your tutor"],
  ["044a70c", "Find your starting point"],
  ["d46edbb", "Learn ahead of school"],
  ["15badb1", "Keep support close"],
  ["859534a", "Help someone else learn"],
];

export function HomePage() {
  return (
    <>
      <section
        className={`${styles.hero} ${styles.centerHero} ${styles.mountainHero}`}
        data-nav-label="Altitutor"
      >
        <div className={styles.mountainBackdrop}>
          <Image
            src="/images/landing/background-alt-scaled.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className={styles.mountainImage}
          />
        </div>
        <div className={styles.container}>
          <Link href="/ucat/" className={styles.announcement}>
            <span>New</span> Meet Altitutor UCAT online{" "}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <h1>
            Want better results?<em>Altitutor can help.</em>
          </h1>
          <p className={styles.lede}>
            <HeartHandshake size={22} aria-hidden="true" />
            A mission-driven non-profit providing accessible education for all
            students.
          </p>
          <div className={styles.actions}>
            <Button href={PRODUCT_LINKS.trialBooking}>Book a free trial</Button>
            <Button href="#find-your-course" secondary>
              Find your course
            </Button>
          </div>
        </div>
      </section>
      <WhyChooseUs
        copy={{
          "4909d86": home("4909d86").html ?? "",
          bbc3db2: home("bbc3db2").html ?? "",
          "88e7edc": home("88e7edc").html ?? "",
          bd33a23: home("bd33a23").html ?? "",
        }}
      />
      <section className={styles.mission} data-nav-label="Our mission">
        <div className={`${styles.container} ${styles.split}`}>
          <div className={styles.sectionHeading}>
            <Eyebrow>Our mission</Eyebrow>
            <h2>
              A different way
              <br />
              <em>to do tuition.</em>
            </h2>
            <div className={styles.actions}>
              <Button href="/about/">Get to know Altitutor</Button>
            </div>
          </div>
          <Copy block={home("18f6dd8")} />
        </div>
      </section>
      <section
        id="how-it-works"
        className={`${styles.processSection} ${styles.section}`}
        data-nav-label="How it works"
        data-scroll-sequence
      >
        <div className={`${styles.container} ${styles.split}`}>
          <div className={`${styles.processIntro} ${styles.stickyIntro}`}>
            <Eyebrow>How it works</Eyebrow>
            <h2>
              Start where you are.
              <br />
              <em>We’ll go from there.</em>
            </h2>
            <Copy block={home("22ba66d")} />
            <div className={styles.actions}>
              <Button href={PRODUCT_LINKS.trialBooking}>
                Book a trial session
              </Button>
              <Button href="#find-your-course" secondary>
                Find your course
              </Button>
            </div>
          </div>
          <div className={styles.timeline} data-scroll-items>
            {steps.map(([id, title]) => (
              <article key={id}>
                <h3>{title}</h3>
                <Copy block={home(id)} />
                {id === "859534a" ? (
                  <div className={styles.timelineLearnMore}>
                    <SubsidyLearnMoreDialog
                      eyebrow="Tuition subsidy"
                      title="Same teaching for every student"
                      paragraphs={[
                        home("27683c5").html ?? "",
                        home("47753a1").html ?? "",
                        home("a4a328d").html ?? "",
                      ]}
                    />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className={styles.section} data-nav-label="Student stories">
        <div className={styles.container}>
          <SectionTitle eyebrow="Student stories">
            See what our students
            <br />
            <em>have to say.</em>
          </SectionTitle>
        </div>
        <TestimonialMarquee
          items={pageContent("/about/testimonials/")
            .filter((block) => block.kind === "testimonial-carousel")
            .flatMap((block) => block.items ?? [])}
        />
        <div className={styles.container}>
          <Link className={styles.textLink} href="/about/testimonials/">
            All reviews, results and how we measure them{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <TrialCTA />
    </>
  );
}
