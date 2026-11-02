"""Exercise the actual legacy-content backfill in an owned disposable database.

The schema additions that emulate the previous version are transaction-local.
The actual migration DO block performs the conversion; all fixtures roll back.
"""
import importlib.util
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("owned_database", ROOT / "scripts/owned_database.py")
owned = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owned)


def main():
    workdir, project = owned.verify_inner(ROOT, os.environ.get("ALTITUTOR_TEST_DB_MANIFEST"))
    database_id = owned.container(workdir, project)[0]
    migration = next((ROOT / "supabase/migrations").glob("*_interview_station_bank.sql")).read_text()
    conversion = migration[migration.index("CREATE TEMP TABLE interview_station_backfill"):migration.index("ALTER TABLE public.interview_questions ALTER COLUMN station_id SET NOT NULL;")]
    fixture = r"""
BEGIN;
ALTER TABLE public.interview_questions ALTER COLUMN station_id DROP NOT NULL;
ALTER TABLE public.interview_questions ADD COLUMN category_id uuid REFERENCES public.interview_categories(id), ADD COLUMN prompt jsonb;
INSERT INTO public.interview_categories(id,name) VALUES('e8261111-0000-4000-8000-000000000001','Legacy ethics');
INSERT INTO public.interview_questions(id,category_id,question,prompt,rubric,tag_ids)
 VALUES('e8261111-0000-4000-8000-000000000002','e8261111-0000-4000-8000-000000000001','"Legacy linked question"','"Original scenario"','"Original rubric"','{}'),
 ('e8261111-0000-4000-8000-000000000003','e8261111-0000-4000-8000-000000000001','"Unplaced bank question"','"Unplaced scenario"','"Unplaced rubric"','{}');
INSERT INTO public.interview_rubric_revisions(question_id,version,rubric,actor_id)
 VALUES('e8261111-0000-4000-8000-000000000002',1,'"Original rubric"','00000000-0000-0000-0000-000000000010');
INSERT INTO public.interviews(id,data) VALUES('e8261111-0000-4000-8000-000000000010',
 '{"name":"Legacy template","stations":[{"id":"e8261111-0000-4000-8000-000000000011","name":"First","maximumPoints":6.5,"questions":[{"id":"e8261111-0000-4000-8000-000000000012","questionId":"e8261111-0000-4000-8000-000000000002"}]},{"id":"e8261111-0000-4000-8000-000000000013","name":"Second","maximumPoints":6,"questions":[{"id":"e8261111-0000-4000-8000-000000000014","questionId":"e8261111-0000-4000-8000-000000000002"}]}]}');
INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
 SELECT id,'e8261111-0000-4000-8000-000000000010','00000000-0000-0000-0000-000000000010','{}','{}',
 jsonb_build_object('phase',phase,'stations',jsonb_build_array(jsonb_build_object('id','e8261111-0000-4000-8000-000000000013','name','Frozen name','maximumPoints',6,
 'questions',jsonb_build_array(jsonb_build_object('id','e8261111-0000-4000-8000-000000000014','questionId','e8261111-0000-4000-8000-000000000002','question','Frozen wording','prompt','Frozen prompt','rubric','Frozen rubric','rubricVersion',1)))),
 'attempts','[{"id":"e8261111-0000-4000-8000-000000000090","feedback":[{"placementId":"e8261111-0000-4000-8000-000000000014","value":"Existing feedback"}],"score":4.5}]'::jsonb)
 FROM (VALUES('e8261111-0000-4000-8000-000000000020'::uuid,'completed'),('e8261111-0000-4000-8000-000000000021'::uuid,'questions')) AS examples(id,phase);
CREATE TEMP TABLE original_rounds AS SELECT id,data FROM public.interview_rounds WHERE interview_id='e8261111-0000-4000-8000-000000000010';
INSERT INTO public.interview_result_releases(round_id,student_id,revision,snapshot,released_by)
 VALUES('e8261111-0000-4000-8000-000000000020','10000000-0000-0000-0000-000000000001',1,'{"score":4.5,"feedback":"Immutable publication"}','00000000-0000-0000-0000-000000000010');
"""
    assertions = r"""
DO $assertions$
DECLARE refs jsonb; active jsonb; completed jsonb; first_station uuid; second_station uuid;
BEGIN
 SELECT data->'stations' INTO refs FROM public.interviews WHERE id='e8261111-0000-4000-8000-000000000010';
 first_station:=(refs->0->>'stationId')::uuid; second_station:=(refs->1->>'stationId')::uuid;
 ASSERT first_station IS NOT NULL AND first_station<>second_station, 'Legacy stations must become distinct bank items';
 ASSERT NOT (refs->0 ? 'questions'), 'Interview must no longer own question placements';
 ASSERT (SELECT prompt FROM public.interview_stations WHERE id=first_station)='"Original scenario"'::jsonb, 'First-question prompt must move to its station';
 ASSERT (SELECT count(DISTINCT station_id) FROM public.interview_questions WHERE question='"Legacy linked question"'::jsonb)=2, 'Global question reuse must become independently owned children';
 ASSERT (SELECT count(*) FROM public.interview_rubric_revisions WHERE rubric='"Original rubric"'::jsonb)=2, 'Cloned child must retain rubric history';
 ASSERT EXISTS(SELECT 1 FROM public.interview_questions q JOIN public.interview_stations s ON s.id=q.station_id WHERE q.question='"Unplaced bank question"'::jsonb AND s.prompt='"Unplaced scenario"'::jsonb), 'Unplaced bank material must remain available';
 SELECT data INTO active FROM public.interview_rounds WHERE id='e8261111-0000-4000-8000-000000000021';
 ASSERT active->'stations'->0->>'stationId'=second_station::text, 'Active round must reference its bank station';
 ASSERT (SELECT station_id FROM public.interview_questions WHERE id=(active->'stations'->0->'questions'->0->>'questionId')::uuid)=second_station, 'Live rubric source must remap to the correct owned child';
 ASSERT active->'stations'->0->'questions'->0->>'id'='e8261111-0000-4000-8000-000000000014', 'Historical feedback identity must not change';
 ASSERT active->'stations'->0->>'prompt'='Frozen prompt' AND active->'stations'->0->'questions'->0->>'question'='Frozen wording', 'Active wording must remain frozen';
 ASSERT active->'attempts'=(SELECT data->'attempts' FROM original_rounds WHERE id='e8261111-0000-4000-8000-000000000021'), 'Attempt IDs, scores and feedback must remain unchanged';
 SELECT data INTO completed FROM public.interview_rounds WHERE id='e8261111-0000-4000-8000-000000000020';
 ASSERT completed=(SELECT data FROM original_rounds WHERE id='e8261111-0000-4000-8000-000000000020'), 'Completed round must remain byte-for-byte equivalent JSON';
 ASSERT (SELECT snapshot FROM public.interview_result_releases WHERE round_id='e8261111-0000-4000-8000-000000000020')='{"score":4.5,"feedback":"Immutable publication"}'::jsonb, 'Published revision must remain unchanged';
END;
$assertions$;
ROLLBACK;
"""
    subprocess.run(["docker", "exec", "-i", database_id, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], input=fixture+conversion+assertions, text=True, check=True)
    print("Interview station upgrade: legacy reuse, orphans, live feedback and immutable results passed")


if __name__ == "__main__":
    main()
