import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Card, EmptyBlock, ErrorBlock, Label, LoadingBlock, SectionTitle, TappableRow } from '@/components/tutor-ui';

import { getLessonPlan, saveLessonPlan } from './api';
import { LessonPicker, topicLabel, type LessonSelection } from './lesson-picker';
import { ControlRow, OperationButton } from './operation-controls';
import { planKey } from './queries';

type PlanDraft = { revision: number; selection: LessonSelection };

export function SessionLessonPlan({ sessionId, subjectId, editable }: {
  sessionId: string;
  subjectId: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const query = useQuery({ queryKey: planKey(sessionId), queryFn: () => getLessonPlan(sessionId) });
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const mutation = useMutation({
    mutationFn: ({ revision, selection }: PlanDraft) =>
      saveLessonPlan(sessionId, revision, selection.topics.map(({ id }) => id), selection.files.map(({ id }) => id)),
    onSuccess: (plan) => {
      client.setQueryData(planKey(sessionId), plan);
      setDraft(null);
    },
  });
  const plan = query.data;

  function openResource(fileId: string) {
    router.push({ pathname: '/resource-file/[fileId]', params: { fileId } });
  }

  function beginEditing() {
    if (!plan) return;
    mutation.reset();
    const topics = plan.topics.map((topic) => ({ id: topic.id, label: topicLabel({ ...topic, subject_id: subjectId }) }));
    for (const file of plan.resources) {
      if (!topics.some((topic) => topic.id === file.topicID)) topics.push({ id: file.topicID, label: file.topicName });
    }
    setDraft({
      revision: plan.revision,
      selection: {
        topics,
        files: plan.resources.map((file) => ({ id: file.id, label: file.worksheet.title, topicId: file.topicID })),
      },
    });
  }

  return (
    <>
      <SectionTitle>Lesson plan</SectionTitle>
      {query.isPending ? <LoadingBlock label="Loading lesson plan…" /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}
      {plan && !draft ? (
        <>
          {plan.topics.length || plan.resources.length ? (
            <Card divided>
              {plan.topics.map((topic) => <TappableRow key={topic.id} title={topicLabel({ ...topic, subject_id: subjectId })} />)}
              {plan.resources.flatMap((file) => [
                <TappableRow key={file.id} title={file.worksheet.title} detail={file.topicName} onPress={() => openResource(file.id)} />,
                ...(file.solutions ? [<TappableRow key={file.solutions.id} title={file.solutions.title}
                  detail="Solutions" onPress={() => openResource(file.solutions!.id)} />] : []),
              ])}
            </Card>
          ) : <EmptyBlock>No lesson plan yet.</EmptyBlock>}
          {editable ? <ControlRow><OperationButton label="Edit lesson plan" onPress={beginEditing} /></ControlRow> : null}
        </>
      ) : null}
      {draft && editable ? (
        <>
          <Label>Plan the topics and resources you intend to use in this session.</Label>
          <LessonPicker subjectId={subjectId} selection={draft.selection} forPlan disabled={mutation.isPending}
            onChange={(selection) => setDraft((current) => current ? { ...current, selection } : current)} />
          {mutation.isError ? <ErrorBlock message={mutation.error.message} /> : null}
          <ControlRow>
            <OperationButton label="Cancel" disabled={mutation.isPending} onPress={() => {
              setDraft(null);
              void query.refetch();
            }} />
            <OperationButton label={mutation.isPending ? 'Saving…' : 'Save lesson plan'} prominent
              disabled={mutation.isPending} onPress={() => mutation.mutate(draft)} />
          </ControlRow>
        </>
      ) : null}
    </>
  );
}
