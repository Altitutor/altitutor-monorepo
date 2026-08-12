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

function legacyAnswerScheme(question: QuestionItem): AnswerScheme["kind"] {
  if (question.questionType === "syllogism") {
    return "decision_making_binary_placement";
  }
  return "single_choice";
}

export function isPlacementResponse(question: {
  answerScheme?: AnswerScheme["kind"];
  questionType: string;
  responseType?: string;
}): boolean {
  const scheme =
    question.answerScheme ??
    (question.questionType === "syllogism"
      ? "decision_making_binary_placement"
      : "single_choice");
  return (
    question.responseType === "drag_and_drop" ||
    scheme === "decision_making_binary_placement" ||
    scheme === "situational_judgement_most_least"
  );
}

export function placementPresentationForQuestion(
  question: Pick<QuestionItem, "answerScheme" | "questionType" | "options">,
): Extract<PresentationContract, { kind: "placement" }> {
  const kind = question.answerScheme ?? legacyAnswerScheme(question as QuestionItem);
  const presentation = getAnswerSchemePresentation(
    kind,
    [...question.options]
      .sort((left, right) => left.index - right.index)
      .map((option) => option.id),
  );
  if (presentation.kind !== "placement") {
    throw new Error("This question does not use a placement response.");
  }
  return presentation;
}

export function legacyPlacementSnapshotToCanonical(
  question: QuestionItem,
  snapshot?: Record<string, boolean>,
): Record<string, PlacementValue> | undefined {
  if (!snapshot) return undefined;
  const [positive, negative] = placementPresentationForQuestion(question).tokens;
  if (!positive || !negative) {
    throw new Error("Placement responses require two presentation tokens.");
  }
  return Object.fromEntries(
    Object.entries(snapshot).map(([optionId, value]) => [
      optionId,
      value ? positive.value : negative.value,
    ]),
  );
}

export function canonicalPlacementSnapshotToLegacy(
  question: QuestionItem,
  snapshot: Readonly<Record<string, PlacementValue>>,
): Record<string, boolean> {
  const [positive, negative] = placementPresentationForQuestion(question).tokens;
  if (!positive || !negative) {
    throw new Error("Placement responses require two presentation tokens.");
  }
  return Object.fromEntries(
    Object.entries(snapshot).map(([optionId, value]) => {
      if (value !== positive.value && value !== negative.value) {
        throw new Error("The placement snapshot contains an unsupported token.");
      }
      return [optionId, value === positive.value];
    }),
  );
}

export function responseDefinitionForQuestion(
  question: QuestionItem,
): ResponseDefinition {
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
    responseType:
      question.responseType ??
      (kind === "single_choice" || kind === "situational_judgement_rating"
        ? "multiple_choice"
        : "drag_and_drop"),
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
  legacySelectedOptionId?: string | null,
): Extract<EvaluationResult, { ok: true }> {
  const contract = contractForQuestion(question);
  const restored = createResponseState(
    contract,
    storedAnswer ??
      snapshotQuestionResponse(
        question,
        legacySelectedOptionId ?? undefined,
        undefined,
      ),
  );
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
  syllogismSnapshot?: Record<string, boolean>,
): CandidateResponse {
  const kind = question.answerScheme ?? legacyAnswerScheme(question);
  if (kind === "single_choice" || kind === "situational_judgement_rating") {
    return { kind: "single_select", selectedOptionId: selectedOptionId ?? null };
  }
  return {
    kind: "placement",
    placements:
      legacyPlacementSnapshotToCanonical(question, syllogismSnapshot) ?? {},
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

export function buildPersistedQuestionResponse(
  question: QuestionItem,
  selectedOptionId?: string,
  syllogismSnapshot?: Record<string, boolean>,
): {
  questionAnswerOptionId: string | null;
  answerSnapshot: ResponseSnapshotV1;
} {
  const answerSnapshot = snapshotQuestionResponse(
    question,
    selectedOptionId,
    syllogismSnapshot,
  );
  return {
    questionAnswerOptionId:
      answerSnapshot.response.kind === "single_select"
        ? answerSnapshot.response.selectedOptionId
        : null,
    answerSnapshot,
  };
}

export function parseBinaryPlacementResponseSnapshot(
  storedAnswer: unknown,
  expectedQuestionId: string,
): Record<string, boolean> | null {
  if (storedAnswer === null || storedAnswer === undefined) return null;
  if (typeof storedAnswer !== "object" || Array.isArray(storedAnswer)) {
    throw new Error("The stored answer is not a supported response snapshot.");
  }
  const snapshot = storedAnswer as Record<string, unknown>;
  if (snapshot.type === "syllogism_v1") {
    if (!Array.isArray(snapshot.answers)) {
      throw new Error("The legacy DM snapshot is malformed.");
    }
    const answers: Record<string, boolean> = {};
    for (const value of snapshot.answers) {
      if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
      ) {
        throw new Error("The legacy DM snapshot is malformed.");
      }
      const row = value as Record<string, unknown>;
      if (
        typeof row.question_answer_option_id !== "string" ||
        typeof row.answer !== "boolean" ||
        row.question_answer_option_id in answers
      ) {
        throw new Error("The legacy DM snapshot is malformed.");
      }
      answers[row.question_answer_option_id] = row.answer;
    }
    return answers;
  }
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
      return [optionId, token === "yes"];
    }),
  );
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
  return {
    selectedOptionId: null,
    syllogismSnapshot: canonicalPlacementSnapshotToLegacy(
      question,
      result.state.placements,
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
