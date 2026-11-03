import type { SharedLessonDocument } from '@altitutor/shared';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, Label, LoadingBlock, TappableRow } from '@/components/student-ui';
import { useSessionLogResources } from '@/hooks/use-student-data';

function SharedFile({ document }: { document: SharedLessonDocument }) {
  const router = useRouter();
  return <TappableRow title={document.filename}
    detail={document.available ? (document.canonicalResourceID ? 'Annotated lesson PDF' : 'Shared lesson PDF') : 'Expired'}
    onPress={document.available ? () => router.push({ pathname: '/lesson-document/[documentId]', params: { documentId: document.id } }) : undefined} />;
}
export function SessionLogFiles({ sessionID }: { sessionID: string }) {
  const resources = useSessionLogResources(sessionID);
  const router = useRouter();
  if (resources.isPending) return <LoadingBlock label="Loading lesson files…" />;
  if (resources.isError) return <ErrorBlock message={resources.error.message} />;
  const { files, documents, hasLog } = resources.data;
  if (!hasLog && !documents.length) return null;
  return <Card>
    <Label>Tutor log · Lesson files</Label>
    {!files.length && !documents.length ? <EmptyBlock>No files were linked to you in this lesson.</EmptyBlock> : null}
    {files.map(file => <View key={file.id} style={{ gap: 4 }}>
      <TappableRow title={file.filename} detail="Canonical worksheet"
        onPress={() => router.push({ pathname: '/resource-file/[fileId]', params: { fileId: file.id, topicId: file.topicId, singleFile: '1' } })} />
      {documents.filter(document => document.canonicalResourceID === file.id).map(document => <SharedFile key={document.id} document={document} />)}
    </View>)}
    {documents.filter(document => !document.canonicalResourceID || !files.some(file => file.id === document.canonicalResourceID))
      .map(document => <SharedFile key={document.id} document={document} />)}
  </Card>;
}
