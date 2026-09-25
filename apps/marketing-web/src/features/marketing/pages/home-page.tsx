import Image from "next/image";
import Link from "next/link";
import { ArrowRight, HeartHandshake } from "lucide-react";
import { PRODUCT_LINKS } from "@/lib/site";
import { content } from "../content";
import {
  Button,
  ContentCard,
  Copy,
  Eyebrow,
  Quotes,
  SectionTitle,
  TrialCTA,
} from "../components/primitives";
import styles from "../marketing.module.css";

const home = (id: string) => content("/", id);
const pathways = [
  {
    id: "38600ea",
    title: "Weekly tuition",
    href: "/classes/weekly-classes/",
    image: "/images/marketing/chemistry-notes.png",
    label: "Explore weekly classes",
  },
  {
    id: "335161b",
    title: "UCAT preparation",
    href: "/classes/ucatprep/",
    image: "/images/marketing/ucat-qr-online.png",
    label: "Explore UCAT classes",
  },
  {
    id: "d36aa0c",
    title: "Assignment drafting",
    href: "/classes/assignment-drafting/",
    image: "/images/marketing/english-draft.png",
    label: "Get help with your writing",
  },
];
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
      <section
        className={`${styles.container} ${styles.homeStats}`}
        aria-label="Student outcomes"
      >
        <div>
          <strong>
            94<span>%</span>
          </strong>
          <p>
            Of our graduating year 12s receive a university offer for their top
            preference.
          </p>
        </div>
        <div>
          <strong>
            96<span>%</span>
          </strong>
          <p>
            Of our students improve their grade by at least one grade band
            within one term.
          </p>
        </div>
        <div>
          <strong>
            100<span>+</span>
          </strong>
          <p>5 star reviews</p>
          <Link href="/about/testimonials/">
            Read our student stories <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <section
        id="find-your-course"
        className={`${styles.container} ${styles.section}`}
        data-nav-label="Courses"
      >
        <SectionTitle eyebrow="Courses">
          A little support.
          <br />
          <em>A lot of possibility.</em>
        </SectionTitle>
        <div className={styles.pathways}>
          {pathways.map((item) => (
            <article className={styles.pathway} key={item.id}>
              <div className={styles.pathwayArt}>
                <Image
                  src={item.image}
                  alt={`${item.title} learning materials`}
                  width={500}
                  height={330}
                  sizes="(max-width: 800px) 85vw, 30vw"
                />
              </div>
              <h3>{item.title}</h3>
              <Copy block={home(item.id)} />
              <Link className={styles.textLink} href={item.href}>
                {item.label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
        <Link className={styles.textLink} href="/classes/">
          Explore all courses, including exam and interview preparation{" "}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
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
        className={`${styles.container} ${styles.section}`}
        data-nav-label="Why choose us"
      >
        <div className={styles.split}>
          <SectionTitle eyebrow="Why choose us">
            Good teaching.
            <br />
            <em>Support around it.</em>
          </SectionTitle>
          <div className={styles.benefits}>
            {["4909d86", "bbc3db2", "88e7edc", "bd33a23"].map((id, i) => (
              <ContentCard key={id} block={home(id)} number={i + 1} />
            ))}
          </div>
        </div>
      </section>
      <section
        id="how-it-works"
        className={`${styles.processSection} ${styles.section}`}
        data-nav-label="How it works"
      >
        <div className={`${styles.container} ${styles.split}`}>
          <div className={styles.processIntro}>
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
              <Button href="/classes/" secondary>
                Courses
              </Button>
            </div>
            <div className={styles.subsidyNote}>
              <Copy block={home("27683c5")} />
              <Copy block={home("47753a1")} />
              <Copy block={home("a4a328d")} />
            </div>
          </div>
          <div className={styles.timeline}>
            {steps.map(([id, title]) => (
              <article key={id}>
                <h3>{title}</h3>
                <Copy block={home(id)} />
              </article>
            ))}
          </div>
        </div>
      </section>
      <section
        className={`${styles.container} ${styles.section}`}
        data-nav-label="Student stories"
      >
        <SectionTitle eyebrow="Student stories">
          See what our students
          <br />
          <em>have to say.</em>
        </SectionTitle>
        <Quotes items={home("68bcaf8").items ?? []} />
        <div className={styles.stats}>
          {[
            ["411ec3f", "19ebe95"],
            ["7f3ff04", "207f253"],
            ["52fb120", "dd6d4c1"],
            ["d7f5c3a", "1d9e88f"],
          ].map(([stat, label]) => (
            <div key={stat}>
              <span className={styles.statValue}>{home(stat).value}</span>
              <Copy block={home(label)} />
            </div>
          ))}
        </div>
        <p className={styles.statsContext}>
          Published student outcomes and feedback. Every student’s experience is
          different.
        </p>
        <Link className={styles.textLink} href="/about/testimonials/">
          All reviews, results and how we measure them{" "}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
      <TrialCTA eyebrow="Free trial session" />
    </>
  );
}
