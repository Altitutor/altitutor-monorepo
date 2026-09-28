import { flattenTopicFilesForNav, formatResourceTypeLabel } from '@altitutor/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBlock } from '@/components/student-ui';
import { useFileNavigation } from '@/features/resources/resource-navigation';
import { ResourcePlayer } from '@/features/resources/resource-player';
import { ResourceToolbar } from '@/features/resources/resource-toolbar';
import { useResourceFiles } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';
import { studentApi } from '@/lib/student-api';

export default function ResourceFileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigationRef = useFileNavigation();
  const { fileId, topicId } = useLocalSearchParams<{ fileId: string; topicId: string }>();
  const files = useResourceFiles(topicId);
  const ordered = useMemo(() => flattenTopicFilesForNav(files.data ?? []), [files.data]);
  const index = ordered.findIndex((file) => file.id === fileId);
  const file = ordered[index] ?? files.data?.find((candidate) => candidate.id === fileId) ?? null;
  const previous = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;
  const [resolved, setResolved] = useState<{ id: string; url: string | null; error: string | null } | null>(null);
  const url = resolved?.id === file?.id ? resolved.url : null;
  const error = resolved?.id === file?.id ? resolved.error : null;

  useEffect(() => {
    if (!file) return;
    const id = file.id;
    let active = true;
    studentApi.getFileUrl(file).then((nextUrl) => {
      if (active) setResolved({ id, url: nextUrl, error: null });
    }).catch((cause: unknown) => {
      if (active) setResolved({ id, url: null, error: cause instanceof Error ? cause.message : 'Unable to open this file.' });
    });
    return () => {
      active = false;
    };
  }, [file]);

  function openFile(nextFileId: string) {
    router.setParams({ fileId: nextFileId });
  }

  useEffect(() => {
    navigationRef.current = {
      topicId,
      currentId: fileId,
      files: ordered.map((entry) => ({
        id: entry.id,
        title: entry.filename || entry.code || 'Resource',
        detail: entry.isSolutions ? 'Solutions' : formatResourceTypeLabel(entry.type),
      })),
      jump: openFile,
    };
    return () => {
      navigationRef.current = null;
    };
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingBottom: process.env.EXPO_OS === 'ios' ? 0 : 56 + Math.max(insets.bottom, 12) }}>
      <Stack.Screen options={{ title: file?.filename || 'Resource', headerLargeTitleEnabled: false }} />
      {files.isPending || (file && !file.externalUrl && !url && !error) ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
      ) : null}
      {files.isError ? <ErrorBlock message={files.error.message} /> : null}
      {error ? <Text style={{ color: theme.danger, padding: 20 }}>{error}</Text> : null}
      {!file && !files.isPending ? <Text style={{ color: theme.textSecondary, padding: 20 }}>This file is no longer available.</Text> : null}
      {file && (url || file.externalUrl) ? <ResourcePlayer key={file.id} file={file} url={url} /> : null}
      <ResourceToolbar
        previous={() => previous && openFile(previous.id)}
        next={() => next && openFile(next.id)}
        previousDisabled={!previous}
        nextDisabled={!next}
        onNavigator={() => router.push('/file-navigator')}
        previousLabel="Previous file"
        nextLabel="Next file"
        navigatorLabel="File navigator"
      />
    </View>
  );
}
