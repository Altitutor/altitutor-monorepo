-- Exclude soft-deleted invoices from admin invoice search (depends on deleted_at on invoices)

CREATE OR REPLACE FUNCTION search_invoices_admin(
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_student_ids UUID[] DEFAULT NULL,
  p_statuses TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'invoice_date',
  p_ascending BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_invoices JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('invoices', '[]'::jsonb, 'total', 0);
  END IF;

  WITH filtered_invoices AS (
    SELECT 
      i.id,
      i.student_id,
      i.stripe_invoice_id,
      i.stripe_invoice_number,
      i.invoice_date,
      i.amount_due_cents,
      i.amount_paid_cents,
      i.currency,
      i.status,
      i.collection_method,
      i.auto_advance,
      i.fee_cents,
      i.net_cents,
      i.stripe_charge_id,
      i.stripe_payment_intent_id,
      i.receipt_url,
      i.hosted_invoice_url,
      i.invoice_pdf,
      i.finalized_at,
      i.dispute_id,
      i.dispute_status,
      i.dispute_reason,
      i.dispute_amount_cents,
      i.dispute_currency,
      i.dispute_created_at,
      i.dispute_updated_at,
      i.dispute_resolved_at,
      i.created_at,
      i.updated_at,
      i.paid_at,
      i.refunded_at,
      i.refunded_via_cn_at,
      i.credited_at,
      i.metadata,
      i.is_refunded,
      i.has_credit_notes,
      s.id AS student__id,
      s.first_name AS student__first_name,
      s.last_name AS student__last_name
    FROM public.invoices i
    LEFT JOIN public.students s ON s.id = i.student_id
    WHERE 
      i.deleted_at IS NULL
      AND (p_date_from IS NULL OR i.invoice_date >= p_date_from)
      AND (p_date_to IS NULL OR i.invoice_date <= p_date_to)
      AND (p_student_ids IS NULL OR array_length(p_student_ids, 1) IS NULL OR i.student_id = ANY(p_student_ids))
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR i.status = ANY(p_statuses))
  ),
  total_count AS (SELECT COUNT(*) AS count FROM filtered_invoices),
  ordered_invoices AS (
    SELECT * FROM filtered_invoices
    ORDER BY
      CASE WHEN p_order_by = 'invoice_date' AND p_ascending THEN invoice_date END ASC,
      CASE WHEN p_order_by = 'invoice_date' AND NOT p_ascending THEN invoice_date END DESC,
      CASE WHEN p_order_by = 'created_at' AND p_ascending THEN created_at END ASC,
      CASE WHEN p_order_by = 'created_at' AND NOT p_ascending THEN created_at END DESC,
      CASE WHEN p_order_by = 'status' AND p_ascending THEN status END ASC,
      CASE WHEN p_order_by = 'status' AND NOT p_ascending THEN status END DESC,
      CASE WHEN p_order_by = 'amount_due_cents' AND p_ascending THEN amount_due_cents END ASC,
      CASE WHEN p_order_by = 'amount_due_cents' AND NOT p_ascending THEN amount_due_cents END DESC,
      invoice_date DESC,
      created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'student_id', student_id,
        'stripe_invoice_id', stripe_invoice_id,
        'stripe_invoice_number', stripe_invoice_number,
        'invoice_date', invoice_date,
        'amount_due_cents', amount_due_cents,
        'amount_paid_cents', amount_paid_cents,
        'currency', currency,
        'status', status,
        'collection_method', collection_method,
        'auto_advance', auto_advance,
        'fee_cents', fee_cents,
        'net_cents', net_cents,
        'stripe_charge_id', stripe_charge_id,
        'stripe_payment_intent_id', stripe_payment_intent_id,
        'receipt_url', receipt_url,
        'hosted_invoice_url', hosted_invoice_url,
        'invoice_pdf', invoice_pdf,
        'finalized_at', finalized_at,
        'dispute_id', dispute_id,
        'dispute_status', dispute_status,
        'dispute_reason', dispute_reason,
        'dispute_amount_cents', dispute_amount_cents,
        'dispute_currency', dispute_currency,
        'dispute_created_at', dispute_created_at,
        'dispute_updated_at', dispute_updated_at,
        'dispute_resolved_at', dispute_resolved_at,
        'created_at', created_at,
        'updated_at', updated_at,
        'paid_at', paid_at,
        'refunded_at', refunded_at,
        'refunded_via_cn_at', refunded_via_cn_at,
        'credited_at', credited_at,
        'metadata', metadata,
        'is_refunded', is_refunded,
        'has_credit_notes', has_credit_notes,
        'student', CASE 
          WHEN student__id IS NOT NULL THEN jsonb_build_object(
            'id', student__id,
            'first_name', student__first_name,
            'last_name', student__last_name
          )
          ELSE NULL
        END
      )
    ),
    MAX(tc.count)
  INTO v_invoices, v_total_count
  FROM ordered_invoices oi
  CROSS JOIN total_count tc;

  RETURN jsonb_build_object(
    'invoices', COALESCE(v_invoices, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

COMMENT ON FUNCTION search_invoices_admin(DATE, DATE, UUID[], TEXT[], INTEGER, INTEGER, TEXT, BOOLEAN) IS 'Admin search invoices; excludes soft-deleted invoices.';
