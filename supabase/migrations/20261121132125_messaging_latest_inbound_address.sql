-- DEV-491: bound reply-address work to one indexed candidate per conversation.
-- The caller's existing table privileges and AdminStaff RLS remain authoritative.
CREATE FUNCTION public.get_contact_latest_inbound_address(p_contact_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT latest.from_number_e164
 FROM public.conversations conversation
 CROSS JOIN LATERAL (
  SELECT message.id,message.created_at,message.from_number_e164
  FROM public.messages message
  WHERE message.conversation_id=conversation.id
   AND message.direction='INBOUND' AND message.is_reaction=false
  ORDER BY message.created_at DESC,message.id DESC
  LIMIT 1
 ) latest
 WHERE conversation.contact_id=p_contact_id
 ORDER BY latest.created_at DESC,latest.id DESC
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_contact_latest_inbound_address(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_contact_latest_inbound_address(uuid) TO authenticated,service_role;
COMMENT ON FUNCTION public.get_contact_latest_inbound_address(uuid) IS 'Latest substantive inbound reply address across all contact conversations, using caller table privileges and RLS.';
