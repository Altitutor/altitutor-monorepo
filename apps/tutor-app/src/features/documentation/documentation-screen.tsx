import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, LoadingBlock, TutorScreen } from '@/components/tutor-ui';
import { getDocumentationTree } from '@/features/documentation/documentation-api';
import type { DocumentationNode } from '@/features/documentation/documentation-tree';
import { useTheme } from '@/hooks/use-theme';

export default function DocumentationScreen() {
  const tree = useQuery({ queryKey: ['tutor-documentation'], queryFn: getDocumentationTree });

  return (
    <TutorScreen title="Documentation">
      {tree.isPending ? <LoadingBlock label="Loading documentation…" /> : null}
      {tree.isError ? <ErrorBlock message={tree.error.message} /> : null}
      {tree.data?.length === 0 ? <EmptyBlock>No documentation is available.</EmptyBlock> : null}
      {tree.data?.length ? (
        <Card>
          {tree.data.map((node) => <DocumentationRow key={node.id} node={node} depth={0} />)}
        </Card>
      ) : null}
    </TutorScreen>
  );
}

function DocumentationRow({ node, depth }: { node: DocumentationNode; depth: number }) {
  const router = useRouter();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const folder = node.kind === 'folder';

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={folder ? `${node.title}, folder` : node.title}
        accessibilityState={folder ? { expanded } : undefined}
        onPress={() => {
          if (folder) setExpanded((current) => !current);
          else router.push({ pathname: '/documentation-document/[documentId]', params: { documentId: node.id } });
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 48,
          gap: 12,
          paddingStart: Math.min(depth, 8) * 14 + 4,
          paddingVertical: 8,
          backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
        })}
      >
        <Text accessible={false} style={{ width: 12, color: theme.textSecondary, fontSize: 16 }}>
          {folder ? expanded ? '⌄' : '›' : ''}
        </Text>
        {process.env.EXPO_OS === 'ios' ? (
          <Image
            source={folder ? 'sf:folder' : 'sf:doc.text'}
            tintColor={theme.primary}
            style={{ width: 20, height: 20 }}
            accessible={false}
          />
        ) : null}
        <Text style={{ flex: 1, color: theme.text, fontSize: 16, fontWeight: folder ? '600' : '400' }}>{node.title}</Text>
      </Pressable>
      {node.kind === 'folder' && expanded
        ? node.children.map((child) => <DocumentationRow key={child.id} node={child} depth={depth + 1} />)
        : null}
    </View>
  );
}
