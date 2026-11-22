-- Install the insert trigger in the previous migration so new writes are
-- hashed without holding its DDL lock throughout this backfill. RPC retries
-- can read either receipt format while the update is in flight.
UPDATE public.interview_command_receipts
SET command = private.interview_command_payload_hash(command)
WHERE command ? 'commandId';
