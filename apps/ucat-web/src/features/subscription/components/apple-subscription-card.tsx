import type { UcatAppleBillingState } from "@altitutor/shared";

export function AppleSubscriptionCard({
  subscription,
}: {
  subscription: NonNullable<UcatAppleBillingState["apple"]>;
}) {
  return (
    <section className="rounded-ucatShell border bg-card p-6 space-y-3">
      <h2 className="text-xl font-semibold">
        UCAT Unlimited · Apple subscription
      </h2>
      <p>
        Your subscription is billed by Apple and provides the same Unlimited
        learning access on web and app.
      </p>
      {subscription.status === 3 ? (
        <p>
          There is a payment issue. Review your Apple subscription to continue.
        </p>
      ) : (
        subscription.accessUntil && (
          <p>
            Access until{" "}
            {new Date(subscription.accessUntil).toLocaleDateString("en-AU")}.
          </p>
        )
      )}
      <p className="text-sm text-muted-foreground">
        Manage renewal, cancellation and payment details through Apple. Apple
        receipts are available from your Apple Account purchase history.
      </p>
      <a
        className="inline-flex underline"
        href="https://apps.apple.com/account/subscriptions"
        target="_blank"
        rel="noopener noreferrer"
      >
        Manage Apple subscription
      </a>
    </section>
  );
}
