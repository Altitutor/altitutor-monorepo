import type {
  InterviewCommand,
  InterviewCommandResult,
  InterviewRoundSetup,
} from "@altitutor/shared";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";

export function createRoundSubmission(
  send: (command: InterviewCommand) => Promise<InterviewCommandResult>,
) {
  let pending: Extract<InterviewCommand, { type: "createRound" }> | null = null;
  let outcomeUnknown = false;
  let flight: Promise<{ roundId: string; setup: InterviewRoundSetup }> | null =
    null;
  return {
    get pending() {
      return pending !== null;
    },
    submit(setup: InterviewRoundSetup) {
      if (flight) return flight;
      const command = (pending ??= {
        type: "createRound",
        commandId: randomUuid(),
        roundId: randomUuid(),
        setup: JSON.parse(JSON.stringify(setup)) as InterviewRoundSetup,
      });
      flight = Promise.resolve()
        .then(() => send(command))
        .then(() => {
          pending = null;
          outcomeUnknown = false;
          return { roundId: command.roundId, setup: command.setup };
        })
        .catch((error: unknown) => {
          // A later auth/validation rejection cannot disprove an earlier
          // committed write whose response was lost.
          const rejected =
            error instanceof Error &&
            "status" in error &&
            typeof error.status === "number" &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 408;
          if (rejected && !outcomeUnknown) pending = null;
          if (!rejected) outcomeUnknown = true;
          throw error;
        })
        .finally(() => {
          flight = null;
        });
      return flight;
    },
  };
}
