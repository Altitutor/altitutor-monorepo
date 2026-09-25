import Image from "next/image";
import { PRODUCT_LINKS } from "@/lib/site";
import { content } from "../content";
import {
  Button,
  Copy,
  Eyebrow,
  ResourceImage,
  SectionTitle,
} from "../components/primitives";
import { TrialCTA } from "../components/trial-cta-section";
import styles from "../marketing.module.css";

const resource = (id: string) => content("/resources/", id);
const materials = [
  ["0ba09f9", "97992da"],
  ["0d2b10c", "6321170"],
  ["72842ac", "dae87de"],
  ["b6cf2a5", "c41382a"],
  ["48e413b", "5b4a042"],
];

export function ResourcesPage() {
  return (
    <>
      <section
        className={`${styles.container} ${styles.hero} ${styles.split} ${styles.resourceHero}`}
      >
        <div>
          <Eyebrow>Online SACE & IB resources</Eyebrow>
          <h1>
            SACE & IB resources.<em>Learn on your terms.</em>
          </h1>
          <Copy block={resource("29b2be3")} />
          <div className={styles.actions}>
            <Button href={PRODUCT_LINKS.student}>Open student portal</Button>
            <Button href="#resources" secondary>
              Explore the resources
            </Button>
          </div>
        </div>
        <ResourceImage
          src="/images/marketing/resources-devices.png"
          alt="Altitutor online resources on a tablet and phone"
          priority
        />
      </section>
      <section
        id="resources"
        className={`${styles.container} ${styles.section}`}
      >
        <SectionTitle eyebrow="Our resources">
          Everything you need.
          <br />
          <em>Ready when you are.</em>
        </SectionTitle>
        <div className={styles.resourceRows}>
          {materials.map(([image, copy], i) => (
            <article key={copy} className={styles.resourceRow}>
              <ResourceImage
                src={resource(image).image!}
                alt={
                  resource(image).alt || "Sample Altitutor learning resources"
                }
              />
              <div>
                <span className={styles.number}>
                  0{i + 1} / YOUR LEARNING TOOLKIT
                </span>
                <Copy block={resource(copy)} />
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className={styles.mission}>
        <div className={styles.container}>
          <div className={styles.split}>
            <SectionTitle eyebrow="Altitutor student dashboard">
              Your classroom.
              <br />
              <em>Wherever you are.</em>
            </SectionTitle>
            <div>
              <Copy block={resource("eb0ab92")} />
              <div className={styles.actions}>
                <Button href={PRODUCT_LINKS.student}>
                  Visit the student portal
                </Button>
              </div>
            </div>
          </div>
          <div className={styles.portalFeatures}>
            {["8715926", "71a3a3a", "580f969"].map((id) => {
              const block = resource(id);
              return (
                <article className={styles.contentCard} key={id}>
                  {block.image ? (
                    <Image
                      src={block.image}
                      alt={block.title ?? ""}
                      width={500}
                      height={300}
                      sizes="(max-width: 800px) 85vw, 30vw"
                    />
                  ) : null}
                  <h3>{block.title}</h3>
                  <Copy block={block} />
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <section className={`${styles.container} ${styles.section}`}>
        <SectionTitle eyebrow="Choose your access">
          In class or online.
          <br />
          <em>There’s a place for you.</em>
        </SectionTitle>
        <div className={styles.accessCards}>
          <article>
            <Eyebrow>Already learning with us?</Eyebrow>
            <h2>Current students</h2>
            {["562dd27", "29e1651", "a95042e"].map((id) => (
              <Copy key={id} block={resource(id)} />
            ))}
            <div className={styles.actions}>
              <Button href={PRODUCT_LINKS.student}>Student portal</Button>
            </div>
          </article>
          <article>
            <Eyebrow>Learn in your own time</Eyebrow>
            <h2>Online-only access</h2>
            {["36b5fcc", "913e56d", "f9fbad1"].map((id) => (
              <Copy key={id} block={resource(id)} />
            ))}
            <div className={styles.actions}>
              <Button href={PRODUCT_LINKS.student}>
                Explore online courses
              </Button>
            </div>
          </article>
        </div>
      </section>
      <TrialCTA />
    </>
  );
}
