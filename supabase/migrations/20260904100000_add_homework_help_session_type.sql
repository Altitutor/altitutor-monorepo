-- Homework Help is an operational Session type, not a Subject or billing type.
-- Keep this enum addition in its own committed transaction so later migrations
-- can safely use the new value on every supported PostgreSQL version.

ALTER TYPE public.session_type ADD VALUE IF NOT EXISTS 'HOMEWORK_HELP';
