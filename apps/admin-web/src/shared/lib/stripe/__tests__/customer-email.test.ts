import { describe, expect, it } from 'vitest';
import {
  createSendInvoiceWithEmailRecovery,
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

describe('createSendInvoiceWithEmailRecovery', () => {
  it('escapes a cached missing-email response on the original idempotency key', async () => {
    const stripe: StripeCustomerEmailClient = {
      customers: {
        retrieve: async () => ({ email: 'student@example.com' }),
        update: async (_customerId, params) => ({ email: params.email }),
      },
    };
    const attemptedKeys: string[] = [];

    const result = await createSendInvoiceWithEmailRecovery({
      stripe,
      customerId: 'cus_with_email',
      fallbackEmail: 'student@example.com',
      idempotencyKey: 'invoice_session_with_cached_error',
      createInvoice: async (idempotencyKey) => {
        attemptedKeys.push(idempotencyKey);
        if (idempotencyKey === 'invoice_session_with_cached_error') {
          const error = new Error(
            'Missing email. In order to create invoices that are sent to the customer, the customer must have a valid email.'
          ) as Error & { statusCode: number; type: string };
          error.statusCode = 400;
          error.type = 'StripeInvalidRequestError';
          throw error;
        }
        return { id: 'in_recovered' };
      },
    });

    expect(result).toEqual({ id: 'in_recovered' });
    expect(attemptedKeys).toEqual([
      'invoice_session_with_cached_error',
      'invoice_session_with_cached_error_email_recovery_v1',
    ]);
  });

  it('does not retry unrelated Stripe errors with a different key', async () => {
    const stripe: StripeCustomerEmailClient = {
      customers: {
        retrieve: async () => ({ email: 'student@example.com' }),
        update: async (_customerId, params) => ({ email: params.email }),
      },
    };
    const attemptedKeys: string[] = [];
    const cardError = Object.assign(new Error('Card declined'), {
      statusCode: 402,
      type: 'StripeCardError',
    });

    await expect(
      createSendInvoiceWithEmailRecovery({
        stripe,
        customerId: 'cus_with_email',
        fallbackEmail: 'student@example.com',
        idempotencyKey: 'invoice_card_error',
        createInvoice: async (idempotencyKey) => {
          attemptedKeys.push(idempotencyKey);
          throw cardError;
        },
      })
    ).rejects.toBe(cardError);

    expect(attemptedKeys).toEqual(['invoice_card_error']);
  });
});
