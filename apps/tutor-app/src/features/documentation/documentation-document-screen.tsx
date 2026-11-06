import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { EmptyBlock, ErrorBlock, LoadingBlock, TutorScreen } from '@/components/tutor-ui';
import { documentHtml } from '@/features/documentation/document-content';
import { DocumentReader } from '@/features/documentation/document-reader';
import { getDocumentationDocument, signDocumentationImages } from '@/features/documentation/documentation-api';
import { useTheme } from '@/hooks/use-theme';

export default function DocumentationDocumentScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const theme = useTheme();
  const document = useQuery({
    queryKey: ['tutor-documentation', documentId],
    queryFn: () => getDocumentationDocument(documentId),
  });
  const content = document.data?.content ?? null;
  const images = useQuery({
    queryKey: ['tutor-documentation-images', documentId, document.data?.content],
    queryFn: () => signDocumentationImages(content),
    enabled: content != null,
    staleTime: 45 * 60_000,
  });
  const title = document.data?.title || 'Document';
  const html = useMemo(() => documentHtml(content, {
    background: theme.background,
    text: theme.text,
    border: theme.border,
    link: theme.primary,
  }, images.data ?? new Map()), [content, images.data, theme.background, theme.border, theme.primary, theme.text]);

  return (
    <>
      <Stack.Screen options={{ title, headerLargeTitleEnabled: false }} />
      {document.isPending || (content != null && images.isPending) ? (
        <TutorScreen title={title} largeTitle={false}><LoadingBlock label="Loading document…" /></TutorScreen>
      ) : document.isError ? (
        <TutorScreen title={title} largeTitle={false}><ErrorBlock message={document.error.message} /></TutorScreen>
      ) : document.data ? (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <DocumentReader html={html} background={theme.background} />
        </View>
      ) : (
        <TutorScreen title={title} largeTitle={false}><EmptyBlock>Document not found.</EmptyBlock></TutorScreen>
      )}
    </>
  );
}
