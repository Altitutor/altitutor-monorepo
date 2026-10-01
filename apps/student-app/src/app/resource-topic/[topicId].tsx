import {
  buildTopicTree,
  flattenTopicsDfs,
  formatResourceFileLabel,
  formatResourceTypeLabel,
  groupFilesByType,
  pairFilesWithSolutions,
  type ResourceFile,
} from '@altitutor/shared';
import { Stack, useLocalSearchParams, useNavigation, useRoute, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, LoadingBlock, StudentScreen, TappableRow } from '@/components/student-ui';
import { useFlashcardTopic } from '@/features/flashcards/flashcard-hooks';
import { setRouteParams, useTopicNavigation } from '@/features/resources/resource-navigation';
import { TopicFileCard } from '@/features/resources/topic-file-card';
import { ResourceToolbar } from '@/features/resources/resource-toolbar';
import { useResourceFiles, useResourceTopics } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';

export default function ResourceTopicScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useTheme();
  const navigationRef = useTopicNavigation();
  const { topicId, subjectId, title } = useLocalSearchParams<{ topicId: string; subjectId: string; title?: string }>();
  const files = useResourceFiles(topicId);
  const flashcards = useFlashcardTopic(topicId);
  const topics = useResourceTopics(subjectId);
  const tree = useMemo(() => buildTopicTree(topics.data ?? []), [topics.data]);
  const topicOrder = useMemo(() => flattenTopicsDfs(tree), [tree]);
  const index = topicOrder.findIndex((topic) => topic.id === topicId);
  const previousTopic = index > 0 ? topicOrder[index - 1] : null;
  const nextTopic = index >= 0 ? topicOrder[index + 1] ?? null : null;
  const grouped = useMemo(
    () => Object.entries(groupFilesByType(files.data ?? [])).map(([type, entries]) => ({
      type,
      pairs: pairFilesWithSolutions(entries),
    })),
    [files.data],
  );

  function openTopic(topic: { id: string; name: string }) {
    setRouteParams(navigation, route.key, { topicId: topic.id, title: topic.name });
  }

  function openFile(file: ResourceFile) {
    router.push({
      pathname: '/resource-file/[fileId]',
      params: { fileId: file.id, topicId, title: file.filename },
    });
  }

  useEffect(() => {
    navigationRef.current = {
      subjectId,
      topicId,
      tree,
      jump: openTopic,
    };
  });

  useEffect(() => {
    return () => {
      navigationRef.current = null;
    };
  }, [navigationRef]);

  return (
    <>
      <Stack.Screen options={{ title: title ?? 'Topic', headerLargeTitleEnabled: false }} />
      <StudentScreen title={title ?? 'Resources'} largeTitle={false} contentPaddingBottom={120}>
        {files.isPending ? <LoadingBlock label="Loading files..." /> : null}
        {files.isError ? <ErrorBlock message={files.error.message} /> : null}
        {topics.isError ? <ErrorBlock message={topics.error.message} /> : null}
        {flashcards.data && (flashcards.data.review_card_count ?? 0) > 0 ? (
          <Card>
            <TappableRow
              title="Flashcards"
              detail={`${flashcards.data.due_review_card_count ?? 0} due · ${flashcards.data.review_card_count ?? 0} cards`}
              onPress={() => router.push({ pathname: '/flashcard-topic/[topicId]', params: { topicId } })}
            />
          </Card>
        ) : null}
        {files.data?.length === 0 && !flashcards.isPending && !flashcards.data ? <EmptyBlock>No resources available.</EmptyBlock> : null}
        {grouped.map((group) => (
          <View key={group.type} style={styles.fileGroup}>
            <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>{formatResourceTypeLabel(group.type)}</Text>
            {group.pairs.map(({ primary, solution }) => (
              <View key={primary.id} style={styles.pair}>
                <TopicFileCard title={formatResourceFileLabel(primary)} onPress={() => openFile(primary)} />
                {solution ? (
                  <TopicFileCard
                    title={formatResourceFileLabel(solution)}
                    eyebrow="Solution"
                    onPress={() => openFile(solution)}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </StudentScreen>
      <ResourceToolbar
        previous={() => previousTopic && openTopic(previousTopic)}
        next={() => nextTopic && openTopic(nextTopic)}
        previousDisabled={!previousTopic}
        nextDisabled={!nextTopic}
        onNavigator={() => router.push('/topic-navigator')}
        previousLabel="Previous topic"
        nextLabel="Next topic"
        navigatorLabel="Topic navigator"
      />
    </>
  );
}

const styles = StyleSheet.create({
  fileGroup: { gap: 12 },
  pair: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  groupTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6 },
});
