import { buildTopicTree, type ResourceTopicNode } from '@altitutor/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyBlock, ErrorBlock, LoadingBlock, StudentScreen } from '@/components/student-ui';
import { useResourceSubjectFiles, useResourceTopics } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';

export default function TopicsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { subjectId, title } = useLocalSearchParams<{ subjectId: string; title?: string }>();
  const topics = useResourceTopics(subjectId);
  const tree = useMemo(() => buildTopicTree(topics.data ?? []), [topics.data]);
  const files = useResourceSubjectFiles(subjectId, (topics.data ?? []).flatMap((topic) => topic.id ? [topic.id] : []));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpanded(new Set(tree.map((topic) => topic.id)));
  }, [tree]);

  function toggle(id: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderTopic(topic: ResourceTopicNode, depth: number) {
    const open = expanded.has(topic.id);
    const fileCount = (files.data ?? []).filter((file) => file.topicId === topic.id).length;
    return (
      <View key={topic.id}>
        <View style={[styles.topicRow, { paddingLeft: 10 + depth * 22, borderBottomColor: theme.border }]}>
          {topic.children.length ? (
            <Pressable accessibilityLabel={open ? 'Collapse topic' : 'Expand topic'} onPress={() => toggle(topic.id)} style={styles.disclosure}>
              <Text style={[styles.disclosureText, { color: theme.textSecondary }]}>{open ? '⌄' : '›'}</Text>
            </Pressable>
          ) : <View style={styles.disclosure} />}
          <Pressable
            onPress={() => router.push({ pathname: '/(tabs)/resources/[subjectId]/[topicId]', params: { subjectId, topicId: topic.id, title: topic.name } })}
            style={styles.topicContent}>
            <View style={styles.grow}>
              <Text style={[styles.topicTitle, { color: theme.text }]}>{topic.name}</Text>
              <Text style={[styles.topicDetail, { color: theme.textSecondary }]}>{topic.code}</Text>
            </View>
            {fileCount ? (
              <View style={[styles.countBadge, { backgroundColor: theme.backgroundSelected }]}>
                <Text style={[styles.countText, { color: theme.primary }]}>{fileCount}</Text>
              </View>
            ) : null}
            <Text style={[styles.openIndicator, { color: theme.textSecondary }]}>›</Text>
          </Pressable>
        </View>
        {open && topic.children.length ? topic.children.map((child) => renderTopic(child, depth + 1)) : null}
      </View>
    );
  }

  return (
    <StudentScreen title={title ?? 'Topics'} subtitle="Select a topic to view resources.">
      {topics.isPending ? <LoadingBlock label="Loading topics..." /> : null}
      {topics.isError ? <ErrorBlock message={topics.error.message} /> : null}
      {topics.data?.length === 0 ? <EmptyBlock>No topics published yet.</EmptyBlock> : null}
      {tree.length ? (
        <View style={[styles.tree, { backgroundColor: theme.backgroundElement, shadowColor: theme.shadow }]}>
          {tree.map((topic) => renderTopic(topic, 0))}
        </View>
      ) : null}
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  tree: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  topicRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 58, paddingRight: 10 },
  disclosure: { alignItems: 'center', justifyContent: 'center', width: 30, height: 46 },
  disclosureText: { fontSize: 22, lineHeight: 24 },
  topicContent: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, paddingVertical: 9 },
  grow: { flex: 1 },
  topicTitle: { fontSize: 15, fontWeight: '600' },
  topicDetail: { fontSize: 12, marginTop: 2 },
  countBadge: { borderRadius: 999, minWidth: 26, paddingHorizontal: 8, paddingVertical: 4 },
  countText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  openIndicator: { fontSize: 20 },
});
