'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import {
  ucatSubscriptionConfigApi,
  type UcatQuotaPeriod,
  type UcatSubscriptionConfigRow,
} from '../api/ucat-subscription-config';

const BILLING_INTERVALS = ['week', 'fortnight', 'month'] as const;
const QUOTA_PERIODS = ['day', 'week', 'month'] as const;

type BillingInterval = (typeof BILLING_INTERVALS)[number];

function isBillingInterval(v: string): v is BillingInterval {
  return (BILLING_INTERVALS as readonly string[]).includes(v);
}

function isQuotaPeriod(v: string): v is UcatQuotaPeriod {
  return (QUOTA_PERIODS as readonly string[]).includes(v);
}

const FREE_QUOTA_AREAS = [
  {
    key: 'practice',
    label: 'Practice questions',
    limitKey: 'free_practice_limit',
    periodKey: 'free_practice_period',
  },
  {
    key: 'sets',
    label: 'Sets',
    limitKey: 'free_sets_limit',
    periodKey: 'free_sets_period',
  },
  {
    key: 'mocks',
    label: 'Mocks',
    limitKey: 'free_mocks_limit',
    periodKey: 'free_mocks_period',
  },
  {
    key: 'learn',
    label: 'Learning modules',
    limitKey: 'free_learn_limit',
    periodKey: 'free_learn_period',
  },
  {
    key: 'skill_trainer',
    label: 'Skill trainer sessions',
    limitKey: 'free_skill_trainer_limit',
    periodKey: 'free_skill_trainer_period',
  },
] as const;

type FreeQuotaLimitKey = (typeof FREE_QUOTA_AREAS)[number]['limitKey'];
type FreeQuotaPeriodKey = (typeof FREE_QUOTA_AREAS)[number]['periodKey'];

function getQuotaLimit(row: UcatSubscriptionConfigRow, key: FreeQuotaLimitKey): number {
  return row[key] ?? 0;
}

function getQuotaPeriod(row: UcatSubscriptionConfigRow, key: FreeQuotaPeriodKey): UcatQuotaPeriod {
  const value = row[key];
  return isQuotaPeriod(value) ? value : 'day';
}

interface UcatSubscriptionConfigFormProps {
  initial: UcatSubscriptionConfigRow;
  onSaved: () => void;
}

export function UcatSubscriptionConfigForm({ initial, onSaved }: UcatSubscriptionConfigFormProps) {
  const [minQuestionsPerDay, setMinQuestionsPerDay] = useState(String(initial.min_questions_per_day));
  const [discountPerDayCents, setDiscountPerDayCents] = useState(String(initial.discount_per_day_cents));
  const [trialDays, setTrialDays] = useState(String(initial.trial_days));
  const [basePriceCents, setBasePriceCents] = useState(String(initial.base_price_cents));
  const [currency, setCurrency] = useState(initial.currency);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    isBillingInterval(initial.billing_interval) ? initial.billing_interval : 'week',
  );
  const [stripePriceId, setStripePriceId] = useState(initial.stripe_price_id ?? '');
  const [stripeProductId, setStripeProductId] = useState(initial.stripe_product_id ?? '');
  const [freeQuotas, setFreeQuotas] = useState(() =>
    Object.fromEntries(
      FREE_QUOTA_AREAS.map((area) => [
        area.key,
        {
          limit: String(getQuotaLimit(initial, area.limitKey)),
          period: getQuotaPeriod(initial, area.periodKey),
        },
      ]),
    ) as Record<string, { limit: string; period: UcatQuotaPeriod }>,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMinQuestionsPerDay(String(initial.min_questions_per_day));
    setDiscountPerDayCents(String(initial.discount_per_day_cents));
    setTrialDays(String(initial.trial_days));
    setBasePriceCents(String(initial.base_price_cents));
    setCurrency(initial.currency);
    setBillingInterval(
      isBillingInterval(initial.billing_interval) ? initial.billing_interval : 'week',
    );
    setStripePriceId(initial.stripe_price_id ?? '');
    setStripeProductId(initial.stripe_product_id ?? '');
    setFreeQuotas(
      Object.fromEntries(
        FREE_QUOTA_AREAS.map((area) => [
          area.key,
          {
            limit: String(getQuotaLimit(initial, area.limitKey)),
            period: getQuotaPeriod(initial, area.periodKey),
          },
        ]),
      ) as Record<string, { limit: string; period: UcatQuotaPeriod }>,
    );
  }, [initial]);

  const handleSave = async () => {
    setError(null);
    const minQ = parseInt(minQuestionsPerDay, 10);
    const disc = parseInt(discountPerDayCents, 10);
    const trial = parseInt(trialDays, 10);
    const base = parseInt(basePriceCents, 10);
    if (!Number.isFinite(minQ) || minQ < 1) {
      setError('Min questions per day must be at least 1');
      return;
    }
    if (!Number.isFinite(disc) || disc < 0) {
      setError('Discount per day (cents) must be 0 or greater');
      return;
    }
    if (!Number.isFinite(trial) || trial < 0) {
      setError('Trial days must be 0 or greater');
      return;
    }
    if (!Number.isFinite(base) || base < 0) {
      setError('Base price (cents) must be 0 or greater');
      return;
    }
    const cur = currency.trim().toLowerCase();
    if (!cur || cur.length > 8) {
      setError('Currency must be a short code (e.g. aud)');
      return;
    }

    const quotaPayload: Partial<UcatSubscriptionConfigRow> = {};
    for (const area of FREE_QUOTA_AREAS) {
      const entry = freeQuotas[area.key];
      const limit = parseInt(entry?.limit ?? '0', 10);
      if (!Number.isFinite(limit) || limit < 0) {
        setError(`${area.label}: limit must be 0 or greater`);
        return;
      }
      quotaPayload[area.limitKey] = limit;
      quotaPayload[area.periodKey] = entry?.period ?? 'day';
    }

    setSaving(true);
    try {
      await ucatSubscriptionConfigApi.update(initial.id, {
        min_questions_per_day: minQ,
        discount_per_day_cents: disc,
        billing_interval: billingInterval,
        trial_days: trial,
        base_price_cents: base,
        currency: cur,
        stripe_price_id: stripePriceId.trim() || null,
        stripe_product_id: stripeProductId.trim() || null,
        free_practice_limit: quotaPayload.free_practice_limit!,
        free_practice_period: quotaPayload.free_practice_period!,
        free_sets_limit: quotaPayload.free_sets_limit!,
        free_sets_period: quotaPayload.free_sets_period!,
        free_mocks_limit: quotaPayload.free_mocks_limit!,
        free_mocks_period: quotaPayload.free_mocks_period!,
        free_learn_limit: quotaPayload.free_learn_limit!,
        free_learn_period: quotaPayload.free_learn_period!,
        free_skill_trainer_limit: quotaPayload.free_skill_trainer_limit!,
        free_skill_trainer_period: quotaPayload.free_skill_trainer_period!,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>UCAT online subscription</CardTitle>
        <CardDescription>
          Controls trial length, practice-day discount rules, display pricing on the public subscribe
          page, Stripe product/price IDs used when{' '}
          <code className="text-xs">UCAT_STRIPE_PRICE_ID</code> is not set on ucat-web, and UCAT Free
          per-area usage quotas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="trial-days">Trial days</Label>
            <Input
              id="trial-days"
              type="number"
              min={0}
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-interval">Billing interval</Label>
            <Select
              value={billingInterval}
              onValueChange={(v) => {
                if (isBillingInterval(v)) setBillingInterval(v);
              }}
            >
              <SelectTrigger id="billing-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="fortnight">Fortnight</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="base-price-cents">Base price (cents)</Label>
            <Input
              id="base-price-cents"
              type="number"
              min={0}
              value={basePriceCents}
              onChange={(e) => setBasePriceCents(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Shown on the UCAT subscribe page (marketing).</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency code</Label>
            <Input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="aud"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="min-questions">Min questions per day (practice discount)</Label>
            <Input
              id="min-questions"
              type="number"
              min={1}
              value={minQuestionsPerDay}
              onChange={(e) => setMinQuestionsPerDay(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="discount-cents">Discount per qualifying day (cents)</Label>
            <Input
              id="discount-cents"
              type="number"
              min={0}
              value={discountPerDayCents}
              onChange={(e) => setDiscountPerDayCents(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Applied as a Stripe invoice item when eligible.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stripe-price-id">Stripe price ID</Label>
          <Input
            id="stripe-price-id"
            value={stripePriceId}
            onChange={(e) => setStripePriceId(e.target.value)}
            placeholder="price_..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stripe-product-id">Stripe product ID (optional)</Label>
          <Input
            id="stripe-product-id"
            value={stripeProductId}
            onChange={(e) => setStripeProductId(e.target.value)}
            placeholder="prod_..."
          />
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <h3 className="text-sm font-semibold">UCAT Free quotas</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Per-area limits for UCAT Free students. Set limit to 0 to disable an area. Periods use the
              student&apos;s timezone.
            </p>
          </div>
          <div className="space-y-4">
            {FREE_QUOTA_AREAS.map((area) => {
              const entry = freeQuotas[area.key] ?? { limit: '0', period: 'day' as UcatQuotaPeriod };
              return (
                <div key={area.key} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${area.key}-limit`}>{area.label} — limit</Label>
                    <Input
                      id={`${area.key}-limit`}
                      type="number"
                      min={0}
                      value={entry.limit}
                      onChange={(e) =>
                        setFreeQuotas((prev) => ({
                          ...prev,
                          [area.key]: { ...entry, limit: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${area.key}-period`}>{area.label} — period</Label>
                    <Select
                      value={entry.period}
                      onValueChange={(v) => {
                        if (!isQuotaPeriod(v)) return;
                        setFreeQuotas((prev) => ({
                          ...prev,
                          [area.key]: { ...entry, period: v },
                        }));
                      }}
                    >
                      <SelectTrigger id={`${area.key}-period`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </CardContent>
    </Card>
  );
}
