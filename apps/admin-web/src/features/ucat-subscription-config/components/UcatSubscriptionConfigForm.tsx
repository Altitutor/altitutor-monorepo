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
} from '@altitutor/ui';
import {
  ucatSubscriptionConfigApi,
  type UcatSubscriptionConfigRow,
} from '../api/ucat-subscription-config';

interface UcatSubscriptionConfigFormProps {
  initial: UcatSubscriptionConfigRow;
  onSaved: () => void;
}

export function UcatSubscriptionConfigForm({ initial, onSaved }: UcatSubscriptionConfigFormProps) {
  const [minQuestionsPerDay, setMinQuestionsPerDay] = useState(String(initial.min_questions_per_day));
  const [discountPerDayCents, setDiscountPerDayCents] = useState(String(initial.discount_per_day_cents));
  const [trialDays, setTrialDays] = useState(String(initial.trial_days));
  const [currency, setCurrency] = useState(initial.currency);
  const [unlimitedStripeProductId, setUnlimitedStripeProductId] = useState(
    initial.unlimited_stripe_product_id ?? '',
  );
  const [proStripeProductId, setProStripeProductId] = useState(
    initial.pro_stripe_product_id ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMinQuestionsPerDay(String(initial.min_questions_per_day));
    setDiscountPerDayCents(String(initial.discount_per_day_cents));
    setTrialDays(String(initial.trial_days));
    setCurrency(initial.currency);
    setUnlimitedStripeProductId(initial.unlimited_stripe_product_id ?? '');
    setProStripeProductId(initial.pro_stripe_product_id ?? '');
  }, [initial]);

  const handleSave = async () => {
    setError(null);
    const minQ = parseInt(minQuestionsPerDay, 10);
    const disc = parseInt(discountPerDayCents, 10);
    const trial = parseInt(trialDays, 10);
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
        trial_days: trial,
        currency: cur,
        unlimited_stripe_product_id: unlimitedStripeProductId.trim() || null,
        pro_stripe_product_id: proStripeProductId.trim() || null,
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
        <CardTitle>UCAT subscription settings</CardTitle>
        <CardDescription>
          Unlimited trial length, practice-day discount rules, currency, and Stripe product IDs.
          Per-tier prices are configured below. UCAT Free quotas are under Settings → UCAT Free tier.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="trial-days">Unlimited trial days</Label>
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
              Shared across Unlimited and Pro; penalty base uses each tier&apos;s plan price.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="unlimited-product-id">Unlimited Stripe product ID</Label>
            <Input
              id="unlimited-product-id"
              value={unlimitedStripeProductId}
              onChange={(e) => setUnlimitedStripeProductId(e.target.value)}
              placeholder="prod_..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pro-product-id">Pro Stripe product ID</Label>
            <Input
              id="pro-product-id"
              value={proStripeProductId}
              onChange={(e) => setProStripeProductId(e.target.value)}
              placeholder="prod_..."
            />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
