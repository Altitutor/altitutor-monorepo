import { buildTopicTree, getResourceSubjectNavLabel, type ResourceTopicNode } from '@altitutor/shared';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, LoadingBlock, TutorScreen } from '@/components/tutor-ui';
import { getResourceSubject, getResourceTopics } from '@/features/resources/resources-api';
import { useTheme } from '@/hooks/use-theme';

export default function ResourceSubjectScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const subject = useQuery({
    queryKey: ['tutor-resource-subject', subjectId],
    queryFn: () => getResourceSubject(subjectId),
  });
  const topics = useQuery({
    queryKey: ['tutor-resource-topics', subjectId],
    queryFn: () => getResourceTopics(subjectId),
  });
  const tree = useMemo(() => buildTopicTree(topics.data ?? []), [topics.data]);
  const title = subject.data ? getResourceSubjectNavLabel(subject.data) : 'Topics';

  return (
    <>
      <Stack.Screen options={{ title, headerLargeTitleEnabled: false }} />
      <TutorScreen title={title} largeTitle={false}>
        {topics.isPending || subject.isPending ? <LoadingBlock label="Loading topics…" /> : null}
        {subject.isError || topics.isError ? <ErrorBlock message={(subject.error ?? topics.error)?.message ?? 'Could not load topics.'} /> : null}
        {subject.data === null ? <EmptyBlock>This subject is unavailable.</EmptyBlock> : null}
        {subject.data && topics.isSuccess && !tree.length ? <EmptyBlock>No topics have been published for this subject.</EmptyBlock> : null}
        {tree.length ? (
          <Card>{tree.map((topic) => <TopicRow key={topic.id} topic={topic} depth={0} />)}</Card>
        ) : null}
      </TutorScreen>
    </>
  );
}

function TopicRow({ topic, depth }: { topic: ResourceTopicNode; depth: number }) {
  const router = useRouter();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(depth === 0);
  const title = topic.name === topic.code ? topic.code : `${topic.code} ${topic.name}`;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingStart: Math.min(depth, 8) * 14 }}>
        {topic.children.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((current) => !current)}
            style={({ pressed }) => ({
              width: 44,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
            })}
          >
            <Text style={{ color: theme.textSecondary, fontSize: 20 }}>{expanded ? '⌄' : '›'}</Text>
          </Pressable>
        ) : <View style={{ width: 16 }} />}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/resource-topic/[topicId]', params: { topicId: topic.id } })}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 44,
            justifyContent: 'center',
            paddingVertical: 8,
            backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
          })}
        >
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: depth === 0 ? '600' : '400' }}>{title}</Text>
        </Pressable>
      </View>
      {expanded ? topic.children.map((child) => <TopicRow key={child.id} topic={child} depth={depth + 1} />) : null}
    </View>
  );
}
