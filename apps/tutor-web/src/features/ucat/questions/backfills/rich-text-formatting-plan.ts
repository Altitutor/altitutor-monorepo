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
};

export type StemBackfillPlan = {
  operations: QuestionStemOperation[];
  fieldChanges: FieldChange[];
  issues: RichTextBackfillIssue[];
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
  if (beforeText !== afterText) {
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
    const answerExplanation = transformField(
      question.answer_explanation,
      `$.questions[${questionIndex}].answer_explanation`,
      fieldChanges,
      issues,
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

  fieldChanges.forEach((change) => issues.push(...validateFieldChange(change)));
  issues.push(...invariantIssues(aggregate, operations));

  return { operations, fieldChanges, issues };
}
