import type { Json } from "@altitutor/shared";
import type { UcatQuestionStemFormValues } from "@/features/ucat/questions/types/schema";

export type BulkImportFormattingIssueCode =
  | "flattened_table"
  | "lost_table"
  | "unresolved_table_placeholder"
  | "invalid_table_shape";

export type BulkImportFormattingIssue = {
  code: BulkImportFormattingIssueCode;
  location: string;
  message: string;
};

export type BulkImportFormattingSourceDocument = {
  label: string;
  value: Json | null | undefined;
  /** Set false when tables are only an import-layout mechanism, such as an answers grid. */
  compareTableCount?: boolean;
};

type RichNode = Record<string, unknown>;

function asNode(value: unknown): RichNode | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as RichNode)
    : null;
}

function childNodes(node: RichNode): RichNode[] {
  return Array.isArray(node.content)
    ? node.content.flatMap((child) => {
        const parsed = asNode(child);
        return parsed ? [parsed] : [];
      })
    : [];
}

function visitRichNodes(value: unknown, visit: (node: RichNode) => void): void {
  const node = asNode(value);
  if (!node) return;
  visit(node);
  childNodes(node).forEach((child) => visitRichNodes(child, visit));
}

function richNodePlainText(value: unknown): string {
  const node = asNode(value);
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  return childNodes(node).map(richNodePlainText).filter(Boolean).join(" ");
}

function countNodeType(value: unknown, type: string): number {
  let count = 0;
  visitRichNodes(value, (node) => {
    if (node.type === type) count += 1;
  });
  return count;
}

function containsUnresolvedTablePlaceholder(value: unknown): boolean {
  let found = false;
  visitRichNodes(value, (node) => {
    if (
      typeof node.text === "string" &&
      /\[\[TABLE:[^\]]+\]\]/u.test(node.text)
    )
      found = true;
  });
  return found;
}

function isLikelyFlattenedTable(value: unknown): boolean {
  const root = asNode(value);
  const blocks = root ? childNodes(root) : [];
  if (blocks.length < 6) return false;
  if (countNodeType(value, "table") > 0 || countNodeType(value, "image") > 0)
    return false;

  const text = richNodePlainText(value).replace(/\s+/gu, " ").trim();
  if (!/\btables?\b/iu.test(text)) return false;

  const shortMeaningfulBlocks = blocks.filter((block) => {
    const blockText = richNodePlainText(block).replace(/\s+/gu, " ").trim();
    return blockText.length >= 1 && blockText.length <= 30;
  }).length;

  return shortMeaningfulBlocks / blocks.length >= 0.6;
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function tableShapeIsInvalid(table: RichNode): boolean {
  const rows = childNodes(table).filter((node) => node.type === "tableRow");
  if (rows.length < 2) return true;

  let hasRowSpan = false;
  const rowWidths = rows.map((row) => {
    const cells = childNodes(row).filter(
      (node) => node.type === "tableCell" || node.type === "tableHeader",
    );
    if (cells.length === 0) return 0;
    return cells.reduce((width, cell) => {
      const attrs = asNode(cell.attrs);
      if (positiveInteger(attrs?.rowspan, 1) > 1) hasRowSpan = true;
      return width + positiveInteger(attrs?.colspan, 1);
    }, 0);
  });

  if (rowWidths.some((width) => width < 2)) return true;
  return !hasRowSpan && new Set(rowWidths).size > 1;
}

function containsInvalidTable(value: unknown): boolean {
  let invalid = false;
  visitRichNodes(value, (node) => {
    if (node.type === "table" && tableShapeIsInvalid(node)) invalid = true;
  });
  return invalid;
}

function stemDocuments(
  stems: UcatQuestionStemFormValues[],
): BulkImportFormattingSourceDocument[] {
  return stems.flatMap((stem, stemIndex) => {
    const stemNumber = stemIndex + 1;
    return [
      { label: `Stem ${stemNumber} · stem text`, value: stem.stemText },
      ...stem.questions.flatMap((question, questionIndex) => [
        {
          label: `Stem ${stemNumber} · question ${questionIndex + 1}`,
          value: question.questionText,
        },
        ...(question.answerExplanation
          ? [
              {
                label: `Stem ${stemNumber} · question ${questionIndex + 1} · explanation`,
                value: question.answerExplanation,
              },
            ]
          : []),
        ...question.options.map((option, optionIndex) => ({
          label: `Stem ${stemNumber} · question ${questionIndex + 1} · option ${optionIndex + 1}`,
          value: option.answerText,
        })),
        ...question.options.flatMap((option, optionIndex) =>
          option.answerExplanation
            ? [
                {
                  label: `Stem ${stemNumber} · question ${questionIndex + 1} · option ${optionIndex + 1} · explanation`,
                  value: option.answerExplanation,
                },
              ]
            : [],
        ),
      ]),
    ];
  });
}

function lintDocument(
  document: BulkImportFormattingSourceDocument,
  issues: BulkImportFormattingIssue[],
): void {
  if (!document.value) return;
  if (isLikelyFlattenedTable(document.value)) {
    issues.push({
      code: "flattened_table",
      location: document.label,
      message:
        "This looks like a table flattened into many short paragraphs. Check the rows and columns before importing.",
    });
  }
  if (containsUnresolvedTablePlaceholder(document.value)) {
    issues.push({
      code: "unresolved_table_placeholder",
      location: document.label,
      message: "An unresolved table placeholder remains in the rich text.",
    });
  }
  if (containsInvalidTable(document.value)) {
    issues.push({
      code: "invalid_table_shape",
      location: document.label,
      message:
        "A table has too few rows or columns, or inconsistent row widths.",
    });
  }
}

export function lintBulkImportFormatting(args: {
  sourceDocuments: BulkImportFormattingSourceDocument[];
  stems: UcatQuestionStemFormValues[];
  compareParsedOutput?: boolean;
}): BulkImportFormattingIssue[] {
  const outputDocuments = stemDocuments(args.stems);
  const issues: BulkImportFormattingIssue[] = [];

  args.sourceDocuments.forEach((document) => lintDocument(document, issues));
  outputDocuments.forEach((document) => lintDocument(document, issues));

  if (args.compareParsedOutput) {
    const sourceTableCount = args.sourceDocuments.reduce(
      (count, document) =>
        count +
        (document.compareTableCount === false
          ? 0
          : countNodeType(document.value, "table")),
      0,
    );
    const outputTableCount = outputDocuments.reduce(
      (count, document) => count + countNodeType(document.value, "table"),
      0,
    );
    if (sourceTableCount > outputTableCount) {
      issues.unshift({
        code: "lost_table",
        location: "Parsed import",
        message: `${sourceTableCount - outputTableCount} of ${sourceTableCount} pasted table${
          sourceTableCount === 1 ? "" : "s"
        } did not survive parsing. Review the parsed stems before importing.`,
      });
    }
  }

  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.location}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
