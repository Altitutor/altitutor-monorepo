-- Billing settings table for fee configuration
CREATE TABLE IF NOT EXISTS public.billing_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ADMINSTAFF full access to billing_settings" ON public.billing_settings;
CREATE POLICY "ADMINSTAFF full access to billing_settings" ON public.billing_settings
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

DROP TRIGGER IF EXISTS set_updated_at_billing_settings ON public.billing_settings;
CREATE TRIGGER set_updated_at_billing_settings
BEFORE UPDATE ON public.billing_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Insert default fee settings
INSERT INTO public.billing_settings (setting_key, setting_value, description) VALUES
  ('fee_percent_domestic', '0.0175', 'Stripe fee percentage for domestic (AU) cards'),
  ('fee_percent_intl', '0.029', 'Stripe fee percentage for international cards'),
  ('fee_fixed_cents', '30', 'Stripe fixed fee in cents'),
  ('domestic_country', 'AU', 'Country code for domestic fee rate')
ON CONFLICT (setting_key) DO NOTHING;


