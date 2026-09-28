import { buildTopicTree } from '@altitutor/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';

import { EmptyBlock, ErrorBlock, LoadingBlock, StudentScreen } from '@/components/student-ui';
import { TopicTree } from '@/features/resources/topic-tree';
import { useResourceSubjectFiles, useResourceTopics } from '@/hooks/use-student-data';

export default function TopicsScreen() {
  const router = useRouter();
  const { subjectId, title } = useLocalSearchParams<{ subjectId: string; title?: string }>();
  const topics = useResourceTopics(subjectId);
  const tree = useMemo(() => buildTopicTree(topics.data ?? []), [topics.data]);
  const files = useResourceSubjectFiles(subjectId, (topics.data ?? []).flatMap((topic) => topic.id ? [topic.id] : []));
  const fileCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files.data ?? []) counts.set(file.topicId, (counts.get(file.topicId) ?? 0) + 1);
    return counts;
  }, [files.data]);

  return (
    <StudentScreen title={title ?? 'Topics'} showHeaderActions>
      {topics.isPending ? <LoadingBlock label="Loading topics..." /> : null}
      {topics.isError ? <ErrorBlock message={topics.error.message} /> : null}
      {topics.data?.length === 0 ? <EmptyBlock>No topics published yet.</EmptyBlock> : null}
      <TopicTree
        tree={tree}
        fileCounts={fileCounts}
        onOpen={(topic) => router.push({
          pathname: '/resource-topic/[topicId]',
          params: { topicId: topic.id, subjectId, title: topic.name },
        })}
      />
    </StudentScreen>
  );
}
