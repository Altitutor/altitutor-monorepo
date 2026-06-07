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
  type UcatSubscriptionConfigRow,
} from '../api/ucat-subscription-config';

const BILLING_INTERVALS = ['week', 'fortnight', 'month'] as const;

type BillingInterval = (typeof BILLING_INTERVALS)[number];

function isBillingInterval(v: string): v is BillingInterval {
  return (BILLING_INTERVALS as readonly string[]).includes(v);
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
  const [monthlyBasePriceCents, setMonthlyBasePriceCents] = useState(
    String(initial.monthly_base_price_cents ?? Math.round(initial.base_price_cents * 4 * 0.75)),
  );
  const [currency, setCurrency] = useState(initial.currency);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    isBillingInterval(initial.billing_interval) ? initial.billing_interval : 'week',
  );
  const [stripePriceId, setStripePriceId] = useState(initial.stripe_price_id ?? '');
  const [monthlyStripePriceId, setMonthlyStripePriceId] = useState(
    initial.monthly_stripe_price_id ?? '',
  );
  const [stripeProductId, setStripeProductId] = useState(initial.stripe_product_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMinQuestionsPerDay(String(initial.min_questions_per_day));
    setDiscountPerDayCents(String(initial.discount_per_day_cents));
    setTrialDays(String(initial.trial_days));
    setBasePriceCents(String(initial.base_price_cents));
    setMonthlyBasePriceCents(
      String(initial.monthly_base_price_cents ?? Math.round(initial.base_price_cents * 4 * 0.75)),
    );
    setCurrency(initial.currency);
    setBillingInterval(
      isBillingInterval(initial.billing_interval) ? initial.billing_interval : 'week',
    );
    setStripePriceId(initial.stripe_price_id ?? '');
    setMonthlyStripePriceId(initial.monthly_stripe_price_id ?? '');
    setStripeProductId(initial.stripe_product_id ?? '');
  }, [initial]);

  const handleSave = async () => {
    setError(null);
    const minQ = parseInt(minQuestionsPerDay, 10);
    const disc = parseInt(discountPerDayCents, 10);
    const trial = parseInt(trialDays, 10);
    const weeklyBase = parseInt(basePriceCents, 10);
    const monthlyBase = parseInt(monthlyBasePriceCents, 10);
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
    if (!Number.isFinite(weeklyBase) || weeklyBase < 0) {
      setError('Weekly base price (cents) must be 0 or greater');
      return;
    }
    if (!Number.isFinite(monthlyBase) || monthlyBase < 0) {
      setError('Monthly base price (cents) must be 0 or greater');
      return;
    }
    const cur = currency.trim().toLowerCase();
    if (!cur || cur.length > 8) {
      setError('Currency must be a short code (e.g. aud)');
      return;
    }

    setSaving(true);
    try {
      await ucatSubscriptionConfigApi.update(initial.id, {
        min_questions_per_day: minQ,
        discount_per_day_cents: disc,
        billing_interval: billingInterval,
        trial_days: trial,
        base_price_cents: weeklyBase,
        monthly_base_price_cents: monthlyBase,
        currency: cur,
        stripe_price_id: stripePriceId.trim() || null,
        monthly_stripe_price_id: monthlyStripePriceId.trim() || null,
        stripe_product_id: stripeProductId.trim() || null,
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
          Trial length, practice-day discount rules, and weekly/monthly Pro pricing shown on the UCAT
          subscribe page. Stripe price IDs drive checkout (env vars{' '}
          <code className="text-xs">UCAT_STRIPE_PRICE_ID</code> /{' '}
          <code className="text-xs">UCAT_STRIPE_MONTHLY_PRICE_ID</code> on ucat-web override DB when
          set). UCAT Free tier limits are under Settings → UCAT Free tier.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Shared</h3>
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
              <p className="text-xs text-muted-foreground">
                Applied as a Stripe invoice item when eligible (Pro only).
              </p>
            </div>
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
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Weekly Pro</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="base-price-cents">Display price (cents)</Label>
              <Input
                id="base-price-cents"
                type="number"
                min={0}
                value={basePriceCents}
                onChange={(e) => setBasePriceCents(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Shown as /wk standard on subscribe.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-interval">Billing interval label</Label>
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
          <div className="space-y-2">
            <Label htmlFor="stripe-price-id">Stripe price ID</Label>
            <Input
              id="stripe-price-id"
              value={stripePriceId}
              onChange={(e) => setStripePriceId(e.target.value)}
              placeholder="price_..."
            />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Monthly Pro</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="monthly-base-price-cents">Display price (cents)</Label>
              <Input
                id="monthly-base-price-cents"
                type="number"
                min={0}
                value={monthlyBasePriceCents}
                onChange={(e) => setMonthlyBasePriceCents(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Shown as /mo standard on subscribe.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly-stripe-price-id">Stripe price ID</Label>
              <Input
                id="monthly-stripe-price-id"
                value={monthlyStripePriceId}
                onChange={(e) => setMonthlyStripePriceId(e.target.value)}
                placeholder="price_..."
              />
            </div>
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
