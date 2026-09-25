import { content } from "../content";
import {
  Button,
  Copy,
  Eyebrow,
  Questions,
  ResourceImage,
  SectionTitle,
  TrialCTA,
} from "../components/primitives";
import styles from "../marketing.module.css";

const courses = (id: string) => content("/classes/", id);
const pathways = [
  {
    id: "5a8129f",
    href: "/classes/weekly-classes/",
    image: "/images/marketing/chemistry-notes.png",
    label: "Weekly subject tutoring",
  },
  {
    id: "9de86c7",
    href: "/classes/examprep/",
    image: "/images/marketing/chemistry-exam.png",
    label: "Exam preparation courses",
  },
  {
    id: "756a704",
    href: "/classes/assignment-drafting/",
    image: "/images/marketing/english-draft.png",
    label: "Assignment drafting",
  },
  {
    id: "48362bd",
    href: "/classes/ucatprep/",
    image: "/images/marketing/ucat-qr-online.png",
    label: "In person UCAT tutoring",
  },
  {
    id: "2701993",
    href: "/classes/medical-interview-preparation/",
    image: "/images/marketing/pre-course-prep.png",
    label: "Medical interview course",
  },
];

function CourseChoices({ start, end }: { start: number; end: number }) {
  return (
    <div className={styles.courseList}>
      {pathways.slice(start, end).map((course, i) => {
        const copy = courses(course.id);
        return (
          <article key={course.id} className={styles.courseChoice}>
            <ResourceImage
              src={course.image}
              alt={`${course.label} sample materials`}
            />
            <div>
              <Eyebrow>0{start + i + 1} / Your next step</Eyebrow>
              <h3>{course.label}</h3>
              <Copy block={copy} />
              <Copy html={`<h3>${copy.detailTitle}</h3>${copy.detailHtml}`} />
              <div className={styles.actions}>
                <Button href={course.href}>Explore this course</Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function CoursesPage() {
  return (
    <>
      <section
        className={`${styles.container} ${styles.hero} ${styles.editorialHero}`}
      >
        <Eyebrow>In person courses · Adelaide</Eyebrow>
        <h1>
          Different goals.<em>Personalised support.</em>
        </h1>
        <Copy block={courses("614bb01")} />
        <div className={styles.actions}>
          <Button href="#school">Help with school subjects</Button>
          <Button href="#medicine" secondary>
            UCAT & medical interviews
          </Button>
        </div>
      </section>
      <section id="school" className={`${styles.container} ${styles.section}`}>
        <SectionTitle eyebrow="School & SACE">
          Make schoolwork easier.
          <br />
          <em>Make progress yours.</em>
        </SectionTitle>
        <CourseChoices start={0} end={3} />
      </section>
      <section className={`${styles.processSection} ${styles.section}`}>
        <div className={`${styles.container} ${styles.split}`}>
          <SectionTitle eyebrow="Find your fit">
            Not sure which
            <br />
            <em>course to pick?</em>
          </SectionTitle>
          <Questions items={courses("d7994e0").items ?? []} />
        </div>
      </section>
      <section
        id="medicine"
        className={`${styles.container} ${styles.section}`}
      >
        <div className={styles.split}>
          <SectionTitle eyebrow="Your pathway to medicine">
            Applying for medicine?
            <br />
            <em>Take the next step.</em>
          </SectionTitle>
          <Copy block={courses("e2e92f2")} />
        </div>
        <CourseChoices start={3} end={5} />
        <div className={styles.actions}>
          <Button href="/ucat/" secondary>
            Looking for online UCAT preparation?
          </Button>
        </div>
      </section>
      <TrialCTA />
    </>
  );
}
