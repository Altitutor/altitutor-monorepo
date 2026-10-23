import type { InterviewQuestion, InterviewStation } from "@altitutor/shared";

const emptyDocument = { type: "doc", content: [{ type: "paragraph" }] };

export function blankQuestion(stationId: string): InterviewQuestion {
  return {
    id: crypto.randomUUID(),
    stationId,
    tagIds: [],
    question: emptyDocument,
    rubric: emptyDocument,
    rubricVersion: 0,
    suggestedTimeSeconds: 60,
  };
}
export function blankStation(categoryId: string): InterviewStation {
  const id = crypto.randomUUID();
  return {
    id,
    version: 0,
    name: "",
    categoryId,
    prompt: emptyDocument,
    maximumPoints: 6,
    questions: [blankQuestion(id)],
    archived: false,
    updatedAt: "",
  };
}
export function duplicateStation(original: InterviewStation): InterviewStation {
  const id = crypto.randomUUID();
  return {
    ...original,
    id,
    version: 0,
    name: `${original.name} (copy)`,
    archived: false,
    updatedAt: "",
    questions: original.questions.map((q) => ({
      ...q,
      id: crypto.randomUUID(),
      stationId: id,
      rubricVersion: 0,
    })),
  };
}
