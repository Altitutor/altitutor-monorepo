-- Project members: staff involved in a project. A project lead is always a member.

CREATE TABLE public.project_members (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, staff_id)
);

CREATE INDEX idx_project_members_staff_id ON public.project_members(staff_id);

COMMENT ON TABLE public.project_members IS 'Staff involved in a project. The project lead is always a member.';
COMMENT ON COLUMN public.project_members.staff_id IS 'A project member. Distinct from the project lead designation, which always implies membership.';

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to project_members" ON public.project_members;
CREATE POLICY "ADMINSTAFF full access to project_members" ON public.project_members
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

INSERT INTO public.project_members (project_id, staff_id)
SELECT id, project_lead_id
FROM public.projects
WHERE project_lead_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_project_lead_is_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_lead_id IS NOT NULL THEN
    INSERT INTO public.project_members (project_id, staff_id)
    VALUES (NEW.id, NEW.project_lead_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_project_lead_is_member ON public.projects;
CREATE TRIGGER ensure_project_lead_is_member
AFTER INSERT OR UPDATE OF project_lead_id ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.ensure_project_lead_is_member();

CREATE OR REPLACE FUNCTION public.project_lead_must_remain_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = OLD.project_id
      AND project_lead_id = OLD.staff_id
  ) THEN
    RAISE EXCEPTION 'Project lead must remain a project member';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS project_lead_must_remain_member ON public.project_members;
CREATE CONSTRAINT TRIGGER project_lead_must_remain_member
AFTER DELETE ON public.project_members
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.project_lead_must_remain_member();

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.project_members';
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;
