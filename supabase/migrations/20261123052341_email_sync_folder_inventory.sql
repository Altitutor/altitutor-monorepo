ALTER TABLE public.email_mailbox_identity
  ADD COLUMN folder_inventory_synced_at timestamptz;
GRANT UPDATE (folder_inventory_synced_at) ON public.email_mailbox_identity TO service_role;

CREATE FUNCTION public.email_read_sync_folder_inventory(
  p_mailbox_address text, p_token uuid
) RETURNS text[] LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_synced_at timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.email_sync_lease
    WHERE singleton AND token = p_token AND expires_at > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'Mailbox sync lease unavailable' USING ERRCODE = '55000';
  END IF;

  SELECT folder_inventory_synced_at INTO v_synced_at
  FROM public.email_mailbox_identity WHERE singleton AND address = p_mailbox_address;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mailbox identity does not match' USING ERRCODE = '42501';
  END IF;
  IF v_synced_at IS NULL OR v_synced_at <= clock_timestamp() - interval '5 minutes' THEN
    RETURN NULL;
  END IF;

  RETURN ARRAY(SELECT id FROM public.email_folders WHERE present ORDER BY id);
END;
$$;

CREATE FUNCTION public.email_reconcile_sync_folder_inventory(
  p_mailbox_address text, p_token uuid, p_folders jsonb
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- Hold the matching lease row for the entire reconciliation transaction.
  PERFORM 1 FROM public.email_sync_lease
  WHERE singleton AND token = p_token AND expires_at > clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mailbox sync lease unavailable' USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.email_mailbox_identity WHERE singleton AND address = p_mailbox_address
  ) THEN
    RAISE EXCEPTION 'Mailbox identity does not match' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_folders) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Expected complete mailbox folder inventory' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.email_folders AS catalog (id, name, parent_id, role, present)
  SELECT folder.id, folder.name, folder.parent_id, folder.role, true
  FROM jsonb_to_recordset(p_folders) AS folder (id text, name text, parent_id text, role text)
  ON CONFLICT (id) DO UPDATE
  SET name = excluded.name, parent_id = excluded.parent_id, role = excluded.role, present = true
  WHERE (catalog.name, catalog.parent_id, catalog.role, catalog.present)
    IS DISTINCT FROM (excluded.name, excluded.parent_id, excluded.role, true);

  WITH missing AS (
    UPDATE public.email_folders AS catalog SET present = false
    WHERE catalog.present AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_folders) AS folder(value)
      WHERE folder.value->>'id' = catalog.id
    )
    RETURNING id
  )
  UPDATE public.email_messages AS message SET removed = true, folder_id = NULL
  FROM missing WHERE message.folder_id = missing.id;

  UPDATE public.email_mailbox_identity SET folder_inventory_synced_at = clock_timestamp()
  WHERE singleton AND address = p_mailbox_address;
END;
$$;

REVOKE ALL ON FUNCTION public.email_read_sync_folder_inventory(text, uuid),
  public.email_reconcile_sync_folder_inventory(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_read_sync_folder_inventory(text, uuid),
  public.email_reconcile_sync_folder_inventory(text, uuid, jsonb) TO service_role;
