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

interface SendInvoiceWithEmailRecoveryOptions<T> {
  stripe: StripeCustomerEmailClient;
  customerId: string;
  fallbackEmail: string | undefined;
  idempotencyKey: string;
  createInvoice: (idempotencyKey: string) => Promise<T>;
}

function isStripeMissingCustomerEmailError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const statusCode = 'statusCode' in error ? error.statusCode : undefined;
  const message = 'message' in error ? error.message : undefined;

  return (
    statusCode === 400 &&
    typeof message === 'string' &&
    message.toLowerCase().includes('missing email')
  );
}

export async function createSendInvoiceWithEmailRecovery<T>({
  stripe,
  customerId,
  fallbackEmail,
  idempotencyKey,
  createInvoice,
}: SendInvoiceWithEmailRecoveryOptions<T>): Promise<T> {
  await ensureStripeCustomerEmail(stripe, customerId, fallbackEmail);

  try {
    return await createInvoice(idempotencyKey);
  } catch (error: unknown) {
    if (!isStripeMissingCustomerEmailError(error)) {
      throw error;
    }

    // Stripe API v1 replays a saved response, including errors, when the same
    // idempotency key is reused. Reconcile the current customer state, then use
    // a deterministic recovery key to escape an earlier missing-email response
    // without risking duplicate invoices on subsequent retries.
    await ensureStripeCustomerEmail(stripe, customerId, fallbackEmail);
    return await createInvoice(`${idempotencyKey}_email_recovery_v1`);
  }
}
