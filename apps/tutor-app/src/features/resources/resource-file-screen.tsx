import {
  canPrintToOffice,
  flattenTopicFilesForNav,
  type TutorResourceFile,
} from '@altitutor/shared';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyBlock, ErrorBlock, LoadingBlock, TutorScreen } from '@/components/tutor-ui';
import { getOfficePrintAccess } from '@/features/resources/office-print-api';
import { ResourcePlayer } from '@/features/resources/resource-player';
import { getResourceFile, getResourceFileUrl, getTopicFiles } from '@/features/resources/resources-api';
import { useTheme } from '@/hooks/use-theme';

export default function ResourceFileScreen() {
  const { fileId } = useLocalSearchParams<{ fileId: string }>();
  const query = useQuery({ queryKey: ['tutor-resource-file', fileId], queryFn: () => getResourceFile(fileId) });
  const theme = useTheme();
  const file = query.data;
  const signed = useQuery({
    queryKey: ['tutor-resource-signed-url', fileId, file?.bucket, file?.storagePath],
    queryFn: () => file ? getResourceFileUrl(file) : null,
    enabled: Boolean(file && !file.externalUrl),
    staleTime: 45 * 60_000,
  });
  const title = file?.filename ?? 'Resource';

  return (
    <>
      <Stack.Screen options={{ title, headerLargeTitleEnabled: false }} />
      {query.isPending || (file && !file.externalUrl && signed.isPending) ? (
        <TutorScreen title={title} largeTitle={false}><LoadingBlock label="Opening file…" /></TutorScreen>
      ) : query.isError ? (
        <TutorScreen title={title} largeTitle={false}>
          <ErrorBlock message={(query.error)?.message ?? 'Could not open file.'} />
        </TutorScreen>
      ) : file ? (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          {signed.isError ? (
            <TutorScreen title={title} largeTitle={false}>
              <ErrorBlock message={signed.error.message} />
            </TutorScreen>
          ) : <ResourcePlayer key={file.id} file={file} url={signed.data ?? null} />}
          <FileActions file={file} />
        </View>
      ) : (
        <TutorScreen title={title} largeTitle={false}><EmptyBlock>This file is unavailable.</EmptyBlock></TutorScreen>
      )}
    </>
  );
}

function FileActions({ file }: { file: TutorResourceFile }) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const files = useQuery({ queryKey: ['tutor-topic-files', file.topicId], queryFn: () => getTopicFiles(file.topicId) });
  const access = useQuery({
    queryKey: ['tutor-office-print-access'],
    queryFn: getOfficePrintAccess,
    enabled: canPrintToOffice(file),
    staleTime: 60_000,
  });
  const ordered = flattenTopicFilesForNav(files.data ?? []);
  const index = ordered.findIndex((entry) => entry.id === file.id);
  const previous = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 ? ordered[index + 1] : null;
  const counterpart = file.isSolutions
    ? ordered.find((entry) => entry.id === file.isSolutionsOfId)
    : ordered.find((entry) => entry.isSolutionsOfId === file.id);

  const openFile = (id: string) => router.replace({ pathname: '/resource-file/[fileId]', params: { fileId: id } });
  const actions = [
    ...(ordered.length > 1 ? [
      { label: 'Previous', action: previous ? () => openFile(previous.id) : undefined },
      { label: 'Next', action: next ? () => openFile(next.id) : undefined },
    ] : []),
    ...(counterpart ? [{ label: file.isSolutions ? 'Original' : 'Solution', action: () => openFile(counterpart.id) }] : []),
    ...(access.isSuccess && access.data !== 'off' && canPrintToOffice(file)
      ? [{ label: 'Print to office', action: () => router.push({ pathname: '/office-print/[fileId]', params: { fileId: file.id } }) }]
      : []),
  ];

  if (actions.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingHorizontal: 10, paddingBottom: insets.bottom, backgroundColor: theme.backgroundElement }}>
      {actions.map(({ label, action }) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityState={{ disabled: !action }}
          disabled={!action}
          onPress={action}
          style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6, opacity: pressed || !action ? 0.55 : 1 })}
        >
          <Text style={{ color: theme.primary, fontWeight: '600' }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
