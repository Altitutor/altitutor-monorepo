import { PRODUCT_LINKS } from "@/lib/site";
import dynamic from "next/dynamic";
import { pageContent, type ContentBlock } from "../content";
import {
  Button,
  ContentCard,
  Copy,
  Eyebrow,
  Quotes,
  ResourceImage,
} from "../components/primitives";
import { TrialCTA } from "../components/trial-cta-section";
import styles from "../marketing.module.css";

const MedicalInterviewWaitlistSection = dynamic(() =>
  import(
    "@/features/product-landing/ucat/medical-interview-waitlist-section"
  ).then((module) => module.MedicalInterviewWaitlistSection),
);

const courseHeadings: Record<string, [string, string]> = {
  "/classes/weekly-classes/": ["Weekly tutoring.", "Get ahead. Stay ahead."],
  "/classes/english-assignment-drafting/": [
    "Assignment drafting.",
    "Find your words.",
  ],
  "/classes/examprep/": ["SACE exam preparation.", "Go in ready."],
  "/classes/ucatprep/": ["UCAT preparation.", "Build your confidence."],
  "/classes/medical-interview-preparation/": [
    "Medical interviews.",
    "Let yourself shine.",
  ],
};

type CourseSection = { title: string; id: string; blocks: ContentBlock[] };

function sectionsFrom(blocks: ContentBlock[]): CourseSection[] {
  const sections: CourseSection[] = [];
  for (const block of blocks) {
    if (block.kind === "heading") {
      if (block.title?.startsWith("Interested?")) break;
      const id =
        block.title
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/-$/, "") ?? block.id;
      sections.push({ title: block.title ?? "", id, blocks: [] });
    } else if (sections.length > 0)
      sections[sections.length - 1].blocks.push(block);
  }
  return sections;
}

function CourseResources({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className={styles.courseResources}>
      {blocks
        .filter((b) => b.kind === "text-editor")
        .map((block) => {
          const precedingImage = blocks
            .slice(0, blocks.indexOf(block))
            .filter((b) => b.kind === "image")
            .at(-1);
          return (
            <article className={styles.courseResource} key={block.id}>
              {precedingImage?.image ? (
                <ResourceImage
                  src={precedingImage.image}
                  alt={precedingImage.alt || "Sample course resources"}
                />
              ) : null}
              <Copy block={block} />
            </article>
          );
        })}
    </div>
  );
}

function CourseSectionContent({ section }: { section: CourseSection }) {
  if (section.title === "Our resources")
    return <CourseResources blocks={section.blocks} />;
  if (section.blocks.some((b) => b.kind === "testimonial-carousel"))
    return <Quotes items={section.blocks.flatMap((b) => b.items ?? [])} />;
  return (
    <div className={styles.courseCards}>
      {section.blocks.map((block) => {
        if (block.kind === "icon-box")
          return <ContentCard key={block.id} block={block} />;
        if (block.kind === "text-editor" || block.kind === "icon-list")
          return <Copy key={block.id} block={block} />;
        return null;
      })}
    </div>
  );
}

export function CoursePage({ path }: { path: string }) {
  const blocks = pageContent(path);
  const sections = sectionsFrom(blocks);
  const introduction = sections[0];
  const body = sections.slice(1);
  const [title, emphasis] = courseHeadings[path];
  const image = introduction.blocks.find((b) => b.kind === "image");
  const facts = introduction.blocks.find((b) => b.kind === "icon-list");
  const interview = path === "/classes/medical-interview-preparation/";
  return (
    <>
      <section
        className={`${styles.container} ${styles.hero} ${styles.courseHero}`}
      >
        <div>
          <Eyebrow>Altitutor · Adelaide courses</Eyebrow>
          <h1>
            {title}
            <em>{emphasis}</em>
          </h1>
          {introduction.blocks
            .filter((b) => b.kind === "text-editor")
            .map((b) => (
              <Copy key={b.id} block={b} />
            ))}
          <div className={styles.actions}>
            <Button
              href={interview ? "#get-started" : PRODUCT_LINKS.trialBooking}
            >
              {interview ? "Join the interview waitlist" : "Book a free trial"}
            </Button>
            <Button href="#course-details" secondary>
              Explore the course
            </Button>
          </div>
        </div>
        {image?.image ? (
          <ResourceImage
            src={image.image}
            alt={image.alt || `${title} learning resources`}
            priority
          />
        ) : null}
      </section>
      <div className={styles.container}>
        {facts ? (
          <div className={styles.courseFacts}>
            <Copy block={facts} />
          </div>
        ) : null}
        <div className={styles.courseBody} id="course-details">
          <nav className={styles.courseNav} aria-label="Course sections">
            {body.map((s) => (
              <a href={`#${s.id}`} key={s.id}>
                {s.title}
              </a>
            ))}
            {interview ? <a href="#get-started">Join the waitlist</a> : null}
          </nav>
          <div>
            {body.map((section) => (
              <section
                id={section.id}
                className={styles.courseSection}
                key={section.id}
              >
                <h2>{section.title}</h2>
                <CourseSectionContent section={section} />
              </section>
            ))}
          </div>
        </div>
      </div>
      {interview ? <MedicalInterviewWaitlistSection /> : <TrialCTA />}
    </>
  );
}
