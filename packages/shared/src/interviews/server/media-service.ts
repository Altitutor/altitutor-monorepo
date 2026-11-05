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
  ensureRecording(session: InterviewMediaSession): Promise<void>;
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
  capabilities(sessionId: string): Promise<InterviewMediaCapability[]>;
  registerCapability(capability: InterviewMediaCapability): Promise<void>;
  revokeCapabilities(providerUserIds: string[]): Promise<void>;
}
export interface InterviewMediaCapability {
  providerUserId: string;
  sessionId: string;
  actorId: string;
  policyKey: string;
  expiresAt: string;
}

function attemptIds(round: InterviewRound): Set<string> {
  if (round.phase === "waiting" || round.phase === "completed")
    return new Set();
  return new Set(
    round.progress.flatMap((station) => {
      if (
        !station.studentId ||
        station.feedbackComplete ||
        (round.mode === "exam" &&
          (round.phase === "feedback" || station.endedEarly))
      )
        return [];
      return round.attempts
        .filter(
          (attempt) =>
            attempt.stationId === station.stationId &&
            attempt.studentId === station.studentId,
        )
        .map((attempt) => attempt.id);
    }),
  );
}
async function digest(value: string): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
async function capabilityId(value: string): Promise<string> {
  const hash = await digest(value);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export class InterviewMediaService {
  constructor(
    private readonly store: InterviewMediaStore,
    private readonly provider: DailyInterviewProvider,
    private readonly now: () => number = Date.now,
  ) {}

  async reconcile(roundId: string, refreshRecordings = true): Promise<void> {
    await this.reconcileRound(
      await this.store.round(roundId),
      refreshRecordings,
    );
  }

  private async reconcileRound(
    round: InterviewRound,
    refreshRecordings: boolean,
  ): Promise<void> {
    const roundId = round.id;
    const attempts = attemptIds(round);
    const keys = new Set(
      round.progress
        .map(
          (station) =>
            interviewMediaPolicy(round, station.tutorId, "tutor")?.key,
        )
        .filter(Boolean),
    );
    const sessions = await this.store.sessions(roundId);
    await Promise.all(
      sessions.map(async (session) => {
        if (session.kind === "audio") return;
        if (
          !session.closedAt &&
          (session.key !== `attempt:${session.attemptId}` ||
            !attempts.has(session.attemptId) ||
            Date.parse(session.expiresAt) <= this.now())
        ) {
          await this.provider.closeRoom(session.roomName);
          await this.store.updateSession(session.id, {
            closedAt: new Date(this.now()).toISOString(),
          });
        } else if (!session.closedAt) {
          const stale = (await this.store.capabilities(session.id)).filter(
            (capability) =>
              !keys.has(capability.policyKey) ||
              Date.parse(capability.expiresAt) <= this.now(),
          );
          if (stale.length) {
            await this.provider.revokeUsers(
              session.roomName,
              stale.map((capability) => capability.providerUserId),
            );
            await this.store.revokeCapabilities(
              stale.map((capability) => capability.providerUserId),
            );
          }
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
    const round = await this.store.round(roundId);
    await this.reconcileRound(round, false);
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
    const policy = resolvePolicy(round);
    const empty: InterviewMediaTicket = {
      sessionId: null,
      canSend: false,
      canReceive: false,
      recordingEnabled: false,
      serverNow: round.serverNow,
    };
    if (!policy) return empty;
    if (round.delivery === "in_person")
      return {
        ...empty,
        attemptId: policy.attemptId,
        recordingEnabled: actor.role === "tutor" && policy.recordingEnabled,
      };
    let session = await this.ensureSession(
      roundId,
      policy,
      round.recordingEnabled,
    );
    const expiresAt = new Date(
      Math.min(
        Date.parse(session.expiresAt),
        policy.expiresAt ? Date.parse(policy.expiresAt) : Infinity,
      ),
    ).toISOString();
    if (Date.parse(expiresAt) <= this.now()) return empty;
    if (session.closedAt)
      return {
        ...empty,
        warning:
          "This video connection has ended. Refresh the interview state.",
      };
    const provisioned = await this.store.round(roundId);
    if (resolvePolicy(provisioned)?.key !== policy.key) {
      await this.reconcile(roundId);
      return { ...empty, serverNow: provisioned.serverNow };
    }
    if (!session.url) {
      const url = await this.provider.ensureRoom(
        session.roomName,
        Math.floor(Date.parse(session.expiresAt) / 1000),
        round.recordingEnabled,
      );
      await this.store.updateSession(session.id, { url });
      session = { ...session, url };
    }
    let recordingActive = false;
    if (actor.role !== "admin" && policy.recordingEnabled) {
      await this.store.ensureRecording(session);
      recordingActive = await this.refreshRecordings(session);
      // REST acceptance is only a request. Actual status comes from provider
      // recordings; failures remain visible and retries reuse the instance ID.
      if (!session.recordingRequestedAt) {
        // The scoped token starts recording on join. Avoid six pre-join REST
        // starts: Daily permits four recording-start requests per five seconds.
        await this.store.updateSession(session.id, {
          recordingRequestedAt: new Date(this.now()).toISOString(),
        });
      } else if (
        !recordingActive &&
        knownSessionId === session.id &&
        this.now() - Date.parse(session.recordingRequestedAt) > 15_000
      ) {
        try {
          await this.provider.startRecording(
            session.roomName,
            session.id,
            (Date.parse(session.expiresAt) - this.now()) / 1000,
          );
          await this.store.updateSession(session.id, {
            recordingRequestedAt: new Date(this.now()).toISOString(),
          });
        } catch {
          await this.store.updateSession(session.id, {
            recordingRequestedAt: new Date(this.now()).toISOString(),
            recordingError:
              "Recording has not started. The interview can continue; recording will retry.",
          });
        }
      }
    }
    // Re-read before issuing a capability: a pause/end/rotation during provider
    // provisioning must not grant access to the stale phase.
    const permissions =
      actor.role === "admin"
        ? { canSend: false, canReceive: true }
        : { canSend: policy.canSend, canReceive: policy.canReceive };
    const accessKey = `${actor.role}:${policy.key}`;
    const providerUserId = await capabilityId(
      `${session.id}:${actor.id}:${accessKey}`,
    );
    // Registered before token mint: concurrent pause/end can ban even an in-flight token.
    await this.store.registerCapability({
      sessionId: session.id,
      actorId: actor.id,
      providerUserId,
      policyKey: policy.key,
      expiresAt,
    });
    const token =
      knownSessionId === session.id && knownAccessKey === accessKey
        ? undefined
        : await this.provider.token(
            session.roomName,
            providerUserId,
            actor.name,
            Math.floor(Date.parse(expiresAt) / 1000),
            permissions,
            actor.role !== "admin" &&
              policy.recordingEnabled &&
              !recordingActive
              ? session.id
              : undefined,
          );
    const current = await this.store.round(roundId);
    if (resolvePolicy(current)?.key !== policy.key) {
      await this.provider.revokeUsers(session.roomName, [providerUserId]);
      await this.store.revokeCapabilities([providerUserId]);
      await this.reconcile(roundId);
      return { ...empty, serverNow: current.serverNow };
    }
    return {
      sessionId: session.id,
      accessKey,
      url: session.url ?? undefined,
      token,
      expiresAt,
      ...permissions,
      recordingEnabled: policy.recordingEnabled,
      recordingActive,
      attemptId: policy.attemptId,
      serverNow: current.serverNow,
      warning:
        policy.recordingEnabled && !recordingActive
          ? "Recording is starting or unavailable. You can continue the interview."
          : undefined,
    };
  }

  private async ensureSession(
    roundId: string,
    policy: InterviewMediaPolicy,
    recordingEnabled: boolean,
  ): Promise<InterviewMediaSession> {
    const key = `attempt:${policy.attemptId}`;
    const hash = await digest(`${roundId}:${key}`);
    return this.store.ensureSession({
      id: crypto.randomUUID(),
      roundId,
      attemptId: policy.attemptId,
      key,
      roomName: `mmi-${hash.slice(0, 48)}`,
      url: null,
      expiresAt: new Date(this.now() + 4 * 60 * 60 * 1000).toISOString(),
      closedAt: null,
      recordingEnabled,
      recordingRequestedAt: null,
      recordingError: null,
      kind: "video",
      recordingActive: false,
    });
  }
}

export function canPlayInterviewRecording(
  recording: InterviewRecording,
  now = Date.now(),
): boolean {
  return recording.state === "ready" && Date.parse(recording.expiresAt) > now;
}
