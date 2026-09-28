import Image from "next/image";
import { getStaffProfiles } from "@/features/staff/server/profiles";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { content, pageContent } from "../content";
import { AboutValues } from "../components/about-values";
import { TeachingMethodSection } from "../components/teaching-method-section";
import {
  Button,
  Copy,
  Eyebrow,
  PageLinks,
  SectionTitle,
} from "../components/primitives";
import styles from "../marketing.module.css";

const about = (id: string) => content("/about/", id);

export async function AboutPage() {
  const profiles = await getStaffProfiles();
  const charities = pageContent("/about/").filter(
    (b) => b.kind === "call-to-action",
  );
  const teachingDetail = (id: string, title: string, description: string) => {
    const original = about(id);
    return {
      title,
      description,
      originalTitle: original.title ?? title,
      html: original.html ?? "",
    };
  };
  const lessonSteps = [
    teachingDetail(
      "db71db1",
      "Review and remember",
      "Start with revision or flashcards so earlier topics stay familiar before exams arrive.",
    ),
    teachingDetail(
      "7b7691b",
      "Learn ahead of school",
      "Work through new content with your tutor, notes, and practice questions before it appears at school.",
    ),
    teachingDetail(
      "696bce9",
      "Practice for assessments",
      "Complete topic tests together, learn assessment strategies, and move on when you feel confident.",
    ),
  ];
  const weekSupport = [
    teachingDetail(
      "c48c5f3",
      "Homework help",
      "A free three-hour class for schoolwork, catch-up, and assignments.",
    ),
    teachingDetail(
      "b86f312",
      "Question helpline",
      "Ask tutors questions during the week whenever you get stuck.",
    ),
    teachingDetail(
      "8c6ca79",
      "Online resources",
      "Use notes, video lessons, flashcards, practice, tests, and exams.",
    ),
  ];

  return (
    <>
      <section
        className={`${styles.container} ${styles.hero} ${styles.aboutHero}`}
      >
        <div>
          <Eyebrow>About Altitutor</Eyebrow>
          <h1>
            Better tuition.<em>For more people.</em>
          </h1>
          <Copy block={about("9423a48")} />
        </div>
        <div className={styles.aboutHeroPhoto}>
          <Image
            src="/images/marketing/about-us.jpg"
            alt="Tutors and students working at desks in the Altitutor learning centre"
            width={1600}
            height={1066}
            priority
            sizes="(max-width: 800px) 90vw, 45vw"
          />
        </div>
      </section>
      <div className={styles.container}>
        <PageLinks
          links={[
            ["#values", "Our values"],
            ["#teaching", "How we teach"],
            ["#team", "Meet the team"],
            ["#charities", "Our wider community"],
          ]}
        />
      </div>
      <section id="values" className={`${styles.container} ${styles.section}`}>
        <div className={styles.split}>
          <SectionTitle eyebrow="Our mission and values">
            Transformative education.
            <br />
            <em>For all who need it.</em>
          </SectionTitle>
          <div className={styles.copy}>
            <p>
              Altitutor&apos;s mission is to reinvest every dollar we earn into
              providing transformative education for all who need it, building a
              community where learning is accessible, relationships are valued,
              and everyone is empowered to excel.
            </p>
          </div>
        </div>
        <AboutValues />
        <div className={styles.actions}>
          <Button href="/about/subsidy/">Explore tuition subsidies</Button>
          <Button href="/about/testimonials/" secondary>
            Read our student reviews
          </Button>
        </div>
      </section>
      <TeachingMethodSection
        lessonSteps={lessonSteps}
        weekSupport={weekSupport}
      />
      <section id="team" className={`${styles.container} ${styles.section}`}>
        <div className={styles.split}>
          <SectionTitle eyebrow="Our team">
            Familiar faces.
            <br />
            <em>Real encouragement.</em>
          </SectionTitle>
          <Copy block={about("61c3580")} />
        </div>
        <div className={styles.teamGrid} data-scroll-stagger>
          {profiles.map((person) => (
            <article key={person.id} className={styles.teamCard}>
              <div className={styles.teamPortrait}>
                {person.image ? (
                  <Image
                    src={person.image}
                    alt={person.name}
                    width={450}
                    height={375}
                    sizes="(max-width: 520px) 90vw, (max-width: 1050px) 45vw, 30vw"
                    style={{
                      objectPosition: `${person.crop.x}% ${person.crop.y}%`,
                      transform: `scale(${person.crop.zoom})`,
                      transformOrigin: `${person.crop.x}% ${person.crop.y}%`,
                    }}
                  />
                ) : (
                  <span className={styles.teamInitial} aria-hidden="true">
                    {person.name.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <h3>{person.name}</h3>
                {person.title && (
                  <p style={{ whiteSpace: "pre-line" }}>{person.title}</p>
                )}
                {person.subjects.length > 0 && (
                  <ul
                    className={styles.staffSubjects}
                    aria-label={`Subjects taught by ${person.name}`}
                  >
                    {person.subjects.map((subject) => (
                      <li key={subject} className={styles.staffSubjectBadge}>
                        {subject}
                      </li>
                    ))}
                  </ul>
                )}
                {person.bio && (
                  <details>
                    <summary>Meet {person.name.split(" ")[0]}</summary>
                    <p style={{ whiteSpace: "pre-line" }}>{person.bio}</p>
                  </details>
                )}
              </div>
            </article>
          ))}
        </div>
        <div className={styles.actions}>
          <Button href="/about/apply/">Join our team today!</Button>
        </div>
      </section>
      <section
        id="charities"
        className={`${styles.processSection} ${styles.section}`}
      >
        <div className={styles.container}>
          <div className={styles.split}>
            <SectionTitle eyebrow="Charities we support">
              A wider circle
              <br />
              <em>of support.</em>
            </SectionTitle>
            <Copy block={about("93b0a58")} />
          </div>
          <div className={styles.charities} data-scroll-stagger>
            {charities.map((charity) => (
              <article className={styles.charity} key={charity.id}>
                {charity.image ? (
                  <Image
                    src={charity.image}
                    alt={charity.title ?? ""}
                    width={500}
                    height={280}
                    sizes="(max-width: 520px) 90vw, 33vw"
                  />
                ) : null}
                <div>
                  <h3>{charity.title}</h3>
                  <Copy block={charity} />
                  {charity.href ? (
                    <a className={styles.textLink} href={charity.href}>
                      Learn more <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className={styles.cta}>
        <Eyebrow>Let’s talk</Eyebrow>
        <h2>
          Still have questions?
          <br />
          <em>Get in touch.</em>
        </h2>
        <div className={styles.actions}>
          <Link href="/about/contact/" className={styles.button}>
            Contact us <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
