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
