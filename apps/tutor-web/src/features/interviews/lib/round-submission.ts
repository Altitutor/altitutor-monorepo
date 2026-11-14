import type {
  InterviewCommand,
  InterviewCommandResult,
  InterviewRoundSetup,
} from "@altitutor/shared";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";

type Send = (command: InterviewCommand) => Promise<InterviewCommandResult>;

/** Retain an unknown outcome's exact identity and payload until recovery. */
function createSubmission<Input, Command extends InterviewCommand, Result>(
  send: Send,
  build: (input: Input) => Command,
  result: (command: Command) => Result,
) {
  let pending: Command | null = null;
  let outcomeUnknown = false;
  let flight: Promise<Result> | null = null;
  return {
    get pending() {
      return pending !== null;
    },
    submit(input: Input): Promise<Result> {
      if (flight) return flight;
      const command = (pending ??= build(input));
      flight = Promise.resolve()
        .then(() => send(command))
        .then(() => {
          pending = null;
          outcomeUnknown = false;
          return result(command);
        })
        .catch((error: unknown) => {
          // A later auth rejection cannot disprove an earlier committed write
          // whose response was lost. Keep that original request recoverable.
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

export function createRoundSubmission(send: Send) {
  return createSubmission(
    send,
    (
      setup: InterviewRoundSetup,
    ): Extract<InterviewCommand, { type: "createRound" }> => ({
      type: "createRound",
      commandId: randomUuid(),
      roundId: randomUuid(),
      setup: JSON.parse(JSON.stringify(setup)) as InterviewRoundSetup,
    }),
    (command) => ({ roundId: command.roundId, setup: command.setup }),
  );
}

export function createRoundsSubmission(send: Send) {
  return createSubmission(
    send,
    (
      setups: InterviewRoundSetup[],
    ): Extract<InterviewCommand, { type: "createRounds" }> => ({
      type: "createRounds",
      commandId: randomUuid(),
      rounds: setups.map((setup) => ({
        roundId: randomUuid(),
        setup: JSON.parse(JSON.stringify(setup)) as InterviewRoundSetup,
      })),
    }),
    (command) => ({ rounds: command.rounds }),
  );
}
