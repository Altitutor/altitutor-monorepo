import { content, pageContent } from "../content";
import {
  Button,
  Copy,
  Eyebrow,
  Questions,
  SectionTitle,
} from "../components/primitives";
import styles from "../marketing.module.css";

export function CareersPage() {
  const roles = pageContent("/about/apply/")
    .filter((b) => b.kind === "icon-box")
    .map((b) => ({ title: b.title ?? "", html: b.html ?? "" }));
  return (
    <>
      <section
        className={`${styles.container} ${styles.hero} ${styles.editorialHero}`}
      >
        <Eyebrow>Work with us</Eyebrow>
        <h1>
          Help someone
          <br />
          <em>find their potential.</em>
        </h1>
        <Copy block={content("/about/apply/", "f14c735")} />
        <div className={styles.actions}>
          <Button href="#roles">Find your role</Button>
          <Button href="#apply" secondary>
            How to apply
          </Button>
        </div>
      </section>
      <section
        id="roles"
        className={`${styles.container} ${styles.section} ${styles.roles}`}
      >
        <div>
          <Eyebrow>Room to make a difference</Eyebrow>
          <h2>
            Different skills.
            <br />
            <em>One shared purpose.</em>
          </h2>
        </div>
        <Questions items={roles} />
      </section>
      <section className={styles.mission}>
        <div className={`${styles.container} ${styles.split}`}>
          <SectionTitle eyebrow="What you get">
            Good people.
            <br />
            <em>Meaningful work.</em>
          </SectionTitle>
          <Copy block={content("/about/apply/", "0561ecf")} />
        </div>
      </section>
      <section
        id="apply"
        className={`${styles.container} ${styles.section} ${styles.split}`}
      >
        <SectionTitle eyebrow="How to apply">
          Your next chapter
          <br />
          <em>could start here.</em>
        </SectionTitle>
        <div>
          <Copy block={content("/about/apply/", "622cea6")} />
          <div className={styles.actions}>
            <Button href="mailto:admin@altitutor.com?subject=Working%20with%20Altitutor">
              Email your resume
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
