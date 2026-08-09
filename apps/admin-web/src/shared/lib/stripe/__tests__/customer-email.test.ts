import {
  ensureStripeCustomerEmail,
  type StripeCustomerEmailClient,
} from '../../../../../../../supabase/functions/billing-runner/shared/customer-email';

describe('ensureStripeCustomerEmail', () => {
  it('reconciles the Supabase email before Stripe creates a send_invoice', async () => {
    let customerEmail: string | null = null;
    const stripe = {
      customers: {
        retrieve: async () => ({ email: customerEmail }),
        update: async (_customerId: string, params: { email: string }) => {
          customerEmail = params.email;
          return { email: customerEmail };
        },
      },
      invoices: {
        create: async () => {
          if (!customerEmail) {
            throw new Error(
              'Missing email. In order to create invoices that are sent to the customer, the customer must have a valid email.',
            );
          }
        },
      },
    };

    await ensureStripeCustomerEmail(
      stripe as StripeCustomerEmailClient,
      'cus_without_email',
      'student@example.com',
    );

    await expect(stripe.invoices.create()).resolves.toBeUndefined();
    expect(customerEmail).toBe('student@example.com');
  });

  it('preserves an existing Stripe billing email', async () => {
    let updateCalls = 0;
    const stripe: StripeCustomerEmailClient = {
      customers: {
        retrieve: async () => ({ email: 'billing@example.com' }),
        update: async () => {
          updateCalls += 1;
          return { email: 'student@example.com' };
        },
      },
    };

    await ensureStripeCustomerEmail(
      stripe,
      'cus_with_email',
      'student@example.com',
    );

    expect(updateCalls).toBe(0);
  });

  it('fails clearly when neither Stripe nor Supabase has an email', async () => {
    const stripe: StripeCustomerEmailClient = {
      customers: {
        retrieve: async () => ({ email: null }),
        update: async () => ({ email: null }),
      },
    };

    await expect(
      ensureStripeCustomerEmail(stripe, 'cus_without_email', undefined),
    ).rejects.toThrow(
      'Stripe customer cus_without_email has no email, and no student or parent email is available',
    );
  });
});
