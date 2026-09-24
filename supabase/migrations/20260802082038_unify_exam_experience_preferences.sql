-- Shared, app-scoped interface preferences. Domain settings remain in their
-- owning tables; this store is deliberately limited to presentation choices.
CREATE TABLE public.user_interface_preferences (
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_key TEXT NOT NULL CHECK (length(btrim(app_key)) > 0),
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(preferences) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (auth_user_id, app_key)
);

COMMENT ON TABLE public.user_interface_preferences IS
  'App-scoped presentation preferences keyed to an authenticated user. Never stores domain state.';

ALTER TABLE public.user_interface_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF manage user interface preferences"
  ON public.user_interface_preferences
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE TRIGGER update_user_interface_preferences_updated_at
  BEFORE UPDATE ON public.user_interface_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

REVOKE ALL ON public.user_interface_preferences FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_interface_preferences TO service_role;

-- Student reads remain behind the repository's caller-scoped facade. The view
-- is intentionally SECURITY DEFINER because Student has no base-table access.
CREATE VIEW public.vstudent_ucat_interface_preferences
WITH (security_invoker = false) AS
SELECT
  preference.app_key,
  preference.preferences,
  preference.updated_at
FROM public.user_interface_preferences preference
WHERE (SELECT public.is_student())
  AND preference.auth_user_id = (SELECT auth.uid())
  AND preference.app_key = 'ucat-web';

REVOKE ALL ON public.vstudent_ucat_interface_preferences FROM anon;
GRANT SELECT ON public.vstudent_ucat_interface_preferences TO authenticated;

-- Preserve the existing Study suggestions choice while moving ownership out
-- of the Study plan domain profile.
INSERT INTO public.user_interface_preferences (auth_user_id, app_key, preferences)
SELECT
  student.user_id,
  'ucat-web',
  jsonb_build_object(
    'studySuggestionsVisible', profile.study_suggestions_enabled,
    'examToolbarLayout', 'compact_top',
    'examToolbarVisible', true,
    'lagModeEnabled', false,
    'theme', 'system'
  )
FROM public.ucat_student_study_plan_profiles profile
JOIN public.students student ON student.id = profile.student_id
WHERE student.user_id IS NOT NULL
ON CONFLICT (auth_user_id, app_key) DO UPDATE
SET preferences = public.user_interface_preferences.preferences
  || jsonb_build_object(
    'studySuggestionsVisible', EXCLUDED.preferences->'studySuggestionsVisible'
  );

DROP VIEW public.vstudent_ucat_study_plan_profiles;

ALTER TABLE public.ucat_student_study_plan_profiles
  DROP COLUMN study_suggestions_enabled;

CREATE VIEW public.vstudent_ucat_study_plan_profiles
WITH (security_invoker = false) AS
SELECT profile.*
FROM public.ucat_student_study_plan_profiles profile
WHERE (SELECT public.is_student())
  AND profile.student_id = (SELECT public.current_student_id());

REVOKE ALL ON public.vstudent_ucat_study_plan_profiles FROM anon;
GRANT SELECT ON public.vstudent_ucat_study_plan_profiles TO authenticated;

-- Durable completion for inline question stems assigned to a class session.
CREATE TABLE public.ucat_student_session_resource_progress (
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_resource_id UUID NOT NULL
    REFERENCES public.ucat_sessions_resources(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, session_resource_id)
);

COMMENT ON TABLE public.ucat_student_session_resource_progress IS
  'Durable completion for a student working an inline session-assigned resource.';

ALTER TABLE public.ucat_student_session_resource_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF manage UCAT session resource progress"
  ON public.ucat_student_session_resource_progress
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE TRIGGER update_ucat_student_session_resource_progress_updated_at
  BEFORE UPDATE ON public.ucat_student_session_resource_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

REVOKE ALL ON public.ucat_student_session_resource_progress FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.ucat_student_session_resource_progress TO service_role;

CREATE VIEW public.vstudent_ucat_session_resource_progress
WITH (security_invoker = false) AS
SELECT
  progress.session_resource_id,
  progress.completed_at,
  progress.updated_at
FROM public.ucat_student_session_resource_progress progress
WHERE (SELECT public.is_student())
  AND progress.student_id = (SELECT public.current_student_id());

REVOKE ALL ON public.vstudent_ucat_session_resource_progress FROM anon;
GRANT SELECT ON public.vstudent_ucat_session_resource_progress TO authenticated;
