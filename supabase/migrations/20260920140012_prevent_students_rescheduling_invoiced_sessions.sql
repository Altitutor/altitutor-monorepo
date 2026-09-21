-- Student self-service rescheduling must stop once a session has financial
-- history. AdminStaff absence commands remain responsible for any invoiced
-- session changes and their corresponding billing adjustments.
CREATE OR REPLACE FUNCTION public.log_student_absences_self(
  operations jsonb,
  logged_by_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  invoiced_sessions_students_id uuid;
BEGIN
  IF jsonb_typeof(operations) = 'array' THEN
    SELECT ss.id
    INTO invoiced_sessions_students_id
    FROM jsonb_array_elements(operations) operation
    JOIN public.sessions_students ss
      ON ss.id::text = operation->>'original_sessions_students_id'
      AND ss.student_id = logged_by_student_id
    JOIN public.invoice_items invoice_item
      ON invoice_item.sessions_students_id = ss.id
      AND invoice_item.is_fee = false
      AND invoice_item.deleted_at IS NULL
    JOIN public.invoices invoice
      ON invoice.id = invoice_item.invoice_id
      AND invoice.deleted_at IS NULL
    LIMIT 1;

    IF invoiced_sessions_students_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This session has already been invoiced. Please contact Altitutor to change it.',
        'code', 'SESSION_ALREADY_INVOICED'
      );
    END IF;
  END IF;

  RETURN private.run_absence_lifecycle_operation(
    'student_absence',
    'log_student_absences_self_rows',
    operations,
    logged_by_student_id
  );
END;
$function$;

COMMENT ON FUNCTION public.log_student_absences_self(jsonb, uuid) IS
  'Logs a student self-service reschedule only when the original session booking has no invoice history.';

REVOKE ALL ON FUNCTION public.log_student_absences_self(jsonb, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_student_absences_self(jsonb, uuid)
  TO authenticated, service_role;
