import { buildTopicTree, flattenTopicFilesForNav, flattenTopicsDfs, formatResourceTypeLabel, groupFilesByType, pairFilesWithSolutions, type ResourceFile } from '@altitutor/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NativeAction } from '@/components/native-action';
import { NativePager } from '@/components/native-pager';
import { Card, EmptyBlock, ErrorBlock, LoadingBlock, StudentScreen, TappableRow } from '@/components/student-ui';
import { useResourceFiles, useResourceTopics } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';

export default function FilesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { subjectId, topicId, title } = useLocalSearchParams<{ subjectId: string; topicId: string; title?: string }>();
  const files = useResourceFiles(topicId);
  const topics = useResourceTopics(subjectId);
  const topicOrder = useMemo(() => flattenTopicsDfs(buildTopicTree(topics.data ?? [])), [topics.data]);
  const index = topicOrder.findIndex((topic) => topic.id === topicId);
  const previousTopic = index > 0 ? topicOrder[index - 1] : null;
  const nextTopic = index >= 0 ? topicOrder[index + 1] : null;
  const orderedFiles = useMemo(() => flattenTopicFilesForNav(files.data ?? []), [files.data]);
  const grouped = useMemo(
    () => Object.entries(groupFilesByType(files.data ?? [])).map(([type, entries]) => ({
      type,
      pairs: pairFilesWithSolutions(entries),
    })),
    [files.data],
  );

  function openFile(file: ResourceFile, counterpart: ResourceFile | null) {
    router.push({
      pathname: '/(tabs)/resources/[subjectId]/viewer',
      params: {
        subjectId,
        topicId,
        title: title ?? 'Resource',
        file: JSON.stringify(file),
        files: JSON.stringify(orderedFiles),
        counterpart: counterpart ? JSON.stringify(counterpart) : '',
      },
    });
  }

  return (
    <StudentScreen title={title ?? 'Files'} subtitle="Tap a file to open it securely.">
      <NativePager
        actions={[
          {
            label: 'Previous topic',
            disabled: !previousTopic,
            onPress: () => previousTopic && router.replace({ pathname: '/(tabs)/resources/[subjectId]/[topicId]', params: { subjectId, topicId: previousTopic.id, title: previousTopic.name } }),
          },
          {
            label: 'Next topic',
            disabled: !nextTopic,
            onPress: () => nextTopic && router.replace({ pathname: '/(tabs)/resources/[subjectId]/[topicId]', params: { subjectId, topicId: nextTopic.id, title: nextTopic.name } }),
          },
        ]}
      />
      {files.isPending ? <LoadingBlock label="Loading files..." /> : null}
      {files.isError ? <ErrorBlock message={files.error.message} /> : null}
      {files.data?.length === 0 ? <EmptyBlock>No files available.</EmptyBlock> : null}
      {grouped.map((group) => (
        <View key={group.type} style={styles.fileGroup}>
          <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>{formatResourceTypeLabel(group.type)}</Text>
          {group.pairs.map(({ primary, solution }) => (
            <Card key={primary.id}>
              <TappableRow
                title={primary.filename ?? primary.code ?? 'Resource'}
                detail={primary.type ?? primary.mimetype ?? undefined}
                onPress={() => openFile(primary, solution)}
              />
              {solution ? (
                <NativeAction label="View solutions" onPress={() => openFile(solution, primary)} />
              ) : null}
            </Card>
          ))}
        </View>
      ))}
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  fileGroup: { gap: 12 },
  groupTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6 },
});
