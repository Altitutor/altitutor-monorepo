import type { InterviewRound } from './index';

export interface InterviewMediaPolicy {
  key: string;
  attemptId: string;
  studentId: string;
  tutorId: string;
  phase: 'reading' | 'questions' | 'feedback';
  expiresAt: string | null;
  canSend: boolean;
  canReceive: boolean;
  recordingEnabled: boolean;
}

/** Server-side policy derived from the authenticated round, never from browser phase flags. */
export function interviewMediaPolicy(round: InterviewRound, actorId: string, role: 'tutor' | 'student'): InterviewMediaPolicy | null {
  if (round.pausedAt || round.phase === 'waiting' || round.phase === 'completed') return null;
  const station = round.progress.find((entry) => role === 'tutor' ? entry.tutorId === actorId : entry.studentId === actorId);
  if (!station?.studentId || station.feedbackComplete) return null;
  const attempt = round.attempts.find((entry) => entry.stationId === station.stationId && entry.studentId === station.studentId);
  if (!attempt) return null;
  const phase = station.endedEarly ? 'feedback' : round.phase;
  if (round.mode === 'exam' && phase === 'feedback') return null;
  const readingExam = round.mode === 'exam' && phase === 'reading';
  return {
    key: `${attempt.id}:${phase}:${round.phaseStartedAt}`,
    attemptId: attempt.id, studentId: station.studentId, tutorId: station.tutorId, phase,
    expiresAt: phase === 'feedback' ? null : round.phaseDeadline,
    canSend: !(readingExam && role === 'tutor'),
    canReceive: !(readingExam && role === 'student'),
    recordingEnabled: round.recordingEnabled && phase !== 'reading',
  };
}

export interface InterviewMediaTicket {
  captureId?: string;
  actorId?: string;
  serverNow?: string;
  sessionId: string | null;
  url?: string;
  token?: string;
  expiresAt?: string;
  canSend: boolean;
  canReceive: boolean;
  recordingEnabled: boolean;
  recordingActive?: boolean;
  warning?: string;
  attemptId?: string;
}
