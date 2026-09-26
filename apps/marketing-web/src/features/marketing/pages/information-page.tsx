import { PRODUCT_LINKS } from "@/lib/site";
import { pageContent } from "../content";
import { Button, Copy, Eyebrow } from "../components/primitives";
import styles from "../marketing.module.css";

export function InformationPage({
  path,
  title,
}: {
  path: string;
  title: string;
}) {
  const blocks = pageContent(path).filter((b) => b.kind === "text-editor");
  return (
    <section className={styles.legal}>
      <Eyebrow>Altitutor</Eyebrow>
      <h1>{title}</h1>
      {blocks.map((b) => (
        <Copy key={b.id} block={b} />
      ))}
      {path === "/privacy-policy/" ? null : (
        <div className={styles.actions}>
          <Button
            href={
              path === "/terms-of-service/"
                ? "/about/contact/"
                : PRODUCT_LINKS.student
            }
          >
            {path === "/terms-of-service/"
              ? "Contact us about our terms"
              : "Continue to student portal"}
          </Button>
        </div>
      )}
    </section>
  );
}
