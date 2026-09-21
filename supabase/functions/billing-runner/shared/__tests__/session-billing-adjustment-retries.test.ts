import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';
import { processSessionBillingAdjustments } from '../session-billing-adjustments.ts';

function retryFixture() {
  const adjustment: Record<string, unknown> = {
    id: 'adjustment-1',
    sessions_students_id: 'ss-1',
    kind: 'credit_note',
    source_invoice_item_id: 'line-1',
    source_credit_note_id: null,
    amount_cents: 9000,
    currency: 'AUD',
    reason_category: 'approved_absence',
    reason_note: 'Sick',
    created_by: null,
    idempotency_key: 'durable-key',
    status: 'pending',
    attempt_count: 0,
    stripe_credit_note_request_version: null,
    stripe_credit_note_command: null,
    stripe_credit_note_requested_at: null,
  };
  const invoice = {
    id: 'invoice-1',
    student_id: 'student-1',
    stripe_invoice_id: 'in_1',
    status: 'open',
  };
  const line = {
    id: 'line-1',
    invoice_id: 'invoice-1',
    sessions_students_id: 'ss-1',
    stripe_invoice_item_id: 'ii_1',
    amount_cents: 9000,
    line_kind: 'session_charge',
    is_fee: false,
  };
  const state = {
    adjustment,
    adjustments: [adjustment],
    optInFailureId: null as string | null,
    invoice,
    line,
    stripeLineId: 'il_1',
    error: new Stripe.errors.StripeConnectionError({
      type: 'api_error',
      message: 'Connection lost',
    }) as Error | null,
    saveError: false,
    creditSaveError: false,
    obligationCurrent: true,
    loseResponse: false,
    calls: [] as Array<{ params: Stripe.CreditNoteCreateParams; key: string | undefined }>,
    credits: [] as Array<Record<string, unknown>>,
    remoteCredits: [] as Stripe.CreditNote[],
  };
  const supabase = {
    rpc(name: string, args: Record<string, unknown>) {
      if (name.startsWith('claim_session_billing_adjustments')) {
        const claimed = state.adjustments.filter((row) =>
          !['failed', 'succeeded', 'superseded'].includes(String(row.status))
        );
        for (const row of claimed) {
          row.status = 'processing';
          row.attempt_count = Number(row.attempt_count) + 1;
        }
        return Promise.resolve({ data: structuredClone(claimed), error: null });
      }
      if (name === 'enqueue_session_billing_adjustment') {
        const row = state.adjustments.find((item) =>
          item.sessions_students_id === args.p_sessions_students_id
        )!;
        row.reason_note = args.p_reason_note;
        return Promise.resolve({ data: state.obligationCurrent ? row.id : null, error: null });
      }
      if (name === 'fail_session_billing_adjustment') {
        state.adjustments.find((row) => row.id === args.p_adjustment_id)!.status = 'retryable';
        return Promise.resolve({ data: null, error: null });
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
    from(table: string) {
      let single = false;
      const filters: Array<[string, unknown]> = [];
      let patch: Record<string, unknown> | undefined;
      const builder = {
        select: (_columns?: string) => builder,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        is: (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        in: (_column: string, _value: unknown) => builder,
        single: () => {
          single = true;
          return builder;
        },
        maybeSingle: () => {
          single = true;
          return builder;
        },
        update: (value: Record<string, unknown>) => {
          patch = value;
          return builder;
        },
        upsert: (value: Record<string, unknown>) => {
          patch = value;
          return builder;
        },
        then(resolve: (result: { data: unknown; error: Error | null }) => unknown) {
          const selectedAdjustments = state.adjustments.filter((row) =>
            filters.every(([column, value]) => row[column] === value)
          );
          if (patch && table === 'session_billing_adjustments') {
            if (
              patch.stripe_credit_note_request_version &&
              selectedAdjustments.some((row) => row.id === state.optInFailureId)
            ) {
              return Promise.resolve(
                resolve({ data: null, error: new Error('Opt-in write failed') }),
              );
            }
            if (state.saveError && patch.stripe_credit_note_command) {
              return Promise.resolve(
                resolve({ data: null, error: new Error('Database unavailable') }),
              );
            }
            for (const row of selectedAdjustments) {
              Object.assign(row, structuredClone(patch));
              if (patch.stripe_credit_note_command) {
                row.stripe_credit_note_requested_at = new Date().toISOString();
              }
            }
          }
          if (patch && table === 'credit_notes') {
            if (state.creditSaveError) {
              return Promise.resolve(
                resolve({ data: null, error: new Error('Credit persistence failed') }),
              );
            }
            state.credits.push(structuredClone(patch));
          }
          const rows = table === 'invoice_items'
            ? [line]
            : table === 'invoices'
            ? [invoice]
            : table === 'session_billing_adjustments'
            ? selectedAdjustments
            : [];
          return Promise.resolve(resolve({ data: single ? rows[0] ?? null : rows, error: null }));
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  const stripe = {
    invoices: {
      listLineItems: () =>
        Promise.resolve({ data: [{ id: state.stripeLineId, invoice_item: 'ii_1' }] }),
    },
    creditNotes: {
      async *list() {
        yield* state.remoteCredits;
      },
      create(params: Stripe.CreditNoteCreateParams, options: Stripe.RequestOptions) {
        state.calls.push({ params: structuredClone(params), key: options.idempotencyKey });
        if (state.error) return Promise.reject(state.error);
        const credit = {
          id: 'cn_1',
          amount: 9000,
          currency: 'aud',
          reason: 'order_change',
          status: 'issued',
          metadata: params.metadata,
          memo: params.memo,
          number: 'CN-1',
        } as Stripe.CreditNote;
        state.remoteCredits.push(credit);
        if (state.loseResponse) {
          return Promise.reject(
            new Stripe.errors.StripeConnectionError({
              type: 'api_error',
              message: 'Response lost after create',
            }),
          );
        }
        return Promise.resolve(credit);
      },
    },
  } as unknown as Stripe;
  return {
    state,
    run: () =>
      processSessionBillingAdjustments({
        supabase,
        stripe,
        isStripeTestKey: true,
        isStripeLiveKey: false,
      }),
  };
}

describe('durable session credit retries', () => {
  for (const change of ['invoice', 'line', 'reason', 'all']) {
    it(`replays identical parameters after ${change} state changes`, async () => {
      const { state, run } = retryFixture();
      expect((await run()).failed).toBe(1);
      if (change === 'invoice' || change === 'all') state.invoice.status = 'paid';
      if (change === 'line' || change === 'all') {
        state.stripeLineId = 'il_changed';
        state.line.amount_cents = 8000;
      }
      if (change !== 'reason' && change !== 'all') state.adjustment.reason_note = 'Sick';
      state.error = null;
      expect((await run()).succeeded).toBe(1);
      expect(state.calls).toHaveLength(2);
      expect(state.calls[1]).toEqual(state.calls[0]);
    });
  }
  it('does not contact Stripe unless the original request is durably saved', async () => {
    const { state, run } = retryFixture();
    state.saveError = true;
    expect((await run()).failed).toBe(1);
    expect(state.calls).toHaveLength(0);
    state.saveError = false;
    state.error = null;
    expect((await run()).succeeded).toBe(1);
    expect(state.calls).toHaveLength(1);
  });

  it('recovers a successful credit after local persistence failed even if obligation changed', async () => {
    const { state, run } = retryFixture();
    state.error = null;
    state.creditSaveError = true;
    expect((await run()).failed).toBe(1);
    state.creditSaveError = false;
    state.invoice.status = 'paid';
    state.obligationCurrent = false;
    expect((await run()).succeeded).toBe(1);
    expect(state.calls).toHaveLength(1);
    expect(state.credits[0].credit_amount_cents).toBeNull();
  });

  it('fails legacy retries with unknown original parameters without sending a new request', async () => {
    const { state, run } = retryFixture();
    state.adjustment.attempt_count = 3;
    expect((await run()).failed).toBe(1);
    expect(state.adjustment.status).toBe('failed');
    expect(state.calls).toHaveLength(0);
  });

  for (
    const error of [
      new Stripe.errors.StripeInvalidRequestError({
        type: 'invalid_request_error',
        message: 'Credit exceeds remaining line amount',
      }),
      new Stripe.errors.StripeIdempotencyError({
        type: 'idempotency_error',
        message: 'Parameters changed',
      }),
    ]
  ) {
    it(`stops retrying terminal ${error.type}`, async () => {
      const { state, run } = retryFixture();
      state.error = error;
      expect((await run()).failed).toBe(1);
      expect(state.adjustment.status).toBe('failed');
      expect((await run()).claimed).toBe(0);
      expect(state.calls).toHaveLength(1);
    });
  }

  for (
    const error of [
      new Stripe.errors.StripeConnectionError({ type: 'api_error', message: 'Network failed' }),
      new Stripe.errors.StripeRateLimitError({ type: 'rate_limit_error', message: 'Rate limited' }),
      new Stripe.errors.StripeAPIError({ type: 'api_error', message: 'Internal error' }),
      new Stripe.errors.StripeInvalidRequestError({
        type: 'invalid_request_error',
        code: 'lock_timeout',
        message: 'Busy',
      }),
    ]
  ) {
    it(`preserves safe retries for ${error.type} ${error.code ?? ''}`, async () => {
      const { state, run } = retryFixture();
      state.error = error;
      expect((await run()).failed).toBe(1);
      expect(state.adjustment.status).toBe('retryable');
      expect(state.adjustment.stripe_credit_note_command).not.toBeNull();
    });
  }

  it('does not replay an expired idempotency key when no prior credit can be recovered', async () => {
    const { state, run } = retryFixture();
    await run();
    state.adjustment.stripe_credit_note_requested_at = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString();
    state.error = null;
    expect((await run()).failed).toBe(1);
    expect(state.adjustment.status).toBe('failed');
    expect(state.calls).toHaveLength(1);
  });
  it('recovers a lost Stripe response even after the key expires without creating another credit', async () => {
    const { state, run } = retryFixture();
    state.error = null;
    state.loseResponse = true;
    expect((await run()).failed).toBe(1);
    state.adjustment.stripe_credit_note_requested_at = new Date(Date.now() - 48 * 60 * 60 * 1000)
      .toISOString();
    state.loseResponse = false;
    state.obligationCurrent = false;
    expect((await run()).succeeded).toBe(1);
    expect(state.calls).toHaveLength(1);
    expect(state.credits[0].stripe_credit_note_id).toBe('cn_1');
  });

  it('does not recreate a previously issued credit that was subsequently voided', async () => {
    const { state, run } = retryFixture();
    state.error = null;
    state.creditSaveError = true;
    await run();
    state.remoteCredits[0].status = 'void';
    state.creditSaveError = false;
    expect((await run()).failed).toBe(1);
    expect(state.adjustment.status).toBe('failed');
    expect(state.calls).toHaveLength(1);
  });
  it('continues opting in other claimed credits when one marker write fails', async () => {
    const { state, run } = retryFixture();
    const second: Record<string, unknown> = {
      ...state.adjustment,
      id: 'adjustment-2',
      sessions_students_id: 'ss-2',
      idempotency_key: 'second-key',
    };
    state.adjustments.push(second);
    state.optInFailureId = 'adjustment-1';
    expect((await run()).failed).toBe(2);
    expect(state.adjustment.stripe_credit_note_request_version).toBeNull();
    expect(second.stripe_credit_note_request_version).toBe(1);
    expect(second.status).toBe('retryable');
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].key).toBe('second-key');
  });
});
