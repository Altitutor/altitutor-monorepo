export interface SharedLessonDocument {
  id: string;
  sessionID: string;
  canonicalResourceID: string | null;
  filename: string;
  publishedAt: string;
  expiresAt: string;
  available: boolean;
}
