import {
  compileResponseContract,
  createResponseState,
  evaluateResponse,
  getAnswerSchemePresentation,
  type AnswerScheme,
  type CandidateResponse,
  type EvaluationResult,
  type PlacementValue,
  type PresentationContract,
  type ResponseDefinition,
  type ResponseSnapshotV1,
} from "@altitutor/ucat-response-contract";
import type { QuestionItem } from "@/features/question-engine/model/types";

export function isPlacementResponse(question: {
  responseType: string;
}): boolean {
  return question.responseType === "drag_and_drop";
}

export function placementPresentationForQuestion(
  question: Pick<QuestionItem, "answerScheme" | "options">,
): Extract<PresentationContract, { kind: "placement" }> {
  const presentation = getAnswerSchemePresentation(
    question.answerScheme,
    [...question.options]
      .sort((left, right) => left.index - right.index)
      .map((option) => option.id),
  );
  if (presentation.kind !== "placement") {
    throw new Error("This question does not use a placement response.");
  }
  return presentation;
}

export function responseDefinitionForQuestion(
  question: QuestionItem,
): ResponseDefinition {
  const kind = question.answerScheme;
  const correctOptionId =
    question.options.find((option) => option.answerKeyValue === "correct")?.id ??
    question.correctOptionId ??
    "";
  let answerScheme: AnswerScheme;

  switch (kind) {
    case "decision_making_binary_placement":
      answerScheme = {
        kind,
        correctByOptionId: Object.fromEntries(
          question.options.map((option) => [
            option.id,
            option.answerKeyValue === "yes" ? "yes" : "no",
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

  const sortedOptions = [...question.options].sort(
    (left, right) => left.index - right.index,
  );
  const isZeroBased = sortedOptions.every((option, position) => option.index === position);
  const isOneBased = sortedOptions.every((option, position) => option.index === position + 1);
  if (!isZeroBased && !isOneBased) {
    throw new Error("Option indexes must be contiguous from zero or one.");
  }

  return {
    questionId: question.id,
    responseType: question.responseType,
    answerScheme,
    options: sortedOptions
      .map((option, contractIndex) => ({
        id: option.id,
        index: contractIndex,
      })),
  };
}

function contractForQuestion(question: QuestionItem) {
  const result = compileResponseContract(responseDefinitionForQuestion(question));
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join(" "));
  }
  return result.contract;
}

export function evaluatePersistedQuestionResponse(
  question: QuestionItem,
  storedAnswer: unknown,
): Extract<EvaluationResult, { ok: true }> {
  const contract = contractForQuestion(question);
  const restored = createResponseState(contract, storedAnswer);
  if (!restored.ok) {
    throw new Error(restored.issues.map((issue) => issue.message).join(" "));
  }
  const evaluation = evaluateResponse(contract, restored.state);
  if (!evaluation.ok) {
    throw new Error(evaluation.issues.map((issue) => issue.message).join(" "));
  }
  return evaluation;
}

export function getQuestionMaximumMarks(question: QuestionItem): number {
  const contract = contractForQuestion(question);
  const blank =
    contract.presentation.kind === "single_select"
      ? ({ kind: "single_select", selectedOptionId: null } as const)
      : ({ kind: "placement", placements: {} } as const);
  const evaluation = evaluateResponse(contract, blank);
  if (!evaluation.ok) {
    throw new Error(evaluation.issues.map((issue) => issue.message).join(" "));
  }
  return evaluation.score.maximum;
}

function candidateResponse(
  question: QuestionItem,
  selectedOptionId?: string,
  placementSnapshot?: Record<string, PlacementValue>,
): CandidateResponse {
  const kind = question.answerScheme;
  if (kind === "single_choice" || kind === "situational_judgement_rating") {
    return { kind: "single_select", selectedOptionId: selectedOptionId ?? null };
  }
  return {
    kind: "placement",
    placements: placementSnapshot ?? {},
  };
}

export function snapshotQuestionResponse(
  question: QuestionItem,
  selectedOptionId?: string,
  placementSnapshot?: Record<string, PlacementValue>,
): ResponseSnapshotV1 {
  const result = evaluateResponse(
    contractForQuestion(question),
    candidateResponse(question, selectedOptionId, placementSnapshot),
  );
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join(" "));
  }
  return result.snapshot;
}

export function buildPersistedQuestionResponse(
  question: QuestionItem,
  selectedOptionId?: string,
  placementSnapshot?: Record<string, PlacementValue>,
): {
  answerSnapshot: ResponseSnapshotV1;
} {
  const answerSnapshot = snapshotQuestionResponse(
    question,
    selectedOptionId,
    placementSnapshot,
  );
  return {
    answerSnapshot,
  };
}

export function parseBinaryPlacementResponseSnapshot(
  storedAnswer: unknown,
  expectedQuestionId: string,
): Record<string, PlacementValue> | null {
  if (storedAnswer === null || storedAnswer === undefined) return null;
  if (typeof storedAnswer !== "object" || Array.isArray(storedAnswer)) {
    throw new Error("The stored answer is not a supported response snapshot.");
  }
  const snapshot = storedAnswer as Record<string, unknown>;
  if (
    snapshot.type !== "ucat_response_v1" ||
    snapshot.questionId !== expectedQuestionId ||
    snapshot.answerScheme !== "decision_making_binary_placement"
  ) {
    throw new Error("The stored DM answer does not match this question.");
  }
  const response = snapshot.response;
  if (
    typeof response !== "object" ||
    response === null ||
    Array.isArray(response) ||
    (response as Record<string, unknown>).kind !== "placement"
  ) {
    throw new Error("The stored DM response is malformed.");
  }
  const placements = (response as Record<string, unknown>).placements;
  if (
    typeof placements !== "object" ||
    placements === null ||
    Array.isArray(placements)
  ) {
    throw new Error("The stored DM response is malformed.");
  }
  return Object.fromEntries(
    Object.entries(placements).map(([optionId, token]) => {
      if (token !== "yes" && token !== "no") {
        throw new Error("The stored DM response contains an unknown token.");
      }
      return [optionId, token];
    }),
  );
}

export function restoreQuestionResponse(
  question: QuestionItem,
  storedAnswer: unknown,
): {
  selectedOptionId: string | null;
  placementSnapshot: Record<string, PlacementValue> | null;
} {
  const result = createResponseState(contractForQuestion(question), storedAnswer);
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join(" "));
  }
  if (result.state.kind === "single_select") {
    return {
      selectedOptionId: result.state.selectedOptionId,
      placementSnapshot: null,
    };
  }
  return {
    selectedOptionId: null,
    placementSnapshot: result.state.placements,
  };
}

export function restorePersistedQuestionResponse(
  question: QuestionItem,
  storedAnswer: unknown,
): ReturnType<typeof restoreQuestionResponse> {
  return restoreQuestionResponse(question, storedAnswer);
}

export function canonicalizeEngineResponses(
  questions: readonly QuestionItem[],
  state: {
    responseSnapshots?: Record<string, ResponseSnapshotV1>;
    selectedAnswers?: Record<string, string>;
    placementSnapshots?: Record<string, Record<string, PlacementValue>>;
  },
): {
  responseSnapshots: Record<string, ResponseSnapshotV1>;
  selectedAnswers: Record<string, string>;
  placementSnapshots: Record<string, Record<string, PlacementValue>>;
} {
  const responseSnapshots: Record<string, ResponseSnapshotV1> = {};
  const selectedAnswers: Record<string, string> = {};
  const placementSnapshots: Record<string, Record<string, PlacementValue>> = {};

  for (const question of questions) {
    const stored = state.responseSnapshots?.[question.id];
    const snapshot =
      stored ??
      snapshotQuestionResponse(
        question,
        state.selectedAnswers?.[question.id],
        state.placementSnapshots?.[question.id],
      );
    const restored = restoreQuestionResponse(question, snapshot);
    responseSnapshots[question.id] = snapshot;
    if (restored.selectedOptionId) {
      selectedAnswers[question.id] = restored.selectedOptionId;
    }
    if (restored.placementSnapshot) {
      placementSnapshots[question.id] = restored.placementSnapshot;
    }
  }

  return { responseSnapshots, selectedAnswers, placementSnapshots };
}
