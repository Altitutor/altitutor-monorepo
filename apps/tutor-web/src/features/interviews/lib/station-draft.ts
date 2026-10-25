import type { InterviewQuestion, InterviewStation } from "@altitutor/shared";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";

const emptyDocument = { type: "doc", content: [{ type: "paragraph" }] };

export function blankQuestion(stationId: string): InterviewQuestion {
  return {
    id: randomUuid(),
    stationId,
    tagIds: [],
    question: emptyDocument,
    rubric: emptyDocument,
    rubricVersion: 0,
    suggestedTimeSeconds: 120,
  };
}
export function blankStation(categoryId: string): InterviewStation {
  const id = randomUuid();
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
  const id = randomUuid();
  return {
    ...original,
    id,
    version: 0,
    name: `${original.name} (copy)`,
    archived: false,
    updatedAt: "",
    questions: original.questions.map((q) => ({
      ...q,
      id: randomUuid(),
      stationId: id,
      rubricVersion: 0,
    })),
  };
}
