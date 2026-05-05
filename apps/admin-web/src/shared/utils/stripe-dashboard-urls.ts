/**
 * Stripe Dashboard URLs use `/test` for test-mode accounts.
 * Set NEXT_PUBLIC_STRIPE_DASHBOARD_TEST_MODE=true in admin-web when using test keys.
 */
function stripeDashboardPathPrefix(): string {
  return typeof process.env.NEXT_PUBLIC_STRIPE_DASHBOARD_TEST_MODE !== 'undefined' &&
    process.env.NEXT_PUBLIC_STRIPE_DASHBOARD_TEST_MODE === 'true'
    ? '/test'
    : '';
}

export function stripeInvoiceDashboardUrl(stripeInvoiceId: string): string {
  return `https://dashboard.stripe.com${stripeDashboardPathPrefix()}/invoices/${stripeInvoiceId}`;
}

export function stripeSubscriptionDashboardUrl(stripeSubscriptionId: string): string {
  return `https://dashboard.stripe.com${stripeDashboardPathPrefix()}/subscriptions/${stripeSubscriptionId}`;
}
