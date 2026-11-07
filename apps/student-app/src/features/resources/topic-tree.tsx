import type { ResourceTopicNode } from '@altitutor/shared';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useReducedMotion, withSpring } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

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
    return (
      <View key={topic.id}>
        <TopicRow
          topic={topic}
          depth={depth}
          open={open}
          current={topic.id === currentId}
          fileCount={fileCounts?.get(topic.id) ?? 0}
          onToggle={() => toggle(topic.id)}
          onOpen={() => onOpen(topic)}
        />
        {open && topic.children.length ? (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} layout={LinearTransition.springify().damping(20)}>
            {topic.children.map((child) => renderTopic(child, depth + 1))}
          </Animated.View>
        ) : null}
      </View>
    );
  }

  if (!tree.length) return null;

  return (
    <View style={[styles.tree, { backgroundColor: theme.backgroundElement }]}>
      {tree.map((topic) => renderTopic(topic, 0))}
    </View>
  );
}

function TopicRow({
  topic,
  depth,
  open,
  current,
  fileCount,
  onToggle,
  onOpen,
}: {
  topic: ResourceTopicNode;
  depth: number;
  open: boolean;
  current: boolean;
  fileCount: number;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: reducedMotion ? (open ? '90deg' : '0deg') : withSpring(open ? '90deg' : '0deg', { damping: 18, stiffness: 220 }) }],
  }), [open, reducedMotion]);

  return (
    <View style={[styles.topicRow, { paddingLeft: 8 + depth * 18, borderBottomColor: theme.border, backgroundColor: current ? theme.backgroundSelected : 'transparent' }]}>
      {topic.children.length ? (
        <Pressable accessibilityLabel={open ? 'Collapse topic' : 'Expand topic'} onPressIn={() => haptic()} onPress={onToggle} style={styles.disclosure}>
          <Animated.View style={chevron}>
            <Image source="sf:chevron.right" tintColor={theme.textSecondary} style={{ width: 12, height: 16 }} />
          </Animated.View>
        </Pressable>
      ) : <View style={styles.disclosure} />}
      <Pressable accessibilityRole="button" onPressIn={() => haptic()} onPress={onOpen} style={styles.topicContent}>
        <Text style={[styles.topicTitle, { color: theme.text }]}>{`${topic.code} ${topic.name}`}</Text>
        {fileCount ? (
          <Text style={[styles.countText, { color: theme.textSecondary, fontVariant: ['tabular-nums'] }]}>{fileCount}</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tree: { borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' },
  topicRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 52, paddingRight: 14 },
  disclosure: { alignItems: 'center', justifyContent: 'center', width: 32, height: 44 },
  topicContent: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, paddingVertical: 10 },
  topicTitle: { flex: 1, fontSize: 16, fontWeight: '500' },
  countText: { fontSize: 15 },
});
