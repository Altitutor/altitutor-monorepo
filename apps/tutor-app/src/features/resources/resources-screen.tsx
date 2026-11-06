import { getResourceSubjectNavLabel } from '@altitutor/shared';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { EmptyBlock, ErrorBlock, LoadingBlock, TutorScreen } from '@/components/tutor-ui';
import { getResourceSubjectCovers } from './resources-api';
import { useResourceSubjects } from './use-resource-subjects';
import { useTheme } from '@/hooks/use-theme';

export default function ResourcesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [gridWidth, setGridWidth] = useState(0);
  const subjects = useResourceSubjects();
  const subjectIds = (subjects.data ?? []).map(({ id }) => id);
  const covers = useQuery({
    queryKey: ['tutor-resource-subject-covers', subjectIds],
    queryFn: () => getResourceSubjectCovers(subjectIds),
    enabled: subjectIds.length > 0,
    staleTime: 30 * 60_000,
  });
  const columns = gridWidth >= 720 ? 3 : 2;
  const gap = 12;
  const cardWidth = (gridWidth - gap * (columns - 1)) / columns;

  return (
    <TutorScreen title="Resources">
      {subjects.isPending ? <LoadingBlock label="Loading subjects…" /> : null}
      {subjects.isError ? <ErrorBlock message={subjects.error.message} /> : null}
      {subjects.data?.length === 0 ? <EmptyBlock>No subject resources are available.</EmptyBlock> : null}
      <View onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {gridWidth > 0 ? subjects.data?.map((subject) => {
          const title = getResourceSubjectNavLabel(subject);
          const coverUrl = covers.data?.get(subject.id);
          return (
            <Pressable
              key={subject.id}
              accessibilityRole="button"
              accessibilityLabel={title}
              onPress={() => router.push({ pathname: '/resource-subject/[subjectId]', params: { subjectId: subject.id } })}
              style={({ pressed }) => ({
                width: cardWidth,
                borderRadius: 18,
                borderCurve: 'continuous',
                overflow: 'hidden',
                backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
              })}
            >
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl, cacheKey: `tutor-subject-cover-${subject.id}` }}
                  cachePolicy="memory"
                  contentFit="cover"
                  style={{ width: '100%', height: 112, backgroundColor: subject.color ?? theme.backgroundSelected }}
                />
              ) : (
                <View style={{ height: 112, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.backgroundSelected }}>
                  <Text style={{ color: theme.primary, fontSize: 28, fontWeight: '700' }}>{title.slice(0, 1)}</Text>
                </View>
              )}
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', padding: 12 }}>{title}</Text>
            </Pressable>
          );
        }) : null}
      </View>
    </TutorScreen>
  );
}
