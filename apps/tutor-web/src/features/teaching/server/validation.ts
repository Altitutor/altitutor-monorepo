import { z } from 'zod';
import { TeachingError } from './auth';

const id = z.string().uuid().transform(value => value.toLowerCase());
const students = z.array(id).max(500);
export const teachingLogSchema = z.object({
  sessionId: id,
  staffAttendance: z.array(z.object({ staffId: id, attended: z.boolean(),
    type: z.enum(['MAIN_TUTOR', 'SECONDARY_TUTOR', 'TRIAL_TUTOR', 'CHECK_IN_HOST', 'CHECK_IN_RECEIVER']),
  }).strict()).max(100),
  studentAttendance: z.array(z.object({ studentId: id, attended: z.boolean() }).strict()).max(500),
  parentAttendance: z.array(z.object({ parentId: id, attended: z.boolean() }).strict()).max(500).default([]),
  topics: z.array(z.object({ topicId: id, studentIds: students }).strict()).max(500),
  topicFiles: z.array(z.object({ topicsFilesId: id, topicId: id, studentIds: students }).strict()).max(500),
  notes: z.array(z.string().trim().min(1).max(10000)).max(25),
}).strict();
export type TeachingLogInput = z.infer<typeof teachingLogSchema>;

export const teachingStudentSchema = z.object({ sessionId: id, studentId: id }).strict();

export const authSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('signIn'), email: z.string().email().max(320), password: z.string().min(1).max(1024) }).strict(),
  z.object({ action: z.literal('refresh'), refreshToken: z.string().min(1).max(8192) }).strict(),
]);

export async function readTeachingBody(request: Request): Promise<unknown> {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new TeachingError(415, 'Send JSON content.');
  const text = await request.text();
  if (text.length > 131072) throw new TeachingError(413, 'This request is too large.');
  try { return JSON.parse(text) as unknown; } catch { throw new TeachingError(400, 'Invalid JSON.'); }
}

export function requireUUID(value: string): string {
  const parsed = id.safeParse(value);
  if (!parsed.success) throw new TeachingError(400, 'Invalid identifier.');
  return parsed.data;
}
