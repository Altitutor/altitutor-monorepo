-- Exclude description and search_vector from activity logging for tasks and issues
-- This prevents noisy activity events when only the description is updated (e.g. during autosave)

CREATE OR REPLACE FUNCTION public.get_excluded_fields_for_table(table_name text)
RETURNS text[]
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE table_name
    WHEN 'invoices' THEN ARRAY['created_at', 'updated_at', 'created_by', 'stripe_invoice_id', 'stripe_invoice_number', 'stripe_charge_id', 'stripe_payment_intent_id', 'receipt_url', 'hosted_invoice_url', 'invoice_pdf', 'dispute_id', 'dispute_status', 'dispute_reason', 'dispute_amount_cents', 'dispute_currency', 'dispute_created_at', 'dispute_updated_at', 'dispute_resolved_at', 'finalized_at', 'paid_at']
    WHEN 'invoice_items' THEN ARRAY['created_at', 'stripe_invoice_item_id']
    WHEN 'credit_notes' THEN ARRAY['created_at', 'updated_at', 'stripe_credit_note_id']
    WHEN 'tasks' THEN ARRAY['created_at', 'updated_at', 'created_by', 'description', 'search_vector', 'source_rule_id', 'source_activity_id']
    WHEN 'issues' THEN ARRAY['created_at', 'updated_at', 'created_by', 'description', 'search_vector']
    ELSE ARRAY['created_at', 'updated_at', 'created_by'] -- Default: exclude only universal timestamps
  END;
END;
$$;
