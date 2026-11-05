import { formatResourceFileLabel, formatResourceTypeLabel } from '@altitutor/shared';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/student-ui';
import { resourceTypeSymbol } from '@/features/resources/topic-path';
import { TopicFileCard } from '@/features/resources/topic-file-card';
import { useSessionLogResources } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';

import { groupSessionFiles } from './session-files';

export function SessionLogFiles({ sessionID }: { sessionID: string }) {
  const resources = useSessionLogResources(sessionID);
  const router = useRouter();
  const theme = useTheme();
  if (resources.isPending) return <LoadingBlock label="Loading lesson files…" />;
  if (resources.isError) return <ErrorBlock message={resources.error.message} />;
  const { files, documents, hasLog, topics } = resources.data;
  if (!hasLog && !documents.length) return null;
  const grouped = groupSessionFiles(files, topics, documents);
  return (
    <Card>
      <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Files</Text>
      {!files.length && !documents.length ? <EmptyBlock>No files were linked to you in this lesson.</EmptyBlock> : null}
      {grouped.groups.map((subject) => (
        <View key={subject.subjectName} style={{ gap: 10 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '700' }}>{subject.subjectName}</Text>
          {subject.topics.map((topic) => (
            <View key={topic.label} style={{ gap: 8 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>{topic.label}</Text>
              {topic.types.map((type) => (
                <View key={type.type} style={{ gap: 8 }}>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' }}>{formatResourceTypeLabel(type.type)}</Text>
                  {type.pairs.map(({ primary, solution, annotated }) => (
                    <View key={primary.id} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <View style={{ width: '48%' }}>
                        <TopicFileCard title={formatResourceFileLabel(primary)} icon={resourceTypeSymbol(primary.type)} onPress={() => router.push({ pathname: '/resource-file/[fileId]', params: { fileId: primary.id, topicId: primary.topicId, singleFile: '1' } })} />
                      </View>
                      {solution ? (
                        <View style={{ width: '48%' }}>
                          <TopicFileCard title={formatResourceFileLabel(solution)} eyebrow="Solution" icon="checkmark.seal" onPress={() => router.push({ pathname: '/resource-file/[fileId]', params: { fileId: solution.id, topicId: solution.topicId, singleFile: '1' } })} />
                        </View>
                      ) : null}
                      {annotated.map((document) => (
                        <View key={document.id} style={{ width: '48%' }}>
                          <TopicFileCard
                            title={document.filename}
                            eyebrow="Annotated"
                            icon="pencil.and.outline"
                            onPress={() => {
                              if (document.available) router.push({ pathname: '/lesson-document/[documentId]', params: { documentId: document.id } });
                            }}
                          />
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
      {grouped.looseAnnotated.map((document) => (
        <TopicFileCard
          key={document.id}
          title={document.filename}
          eyebrow={document.available ? 'Annotated lesson PDF' : 'Expired'}
          icon="pencil.and.outline"
          onPress={() => {
            if (document.available) router.push({ pathname: '/lesson-document/[documentId]', params: { documentId: document.id } });
          }}
        />
      ))}
    </Card>
  );
}
