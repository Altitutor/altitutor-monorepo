import {
  canPrintToOffice,
  formatResourceFileLabel,
  formatResourceTypeLabel,
  groupFilesByType,
  pairFilesWithSolutions,
  type TutorResourceFile,
} from '@altitutor/shared';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, LoadingBlock, SectionTitle, TutorScreen } from '@/components/tutor-ui';
import { getOfficePrintAccess } from '@/features/resources/office-print-api';
import { getResourceTopic, getTopicFiles } from '@/features/resources/resources-api';
import { useTheme } from '@/hooks/use-theme';

export default function ResourceTopicScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const topic = useQuery({ queryKey: ['tutor-resource-topic', topicId], queryFn: () => getResourceTopic(topicId) });
  const files = useQuery({ queryKey: ['tutor-topic-files', topicId], queryFn: () => getTopicFiles(topicId) });
  const title = topic.data?.name || topic.data?.code || 'Topic';
  const access = useQuery({
    queryKey: ['tutor-office-print-access'],
    queryFn: getOfficePrintAccess,
    enabled: files.data?.some(canPrintToOffice) ?? false,
    staleTime: 60_000,
  });
  const officePrintEnabled = access.isSuccess && access.data !== 'off';

  return (
    <>
      <Stack.Screen options={{ title, headerLargeTitleEnabled: false }} />
      <TutorScreen title={title} largeTitle={false}>
        {topic.isPending || files.isPending ? <LoadingBlock label="Loading files…" /> : null}
        {topic.isError || files.isError ? <ErrorBlock message={(topic.error ?? files.error)?.message ?? 'Could not load files.'} /> : null}
        {topic.data === null ? <EmptyBlock>This topic is unavailable.</EmptyBlock> : null}
        {topic.data && files.data?.length === 0 ? <EmptyBlock>No files are available for this topic.</EmptyBlock> : null}
        {Object.entries(groupFilesByType(files.data ?? [])).map(([type, typeFiles]) => (
          <View key={type} style={{ gap: 8 }}>
            <SectionTitle>{formatResourceTypeLabel(type)}</SectionTitle>
            {pairFilesWithSolutions(typeFiles).map(({ primary, solution }) => (
              <Card key={primary.id} divided={Boolean(solution)}>
                <FileRow file={primary} officePrintEnabled={officePrintEnabled} />
                {solution ? <FileRow file={solution} officePrintEnabled={officePrintEnabled} /> : null}
              </Card>
            ))}
          </View>
        ))}
      </TutorScreen>
    </>
  );
}

function FileRow({ file, officePrintEnabled }: { file: TutorResourceFile; officePrintEnabled: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/resource-file/[fileId]', params: { fileId: file.id } })}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 44,
          justifyContent: 'center',
          opacity: pressed ? 0.65 : 1,
        })}
      >
        {file.isSolutions ? <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Solution</Text> : null}
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '500' }}>{formatResourceFileLabel(file)}</Text>
      </Pressable>
      {officePrintEnabled && canPrintToOffice(file) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Print ${file.filename} to office`}
          onPress={() => router.push({ pathname: '/office-print/[fileId]', params: { fileId: file.id } })}
          style={({ pressed }) => ({
            justifyContent: 'center',
            minHeight: 44,
            paddingHorizontal: 8,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '600' }}>Print</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
