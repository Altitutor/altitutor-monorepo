import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { content, pageContent } from "../content";
import {
  Button,
  ContentCard,
  Copy,
  Eyebrow,
  PageLinks,
  SectionTitle,
} from "../components/primitives";
import styles from "../marketing.module.css";

const about = (id: string) => content("/about/", id);

export function AboutPage() {
  const team = pageContent("/about/").filter(
    (b) => b.kind === "flip-box" && b.title !== "You",
  );
  const charities = pageContent("/about/").filter(
    (b) => b.kind === "call-to-action",
  );
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
        <div className={styles.portraitComposition}>
          <Image
            src={about("3b2d88d").image!}
            alt="Matthew Chua, Altitutor tutor"
            width={300}
            height={300}
            priority
          />
          <Image
            src={about("9f20f4f").image!}
            alt="Lara Nguyen, Altitutor team"
            width={300}
            height={300}
            priority
          />
          <p>People who care about your next chapter.</p>
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
          <SectionTitle eyebrow="Our values">
            Good education should
            <br />
            <em>open doors.</em>
          </SectionTitle>
          <Copy block={about("998c6ba")} />
        </div>
        <div className={styles.valuesGrid}>
          {["b64b029", "9af0661", "41b01c4", "bf261c7"].map((id, i) => (
            <ContentCard key={id} block={about(id)} number={i + 1} />
          ))}
        </div>
        <div className={styles.actions}>
          <Button href="/about/subsidy/">Explore tuition subsidies</Button>
          <Button href="/about/testimonials/" secondary>
            Read our student reviews
          </Button>
        </div>
      </section>
      <section
        id="teaching"
        className={`${styles.processSection} ${styles.section}`}
      >
        <div className={styles.container}>
          <div className={styles.split}>
            <SectionTitle eyebrow="Our teaching method">
              The best of both worlds.
              <br />
              <em>Built around you.</em>
            </SectionTitle>
            <Copy block={about("c90b9f5")} />
          </div>
          <Copy block={about("7e7ad5b")} />
          <div className={styles.teaching}>
            <div>
              <h3>In class</h3>
              <Copy block={about("23fbbe2")} />
              {["db71db1", "7b7691b", "696bce9"].map((id) => (
                <ContentCard key={id} block={about(id)} />
              ))}
            </div>
            <div>
              <h3>Out of class</h3>
              <Copy block={about("1f50fc0")} />
              {["c48c5f3", "b86f312", "8c6ca79"].map((id) => (
                <ContentCard key={id} block={about(id)} />
              ))}
            </div>
          </div>
          <div className={styles.actions}>
            <Button href="#find-your-course">Find your course</Button>
          </div>
        </div>
      </section>
      <section id="team" className={`${styles.container} ${styles.section}`}>
        <div className={styles.split}>
          <SectionTitle eyebrow="Our team">
            Familiar faces.
            <br />
            <em>Real encouragement.</em>
          </SectionTitle>
          <Copy block={about("61c3580")} />
        </div>
        <div className={styles.teamGrid}>
          {team.map((person) => (
            <article key={person.id} className={styles.teamCard}>
              <div className={styles.teamPortrait}>
                {person.image ? (
                  <Image
                    src={person.image}
                    alt={person.title ?? "Altitutor team member"}
                    width={450}
                    height={375}
                    sizes="(max-width: 520px) 90vw, (max-width: 1050px) 45vw, 30vw"
                  />
                ) : (
                  <span className={styles.teamInitial} aria-hidden="true">
                    {person.title?.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <h3>{person.title}</h3>
                <Copy block={person} />
                <details>
                  <summary>Meet {person.title?.split(" ")[0]}</summary>
                  <Copy html={person.detailHtml} />
                </details>
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
          <div className={styles.charities}>
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
