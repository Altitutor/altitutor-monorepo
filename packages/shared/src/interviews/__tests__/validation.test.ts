import { isInterviewCommand } from "../validation";

const stationId = "e8000000-0000-4000-8000-000000000100";
const question = {
  id: "e8000000-0000-4000-8000-000000000101",
  stationId,
  tagIds: ["e8000000-0000-4000-8000-000000000102"],
  question: "What caused the misunderstanding?",
  rubric: "Discuss communication",
  suggestedTimeSeconds: 90,
};
const command = {
  type: "saveStation",
  commandId: "e8000000-0000-4000-8000-000000000103",
  expectedVersion: 0,
  station: {
    id: stationId,
    name: "Communication",
    categoryId: "e8000000-0000-4000-8000-000000000104",
    prompt: "A patient misunderstood their follow-up instructions.",
    maximumPoints: 6.5,
    archived: false,
    questions: [question],
  },
};

test("a station saves its prompt, category and linked questions with their tags", () => {
  expect(isInterviewCommand(command)).toBe(true);
});

test("questions cannot be saved independently", () => {
  expect(
    isInterviewCommand({
      ...command,
      type: "saveQuestion",
      question: {
        ...question,
        categoryId: command.station.categoryId,
        prompt: command.station.prompt,
        archived: false,
      },
    }),
  ).toBe(false);
});

test("a station cannot contain another station's question or repeat a child identity", () => {
  expect(
    isInterviewCommand({
      ...command,
      station: {
        ...command.station,
        questions: [{ ...question, stationId: question.id }],
      },
    }),
  ).toBe(false);
  expect(
    isInterviewCommand({
      ...command,
      station: {
        ...command.station,
        questions: [question, question],
      },
    }),
  ).toBe(false);
  expect(
    isInterviewCommand({
      ...command,
      station: {
        ...command.station,
        questions: [],
      },
    }),
  ).toBe(false);
});

test("station feedback uses the bounded rich-text command boundary", () => {
  const assessment = {
    type: "saveAttempt",
    commandId: command.commandId,
    roundId: stationId,
    attemptId: question.id,
    expectedAttemptVersion: 1,
    score: null,
    notAssessedReason: null,
    feedback: [],
  };
  expect(isInterviewCommand(assessment)).toBe(true);
  expect(isInterviewCommand({ ...assessment, generalFeedback: null })).toBe(
    true,
  );
  expect(
    isInterviewCommand({
      ...assessment,
      generalFeedback: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Clear communication" }],
          },
        ],
      },
    }),
  ).toBe(true);
  expect(
    isInterviewCommand({ ...assessment, generalFeedback: "x".repeat(100_001) }),
  ).toBe(false);
  expect(
    isInterviewCommand({ ...assessment, generalFeedback: () => "unsafe" }),
  ).toBe(false);
});


test('question selection is a bounded command independent of assessment saves', () => {
 const selection={type:'selectQuestion',commandId:command.commandId,roundId:stationId,attemptId:question.id,questionId:question.id};
 expect(isInterviewCommand(selection)).toBe(true);
 expect(isInterviewCommand({...selection,questionId:'unknown'})).toBe(false);
});

const roundSetup = {
  interviewId: command.station.categoryId,
  name: "Afternoon circuit",
  delivery: "in_person",
  mode: "feedback",
  recordingEnabled: true,
  scheduledAt: "2026-11-14T03:30:00.000Z",
  rotationAllowanceSeconds: 120,
  studentIds: ["10000000-0000-0000-0000-000000000001"],
  assignments: [{ stationId, tutorId: "00000000-0000-0000-0000-000000000010" }],
};

test("bulk creation validates a bounded, distinct set of rounds and students", () => {
  const bulk = {
    type: "createRounds",
    commandId: command.commandId,
    rounds: [
      { roundId: question.id, setup: roundSetup },
      { roundId: stationId, setup: { ...roundSetup, studentIds: ["10000000-0000-0000-0000-000000000002"] } },
    ],
  };
  expect(isInterviewCommand(bulk)).toBe(true);
  expect(isInterviewCommand({ ...bulk, rounds: [] })).toBe(false);
  expect(isInterviewCommand({ ...bulk, rounds: [bulk.rounds[0], bulk.rounds[0]] })).toBe(false);
  expect(isInterviewCommand({ ...bulk, rounds: [bulk.rounds[0], { ...bulk.rounds[1], setup: roundSetup }] })).toBe(false);
});

test("round commands bound scheduling allowance without changing legacy payloads", () => {
  const create = { type: "createRound", commandId: command.commandId, roundId: question.id, setup: roundSetup };
  expect(isInterviewCommand({ ...create, setup: { ...roundSetup, rotationAllowanceSeconds: undefined } })).toBe(true);
  expect(isInterviewCommand({ ...create, setup: { ...roundSetup, rotationAllowanceSeconds: 0 } })).toBe(true);
  for (const allowance of [-1, 0.5, 7201, null, "120"]) {
    expect(isInterviewCommand({ ...create, setup: { ...roundSetup, rotationAllowanceSeconds: allowance } })).toBe(false);
  }
  expect(isInterviewCommand({ type: "skipQuestions", commandId: command.commandId, roundId: stationId, expectedVersion: 3 })).toBe(true);
  expect(isInterviewCommand({ type: "skipQuestions", commandId: command.commandId, roundId: stationId })).toBe(false);
});

test("bulk identities compare UUID values regardless of hex letter casing", () => {
  const bulk = {
    type: "createRounds",
    commandId: command.commandId,
    rounds: [
      { roundId: question.id, setup: roundSetup },
      { roundId: question.id.toUpperCase(), setup: { ...roundSetup, studentIds: ["10000000-0000-0000-0000-000000000002"] } },
    ],
  };
  expect(isInterviewCommand(bulk)).toBe(false);
  expect(isInterviewCommand({
    ...bulk,
    rounds: [
      { roundId: question.id, setup: { ...roundSetup, studentIds: ["a0000000-0000-4000-8000-000000000001"] } },
      { roundId: stationId, setup: { ...roundSetup, studentIds: ["A0000000-0000-4000-8000-000000000001"] } },
    ],
  })).toBe(false);
});
