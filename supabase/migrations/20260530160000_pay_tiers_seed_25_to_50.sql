-- Pay tier ladder: $25/hr starting, +$2.50/hr per tier through $50/hr (11 tiers).

INSERT INTO public.staff_pay_tiers (tier_number, name, base_pay_rate_cents, currency)
VALUES
  (1, 'Tier 1', 2500, 'AUD'),
  (2, 'Tier 2', 2750, 'AUD'),
  (3, 'Tier 3', 3000, 'AUD'),
  (4, 'Tier 4', 3250, 'AUD'),
  (5, 'Tier 5', 3500, 'AUD'),
  (6, 'Tier 6', 3750, 'AUD'),
  (7, 'Tier 7', 4000, 'AUD'),
  (8, 'Tier 8', 4250, 'AUD'),
  (9, 'Tier 9', 4500, 'AUD'),
  (10, 'Tier 10', 4750, 'AUD'),
  (11, 'Tier 11', 5000, 'AUD')
ON CONFLICT (tier_number) DO UPDATE SET
  name = EXCLUDED.name,
  base_pay_rate_cents = EXCLUDED.base_pay_rate_cents,
  currency = EXCLUDED.currency;
