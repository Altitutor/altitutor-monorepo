interface StripeCustomerWithEmail {
  deleted?: boolean;
  email?: string | null;
}

export interface StripeCustomerEmailClient {
  customers: {
    retrieve(customerId: string): Promise<StripeCustomerWithEmail>;
    update(
      customerId: string,
      params: { email: string }
    ): Promise<StripeCustomerWithEmail>;
  };
}

export async function ensureStripeCustomerEmail(
  stripe: StripeCustomerEmailClient,
  customerId: string,
  fallbackEmail: string | undefined
): Promise<void> {
  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) {
    throw new Error(`Stripe customer ${customerId} has been deleted`);
  }

  if (customer.email?.trim()) {
    return;
  }

  const email = fallbackEmail?.trim();
  if (!email) {
    throw new Error(
      `Stripe customer ${customerId} has no email, and no student or parent email is available`
    );
  }

  await stripe.customers.update(customerId, { email });
}
