import { Button } from "@/features/marketing/components/primitives";
import {
  conversionActions,
  type ConversionTarget,
} from "@/features/marketing/conversion-actions";
import styles from "./blog.module.css";

export function ArticleConversion({ target }: { target: ConversionTarget }) {
  const action = conversionActions[target];
  return (
    <section className={styles.conversion} aria-labelledby="article-next-step">
      <h2 id="article-next-step">{action.heading}</h2>
      <p>{action.description}</p>
      <Button href={action.href}>{action.label}</Button>
    </section>
  );
}
