-- Close the race where attendance changes after a credit adjustment is
-- claimed but before its Stripe credit note is persisted locally. The credit
-- note is the durable point at which a now-chargeable session may need a
-- restoration charge.

CREATE OR REPLACE FUNCTION private.enqueue_billing_after_session_credit_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sessions_students_id uuid;
  v_created_by uuid;
BEGIN
  IF NEW.billing_adjustment_id IS NULL OR NEW.status = 'void' THEN
    RETURN NEW;
  END IF;

  SELECT
    adjustment.sessions_students_id,
    adjustment.created_by
  INTO
    v_sessions_students_id,
    v_created_by
  FROM public.session_billing_adjustments adjustment
  WHERE adjustment.id = NEW.billing_adjustment_id
    AND adjustment.kind = 'credit_note';

  IF v_sessions_students_id IS NOT NULL THEN
    PERFORM public.enqueue_session_billing_adjustment(
      v_sessions_students_id,
      v_created_by,
      'system_reconciliation',
      'Revalidated after the session credit note was recorded'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_billing_after_session_credit_note
  ON public.credit_notes;

CREATE TRIGGER enqueue_billing_after_session_credit_note
AFTER INSERT
ON public.credit_notes
FOR EACH ROW
EXECUTE FUNCTION private.enqueue_billing_after_session_credit_note();

REVOKE ALL ON FUNCTION private.enqueue_billing_after_session_credit_note()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION private.enqueue_billing_after_session_credit_note() IS
  'Re-evaluates a session obligation after an adjustment-owned Credit note persists, closing attendance races without scanning historical records.';

-- An untouched reschedule replacement has a pending normal charge as soon as
-- it is assigned. If AdminStaff undo that reschedule before attendance or
-- invoicing, the pending work must not turn the billing-history foreign key
-- into a reason the replacement cannot be removed. Only work which has never
-- begun processing is disposable; all financially meaningful history remains
-- protected by the existing restrictive foreign key.
CREATE OR REPLACE FUNCTION private.discard_pending_session_charge_before_assignment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.session_billing_adjustments
  WHERE sessions_students_id = OLD.id
    AND kind = 'session_charge'
    AND status IN ('pending', 'superseded');

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS discard_pending_session_charge_before_assignment_delete
  ON public.sessions_students;

CREATE TRIGGER discard_pending_session_charge_before_assignment_delete
BEFORE DELETE
ON public.sessions_students
FOR EACH ROW
EXECUTE FUNCTION private.discard_pending_session_charge_before_assignment_delete();

REVOKE ALL ON FUNCTION private.discard_pending_session_charge_before_assignment_delete()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION private.discard_pending_session_charge_before_assignment_delete() IS
  'Discards never-processed session-charge work when its source assignment is intentionally removed; processed billing history remains protected.';
