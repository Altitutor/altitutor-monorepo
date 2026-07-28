import type { Json } from "@altitutor/shared";

type JsonRecord = Record<string, Json | undefined>;

export type RichTextBackfillIssue = {
  code:
    | "empty_math"
    | "malformed_bold"
    | "malformed_inline_math"
    | "malformed_display_math"
    | "mixed_display_math"
    | "invalid_rich_text";
  path: string;
  message: string;
};

export type RichTextBackfillStats = {
  boldSpans: number;
  inlineMathNodes: number;
  blockMathNodes: number;
};

export type RichTextBackfillResult = {
  value: Json;
  changed: boolean;
  issues: RichTextBackfillIssue[];
  stats: RichTextBackfillStats;
};

const EMPTY_STATS: RichTextBackfillStats = {
  boldSpans: 0,
  inlineMathNodes: 0,
  blockMathNodes: 0,
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneMarks(value: unknown): Json[] {
  return Array.isArray(value)
    ? value.filter(isRecord).map((mark) => ({ ...mark }))
    : [];
}

function withBoldMark(marks: Json[]): Json[] {
  if (marks.some((mark) => isRecord(mark) && mark.type === "bold"))
    return marks;
  return [...marks, { type: "bold" }];
}

function textNode(
  original: JsonRecord,
  text: string,
  marks: Json[],
): JsonRecord {
  const next: JsonRecord = { ...original, text };
  if (marks.length > 0) next.marks = marks;
  else delete next.marks;
  return next;
}

function addIssue(
  issues: RichTextBackfillIssue[],
  code: RichTextBackfillIssue["code"],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function stripCompleteInlineMath(text: string): string {
  return text.replace(/\\\([\s\S]*?\\\)/gu, "");
}

function detectMalformedInlineSyntax(
  text: string,
  path: string,
  issues: RichTextBackfillIssue[],
): void {
  const withoutInlineMath = stripCompleteInlineMath(text);
  if (withoutInlineMath.includes("\\(") || withoutInlineMath.includes("\\)")) {
    addIssue(
      issues,
      "malformed_inline_math",
      path,
      "Found an unmatched inline LaTeX delimiter.",
    );
  }

  const withoutMath = text.replace(/\\\([\s\S]*?\\\)/gu, "");
  const boldDelimiterCount = withoutMath.match(/\*\*/gu)?.length ?? 0;
  if (boldDelimiterCount % 2 !== 0) {
    addIssue(
      issues,
      "malformed_bold",
      path,
      "Found an unmatched bold delimiter.",
    );
  }
}

function transformText(
  original: JsonRecord,
  marks: Json[],
  allowBold: boolean,
  path: string,
  issues: RichTextBackfillIssue[],
  stats: RichTextBackfillStats,
): Json[] {
  const text = typeof original.text === "string" ? original.text : "";
  const pattern = allowBold
    ? /\*\*([^*\n]+)\*\*|\\\(([\s\S]*?)\\\)/gu
    : /\\\(([\s\S]*?)\\\)/gu;
  const output: Json[] = [];
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor)
      output.push(textNode(original, text.slice(cursor, index), marks));

    if (allowBold && match[1] !== undefined) {
      stats.boldSpans += 1;
      const inner = textNode(original, match[1], withBoldMark(marks));
      output.push(
        ...transformText(
          inner,
          withBoldMark(marks),
          false,
          path,
          issues,
          stats,
        ),
      );
    } else {
      const latex = (allowBold ? match[2] : match[1])?.trim() ?? "";
      if (!latex) {
        addIssue(
          issues,
          "empty_math",
          path,
          "Inline LaTeX delimiters contain no formula.",
        );
        output.push(textNode(original, match[0], marks));
      } else {
        stats.inlineMathNodes += 1;
        const mathNode: JsonRecord = {
          type: "inlineMath",
          attrs: { latex },
        };
        if (marks.length > 0) mathNode.marks = marks;
        output.push(mathNode);
      }
    }
    cursor = index + match[0].length;
  }

  if (cursor < text.length)
    output.push(textNode(original, text.slice(cursor), marks));
  return output.filter(
    (node) => !isRecord(node) || node.type !== "text" || node.text !== "",
  );
}

function paragraphText(content: Json[]): string | null {
  let text = "";
  for (const child of content) {
    if (
      !isRecord(child) ||
      child.type !== "text" ||
      typeof child.text !== "string"
    ) {
      return null;
    }
    text += child.text;
  }
  return text;
}

function displayMatches(text: string): RegExpMatchArray[] {
  return Array.from(text.matchAll(/\\\[([\s\S]*?)\\\]/gu));
}

function hasUnmatchedDisplayDelimiter(text: string): boolean {
  const withoutComplete = text.replace(/\\\[[\s\S]*?\\\]/gu, "");
  return withoutComplete.includes("\\[") || withoutComplete.includes("\\]");
}

function transformNode(
  value: Json,
  path: string,
  issues: RichTextBackfillIssue[],
  stats: RichTextBackfillStats,
): Json {
  if (Array.isArray(value)) {
    return value.map((child, index) =>
      transformNode(child, `${path}[${index}]`, issues, stats),
    );
  }
  if (!isRecord(value)) return value;

  const content = Array.isArray(value.content) ? value.content : null;
  if (value.type === "paragraph" && content) {
    const completeText = paragraphText(content);
    const displaySource =
      completeText ??
      content
        .filter(
          (child): child is JsonRecord =>
            isRecord(child) && child.type === "text",
        )
        .map((child) => (typeof child.text === "string" ? child.text : ""))
        .join("");
    const matches = displayMatches(displaySource);

    if (hasUnmatchedDisplayDelimiter(displaySource)) {
      addIssue(
        issues,
        "malformed_display_math",
        path,
        "Found an unmatched display LaTeX delimiter.",
      );
    }
    if (matches.length > 0) {
      const onlyMatch = matches.length === 1 ? matches[0] : null;
      const before = onlyMatch
        ? displaySource.slice(0, onlyMatch.index ?? 0)
        : "";
      const after = onlyMatch
        ? displaySource.slice((onlyMatch.index ?? 0) + onlyMatch[0].length)
        : "";
      const latex = onlyMatch?.[1]?.trim() ?? "";
      if (
        completeText !== null &&
        onlyMatch &&
        before.trim() === "" &&
        after.trim() === "" &&
        latex &&
        Object.keys(value).every((key) => key === "type" || key === "content")
      ) {
        stats.blockMathNodes += 1;
        return { type: "blockMath", attrs: { latex } };
      }
      addIssue(
        issues,
        latex ? "mixed_display_math" : "empty_math",
        path,
        latex
          ? "Display LaTeX is mixed with other paragraph content or paragraph metadata."
          : "Display LaTeX delimiters contain no formula.",
      );
    }
  }

  if (value.type === "text" && typeof value.text === "string") {
    detectMalformedInlineSyntax(value.text, path, issues);
    if (value.text.includes("\\[") || value.text.includes("\\]")) {
      return { ...value };
    }
    const nodes = transformText(
      value,
      cloneMarks(value.marks),
      true,
      path,
      issues,
      stats,
    );
    return nodes.length === 1 ? nodes[0] : nodes;
  }

  if (!content) return { ...value };
  const transformed: Json[] = [];
  content.forEach((child, index) => {
    const next = transformNode(
      child,
      `${path}.content[${index}]`,
      issues,
      stats,
    );
    if (Array.isArray(next) && isRecord(child) && child.type === "text") {
      transformed.push(...next);
    } else {
      transformed.push(next);
    }
  });
  return { ...value, content: transformed };
}

export function backfillRichTextFormatting(
  value: Json,
  path = "$",
): RichTextBackfillResult {
  const issues: RichTextBackfillIssue[] = [];
  const stats = { ...EMPTY_STATS };
  if (
    !isRecord(value) ||
    value.type !== "doc" ||
    !Array.isArray(value.content)
  ) {
    addIssue(
      issues,
      "invalid_rich_text",
      path,
      "Expected a ProseMirror document with a content array.",
    );
    return { value, changed: false, issues, stats };
  }

  const transformed = transformNode(value, path, issues, stats);
  return {
    value: transformed,
    changed: JSON.stringify(transformed) !== JSON.stringify(value),
    issues,
    stats,
  };
}

function formattingDelimitersRemoved(text: string): string {
  return text
    .replace(/\\\(([\s\S]*?)\\\)/gu, "$1")
    .replace(/\\\[([\s\S]*?)\\\]/gu, "$1")
    .replace(/\*\*([^*\n]+)\*\*/gu, "$1");
}

export function extractedSemanticTextBeforeBackfill(value: Json): string {
  return semanticText(value, true);
}

export function extractedSemanticTextAfterBackfill(value: Json): string {
  return semanticText(value, false);
}

function semanticText(value: Json, removeDelimiters: boolean): string {
  function visit(node: Json): string {
    if (node === null) return "";
    if (
      typeof node === "string" ||
      typeof node === "number" ||
      typeof node === "boolean"
    ) {
      return String(node);
    }
    if (Array.isArray(node)) return node.map(visit).filter(Boolean).join(" ");
    if (node.type === "text" && typeof node.text === "string") {
      return removeDelimiters
        ? formattingDelimitersRemoved(node.text)
        : node.text;
    }
    if (
      (node.type === "inlineMath" || node.type === "blockMath") &&
      isRecord(node.attrs) &&
      typeof node.attrs.latex === "string"
    ) {
      return node.attrs.latex;
    }
    if (!Array.isArray(node.content)) return "";
    const separator = node.type === "paragraph" ? "" : " ";
    return node.content.map(visit).filter(Boolean).join(separator);
  }
  return visit(value).replace(/\s+/gu, " ").trim();
}

export function literalFormattingLeaks(value: Json): string[] {
  const leaks: string[] = [];
  function visit(node: Json): void {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isRecord(node)) return;
    if (node.type === "text" && typeof node.text === "string") {
      if (/\*\*[^*\n]+\*\*/u.test(node.text)) leaks.push("bold");
      if (/\\\([\s\S]*?\\\)/u.test(node.text)) leaks.push("inline_math");
      if (/^\s*\\\[[\s\S]*?\\\]\s*$/u.test(node.text))
        leaks.push("display_math");
    }
    if (Array.isArray(node.content)) node.content.forEach(visit);
  }
  visit(value);
  return Array.from(new Set(leaks));
}
