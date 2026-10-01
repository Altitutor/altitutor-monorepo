import type { ResourceTopicNode } from '@altitutor/shared';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function TopicTree({
  tree,
  currentId,
  fileCounts,
  onOpen,
}: {
  tree: ResourceTopicNode[];
  currentId?: string;
  fileCounts?: Map<string, number>;
  onOpen: (topic: ResourceTopicNode) => void;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const next = new Set(tree.map((topic) => topic.id));
    if (currentId) {
      const walk = (nodes: ResourceTopicNode[], parents: string[]): boolean => {
        for (const node of nodes) {
          if (node.id === currentId) {
            parents.forEach((id) => next.add(id));
            return true;
          }
          if (walk(node.children, [...parents, node.id])) return true;
        }
        return false;
      };
      walk(tree, []);
    }
    setExpanded(next);
  }, [currentId, tree]);

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
    const fileCount = fileCounts?.get(topic.id) ?? 0;
    const current = topic.id === currentId;
    return (
      <View key={topic.id}>
        <View style={[styles.topicRow, { paddingLeft: 10 + depth * 22, borderBottomColor: theme.border, backgroundColor: current ? theme.backgroundSelected : 'transparent' }]}>
          {topic.children.length ? (
            <Pressable accessibilityLabel={open ? 'Collapse topic' : 'Expand topic'} onPress={() => toggle(topic.id)} style={styles.disclosure}>
              <Text style={[styles.disclosureText, { color: theme.textSecondary }]}>{open ? '⌄' : '›'}</Text>
            </Pressable>
          ) : <View style={styles.disclosure} />}
          <Pressable onPress={() => onOpen(topic)} style={styles.topicContent}>
            <View style={styles.grow}>
              <Text style={[styles.topicTitle, { color: theme.text }]}>{topic.name}</Text>
              <Text style={[styles.topicDetail, { color: theme.textSecondary }]}>{current ? 'Current' : topic.code}</Text>
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

  if (!tree.length) return null;

  return (
    <View style={[styles.tree, { backgroundColor: theme.backgroundElement, shadowColor: theme.shadow }]}>
      {tree.map((topic) => renderTopic(topic, 0))}
    </View>
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
