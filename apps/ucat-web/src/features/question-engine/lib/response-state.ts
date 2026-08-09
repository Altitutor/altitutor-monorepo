import {
  compileResponseContract,
  createResponseState,
  evaluateResponse,
  type AnswerScheme,
  type CandidateResponse,
  type ResponseDefinition,
  type ResponseSnapshotV1,
} from "@altitutor/ucat-response-contract";
import type { QuestionItem } from "@/features/question-engine/model/types";

function legacyAnswerScheme(question: QuestionItem): AnswerScheme["kind"] {
  if (question.questionType === "syllogism") {
    return "decision_making_binary_placement";
  }
  return "single_choice";
}

function definitionForQuestion(question: QuestionItem): ResponseDefinition {
  const kind = question.answerScheme ?? legacyAnswerScheme(question);
  const correctOptionId =
    question.options.find((option) => option.answerKeyValue === "correct")?.id ??
    question.correctOptionId ??
    question.options.find((option) => option.isAnswer)?.id ??
    "";
  let answerScheme: AnswerScheme;

  switch (kind) {
    case "decision_making_binary_placement":
      answerScheme = {
        kind,
        correctByOptionId: Object.fromEntries(
          question.options.map((option) => [
            option.id,
            option.answerKeyValue
              ? option.answerKeyValue === "yes"
                ? "yes"
                : "no"
              : option.isAnswer
                ? "yes"
                : "no",
          ]),
        ),
      };
      break;
    case "situational_judgement_most_least":
      answerScheme = {
        kind,
        mostAppropriateOptionId:
          question.options.find((option) => option.answerKeyValue === "most")
            ?.id ?? "",
        leastAppropriateOptionId:
          question.options.find((option) => option.answerKeyValue === "least")
            ?.id ?? "",
      };
      break;
    case "situational_judgement_rating":
      answerScheme = { kind, correctOptionId };
      break;
    case "single_choice":
      answerScheme = { kind, correctOptionId };
      break;
  }

  return {
    questionId: question.id,
    responseType:
      question.responseType ??
      (kind === "single_choice" || kind === "situational_judgement_rating"
        ? "multiple_choice"
        : "drag_and_drop"),
    answerScheme,
    options: question.options.map((option) => ({
      id: option.id,
      index: option.index,
    })),
  };
}

function contractForQuestion(question: QuestionItem) {
  const result = compileResponseContract(definitionForQuestion(question));
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join(" "));
  }
  return result.contract;
}

function candidateResponse(
  question: QuestionItem,
  selectedOptionId?: string,
  syllogismSnapshot?: Record<string, boolean>,
): CandidateResponse {
  const kind = question.answerScheme ?? legacyAnswerScheme(question);
  if (kind === "single_choice" || kind === "situational_judgement_rating") {
    return { kind: "single_select", selectedOptionId: selectedOptionId ?? null };
  }
  return {
    kind: "placement",
    placements: Object.fromEntries(
      Object.entries(syllogismSnapshot ?? {}).map(([optionId, answer]) => [
        optionId,
        answer ? "yes" : "no",
      ]),
    ),
  };
}

export function snapshotQuestionResponse(
  question: QuestionItem,
  selectedOptionId?: string,
  syllogismSnapshot?: Record<string, boolean>,
): ResponseSnapshotV1 {
  const result = evaluateResponse(
    contractForQuestion(question),
    candidateResponse(question, selectedOptionId, syllogismSnapshot),
  );
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join(" "));
  }
  return result.snapshot;
}

export function restoreQuestionResponse(
  question: QuestionItem,
  storedAnswer: unknown,
): {
  selectedOptionId: string | null;
  syllogismSnapshot: Record<string, boolean> | null;
} {
  const result = createResponseState(contractForQuestion(question), storedAnswer);
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join(" "));
  }
  if (result.state.kind === "single_select") {
    return {
      selectedOptionId: result.state.selectedOptionId,
      syllogismSnapshot: null,
    };
  }
  const placements = Object.entries(result.state.placements);
  if (placements.some(([, token]) => token !== "yes" && token !== "no")) {
    throw new Error("This placement response is not supported by the current engine.");
  }
  return {
    selectedOptionId: null,
    syllogismSnapshot: Object.fromEntries(
      placements.map(([optionId, token]) => [optionId, token === "yes"]),
    ),
  };
}

/** Compatibility read boundary; callers always receive canonical validated state. */
export function restorePersistedQuestionResponse(
  question: QuestionItem,
  storedAnswer: unknown,
  legacySelectedOptionId?: string | null,
): ReturnType<typeof restoreQuestionResponse> {
  if (storedAnswer !== null && storedAnswer !== undefined) {
    return restoreQuestionResponse(question, storedAnswer);
  }
  return restoreQuestionResponse(
    question,
    snapshotQuestionResponse(
      question,
      legacySelectedOptionId ?? undefined,
      undefined,
    ),
  );
}

export function canonicalizeEngineResponses(
  questions: readonly QuestionItem[],
  state: {
    responseSnapshots?: Record<string, ResponseSnapshotV1>;
    selectedAnswers?: Record<string, string>;
    syllogismSnapshots?: Record<string, Record<string, boolean>>;
  },
): {
  responseSnapshots: Record<string, ResponseSnapshotV1>;
  selectedAnswers: Record<string, string>;
  syllogismSnapshots: Record<string, Record<string, boolean>>;
} {
  const responseSnapshots: Record<string, ResponseSnapshotV1> = {};
  const selectedAnswers: Record<string, string> = {};
  const syllogismSnapshots: Record<string, Record<string, boolean>> = {};

  for (const question of questions) {
    const stored = state.responseSnapshots?.[question.id];
    const snapshot =
      stored ??
      snapshotQuestionResponse(
        question,
        state.selectedAnswers?.[question.id],
        state.syllogismSnapshots?.[question.id],
      );
    const restored = restoreQuestionResponse(question, snapshot);
    responseSnapshots[question.id] = snapshot;
    if (restored.selectedOptionId) {
      selectedAnswers[question.id] = restored.selectedOptionId;
    }
    if (restored.syllogismSnapshot) {
      syllogismSnapshots[question.id] = restored.syllogismSnapshot;
    }
  }

  return { responseSnapshots, selectedAnswers, syllogismSnapshots };
}
