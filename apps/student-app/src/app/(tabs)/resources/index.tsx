import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { EmptyBlock, ErrorBlock, LoadingBlock, StudentScreen } from '@/components/student-ui';
import { isUcatSubject, openUcatResources } from '@/features/resources/open-ucat';
import { useResourceSubjects, useSubjectCovers } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

export default function ResourcesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const subjects = useResourceSubjects();
  const subjectIds = useMemo(() => (subjects.data ?? []).flatMap((subject) => subject.id ? [subject.id] : []), [subjects.data]);
  const covers = useSubjectCovers(subjectIds);
  const coverBySubject = useMemo(() => new Map((covers.data ?? []).map((cover) => [cover.subjectId, cover.url])), [covers.data]);
  const cardWidth = (width - 40 - 12) / 2;

  return (
    <StudentScreen title="Resources" showHeaderActions>
      {subjects.isPending ? <LoadingBlock label="Loading subjects..." /> : null}
      {subjects.isError ? <ErrorBlock message={subjects.error.message} /> : null}
      {subjects.data?.length === 0 ? <EmptyBlock>No subject resources available.</EmptyBlock> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {subjects.data?.map((subject) => {
          const title = subject.long_name || subject.name || 'Subject';
          const cover = subject.id ? coverBySubject.get(subject.id) : undefined;
          const ucat = isUcatSubject(subject);
          return (
            <Pressable
              key={subject.id}
              accessibilityRole="button"
              accessibilityLabel={title}
              onPressIn={() => haptic()}
              onPress={() => {
                if (ucat) {
                  void openUcatResources();
                  return;
                }
                if (!subject.id) return;
                router.push({ pathname: '/resource-subject/[subjectId]', params: { subjectId: subject.id, title: subject.name ?? 'Resources' } });
              }}
              style={{ width: cardWidth, borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: theme.backgroundElement, boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}>
              {cover ? (
                <Image
                  source={{ uri: cover, cacheKey: `subject-cover-${subject.id ?? title}` }}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  style={{ width: '100%', height: 112, backgroundColor: subject.color ?? theme.backgroundSelected }}
                />
              ) : (
                <View style={{ height: 112, alignItems: 'center', justifyContent: 'center', backgroundColor: subject.color ?? theme.backgroundSelected }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700' }}>{title.slice(0, 1)}</Text>
                </View>
              )}
              <Text selectable numberOfLines={2} style={{ color: theme.text, fontSize: 16, fontWeight: '600', padding: 12 }}>{title}</Text>
            </Pressable>
          );
        })}
      </View>
    </StudentScreen>
  );
}
