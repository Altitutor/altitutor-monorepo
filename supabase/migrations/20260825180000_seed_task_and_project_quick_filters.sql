-- Global quick filters: unlinked tasks, and projects the current user is a member of.

INSERT INTO public.quick_filters (user_id, target_entity, name, config)
SELECT NULL, 'tasks', 'Not linked to an issue or project', '{"unlinked":["none"]}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.quick_filters
  WHERE user_id IS NULL
    AND target_entity = 'tasks'
    AND name = 'Not linked to an issue or project'
);

INSERT INTO public.quick_filters (user_id, target_entity, name, config)
SELECT NULL, 'projects', 'My projects', '{"member":["$ME$"]}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.quick_filters
  WHERE user_id IS NULL
    AND target_entity = 'projects'
    AND name = 'My projects'
);
