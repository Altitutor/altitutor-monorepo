import { defaultCheckInSessionsStaffType } from '@altitutor/shared/pay-tiers';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDeferredValue, useState } from 'react';

import { Card, EmptyBlock, ErrorBlock, Label, LoadingBlock, SectionTitle, TappableRow, TutorScreen, Value } from '@/components/tutor-ui';

import { useAuth } from '@/providers/auth-provider';

import { addSessionStaff, addSessionStudent, findSessionPeople, getSession, submitTutorLog, type SessionDetail } from './api';
import { LessonPicker, type LessonSelection } from './lesson-picker';
import { ChoicePills, ControlRow, OperationButton, OperationInput } from './operation-controls';
import { operationsKey, sessionKey, useSession } from './queries';
import { mayLogSession, sessionDate, sessionTitle, type SessionPerson } from './session-model';
import { buildLogSubmission, logAttendanceBlockers, logLessonBlocker, logStaffType, staffRoleOptions, type LogDraft, type LogRoster } from './tutor-log-form';

const participantMutationKey = (sessionId: string) => [...operationsKey, 'add-participant', sessionId] as const;

const attendanceOptions = [{ value: 'yes', label: 'Attended' }, { value: 'no', label: 'Did not attend' }] as const;

function AttendanceChoices({ name, value, onChange }: { name: string; value?: boolean; onChange: (attended: boolean) => void }) {
  return (
    <ChoicePills label={`${name} attendance`} options={attendanceOptions}
      selected={value === undefined ? [] : [value ? 'yes' : 'no']} onSelect={(choice) => onChange(choice === 'yes')} />
  );
}

function ParticipantAdder({ kind, sessionId, existingIds, defaultStaffType }: {
  kind: 'staff' | 'student';
  sessionId: string;
  existingIds: string[];
  defaultStaffType?: string;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const term = useDeferredValue(query.trim());
  const search = useQuery({
    queryKey: [...operationsKey, 'candidate', kind, term],
    queryFn: () => findSessionPeople(kind, term),
    enabled: open && term.length >= 2,
  });
  const add = useMutation({
    mutationKey: participantMutationKey(sessionId),
    mutationFn: (id: string) => kind === 'staff'
      ? addSessionStaff(sessionId, id, defaultStaffType ?? 'MAIN_TUTOR') : addSessionStudent(sessionId, id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: sessionKey(sessionId) });
      setQuery('');
      setOpen(false);
    },
  });
  const options = search.data?.filter((person) => !existingIds.includes(person.id)) ?? [];
  const title = kind === 'staff' ? 'Add staff' : 'Add student';
  if (!open) return <ControlRow><OperationButton label={title} onPress={() => { add.reset(); setOpen(true); }} /></ControlRow>;
  return (
    <Card>
      <OperationInput accessibilityLabel={`Search ${kind}`} placeholder={`Search ${kind} by name`}
        autoCapitalize="words" value={query} onChangeText={setQuery} editable={!add.isPending} />
      {search.isFetching ? <LoadingBlock label="Searching…" /> : null}
      {search.isError ? <ErrorBlock message={search.error.message} /> : null}
      {term.length >= 2 && search.isSuccess && !options.length ? <Label>No matching people available to add.</Label> : null}
      {options.map(({ id, name }) => <TappableRow key={id} title={name} detail="Add to session"
        onPress={add.isPending ? undefined : () => add.mutate(id)} />)}
      {add.isError ? <ErrorBlock message={add.error.message} /> : null}
      <ControlRow><OperationButton label={add.isPending ? 'Adding…' : 'Close search'}
        disabled={add.isPending} onPress={() => setOpen(false)} /></ControlRow>
    </Card>
  );
}

function MemberAttendance({ title, people, choices, onChange, empty }: {
  title: string;
  people: SessionPerson[];
  choices: Record<string, boolean>;
  onChange: (id: string, attended: boolean) => void;
  empty: string;
}) {
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      {!people.length ? <EmptyBlock>{empty}</EmptyBlock> : null}
      {people.map((person) => (
        <Card key={person.id}>
          <Value>{person.name}</Value>
          {person.plannedAbsence ? <Label>Planned absence</Label> : null}
          <AttendanceChoices name={person.name} value={choices[person.id]} onChange={(value) => onChange(person.id, value)} />
        </Card>
      ))}
    </>
  );
}

function toggleStudent(current: string[], id: string) {
  return current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
}

const steps = ['Attendance', 'Lesson activity', 'Review'] as const;
type Step = 0 | 1 | 2;

function TutorLogEditor({ sessionId, data, tutorId, onSaved }: {
  sessionId: string;
  data: NonNullable<SessionDetail>;
  tutorId: string;
  onSaved: () => void;
}) {
  const client = useQueryClient();
  const [step, setStep] = useState<Step>(0);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [draft, setDraft] = useState<LogDraft>({ staff: {}, students: {}, parents: {}, topics: {}, files: {}, notes: '' });
  const [selection, setSelection] = useState<LessonSelection>({ topics: [], files: [] });
  const addingParticipant = useIsMutating({ mutationKey: participantMutationKey(sessionId) }) > 0;
  const mutation = useMutation({
    mutationFn: async (input: LogDraft) => {
      const latest = await getSession(sessionId);
      const role = latest?.staff.find((person) => person.id === tutorId)?.type;
      if (!latest || !mayLogSession(latest.session, role, latest.logState)) {
        throw new Error('This session is no longer available to log. Open the session to check its latest status.');
      }
      const latestRoster = {
        ...latest,
        staff: latest.staff.map((person) => ({ ...person, type: logStaffType(person, latest.session.session_type, tutorId) })),
      };
      const result = buildLogSubmission(sessionId, latest.session.session_type, latestRoster, input);
      if ('blockers' in result) {
        client.setQueryData(sessionKey(sessionId), latest);
        setStep(0);
        setBlockers(result.blockers);
        return null;
      }
      return submitTutorLog(result.payload);
    },
    onSuccess: (result) => {
      if (!result) return;
      void client.invalidateQueries({ queryKey: operationsKey });
      onSaved();
    },
  });

  const sessionType = data.session.session_type;
  const staff = data.staff.map((person) => ({ ...person, type: logStaffType(person, sessionType, tutorId) }));
  const roster = { staff, students: data.students, parents: data.parents };
  const options = data.students.filter(({ id }) => draft.students[id] === true).map(({ id, name }) => ({ value: id, label: name }));

  function changeStaff(staffId: string, currentType: string, next: { attended?: boolean; type?: string }) {
    setBlockers([]);
    setDraft((current) => ({
      ...current,
      staff: { ...current.staff, [staffId]: { ...(current.staff[staffId] ?? { type: currentType }), ...next } },
    }));
  }

  function changeSelection(value: LessonSelection) {
    setSelection(value);
    setBlockers([]);
    setDraft((current) => ({
      ...current,
      topics: Object.fromEntries(value.topics.map(({ id }) => [id, current.topics[id] ?? []])),
      files: Object.fromEntries(value.files.map(({ id, topicId }) => [id, current.files[id] ?? { topicId, studentIds: [] }])),
    }));
  }

  function advance() {
    if (step === 0) {
      const attendanceBlockers = logAttendanceBlockers(roster, draft);
      if (attendanceBlockers.length) {
        setBlockers(attendanceBlockers);
        return;
      }
      setStep(1);
      return;
    }
    const lessonBlocker = logLessonBlocker(sessionType, selection.topics.map(({ id }) => id));
    if (lessonBlocker) {
      setBlockers([lessonBlocker]);
      return;
    }
    setStep(2);
  }

  function submit() {
    const result = buildLogSubmission(sessionId, sessionType, roster, draft);
    if ('blockers' in result) {
      setBlockers(result.blockers);
      return;
    }
    mutation.mutate(draft);
  }

  return (
    <>
      <Label>Step {step + 1} of {steps.length}</Label>
      <SectionTitle>{steps[step]}</SectionTitle>
      {step === 0 ? (
        <>
          <Label>Confirm attendance for each person in the session.</Label>
          <SectionTitle>Staff</SectionTitle>
          {staff.map((person) => (
            <Card key={person.id}>
              <Value>{person.name}</Value>
              {person.plannedAbsence ? <Label>Planned absence</Label> : null}
              <AttendanceChoices name={person.name} value={draft.staff[person.id]?.attended}
                onChange={(attended) => changeStaff(person.id, person.type, { attended })} />
              <ChoicePills label={`${person.name} role`} options={staffRoleOptions(sessionType)}
                selected={[draft.staff[person.id]?.type ?? person.type]}
                onSelect={(type) => changeStaff(person.id, person.type, { type })} />
            </Card>
          ))}
          <ParticipantAdder kind="staff" sessionId={sessionId} existingIds={staff.map(({ id }) => id)}
            defaultStaffType={sessionType === 'CHECK_IN'
              ? defaultCheckInSessionsStaffType(Boolean(data.students.length || data.parents.length)) : 'MAIN_TUTOR'} />
          <MemberAttendance title="Students" people={data.students} choices={draft.students} empty="No students planned."
            onChange={(id, attended) => {
              setBlockers([]);
              setDraft((current) => ({ ...current, students: { ...current.students, [id]: attended } }));
            }} />
          <ParticipantAdder kind="student" sessionId={sessionId} existingIds={data.students.map(({ id }) => id)} />
          {data.parents.length ? (
            <MemberAttendance title="Parents" people={data.parents} choices={draft.parents} empty="No parents planned."
              onChange={(id, attended) => {
                setBlockers([]);
                setDraft((current) => ({ ...current, parents: { ...current.parents, [id]: attended } }));
              }} />
          ) : null}
        </>
      ) : null}
      {step === 1 ? (
        <>
          <LessonPicker subjectId={data.session.subject_id} selection={selection} onChange={changeSelection} />
          {options.length && selection.topics.length ? (
            <>
              <SectionTitle>Assign to students</SectionTitle>
              <Label>Choose which attending students covered each topic or received each resource.</Label>
              {selection.topics.map(({ id, label }) => (
                <Card key={id}>
                  <Value>{label}</Value>
                  <ChoicePills label={`Students for ${label}`} options={options} selected={draft.topics[id] ?? []}
                    onSelect={(studentId) => setDraft((current) => ({
                      ...current,
                      topics: { ...current.topics, [id]: toggleStudent(current.topics[id] ?? [], studentId) },
                    }))} />
                </Card>
              ))}
              {selection.files.map(({ id, label, topicId }) => (
                <Card key={id}>
                  <Value>{label}</Value>
                  <ChoicePills label={`Students for ${label}`} options={options} selected={draft.files[id]?.studentIds ?? []}
                    onSelect={(studentId) => setDraft((current) => ({
                      ...current,
                      files: {
                        ...current.files, [id]: { topicId, studentIds: toggleStudent(current.files[id]?.studentIds ?? [], studentId) },
                      },
                    }))} />
                </Card>
              ))}
            </>
          ) : null}
        </>
      ) : null}
      {step === 2 ? (
        <>
          <ReviewSummary roster={roster} draft={draft} selection={selection} />
          <SectionTitle>Notes</SectionTitle>
          <OperationInput accessibilityLabel="Tutor log notes" placeholder="Add notes about the session" multiline
            value={draft.notes} editable={!mutation.isPending}
            onChangeText={(notes) => setDraft((current) => ({ ...current, notes }))} />
        </>
      ) : null}
      {blockers.length ? <ErrorBlock message={blockers.join('\n')} /> : null}
      {mutation.isError ? <ErrorBlock message={mutation.error.message} /> : null}
      <ControlRow>
        {step > 0 ? (
          <OperationButton label="Back" disabled={mutation.isPending} onPress={() => {
            setBlockers([]);
            setStep(step === 2 ? 1 : 0);
          }} />
        ) : null}
        {step < 2 ? <OperationButton label="Continue" onPress={advance} disabled={addingParticipant} prominent /> : (
          <OperationButton label={mutation.isPending ? 'Submitting…' : 'Submit tutor log'} onPress={submit}
            disabled={mutation.isPending} prominent />
        )}
      </ControlRow>
    </>
  );
}

function ReviewSummary({ roster, draft, selection }: { roster: LogRoster; draft: LogDraft; selection: LessonSelection }) {
  const participants = [
    ...roster.staff.map(({ id, name }) => ({ key: `staff-${id}`, name, attended: draft.staff[id]?.attended })),
    ...roster.students.map(({ id, name }) => ({ key: `student-${id}`, name, attended: draft.students[id] })),
    ...roster.parents.map(({ id, name }) => ({ key: `parent-${id}`, name, attended: draft.parents[id] })),
  ];
  const studentNames = new Map(roster.students.filter(({ id }) => draft.students[id]).map(({ id, name }) => [id, name]));
  function assignedNames(ids: string[]) {
    return ids.flatMap((id) => studentNames.get(id) ?? []).join(', ') || 'No student assignments';
  }
  return (
    <>
      <Card divided>
        {participants.map(({ key, name, attended }) => (
          <TappableRow key={key} title={name} detail={attended ? 'Attended' : 'Did not attend'} />
        ))}
      </Card>
      {selection.topics.length || selection.files.length ? (
        <Card divided>
          {selection.topics.map(({ id, label }) => <TappableRow key={id} title={label} detail={assignedNames(draft.topics[id] ?? [])} />)}
          {selection.files.map(({ id, label }) => <TappableRow key={id} title={label} detail={assignedNames(draft.files[id]?.studentIds ?? [])} />)}
        </Card>
      ) : null}
    </>
  );
}

export function LogSessionScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { profile } = useAuth();
  const query = useSession(sessionId);
  const data = query.data;
  const tutorId = profile?.id;
  const role = data?.staff.find((person) => person.id === tutorId)?.type;
  const eligible = Boolean(data && tutorId && profile?.status === 'ACTIVE' && mayLogSession(data.session, role, data.logState));
  const [saved, setSaved] = useState(false);

  return (
    <TutorScreen title="Tutor log" largeTitle={false}
      subtitle={data ? [sessionTitle(data.session), data.session.start_at ? sessionDate(data.session.start_at) : null].filter(Boolean).join(' · ') : undefined}>
      {query.isPending ? <LoadingBlock label="Loading session roster…" /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}
      {saved ? (
        <Card>
          <Value>Tutor log submitted</Value>
          <OperationButton label="Done" prominent onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace({ pathname: '/session/[sessionId]', params: { sessionId } });
          }} />
        </Card>
      ) : null}
      {!saved && data && tutorId && eligible ? (
        <TutorLogEditor key={sessionId} data={data} sessionId={sessionId} tutorId={tutorId} onSaved={() => setSaved(true)} />
      ) : null}
      {!saved && query.isSuccess && !eligible ? (
        <EmptyBlock>{data?.logState?.deleted_at ? 'An administrator can restore the deleted log for this session.'
          : data?.logState ? 'This session already has a tutor log.' : 'This session is not available to log.'}</EmptyBlock>
      ) : null}
    </TutorScreen>
  );
}
