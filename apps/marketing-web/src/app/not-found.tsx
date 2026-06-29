import { MarketingButton, MarketingCard, MarketingHeading } from "./MarketingUI";

export default function NotFound() {
  return (
    <main className="marketing-not-found">
      <MarketingCard as="section" className="marketing-not-found__card">
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
