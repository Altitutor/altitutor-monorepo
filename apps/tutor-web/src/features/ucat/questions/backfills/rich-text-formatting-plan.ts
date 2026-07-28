import type { Json } from "@altitutor/shared";
import { getSchema } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { Mathematics } from "@tiptap/extension-mathematics";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import type { QuestionStemOperation } from "@/features/ucat/mcp/server/schemas";
import {
  backfillRichTextFormatting,
  extractedSemanticTextAfterBackfill,
  extractedSemanticTextBeforeBackfill,
  literalFormattingLeaks,
  type RichTextBackfillIssue,
  type RichTextBackfillStats,
} from "./rich-text-formatting";

type JsonRecord = Record<string, Json | undefined>;

type FieldChange = {
  path: string;
  before: Json;
  after: Json;
  stats: RichTextBackfillStats;
  reviewedSemanticCorrection?: {
    before: string;
    after: string;
  };
};

export type StemBackfillPlan = {
  operations: QuestionStemOperation[];
  fieldChanges: FieldChange[];
  issues: RichTextBackfillIssue[];
  reviewedCorrections: string[];
};

const richTextSchema = getSchema([
  StarterKit,
  Mathematics,
  TableKit,
  Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        fileId: { default: null },
        storageBucket: { default: null },
        storagePath: { default: null },
        visualType: { default: null },
        visualSpec: { default: null },
        visualTitle: { default: null },
        visualDescription: { default: null },
      };
    },
  }),
]);

const REVIEWED_SUBSCRIPT_REPAIR = {
  stemId: "30134c9b-fd68-409c-b3f3-ff818ca6dccb",
  questionId: "43b03d90-f139-4c82-aafd-a1ac4876d330",
  revision:
    "eyJpZCI6IjMwMTM0YzliLWZkNjgtNDA5Yy1iM2YzLWZmODE4Y2E2ZGNjYiIsInVwZGF0ZWRBdCI6IjIwMjYtMDctMjdUMTM6MTY6NDAuNTY5NzU4KzAwOjAwIn0",
  incorrectLatex:
    "P{\\text{new}}=A(1.25v)^3=1.25^3Av^3=1.953125P{\\text{old}}.",
  correctedLatex:
    "P_{\\text{new}}=A(1.25v)^3=1.25^3Av^3=1.953125P_{\\text{old}}.",
  beforeSemantic:
    "A 25% increase makes the new velocity 1.25v. Substitute this into the formula: P{\\text{new}}=A(1.25v)^3=1.25^3Av^3=1.953125P{\\text{old}}. The new power is about 1.95 times the old power, so the increase is (1.953125-1)\\times100\\%\\approx95\\%.",
  afterSemantic:
    "A 25% increase makes the new velocity 1.25v. Substitute this into the formula: P_{\\text{new}}=A(1.25v)^3=1.25^3Av^3=1.953125P_{\\text{old}}. The new power is about 1.95 times the old power, so the increase is (1.953125-1)\\times100\\%\\approx95\\%.",
} as const;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asJson(value: unknown): Json | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    Array.isArray(value) ||
    isRecord(value)
  ) {
    return value as Json;
  }
  return null;
}

export function validateTipTapDocument(value: Json): string | null {
  try {
    const node = richTextSchema.nodeFromJSON(value);
    node.check();
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Unknown TipTap schema error";
  }
}

function validateFieldChange(change: FieldChange): RichTextBackfillIssue[] {
  const issues: RichTextBackfillIssue[] = [];
  const beforeText = extractedSemanticTextBeforeBackfill(change.before);
  const afterText = extractedSemanticTextAfterBackfill(change.after);
  const reviewedCorrectionMatches =
    change.reviewedSemanticCorrection?.before === beforeText &&
    change.reviewedSemanticCorrection.after === afterText;
  if (beforeText !== afterText && !reviewedCorrectionMatches) {
    issues.push({
      code: "invalid_rich_text",
      path: change.path,
      message: `Semantic text changed (${JSON.stringify(beforeText)} -> ${JSON.stringify(afterText)}).`,
    });
  }
  const leaks = literalFormattingLeaks(change.after);
  if (leaks.length > 0) {
    issues.push({
      code: "invalid_rich_text",
      path: change.path,
      message: `Formatting delimiters remain after transformation: ${leaks.join(", ")}.`,
    });
  }
  const schemaError = validateTipTapDocument(change.after);
  if (schemaError) {
    issues.push({
      code: "invalid_rich_text",
      path: change.path,
      message: `TipTap schema validation failed: ${schemaError}`,
    });
  }
  return issues;
}

function replaceExactBlockMathLatex(
  value: Json,
  before: string,
  after: string,
): { value: Json; replacements: number } {
  if (Array.isArray(value)) {
    let replacements = 0;
    const next = value.map((child) => {
      const result = replaceExactBlockMathLatex(child, before, after);
      replacements += result.replacements;
      return result.value;
    });
    return { value: replacements > 0 ? next : value, replacements };
  }
  if (!isRecord(value)) return { value, replacements: 0 };
  if (
    value.type === "blockMath" &&
    isRecord(value.attrs) &&
    value.attrs.latex === before
  ) {
    return {
      value: {
        ...value,
        attrs: { ...value.attrs, latex: after },
      },
      replacements: 1,
    };
  }
  if (!Array.isArray(value.content)) return { value, replacements: 0 };
  const result = replaceExactBlockMathLatex(value.content, before, after);
  return result.replacements > 0
    ? {
        value: { ...value, content: result.value },
        replacements: result.replacements,
      }
    : { value, replacements: 0 };
}

function applyReviewedAnswerExplanationRepair(
  aggregate: Record<string, unknown>,
  questionId: string,
  path: string,
  value: Json | null | undefined,
  fieldChanges: FieldChange[],
): Json | null | undefined {
  if (
    aggregate.id !== REVIEWED_SUBSCRIPT_REPAIR.stemId ||
    aggregate.revision !== REVIEWED_SUBSCRIPT_REPAIR.revision ||
    questionId !== REVIEWED_SUBSCRIPT_REPAIR.questionId ||
    value === null ||
    value === undefined
  ) {
    return value;
  }
  const result = replaceExactBlockMathLatex(
    value,
    REVIEWED_SUBSCRIPT_REPAIR.incorrectLatex,
    REVIEWED_SUBSCRIPT_REPAIR.correctedLatex,
  );
  const change = fieldChanges.find((candidate) => candidate.path === path);
  if (result.replacements !== 1 || !change) return value;
  const beforeText = extractedSemanticTextBeforeBackfill(change.before);
  const afterText = extractedSemanticTextAfterBackfill(result.value);
  if (
    beforeText !== REVIEWED_SUBSCRIPT_REPAIR.beforeSemantic ||
    afterText !== REVIEWED_SUBSCRIPT_REPAIR.afterSemantic
  ) {
    return value;
  }
  change.after = result.value;
  change.reviewedSemanticCorrection = {
    before: REVIEWED_SUBSCRIPT_REPAIR.beforeSemantic,
    after: REVIEWED_SUBSCRIPT_REPAIR.afterSemantic,
  };
  return result.value;
}

function transformField(
  value: unknown,
  path: string,
  changes: FieldChange[],
  issues: RichTextBackfillIssue[],
): Json | null | undefined {
  if (value === null) return null;
  const json = asJson(value);
  if (json === null) {
    issues.push({
      code: "invalid_rich_text",
      path,
      message: "Rich-text field is not JSON.",
    });
    return undefined;
  }
  const result = backfillRichTextFormatting(json, path);
  issues.push(...result.issues);
  if (result.changed) {
    changes.push({
      path,
      before: json,
      after: result.value,
      stats: result.stats,
    });
  }
  return result.value;
}

function stringId(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function referencedFileIds(
  value: unknown,
  output = new Set<string>(),
): string[] {
  if (Array.isArray(value)) {
    value.forEach((item) => referencedFileIds(item, output));
  } else if (isRecord(value)) {
    Object.entries(value).forEach(([key, child]) => {
      if (
        (key === "fileId" || key === "file_id") &&
        typeof child === "string" &&
        child
      ) {
        output.add(child);
      } else {
        referencedFileIds(child, output);
      }
    });
  }
  return [...output].sort();
}

type StemShape = {
  questionIds: string[];
  optionIds: string[][];
  correctAnswers: Array<{ id: string; isAnswer: boolean }>;
  referencedFileIds: string[];
};

function stemShape(value: Record<string, unknown>): StemShape {
  const questions = Array.isArray(value.questions)
    ? value.questions.filter(isRecord)
    : [];
  return {
    questionIds: questions.map((question) => stringId(question.id) ?? ""),
    optionIds: questions.map((question) =>
      Array.isArray(question.answer_options)
        ? question.answer_options
            .filter(isRecord)
            .map((option) => stringId(option.id) ?? "")
        : [],
    ),
    correctAnswers: questions.flatMap((question) =>
      Array.isArray(question.answer_options)
        ? question.answer_options.filter(isRecord).map((option) => ({
            id: stringId(option.id) ?? "",
            isAnswer: option.is_answer === true,
          }))
        : [],
    ),
    referencedFileIds: referencedFileIds(value),
  };
}

function invariantIssues(
  before: Record<string, unknown>,
  operations: QuestionStemOperation[],
): RichTextBackfillIssue[] {
  const after = JSON.parse(JSON.stringify(before)) as Record<string, unknown>;
  for (const operation of operations) {
    if (operation.type === "set_metadata" && operation.stemText !== undefined) {
      after.stem_text = operation.stemText as Json;
      continue;
    }
    if (operation.type !== "update_question") continue;
    const questions = Array.isArray(after.questions)
      ? after.questions.filter(isRecord)
      : [];
    const question = questions.find((item) => item.id === operation.questionId);
    if (!question) continue;
    if (operation.changes.questionText !== undefined) {
      question.question_text = operation.changes.questionText as Json;
    }
    if (operation.changes.answerExplanation !== undefined) {
      question.answer_explanation = operation.changes.answerExplanation as Json;
    }
    continue;
  }
  for (const operation of operations) {
    if (operation.type !== "update_answer_option") continue;
    const questions = Array.isArray(after.questions)
      ? after.questions.filter(isRecord)
      : [];
    const question = questions.find((item) => item.id === operation.questionId);
    const options =
      question && Array.isArray(question.answer_options)
        ? question.answer_options.filter(isRecord)
        : [];
    const option = options.find((item) => item.id === operation.optionId);
    if (!option) continue;
    if (operation.changes.answerText !== undefined) {
      option.answer_text = operation.changes.answerText as Json;
    }
    if (operation.changes.answerExplanation !== undefined) {
      option.answer_explanation = operation.changes.answerExplanation as Json;
    }
  }

  const beforeShape = stemShape(before);
  const afterShape = stemShape(after);
  return JSON.stringify(beforeShape) === JSON.stringify(afterShape)
    ? []
    : [
        {
          code: "invalid_rich_text",
          path: "$",
          message:
            "Question/option order, counts, correct-answer IDs/flags, or referenced file IDs changed.",
        },
      ];
}

export function planStemRichTextBackfill(
  aggregate: Record<string, unknown>,
): StemBackfillPlan {
  const operations: QuestionStemOperation[] = [];
  const fieldChanges: FieldChange[] = [];
  const issues: RichTextBackfillIssue[] = [];

  const stemText = transformField(
    aggregate.stem_text,
    "$.stem_text",
    fieldChanges,
    issues,
  );
  if (
    stemText !== undefined &&
    JSON.stringify(stemText) !== JSON.stringify(aggregate.stem_text)
  ) {
    operations.push({
      type: "set_metadata",
      stemText: stemText as Record<string, unknown>,
    });
  }

  const questions = Array.isArray(aggregate.questions)
    ? aggregate.questions.filter(isRecord)
    : [];
  questions.forEach((question, questionIndex) => {
    const questionId = stringId(question.id);
    if (!questionId) {
      issues.push({
        code: "invalid_rich_text",
        path: `$.questions[${questionIndex}].id`,
        message: "Question ID is missing.",
      });
      return;
    }
    const questionChanges: Extract<
      QuestionStemOperation,
      { type: "update_question" }
    >["changes"] = {};
    const questionText = transformField(
      question.question_text,
      `$.questions[${questionIndex}].question_text`,
      fieldChanges,
      issues,
    );
    if (
      questionText !== undefined &&
      JSON.stringify(questionText) !== JSON.stringify(question.question_text)
    ) {
      questionChanges.questionText = questionText as Record<string, unknown>;
    }
    let answerExplanation = transformField(
      question.answer_explanation,
      `$.questions[${questionIndex}].answer_explanation`,
      fieldChanges,
      issues,
    );
    answerExplanation = applyReviewedAnswerExplanationRepair(
      aggregate,
      questionId,
      `$.questions[${questionIndex}].answer_explanation`,
      answerExplanation,
      fieldChanges,
    );
    if (
      answerExplanation !== undefined &&
      JSON.stringify(answerExplanation) !==
        JSON.stringify(question.answer_explanation)
    ) {
      questionChanges.answerExplanation = answerExplanation as Record<
        string,
        unknown
      > | null;
    }
    if (Object.keys(questionChanges).length > 0) {
      operations.push({
        type: "update_question",
        questionId,
        changes: questionChanges,
      });
    }

    const options = Array.isArray(question.answer_options)
      ? question.answer_options.filter(isRecord)
      : [];
    options.forEach((option, optionIndex) => {
      const optionId = stringId(option.id);
      if (!optionId) {
        issues.push({
          code: "invalid_rich_text",
          path: `$.questions[${questionIndex}].answer_options[${optionIndex}].id`,
          message: "Answer option ID is missing.",
        });
        return;
      }
      const optionChanges: Extract<
        QuestionStemOperation,
        { type: "update_answer_option" }
      >["changes"] = {};
      const answerText = transformField(
        option.answer_text,
        `$.questions[${questionIndex}].answer_options[${optionIndex}].answer_text`,
        fieldChanges,
        issues,
      );
      if (
        answerText !== undefined &&
        JSON.stringify(answerText) !== JSON.stringify(option.answer_text)
      ) {
        optionChanges.answerText = answerText as Record<string, unknown>;
      }
      const optionExplanation = transformField(
        option.answer_explanation,
        `$.questions[${questionIndex}].answer_options[${optionIndex}].answer_explanation`,
        fieldChanges,
        issues,
      );
      if (
        optionExplanation !== undefined &&
        JSON.stringify(optionExplanation) !==
          JSON.stringify(option.answer_explanation)
      ) {
        optionChanges.answerExplanation = optionExplanation as Record<
          string,
          unknown
        > | null;
      }
      if (Object.keys(optionChanges).length > 0) {
        operations.push({
          type: "update_answer_option",
          questionId,
          optionId,
          changes: optionChanges,
        });
      }
    });
  });

  if (
    aggregate.id === REVIEWED_SUBSCRIPT_REPAIR.stemId &&
    !fieldChanges.some((change) => change.reviewedSemanticCorrection)
  ) {
    issues.push({
      code: "invalid_rich_text",
      path: "$",
      message:
        "The manually reviewed subscript repair did not match its pinned revision and exact source shape.",
    });
  }
  fieldChanges.forEach((change) => issues.push(...validateFieldChange(change)));
  issues.push(...invariantIssues(aggregate, operations));

  return {
    operations,
    fieldChanges,
    issues,
    reviewedCorrections: fieldChanges
      .filter((change) => change.reviewedSemanticCorrection)
      .map((change) => `${change.path}:restore_latex_subscripts`),
  };
}
