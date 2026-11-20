import type {
  InterviewCommand,
  InterviewCommandResult,
  InterviewRound,
} from "@altitutor/shared";

type RoundCommand = Extract<
  InterviewCommand,
  { roundId: string; expectedVersion: number }
>;

/** Refresh the intent's relevant state before applying its versioned command. */
export async function submitRoundCommand(
  command: RoundCommand,
  round: InterviewRound,
  actorId: string | undefined,
  refresh: () => Promise<InterviewRound>,
  send: (command: InterviewCommand) => Promise<InterviewCommandResult>,
) {
  const stationLocal =
    round.delivery === "in_person" &&
    (command.type === "ready" || command.type === "claimStudent") &&
    !!actorId &&
    round.progress.some((item) => item.tutorId === actorId);
  const controls = (value: InterviewRound) =>
    JSON.stringify({
      phase: value.phase,
      rotation: value.rotation,
      startedAt: value.startedAt,
      pausedAt: value.pausedAt,
      progress: stationLocal
        ? value.progress.filter((item) => item.tutorId === actorId)
        : value.progress,
      ...(stationLocal
        ? {
            delivery: value.delivery,
            phaseStartedAt: value.phaseStartedAt,
            phaseDeadline: value.phaseDeadline,
          }
        : {}),
    });
  // Each peer can select a student and then mark ready. Allow both writes per
  // peer plus our own submission, with a finite limit under ongoing changes.
  const attempts = stationLocal ? 2 * (round.progress.length - 1) + 1 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const latest = await refresh();
    if (controls(latest) !== controls(round))
      throw new Error(
        "The round changed while your feedback was saving. Review its current state and try again.",
      );
    try {
      return await send({ ...command, expectedVersion: latest.version });
    } catch (error) {
      // Only a definite version rejection is safe to replay. Network failures
      // and timeouts may have committed, so never retry those automatically.
      if (
        attempt === attempts - 1 ||
        !(error instanceof Error) ||
        !("status" in error) ||
        error.status !== 409
      )
        throw error;
    }
  }
  throw new Error("Unable to save interview changes.");
}
