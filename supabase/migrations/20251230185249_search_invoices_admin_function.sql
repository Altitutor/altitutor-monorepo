-- Migration: Create search_invoices_admin RPC function
-- Description:
--   - Create optimized RPC function for searching and filtering invoices
--   - Supports filtering by date range, student IDs, statuses
--   - Returns invoices with student relationship
--   - Includes pagination and ordering support
--   - Uses existing indexes on invoices table

-- ========================
-- SEARCH_INVOICES_ADMIN FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION search_invoices_admin(
  -- Filters
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_student_ids UUID[] DEFAULT NULL,
  p_statuses TEXT[] DEFAULT NULL,
  
  -- Pagination
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  
  -- Ordering
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
  -- Security check
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object(
      'invoices', '[]'::jsonb,
      'total', 0
    );
  END IF;

  -- Build filtered invoices query with all filters
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
      i.metadata,
      -- Student relationship
      s.id AS student__id,
      s.first_name AS student__first_name,
      s.last_name AS student__last_name
    FROM public.invoices i
    LEFT JOIN public.students s ON s.id = i.student_id
    WHERE 
      -- Date range filter
      (p_date_from IS NULL OR i.invoice_date >= p_date_from)
      AND (p_date_to IS NULL OR i.invoice_date <= p_date_to)
      -- Student filter
      AND (p_student_ids IS NULL OR array_length(p_student_ids, 1) IS NULL OR i.student_id = ANY(p_student_ids))
      -- Status filter
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR i.status = ANY(p_statuses))
  ),
  ordered_invoices AS (
    SELECT *
    FROM filtered_invoices
    ORDER BY
      CASE WHEN p_order_by = 'invoice_date' AND p_ascending THEN invoice_date END ASC,
      CASE WHEN p_order_by = 'invoice_date' AND NOT p_ascending THEN invoice_date END DESC,
      CASE WHEN p_order_by = 'created_at' AND p_ascending THEN created_at END ASC,
      CASE WHEN p_order_by = 'created_at' AND NOT p_ascending THEN created_at END DESC,
      CASE WHEN p_order_by = 'status' AND p_ascending THEN status END ASC,
      CASE WHEN p_order_by = 'status' AND NOT p_ascending THEN status END DESC,
      CASE WHEN p_order_by = 'amount_due_cents' AND p_ascending THEN amount_due_cents END ASC,
      CASE WHEN p_order_by = 'amount_due_cents' AND NOT p_ascending THEN amount_due_cents END DESC,
      -- Default to invoice_date DESC if order_by doesn't match
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
        'metadata', metadata,
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
    COUNT(*) OVER()::BIGINT
  INTO v_invoices, v_total_count
  FROM ordered_invoices;

  -- Build result
  RETURN jsonb_build_object(
    'invoices', COALESCE(v_invoices, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

-- Grant execute permission to authenticated users (RLS will handle authorization)
GRANT EXECUTE ON FUNCTION search_invoices_admin TO authenticated;

-- Add comment
COMMENT ON FUNCTION search_invoices_admin IS 'Admin search function for invoices with filtering, pagination, and ordering support';

