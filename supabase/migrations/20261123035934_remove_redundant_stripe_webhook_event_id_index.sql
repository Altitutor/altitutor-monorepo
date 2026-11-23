-- The stripe_event_id UNIQUE constraint already supplies this lookup's btree.
-- Bound the wait for the exclusive table lock in the transactional migration.
SET LOCAL lock_timeout = '2s';
DROP INDEX IF EXISTS public.idx_webhook_events_stripe_id;
