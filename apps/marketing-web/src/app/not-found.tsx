import { MarketingButton, MarketingCard, MarketingHeading } from "./MarketingUI";
import styles from "./NotFound.module.css";

export default function NotFound() {
  return (
    <main className={styles.root}>
      <MarketingCard as="section" className={styles.card}>
        <p className="marketing-kicker">404</p>
        <MarketingHeading as="h1" variant="section">Page not found</MarketingHeading>
        <p>
          This page is not part of the current Altitutor marketing site.
        </p>
        <MarketingButton href="/">
          Back to home
        </MarketingButton>
      </MarketingCard>
    </main>
  );
}
