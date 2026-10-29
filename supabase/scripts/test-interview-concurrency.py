"""Twelve-party interview command races over real HTTP, only in an owned DB lease.

Six existing disposable tutor/student fixtures use a dedicated Medicine class.
Assertions read the public service snapshot RPC, not internal aggregate fields.
The outer owned_database runner destroys its own stack even if cleanup fails.
"""
import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("owned_database", ROOT / "scripts/owned_database.py")
owned = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owned)


def main():
    workdir, project = owned.verify_inner(ROOT, os.environ.get("ALTITUTOR_TEST_DB_MANIFEST"))
    database_id = owned.container(workdir, project)[0]
    _, _, _, api_port = owned.configuration(workdir)
    api_url = os.environ["SUPABASE_URL"]
    parsed = urllib.parse.urlparse(api_url)
    assert parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    assert str(parsed.port) == api_port and not parsed.username and not parsed.password
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    tutors = [f"00000000-0000-0000-0000-{index:012d}" for index in range(10, 16)]
    students = [f"10000000-0000-0000-0000-{index:012d}" for index in range(1, 7)]
    class_id, category_id, question_id, interview_id, online_id, physical_id = [str(uuid.uuid4()) for _ in range(6)]
    shared_question_id = str(uuid.uuid4())
    owner_station_ids = [str(uuid.uuid4()), str(uuid.uuid4())]
    command_ids = set()
    grant_ids = []

    def sql(statement):
        result = subprocess.run(
            ["docker", "exec", "-i", database_id, "psql", "-U", "postgres", "-d", "postgres",
             "-v", "ON_ERROR_STOP=1", "-Atq"], input=statement, text=True, capture_output=True,
        )
        if result.returncode:
            raise AssertionError("Disposable interview fixture SQL failed: " + result.stderr.strip())
        return result.stdout.strip()

    def rpc(function, payload, barrier=None):
        request = urllib.request.Request(
            api_url + "/rest/v1/rpc/" + function, data=json.dumps(payload).encode(),
            headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"},
        )
        if barrier:
            barrier.wait(timeout=10)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    def payload(actor, command):
        command = {"commandId": str(uuid.uuid4()), **command}
        command_ids.add(command["commandId"])
        return {"p_actor_user_id": actor, "p_command": command}

    def command(actor, value):
        status, body = rpc("interview_command", payload(actor, value))
        assert status == 200, f"Interview {value['type']} failed: {body}"
        return body

    def snapshot(round_id):
        status, body = rpc("interview_media_state", {"p_round_id": round_id})
        assert status == 200 and body and body["id"] == round_id, "Scoped service snapshot failed"
        return body

    def parallel(requests):
        barrier = threading.Barrier(len(requests))
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(requests)) as executor:
            return list(executor.map(lambda value: rpc("interview_command", value, barrier), requests))

    def control(kind, actor=tutors[0], round_id=online_id, **extra):
        state = snapshot(round_id)
        return command(actor, {"type": kind, "roundId": round_id, "expectedVersion": state["version"], **extra})

    quoted_tutors = ",".join("'" + value + "'" for value in tutors)
    quoted_students = ",".join("'" + value + "'" for value in students)
    original_sixth_status = sql(f"SELECT status FROM public.staff WHERE id='{tutors[5]}';")
    assert original_sixth_status in {"ACTIVE", "INACTIVE", "TRIAL"}
    try:
        sql(f"UPDATE public.staff SET status='ACTIVE' WHERE id='{tutors[5]}';")
        grant_ids = json.loads(sql(f"""
          WITH added AS (
            INSERT INTO public.staff_subjects(staff_id,subject_id)
            SELECT staff.id,subject.id FROM public.staff staff CROSS JOIN public.subjects subject
            WHERE staff.id IN ({quoted_tutors}) AND subject.name='Medicine Interview'
            ON CONFLICT DO NOTHING RETURNING id
          ) SELECT coalesce(jsonb_agg(id),'[]') FROM added;
        """))
        sql(f"""
          BEGIN;
          INSERT INTO public.classes(id,subject_id,day_of_week,start_time,end_time,status,session_start_date,session_end_date)
          SELECT '{class_id}',id,1,'16:00','17:00','ACTIVE',current_date,current_date+365
          FROM public.subjects WHERE name='Medicine Interview' LIMIT 1;
          ALTER TABLE public.classes_students DISABLE TRIGGER trigger_sync_student_on_enrollment;
          INSERT INTO public.classes_students(id,student_id,class_id,enrolled_at,enrolled_by)
          SELECT gen_random_uuid(),id,'{class_id}',now()-interval '1 day','00000000-0000-0000-0000-000000000001'
          FROM public.students WHERE id IN ({quoted_students});
          ALTER TABLE public.classes_students ENABLE TRIGGER trigger_sync_student_on_enrollment;
          CREATE FUNCTION private.test_interview_concurrency_delay() RETURNS trigger LANGUAGE plpgsql AS $body$
          BEGIN
            IF NEW.id='{online_id}' AND OLD.data->>'startedAt' IS NULL AND NEW.data->>'startedAt' IS NOT NULL THEN
              PERFORM pg_advisory_xact_lock(hashtextextended('{online_id}',9));
            END IF;
            IF NEW.id IN ('{online_id}','{physical_id}') THEN PERFORM pg_sleep(0.05); END IF;
            RETURN NEW;
          END;
          $body$;
          CREATE TRIGGER test_interview_concurrency_delay BEFORE UPDATE ON public.interview_rounds
            FOR EACH ROW EXECUTE FUNCTION private.test_interview_concurrency_delay();
          COMMIT;
        """)
        command(tutors[0], {"type": "saveCategory", "category": {"id": category_id, "name": "Concurrency", "parentId": None}})
        # Force two station saves to observe the same missing child identity.
        # Only one may claim it; the loser must roll back without changing it.
        sql(f"""
          CREATE FUNCTION private.test_interview_question_owner_delay() RETURNS trigger LANGUAGE plpgsql AS $body$
          BEGIN
            IF NEW.id='{shared_question_id}' THEN PERFORM pg_sleep(0.2); END IF;
            RETURN NEW;
          END;
          $body$;
          CREATE TRIGGER test_interview_question_owner_delay BEFORE INSERT ON public.interview_questions
            FOR EACH ROW EXECUTE FUNCTION private.test_interview_question_owner_delay();
        """)
        competing = [payload(tutor, {"type": "saveStation", "expectedVersion": 0, "station": {
            "id": owner, "name": f"Ownership contender {index}", "categoryId": category_id,
            "prompt": "Ownership scenario", "maximumPoints": 6, "archived": False,
            "questions": [{"id": shared_question_id, "stationId": owner, "tagIds": [],
                           "question": f"Owned question {index}", "rubric": "Ownership rubric", "suggestedTimeSeconds": 60}],
        }}) for index, (tutor, owner) in enumerate(zip(tutors, owner_station_ids))]
        ownership = parallel(competing)
        assert sum(status == 200 for status, _ in ownership) == 1, "Only one station may claim a new question identity"
        loser = next(body for status, body in ownership if status != 200)
        assert loser.get("code") == "22023", "Losing station must reject rather than overwrite another owner's question"
        winner = next(index for index, (status, _) in enumerate(ownership) if status == 200)
        status, bank = rpc("interview_station_json", {"s": {"id": owner_station_ids[winner]}})
        assert status == 200 and bank and len(bank["questions"]) == 1, "Winning station must retain its one owned question"
        assert bank["questions"][0]["question"] == f"Owned question {winner}", "Losing save must not change the winner's wording"
        sql("DROP TRIGGER test_interview_question_owner_delay ON public.interview_questions; DROP FUNCTION private.test_interview_question_owner_delay();")
        print("PASS: concurrent cross-station inserts preserve exclusive question ownership")
        station_id = str(uuid.uuid4())
        command(tutors[0], {"type": "saveStation", "expectedVersion": 0, "station": {
            "id": station_id, "name": "Motivation", "categoryId": category_id,
            "prompt": "Explain your motivation.", "maximumPoints": 6, "archived": False,
            "questions": [{"id": question_id, "stationId": station_id, "tagIds": [], "question": "Why medicine?",
                           "rubric": "Listen for reflection.", "suggestedTimeSeconds": 60}],
        }})
        stations = [{"id": str(uuid.uuid4()), "stationId": station_id} for _ in range(6)]
        command(tutors[0], {"type": "saveInterview", "expectedVersion": 0, "interview": {
            "id": interview_id, "name": "Concurrent MMI", "readingTimeSeconds": 1, "questionTimeSeconds": 1,
            "recordingEnabled": False, "archived": False, "stations": stations,
        }})
        setup = {"interviewId": interview_id, "name": "Twelve-party mock", "delivery": "online", "mode": "exam",
                 "recordingEnabled": False, "scheduledAt": None, "studentIds": students,
                 "assignments": [{"stationId": station["id"], "tutorId": tutor} for station, tutor in zip(stations, tutors)]}
        command(tutors[0], {"type": "createRound", "roundId": online_id, "setup": setup})
        # Liveness must not wait behind an unrelated assessment transaction.
        lock_process = subprocess.Popen(
            ["docker", "exec", "-i", database_id, "psql", "-U", "postgres", "-d", "postgres",
             "-v", "ON_ERROR_STOP=1", "-Atq"],
            stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
        )
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)
        try:
            lock_process.stdin.write(f"BEGIN; SET LOCAL application_name='interview_heartbeat_lock_test'; SET LOCAL idle_in_transaction_session_timeout='15s'; SELECT pg_advisory_xact_lock(hashtextextended('{online_id}',9));\n")
            lock_process.stdin.flush()
            deadline = time.monotonic() + 3
            while time.monotonic() < deadline:
                if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='interview_heartbeat_lock_test' AND state='idle in transaction';") == '1':
                    break
                time.sleep(0.02)
            else:
                raise AssertionError("Owned fixture did not acquire its assessment-release barrier")
            assessment = executor.submit(control, "start")
            blocked_assessment = "SELECT count(*) FROM pg_stat_activity a CROSS JOIN LATERAL unnest(pg_blocking_pids(a.pid)) blocker(pid) JOIN pg_stat_activity b ON b.pid=blocker.pid WHERE b.application_name='interview_heartbeat_lock_test' AND a.wait_event='advisory';"
            deadline = time.monotonic() + 3
            while time.monotonic() < deadline:
                if sql(blocked_assessment) == '1':
                    break
                time.sleep(0.02)
            else:
                raise AssertionError("Actual round-control request did not reach the locked assessment barrier")
            heartbeat = executor.submit(command, tutors[0], {"type": "heartbeat", "roundId": online_id})
            try:
                heartbeat.result(timeout=2)
            except concurrent.futures.TimeoutError as error:
                blocking = sql("SELECT coalesce(jsonb_agg(jsonb_build_object('application',a.application_name,'wait',a.wait_event,'blocker',b.application_name)),'[]') FROM pg_stat_activity a CROSS JOIN LATERAL unnest(pg_blocking_pids(a.pid)) blocker(pid) JOIN pg_stat_activity b ON b.pid=blocker.pid WHERE a.application_name LIKE 'PostgREST%' AND (b.application_name='interview_heartbeat_lock_test' OR b.application_name LIKE 'PostgREST%');")
                raise AssertionError("Heartbeat did not finish while assessment lock remained held; blocking graph: " + blocking) from error
            assert sql(blocked_assessment) == '1', "Actual round-control transaction must still be waiting at its assessment barrier after heartbeat returns"
            row_probe = subprocess.run(
                ["docker", "exec", "-i", database_id, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"],
                input=f"SELECT 1 FROM public.interview_rounds WHERE id='{online_id}' FOR NO KEY UPDATE NOWAIT;",
                text=True, capture_output=True,
            )
            assert row_probe.returncode != 0 and 'could not obtain lock on row' in row_probe.stderr, "The real round-control request must still hold its database row lock"
        finally:
            try:
                lock_process.communicate("ROLLBACK;\n", timeout=5)
            except subprocess.TimeoutExpired:
                lock_process.kill()
                lock_process.communicate(timeout=5)
                raise
            finally:
                executor.shutdown(wait=True)
        assessment.result(timeout=5)
        print("PASS: heartbeat completes without waiting for the assessment round lock")
        for tutor in tutors:
            control("ready", actor=tutor, ready=True)
        outcomes = parallel([payload(actor, {"type": "heartbeat", "roundId": online_id}) for actor in tutors + students])
        assert all(status == 200 for status, _ in outcomes), "Every one of twelve selected participants can reconnect"
        control("startReading")
        time.sleep(2.2)  # Both one-second server deadlines elapse; clients do not advance the clock.
        for index, tutor in enumerate(tutors):
            current = snapshot(online_id)
            progress = next(p for p in current["progress"] if p["tutorId"] == tutor)
            attempt = next(a for a in current["attempts"] if a["stationId"] == progress["stationId"] and a["studentId"] == progress["studentId"])
            command(tutor, {"type": "saveAttempt", "roundId": online_id, "attemptId": attempt["id"],
                           "expectedAttemptVersion": attempt["version"], "score": index + 0.5,
                           "notAssessedReason": None, "feedback": []})
            control("finishFeedback", actor=tutor)
        before = snapshot(online_id)
        assert before["phase"] == "feedback" and before["rotation"] == 0
        requests = [payload(tutor, {"type": "next", "roundId": online_id, "expectedVersion": before["version"]}) for tutor in tutors]
        requests += [payload(student, {"type": "heartbeat", "roundId": online_id}) for student in students]
        print("Running simultaneous Next and heartbeat requests", flush=True)
        outcomes = parallel(requests)
        successes = [body for status, body in outcomes[:6] if status == 200]
        failures = [body for status, body in outcomes[:6] if status != 200]
        assert len(successes) == 1 and len(failures) == 5 and all(body.get("code") == "PT409" for body in failures), "Exactly one simultaneous Next must succeed"
        assert all(status == 200 for status, _ in outcomes[6:]), "Student heartbeats survive tutor transition contention"
        after = snapshot(online_id)
        assert after["rotation"] == 1 and after["phase"] == "waiting", "Concurrent Next must never skip a rotation"
        print("PASS: twelve concurrent participants; six simultaneous Next actions advance exactly once")

        attempts = [next(a for a in before["attempts"] if a["stationId"] == station["id"] and a["studentId"] == student)
                    for station, student in zip(stations, students)]
        save_commands = [{"type": "saveAttempt", "roundId": online_id, "attemptId": attempt["id"], "expectedAttemptVersion": attempt["version"],
                          "score": index + 0.5, "notAssessedReason": None,
                          "feedback": [{"placementId": question_id, "value": f"Independent tutor {index}"}]}
                         for index, attempt in enumerate(attempts)]
        requests = [payload(tutor, save) for tutor, save in zip(tutors, save_commands)]
        requests += [payload(student, {"type": "heartbeat", "roundId": online_id}) for student in students]
        outcomes = parallel(requests)
        assert all(status == 200 for status, _ in outcomes), "Independent station autosaves must all succeed under heartbeat traffic"
        saved = snapshot(online_id)
        for index, attempt in enumerate(attempts):
            observed = next(a for a in saved["attempts"] if a["id"] == attempt["id"])
            assert observed["score"] == index + 0.5 and observed["feedback"][0]["value"] == f"Independent tutor {index}", "Concurrent note or score was lost"
        assert saved["version"] == after["version"], "Independent autosaves must not invalidate round control versions"
        print("PASS: six simultaneous independent assessments persist with six student heartbeats; no lost notes")

        current = next(a for a in saved["attempts"] if a["id"] == attempts[0]["id"])
        duplicate = payload(tutors[0], {**save_commands[0], "score": 2.5, "expectedAttemptVersion": current["version"]})
        outcomes = parallel([duplicate] * 12)
        assert all(status == 200 for status, _ in outcomes) and len({json.dumps(body, sort_keys=True) for _, body in outcomes}) == 1, "Simultaneous duplicate command IDs must return one identical outcome"
        retried = next(a for a in snapshot(online_id)["attempts"] if a["id"] == current["id"])
        assert retried["version"] == current["version"] + 1 and retried["score"] == 2.5, "Retried command must apply once"
        print("PASS: twelve simultaneous retries of one command return one outcome and increment attempt version once")

        command(tutors[0], {"type": "createRound", "roundId": physical_id, "setup": {**setup, "delivery": "in_person"}})
        control("start", round_id=physical_id)
        initial = snapshot(physical_id)
        requests = [payload(tutor, {"type": "claimStudent", "roundId": physical_id, "expectedVersion": initial["version"], "studentId": students[0]}) for tutor in tutors[:2]]
        requests += [payload(actor, {"type": "heartbeat", "roundId": physical_id}) for actor in tutors[2:] + students]
        outcomes = parallel(requests)
        assert sum(status == 200 for status, _ in outcomes[:2]) == 1 and all(status == 200 for status, _ in outcomes[2:]), "Only one concurrent tutor can claim the arriving student"
        claimed = snapshot(physical_id)
        assert sum(p["studentId"] == students[0] for p in claimed["progress"]) == 1, "Student must occupy exactly one station"
        losing_index = next(index for index, (status, _) in enumerate(outcomes[:2]) if status != 200)
        status, body = rpc("interview_command", payload(tutors[losing_index], {"type": "claimStudent", "roundId": physical_id,
            "expectedVersion": claimed["version"], "studentId": students[0]}))
        assert status != 200 and body.get("code") == "22023" and "already at another station" in body.get("message", ""), "Refreshed loser must still be rejected by exclusive student attribution"
        print("PASS: competing in-person claims under twelve-party traffic preserve exclusive student attribution")
    finally:
        quoted_commands = ",".join("'" + value + "'" for value in command_ids) or "NULL"
        quoted_grants = ",".join("'" + value + "'" for value in grant_ids) or "NULL"
        sql(f"""
          DROP TRIGGER IF EXISTS test_interview_question_owner_delay ON public.interview_questions;
          DROP FUNCTION IF EXISTS private.test_interview_question_owner_delay();
          DROP TRIGGER IF EXISTS test_interview_concurrency_delay ON public.interview_rounds;
          DROP FUNCTION IF EXISTS private.test_interview_concurrency_delay();
          DELETE FROM public.notifications WHERE metadata->>'roundId' IN ('{online_id}','{physical_id}');
          DELETE FROM public.interview_tutor_presence WHERE round_id IN ('{online_id}','{physical_id}');
          DELETE FROM public.interview_presence WHERE round_id IN ('{online_id}','{physical_id}');
          DELETE FROM public.interview_rounds WHERE id IN ('{online_id}','{physical_id}');
          DELETE FROM public.interview_command_receipts WHERE command_id IN ({quoted_commands});
          DELETE FROM public.interviews WHERE id='{interview_id}';
          DELETE FROM public.interview_rubric_revisions WHERE question_id IN ('{question_id}','{shared_question_id}');
          DELETE FROM public.interview_questions WHERE id IN ('{question_id}','{shared_question_id}');
          DELETE FROM public.interview_stations WHERE category_id='{category_id}';
          DELETE FROM public.interview_categories WHERE id='{category_id}';
          DELETE FROM public.classes_students WHERE class_id='{class_id}';
          DELETE FROM public.classes WHERE id='{class_id}';
          DELETE FROM public.staff_subjects WHERE id IN ({quoted_grants});
          UPDATE public.staff SET status='{original_sixth_status}' WHERE id='{tutors[5]}';
        """)


if __name__ == "__main__":
    main()
