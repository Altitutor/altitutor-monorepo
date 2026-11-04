import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { ErrorBlock, LoadingBlock } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';
import { studentApi } from '@/lib/student-api';

export default function LessonDocumentScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const theme = useTheme();
  const router = useRouter();
  const [viewerError, setViewerError] = useState(false);
  const document = useQuery({ queryKey: ['student', 'lesson-document', documentId], queryFn: () => studentApi.getLessonDocument(documentId), enabled: Boolean(documentId) });
  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <Stack.Screen options={{ headerShown: true, title: 'Lesson PDF', headerLargeTitleEnabled: false,
      ...(Platform.OS === 'android' ? { headerRight: () => <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ padding: 12 }}>
        <Text style={{ color: theme.primary }}>Close</Text>
      </Pressable> } : {}),
    }} />
    {Platform.OS === 'ios' ? <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button accessibilityLabel="Close lesson PDF" icon="xmark" onPress={() => router.back()} />
    </Stack.Toolbar> : null}
    {document.isPending ? <LoadingBlock label="Opening lesson PDF…" /> : null}
    {viewerError ? <ErrorBlock message="The PDF could not be displayed here. Refresh it or open it in your browser." /> : null}
    {document.isError ? <ErrorBlock message={document.error.message} /> : null}
    {document.data ? <>
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => { void Linking.openURL(document.data.url).catch(() => setViewerError(true)); }}>
          <Text style={{ color: theme.primary }}>Open PDF in browser</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setViewerError(false); void document.refetch(); }}>
          <Text style={{ color: theme.primary }}>Refresh PDF</Text>
        </Pressable>
      </ScrollView>
      <WebView key={document.data.url} source={{ uri: document.data.url }} style={{ flex: 1, backgroundColor: theme.background }} onError={() => setViewerError(true)} startInLoadingState />
    </> : null}
  </View>;
}
