import type { InterviewRound, InterviewRecording } from "../index";
import {
  interviewMediaPolicy,
  type InterviewMediaPolicy,
  type InterviewMediaTicket,
} from "../media";
import { DailyInterviewProvider } from "./daily";

export interface InterviewMediaSession {
  id: string;
  roundId: string;
  attemptId: string;
  key: string;
  roomName: string;
  url: string | null;
  expiresAt: string;
  closedAt: string | null;
  recordingEnabled: boolean;
  recordingRequestedAt: string | null;
  recordingError: string | null;
  kind: "audio" | "video";
  recordingActive: boolean;
}
export interface InterviewMediaStore {
  round(id: string): Promise<InterviewRound>;
  sessions(roundId: string): Promise<InterviewMediaSession[]>;
  ensureSession(session: InterviewMediaSession): Promise<InterviewMediaSession>;
  updateSession(
    id: string,
    patch: Partial<
      Pick<
        InterviewMediaSession,
        | "url"
        | "closedAt"
        | "recordingRequestedAt"
        | "recordingError"
        | "recordingActive"
      >
    >,
  ): Promise<void>;
  claimRecordingRefresh(id: string): Promise<boolean>;
  failPendingRecording(id: string): Promise<void>;
  syncRecording(
    session: InterviewMediaSession,
    recording: {
      id: string;
      state: "recording" | "ready" | "failed";
      createdAt: string;
    },
    first: boolean,
  ): Promise<void>;
}

function sessionKey(policy: InterviewMediaPolicy) {
  // Do not reissue credentials for a room from an older recording policy.
  return `phase-v2:${policy.key}`;
}

export class InterviewMediaService {
  constructor(
    private readonly store: InterviewMediaStore,
    private readonly provider: DailyInterviewProvider,
    private readonly now: () => number = Date.now,
  ) {}

  async reconcile(roundId: string, refreshRecordings = true): Promise<void> {
    const sessions = await this.store.sessions(roundId);
    const round = await this.store.round(roundId);
    await this.reconcileRound(round, sessions, refreshRecordings);
  }

  private async closeSession(session: InterviewMediaSession): Promise<void> {
    await this.provider.closeRoom(session.roomName);
    await this.store.updateSession(session.id, {
      closedAt: new Date(this.now()).toISOString(),
    });
  }

  private async reconcileRound(
    round: InterviewRound,
    sessions: InterviewMediaSession[],
    refreshRecordings: boolean,
  ): Promise<void> {
    const keys = new Set(
      round.progress.flatMap((station) => {
        const policy = interviewMediaPolicy(round, station.tutorId, "tutor");
        return policy ? [sessionKey(policy)] : [];
      }),
    );
    await Promise.all(
      sessions.map(async (session) => {
        if (session.kind === "audio") return;
        if (
          !session.closedAt &&
          (!keys.has(session.key) || Date.parse(session.expiresAt) <= this.now())
        ) {
          await this.closeSession(session);
        }
        const settled =
          session.closedAt &&
          round.recordings.some(
            (recording) =>
              recording.id === session.id &&
              ["ready", "failed", "expired"].includes(recording.state),
          );
        if (refreshRecordings && session.recordingEnabled && !settled)
          await this.refreshRecordings(session);
      }),
    );
  }

  private async refreshRecordings(
    session: InterviewMediaSession,
  ): Promise<boolean> {
    if (!(await this.store.claimRecordingRefresh(session.id)))
      return session.recordingActive;
    try {
      const recordings = (
        await this.provider.recordings(session.roomName)
      ).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const [index, recording] of recordings.entries())
        await this.store.syncRecording(session, recording, index === 0);
      if (
        !recordings.length &&
        session.closedAt &&
        this.now() - Date.parse(session.closedAt) > 5 * 60_000
      )
        await this.store.failPendingRecording(session.id);
      const recordingActive = recordings.some(
        (recording) => recording.state === "recording",
      );
      await this.store.updateSession(session.id, {
        recordingError: null,
        recordingActive,
      });
      return recordingActive;
    } catch {
      await this.store.updateSession(session.id, {
        recordingActive: false,
        recordingError:
          "Recording status is unavailable. The interview can continue.",
      });
      return false;
    }
  }

  async ticket(
    roundId: string,
    actor: { id: string; name: string; role: "tutor" | "student" },
    knownSessionId?: string,
    knownAccessKey?: string,
  ): Promise<InterviewMediaTicket> {
    return this.issueTicket(roundId, actor, knownSessionId, knownAccessKey);
  }

  /** Caller verifies active AdminStaff access before invoking this adapter. */
  async ticketObserver(
    roundId: string,
    actor: { id: string; name: string },
    stationId: string,
    knownSessionId?: string,
    knownAccessKey?: string,
  ): Promise<InterviewMediaTicket> {
    return this.issueTicket(
      roundId,
      { ...actor, role: "admin" },
      knownSessionId,
      knownAccessKey,
      stationId,
    );
  }

  private async issueTicket(
    roundId: string,
    actor: { id: string; name: string; role: "tutor" | "student" | "admin" },
    knownSessionId?: string,
    knownAccessKey?: string,
    stationId?: string,
  ): Promise<InterviewMediaTicket> {
    const resolvePolicy = (current: InterviewRound) => {
      if (actor.role !== "admin")
        return interviewMediaPolicy(current, actor.id, actor.role);
      const station = current.progress.find(
        (item) => item.stationId === stationId,
      );
      return station
        ? interviewMediaPolicy(current, station.tutorId, "tutor")
        : null;
    };
    const initial = await this.store.round(roundId);
    const sessions = await this.store.sessions(roundId);
    const round = await this.store.round(roundId);
    await this.reconcileRound(round, sessions, false);
    const policy = resolvePolicy(round);
    const empty: InterviewMediaTicket = {
      sessionId: null,
      canSend: false,
      canReceive: false,
      recordingEnabled: false,
      serverNow: round.serverNow,
    };
    // If policy changed while listing rooms, a just-published predecessor may
    // have been missed. Let the next ticket reconcile it before admitting anyone.
    if (!policy || resolvePolicy(initial)?.key !== policy.key) return empty;
    if (round.delivery === "in_person")
      return {
        ...empty,
        attemptId: policy.attemptId,
        recordingEnabled: actor.role === "tutor" && policy.recordingEnabled,
      };
    const expiresAt =
      policy.expiresAt ??
      new Date(Date.parse(round.phaseStartedAt) + 4 * 60 * 60 * 1000).toISOString();
    if (Date.parse(expiresAt) <= this.now()) return empty;
    const session =
      sessions.find((candidate) => candidate.key === sessionKey(policy)) ??
      (await this.createSession(roundId, policy, expiresAt));
    if (
      session.closedAt ||
      !session.url ||
      Date.parse(session.expiresAt) <= this.now()
    )
      return empty;
    const beforeMint = await this.store.round(roundId);
    if (resolvePolicy(beforeMint)?.key !== policy.key) {
      await this.closeSession(session);
      return { ...empty, serverNow: beforeMint.serverNow };
    }
    const permissions =
      actor.role === "admin"
        ? { canSend: false, canReceive: true }
        : { canSend: policy.canSend, canReceive: policy.canReceive };
    const accessKey = `${actor.role}:${policy.key}`;
    const token =
      knownSessionId === session.id && knownAccessKey === accessKey
        ? undefined
        : await this.provider.token(
            session.roomName,
            actor.id,
            actor.name,
            Math.floor(Date.parse(session.expiresAt) / 1000),
            permissions,
          );
    const current = token ? await this.store.round(roundId) : beforeMint;
    if (resolvePolicy(current)?.key !== policy.key) {
      await this.closeSession(session);
      return { ...empty, serverNow: current.serverNow };
    }
    return {
      ...empty,
      sessionId: session.id,
      accessKey,
      url: session.url,
      token,
      expiresAt: session.expiresAt,
      ...permissions,
      attemptId: policy.attemptId,
      recordingEnabled: policy.recordingEnabled,
      serverNow: current.serverNow,
    };
  }

  private async createSession(
    roundId: string,
    policy: InterviewMediaPolicy,
    expiresAt: string,
  ): Promise<InterviewMediaSession> {
    // Provision an unissued, unique room, then publish the ready row. A late
    // create can never resurrect the name of a room that issued credentials.
    const id = crypto.randomUUID();
    const roomName = `mmi-${id}`;
    const url = await this.provider.createRoom(
      roomName,
      Math.floor(Date.parse(expiresAt) / 1000),
    );
    const session = await this.store.ensureSession({
      id,
      roundId,
      attemptId: policy.attemptId,
      key: sessionKey(policy),
      roomName,
      url,
      expiresAt,
      closedAt: null,
      recordingEnabled: false,
      recordingRequestedAt: null,
      recordingError: null,
      kind: "video",
      recordingActive: false,
    });
    // Only delete a known loser. A failed database read leaves the outcome
    // uncertain and another caller may already have used the published room.
    if (session.id !== id) await this.provider.closeRoom(roomName);
    return session;
  }
}

export function canPlayInterviewRecording(
  recording: InterviewRecording,
  now = Date.now(),
): boolean {
  return recording.state === "ready" && Date.parse(recording.expiresAt) > now;
}
