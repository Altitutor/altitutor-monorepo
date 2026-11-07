export interface PlannedTopic {
  id: string;
  name: string;
  code: string | null;
}
export interface PlannedDocument {
  id: string;
  code: string | null;
  title: string;
  mimeType: string;
  externalURL: string | null;
}
export interface PlannedResource {
  id: string;
  topicID: string;
  topicName: string;
  subjectID: string;
  subjectName: string;
  worksheet: PlannedDocument;
  solutions: PlannedDocument | null;
}
export interface SessionLessonPlan {
  sessionID: string;
  revision: number;
  updatedAt: string | null;
  topics: PlannedTopic[];
  resources: PlannedResource[];
}
