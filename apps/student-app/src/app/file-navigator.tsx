import { formatResourceFileLabel, formatResourceTypeLabel, groupFilesByType, pairFilesWithSolutions } from '@altitutor/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { EmptyBlock, StudentScreen } from '@/components/student-ui';
import { useFileNavigation, type FileNavigation } from '@/features/resources/resource-navigation';
import { resourceTypeSymbol } from '@/features/resources/topic-path';
import { TopicFileCard } from '@/features/resources/topic-file-card';
import { useResourceFiles } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';

export default function FileNavigatorScreen() {
  const navigationRef = useFileNavigation();
  const router = useRouter();
  const theme = useTheme();
  const [nav, setNav] = useState<FileNavigation | null>(null);
  const [jump, setJump] = useState<((fileId: string) => void) | null>(null);

  useEffect(() => {
    const current = navigationRef.current;
    setNav(current);
    setJump(() => current?.jump ?? null);
  }, [navigationRef]);

  const files = useResourceFiles(nav?.topicId ?? '');
  const grouped = useMemo(
    () => Object.entries(groupFilesByType(files.data ?? [])).map(([type, entries]) => ({
      type,
      pairs: pairFilesWithSolutions(entries),
    })),
    [files.data],
  );

  return (
    <StudentScreen title="Files" largeTitle={false}>
      {nav && grouped.length ? grouped.map((group) => (
        <View key={group.type} style={{ gap: 10 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' }}>
            {formatResourceTypeLabel(group.type)}
          </Text>
          {group.pairs.map(({ primary, solution }) => (
            <View key={primary.id} style={{ flexDirection: 'row', gap: 10 }}>
              <TopicFileCard
                title={formatResourceFileLabel(primary)}
                icon={resourceTypeSymbol(primary.type)}
                highlighted={primary.id === nav.currentId}
                onPress={() => {
                  jump?.(primary.id);
                  router.back();
                }}
              />
              {solution ? (
                <TopicFileCard
                  title={formatResourceFileLabel(solution)}
                  eyebrow="Solution"
                  icon="checkmark.seal"
                  highlighted={solution.id === nav.currentId}
                  onPress={() => {
                    jump?.(solution.id);
                    router.back();
                  }}
                />
              ) : null}
            </View>
          ))}
        </View>
      )) : (
        <EmptyBlock>Open a file to browse this topic.</EmptyBlock>
      )}
    </StudentScreen>
  );
}
