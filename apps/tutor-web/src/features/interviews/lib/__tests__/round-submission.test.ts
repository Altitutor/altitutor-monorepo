import { createRoundSubmission } from "../round-submission";
import type { InterviewCommand, InterviewRoundSetup } from "@altitutor/shared";

test("retrying a lost creation response replays the original round, command and details", async () => {
  const send = jest
    .fn()
    .mockRejectedValueOnce(new Error("Response lost"))
    .mockResolvedValue({ id: "round", version: 1 });
  const { submit } = createRoundSubmission(send);
  const setup = { name: "Original", scheduledAt: null } as InterviewRoundSetup;
  await expect(submit(setup)).rejects.toThrow("Response lost");
  const result = await submit({ ...setup, name: "Edited after timeout" });
  expect(send.mock.calls[1][0]).toEqual(send.mock.calls[0][0]);
  expect(result.roundId).toBe(
    (
      send.mock.calls[0][0] as Extract<
        InterviewCommand,
        { type: "createRound" }
      >
    ).roundId,
  );
  expect(result.setup.name).toBe("Original");
});

test("a definite rejection permits corrected details in a new submission", async () => {
  const send = jest
    .fn()
    .mockRejectedValueOnce(
      Object.assign(new Error("Invalid setup"), { status: 400 }),
    )
    .mockResolvedValue({ id: "round", version: 1 });
  const submission = createRoundSubmission(send);
  const setup = { name: "Original", scheduledAt: null } as InterviewRoundSetup;
  await expect(submission.submit(setup)).rejects.toThrow("Invalid setup");
  expect(submission.pending).toBe(false);
  await submission.submit({ ...setup, name: "Corrected" });
  expect(send.mock.calls[1][0].commandId).not.toBe(
    send.mock.calls[0][0].commandId,
  );
  expect(send.mock.calls[1][0].setup.name).toBe("Corrected");
});

test("an auth failure after a lost response cannot discard the possibly committed identity", async () => {
  const send = jest
    .fn()
    .mockRejectedValueOnce(new Error("Response lost"))
    .mockRejectedValueOnce(
      Object.assign(new Error("Sign in again"), { status: 401 }),
    )
    .mockResolvedValue({ id: "round", version: 1 });
  const submission = createRoundSubmission(send);
  const setup = { name: "Original", scheduledAt: null } as InterviewRoundSetup;
  await expect(submission.submit(setup)).rejects.toThrow("Response lost");
  await expect(submission.submit(setup)).rejects.toThrow("Sign in again");
  expect(submission.pending).toBe(true);
  await submission.submit({ ...setup, name: "Changed" });
  expect(send.mock.calls[2][0]).toEqual(send.mock.calls[0][0]);
});

test("bulk retry recovers the same complete series after a lost response", async () => {
  const { createRoundsSubmission } = await import("../round-submission");
  const accepted: InterviewCommand[] = [];
  const send = async (command: InterviewCommand) => {
    accepted.push(command);
    if (accepted.length === 1) throw new Error("Response lost");
    return { id: "series", version: 1 };
  };
  const submission = createRoundsSubmission(send);
  const setups = [
    { name: "Round 1", scheduledAt: "2026-11-14T03:30:00Z" },
    { name: "Round 2", scheduledAt: "2026-11-14T03:46:00Z" },
  ] as InterviewRoundSetup[];
  await expect(submission.submit(setups)).rejects.toThrow("Response lost");
  const recovered = await submission.submit([
    { ...setups[0], name: "Changed" },
  ]);
  expect(accepted[1]).toEqual(accepted[0]);
  expect(recovered.rounds.map((round) => round.setup.name)).toEqual([
    "Round 1",
    "Round 2",
  ]);
});
