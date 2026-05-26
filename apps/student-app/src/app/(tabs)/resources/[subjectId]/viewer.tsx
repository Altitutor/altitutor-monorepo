import type { ResourceFile } from '@altitutor/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { NativePager } from '@/components/native-pager';
import { useTheme } from '@/hooks/use-theme';
import { studentApi } from '@/lib/student-api';

export default function ResourceViewerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { subjectId, topicId, file: serialized, files: serializedFiles, counterpart } = useLocalSearchParams<{
    subjectId: string;
    topicId: string;
    file: string;
    files?: string;
    counterpart?: string;
  }>();
  const file = useMemo(() => JSON.parse(serialized) as ResourceFile, [serialized]);
  const files = useMemo(() => serializedFiles ? JSON.parse(serializedFiles) as ResourceFile[] : [], [serializedFiles]);
  const linked = useMemo(() => counterpart ? JSON.parse(counterpart) as ResourceFile : null, [counterpart]);
  const fileIndex = files.findIndex((candidate) => candidate.id === file.id);
  const previous = fileIndex > 0 ? files[fileIndex - 1] : null;
  const next = fileIndex >= 0 && fileIndex < files.length - 1 ? files[fileIndex + 1] : null;
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    setError(null);
    studentApi.getFileUrl(file).then(setUrl).catch((cause: Error) => setError(cause.message));
  }, [file]);

  function open(nextFile: ResourceFile | null, alternate?: ResourceFile | null) {
    if (!nextFile) return;
    router.replace({
      pathname: '/(tabs)/resources/[subjectId]/viewer',
      params: {
        subjectId,
        topicId,
        file: JSON.stringify(nextFile),
        files: serializedFiles ?? '',
        counterpart: alternate ? JSON.stringify(alternate) : '',
      },
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: file.filename, headerLargeTitleEnabled: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
        <NativePager
          actions={[
            { label: 'Previous', disabled: !previous, onPress: () => open(previous) },
            ...(linked
              ? [{ label: file.isSolutions ? 'View resource' : 'View solutions', onPress: () => open(linked, file) }]
              : []),
            { label: 'Next', disabled: !next, onPress: () => open(next) },
          ]}
        />
        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
        {!url && !error ? <ActivityIndicator color={theme.primary} /> : null}
        {url && file.mimetype?.startsWith('image/') ? (
          <Image source={{ uri: url }} alt={file.filename} resizeMode="contain" style={styles.viewer} />
        ) : null}
        {url && !file.mimetype?.startsWith('image/') ? (
          <WebView source={{ uri: url }} style={styles.viewer} startInLoadingState />
        ) : null}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  viewer: { flex: 1, borderRadius: 12, overflow: 'hidden' },
});
