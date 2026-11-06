import { useQueries, useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { View } from 'react-native';

import { Card, ErrorBlock, Label, LoadingBlock, SectionTitle } from '@/components/tutor-ui';

import { findLessonTopics, listLessonFiles, type LessonFile, type LessonTopic } from './api';
import { ChoicePills, OperationInput } from './operation-controls';
import { operationsKey } from './queries';

export type SelectedTopic = { id: string; label: string };
export type SelectedFile = { id: string; topicId: string; label: string };
export type LessonSelection = { topics: SelectedTopic[]; files: SelectedFile[] };

export function topicLabel(topic: LessonTopic) {
  return [topic.code, topic.name].filter(Boolean).join(' ') || 'Topic';
}

export function fileLabel(file: LessonFile) {
  return [file.code, file.filename].filter(Boolean).join(' ') || 'Resource';
}

export function LessonPicker({
  subjectId,
  selection,
  onChange,
  forPlan = false,
  disabled = false,
}: {
  subjectId: string | null;
  selection: LessonSelection;
  onChange: (value: LessonSelection) => void;
  forPlan?: boolean;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const term = useDeferredValue(search.trim());
  const topics = useQuery({
    queryKey: [...operationsKey, 'topics', subjectId, term],
    queryFn: () => findLessonTopics(subjectId, term),
  });
  const files = useQueries({
    queries: selection.topics.map((topic) => ({
      queryKey: [...operationsKey, 'files', topic.id, forPlan],
      queryFn: () => listLessonFiles(topic.id, forPlan),
    })),
  });
  const topicOptions = [...new Map([
    ...selection.topics,
    ...(topics.data ?? []).flatMap((topic) => topic.id ? [{ id: topic.id, label: topicLabel(topic) }] : []),
  ].map((item) => [item.id, item])).values()];

  function toggleTopic(id: string) {
    if (selection.topics.some((topic) => topic.id === id)) {
      onChange({
        topics: selection.topics.filter((topic) => topic.id !== id),
        files: selection.files.filter((file) => file.topicId !== id),
      });
      return;
    }
    const topic = topicOptions.find((option) => option.id === id);
    if (topic) onChange({ ...selection, topics: [...selection.topics, topic] });
  }

  function toggleFile(file: SelectedFile) {
    const files = selection.files.some((selected) => selected.id === file.id)
      ? selection.files.filter((selected) => selected.id !== file.id)
      : [...selection.files, file];
    onChange({ ...selection, files });
  }

  return (
    <>
      <SectionTitle>Topics</SectionTitle>
      <OperationInput accessibilityLabel="Search topics" editable={!disabled} placeholder="Search all subjects" value={search} onChangeText={setSearch} />
      {topics.isPending ? <LoadingBlock label="Loading topics…" /> : null}
      {topics.isError ? <ErrorBlock message={topics.error.message} /> : null}
      {topics.isSuccess && !topicOptions.length ? <Label>{term ? 'No topics match this search.' : 'Search to find a topic.'}</Label> : null}
      {topicOptions.length ? (
        <ChoicePills disabled={disabled} label="Topic" options={topicOptions.map(({ id, label }) => ({ value: id, label }))}
          selected={selection.topics.map(({ id }) => id)} onSelect={toggleTopic} />
      ) : null}
      {selection.topics.length ? <SectionTitle>Resources</SectionTitle> : null}
      {selection.topics.map((topic, index) => {
        const result = files[index];
        const fileOptions = [...new Map([
          ...selection.files.filter((file) => file.topicId === topic.id),
          ...(result?.data ?? []).flatMap((file) => file.id ? [{ id: file.id, topicId: topic.id, label: fileLabel(file) }] : []),
        ].map((item) => [item.id, item])).values()];
        return (
          <Card key={topic.id}>
            <Label>{topic.label}</Label>
            {result?.isPending ? <LoadingBlock label="Loading resources…" /> : null}
            {result?.isError ? <ErrorBlock message={result.error.message} /> : null}
            {result?.isSuccess && !fileOptions.length ? <Label>No resources in this topic.</Label> : null}
            {fileOptions.length ? (
              <View>
                <ChoicePills disabled={disabled} label={`Resource in ${topic.label}`} options={fileOptions.map(({ id, label }) => ({ value: id, label }))}
                  selected={selection.files.map(({ id }) => id)} onSelect={(id) => {
                    const file = fileOptions.find((option) => option.id === id);
                    if (file) toggleFile(file);
                  }} />
              </View>
            ) : null}
          </Card>
        );
      })}
    </>
  );
}
