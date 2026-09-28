import { flattenTopicsDfs } from '@altitutor/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { EmptyBlock, StudentScreen } from '@/components/student-ui';
import { useTopicNavigation, type TopicNavigation } from '@/features/resources/resource-navigation';
import { TopicTree } from '@/features/resources/topic-tree';
import { useResourceSubjectFiles } from '@/hooks/use-student-data';

export default function TopicNavigatorScreen() {
  const navigationRef = useTopicNavigation();
  const router = useRouter();
  const [nav, setNav] = useState<TopicNavigation | null>(null);

  useEffect(() => {
    setNav(navigationRef.current);
  }, [navigationRef]);

  const topicIds = useMemo(() => (nav ? flattenTopicsDfs(nav.tree).map((topic) => topic.id) : []), [nav]);
  const files = useResourceSubjectFiles(nav?.subjectId ?? '', topicIds);
  const fileCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files.data ?? []) counts.set(file.topicId, (counts.get(file.topicId) ?? 0) + 1);
    return counts;
  }, [files.data]);

  return (
    <StudentScreen title="Topics" subtitle="Jump to another topic in this subject." largeTitle={false}>
      {nav ? (
        <TopicTree
          tree={nav.tree}
          currentId={nav.topicId}
          fileCounts={fileCounts}
          onOpen={(topic) => {
            nav.jump(topic);
            router.back();
          }}
        />
      ) : (
        <EmptyBlock>Open a topic to browse this subject.</EmptyBlock>
      )}
    </StudentScreen>
  );
}
