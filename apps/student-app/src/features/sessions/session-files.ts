import { groupFilesByType, pairFilesWithSolutions, type ResourceFile, type SharedLessonDocument } from '@altitutor/shared';

export type SessionTopicMeta = {
  id: string;
  code: string;
  name: string;
  subjectId: string;
  subjectName: string;
};

export type SessionFilePair = {
  primary: ResourceFile;
  solution: ResourceFile | null;
  annotated: SharedLessonDocument[];
};

export type SessionFileGroup = {
  subjectName: string;
  topics: { label: string; types: { type: string; pairs: SessionFilePair[] }[] }[];
};

export function groupSessionFiles(
  files: ResourceFile[],
  topics: SessionTopicMeta[],
  documents: SharedLessonDocument[],
): { groups: SessionFileGroup[]; looseAnnotated: SharedLessonDocument[] } {
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const bySubject = new Map<string, Map<string, ResourceFile[]>>();
  for (const file of files) {
    const topic = topicById.get(file.topicId);
    const subjectName = topic?.subjectName ?? 'Subject';
    const topicLabel = topic ? `${topic.code} ${topic.name}`.trim() : 'Topic';
    const topicsForSubject = bySubject.get(subjectName) ?? new Map<string, ResourceFile[]>();
    topicsForSubject.set(topicLabel, [...(topicsForSubject.get(topicLabel) ?? []), file]);
    bySubject.set(subjectName, topicsForSubject);
  }
  const attached = new Set<string>();
  const groups = [...bySubject.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([subjectName, topicFiles]) => ({
    subjectName,
    topics: [...topicFiles.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([label, entries]) => {
      return {
        label,
        types: Object.entries(groupFilesByType(entries)).map(([type, typed]) => ({
          type,
          pairs: pairFilesWithSolutions(typed).map(({ primary, solution }) => {
            const annotated = documents.filter((document) => document.canonicalResourceID === primary.id || document.canonicalResourceID === solution?.id);
            annotated.forEach((document) => attached.add(document.id));
            return { primary, solution, annotated };
          }),
        })),
      };
    }),
  }));
  return { groups, looseAnnotated: documents.filter((document) => !attached.has(document.id)) };
}
