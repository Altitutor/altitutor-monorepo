import type { JSONContent } from "@altitutor/ui";

export type ImportedStationQuestion = {
  question: JSONContent;
  rubric: JSONContent;
};
export type ParsedStationImport = {
  name: string;
  prompt: JSONContent;
  questions: ImportedStationQuestion[];
  questionDocument: JSONContent;
  warnings: string[];
};
const document = (content: JSONContent[] = []): JSONContent => {
  const first = content.findIndex(hasText);
  if (first < 0) return { type: "doc", content: [] };
  let end = content.length;
  while (end > first && !hasText(content[end - 1])) end--;
  return { type: "doc", content: content.slice(first, end) };
};
const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: text ? [{ type: "text", text }] : [],
});
function text(node: JSONContent): string {
  if (node.type === "hardBreak") return "\n";
  return (
    node.text ??
    (node.content ?? [])
      .map(text)
      .join(
        ["doc", "tableCell", "tableHeader", "listItem"].includes(
          node.type ?? "",
        )
          ? "\n"
          : "",
      )
  );
}
const hasText = (node: JSONContent) => !!text(node).replace(/[\s•·]/g, "");
const label = (node: JSONContent) =>
  text(node)
    .trim()
    .replace(/[:\s]+$/g, "")
    .toLowerCase();
const isPrompt = (node: JSONContent) =>
  /^(?:reading\s+)?prompt\s*:?(?:\s*$|\s*\n)/i.test(text(node).trim()) ||
  /^(?:reading\s+)?prompt\s*:/i.test(text(node).trim());
const isQuestionHeading = (node: JSONContent) =>
  /^(?:questions?|questions?\s+(?:and|&)\s+rubrics?)$/.test(label(node));
function tableColumns(node: JSONContent) {
  if (node.type !== "table") return null;
  for (const [header, row] of (node.content ?? []).entries()) {
    const cells = row.content ?? [];
    const question = cells.findIndex((c) => /^questions?$/.test(label(c)));
    if (question >= 0)
      return {
        header,
        question,
        rubric: cells.findIndex((c) => /^rubrics?$/.test(label(c))),
        feedback: cells.some((c) => label(c) === "feedback"),
      };
  }
  return null;
}
function blocks(node: JSONContent): JSONContent[] {
  if (node.type === "doc" || node.type === "blockquote")
    return (node.content ?? []).flatMap(blocks);
  // Word sometimes wraps the whole document in a one-cell layout table.
  if (
    node.type === "table" &&
    !tableColumns(node) &&
    node.content?.length === 1 &&
    node.content[0].content?.length === 1
  ) {
    return (node.content[0].content[0].content ?? []).flatMap(blocks);
  }
  if (node.type === "paragraph" && /[\r\n]/.test(text(node))) {
    // Keep inline formatting while splitting plain-text pastes / hard breaks.
    const result: JSONContent[] = [];
    let line: JSONContent[] = [];
    for (const child of node.content ?? []) {
      if (child.type === "hardBreak") {
        result.push({ ...node, content: line });
        line = [];
      } else if (child.text?.includes("\n")) {
        child.text.split(/\r?\n/).forEach((part, index) => {
          if (index) {
            result.push({ ...node, content: line });
            line = [];
          }
          if (part) line.push({ ...child, text: part });
        });
      } else line.push(child);
    }
    result.push({ ...node, content: line });
    return result;
  }
  return [node];
}
function withoutPrefix(node: JSONContent, prefix: RegExp): JSONContent {
  let remaining = text(node).match(prefix)?.[0].length ?? 0;
  const trim = (child: JSONContent): JSONContent => {
    if (child.text != null) {
      const count = Math.min(remaining, child.text.length);
      remaining -= count;
      return { ...child, text: child.text.slice(count) };
    }
    return {
      ...child,
      ...(child.content
        ? { content: child.content.map(trim).filter((c) => c.text !== "") }
        : {}),
    };
  };
  return trim(node);
}
function clipboardBlocks(source: JSONContent): JSONContent[] {
  const input = blocks(source);
  const result: JSONContent[] = [];
  for (let index = 0; index < input.length; index++) {
    const value = text(input[index]);
    const headings = value.split("\t").map((s) => s.trim().toLowerCase());
    if (
      !value.includes("\t") ||
      !headings.some((s) => /^questions?$/.test(s))
    ) {
      result.push(input[index]);
      continue;
    }
    const rows: JSONContent[] = [];
    do {
      rows.push({
        type: "tableRow",
        content: text(input[index])
          .split("\t")
          .map((value) => ({
            type: "tableCell",
            content: [paragraph(value.trim())],
          })),
      });
      index++;
    } while (index < input.length && text(input[index]).includes("\t"));
    index--;
    result.push({ type: "table", content: rows });
  }
  return result;
}
const questionMarker = /^(?:(?:question|q)\s*\d+\s*[:.)-]?\s*|\d+\s*[.)]\s*)/i;
const rubricMarker = /^(?:rubric|marking\s+(?:guide|guidance))\s*:\s*/i;
function parseQuestions(
  source: JSONContent,
  warnings: Set<string>,
): ImportedStationQuestion[] {
  const questions: ImportedStationQuestion[] = [];
  let current: { question: JSONContent[]; rubric: JSONContent[] } | null = null;
  let inRubric = false;
  const finish = () => {
    if (current?.question.some(hasText))
      questions.push({
        question: document(current.question),
        rubric: document(current.rubric),
      });
    current = null;
    inRubric = false;
  };
  const visit = (node: JSONContent, listItem = false) => {
    const columns = tableColumns(node);
    if (columns) {
      finish();
      if (columns.feedback)
        warnings.add(
          "Feedback columns are ignored. Only a Rubric column supplies marking guidance.",
        );
      for (const row of node.content?.slice(columns.header + 1) ?? []) {
        const cells = row.content ?? [];
        const question = document(cells[columns.question]?.content ?? []);
        if (!hasText(question)) continue;
        questions.push({
          question,
          rubric:
            columns.rubric >= 0
              ? document(cells[columns.rubric]?.content ?? [])
              : document(),
        });
      }
      return;
    }
    if (node.type === "table") {
      warnings.add(
        "An unrecognised table was kept with the question text. Check the preview.",
      );
    }
    if (node.type === "orderedList" || node.type === "bulletList") {
      if (inRubric && current) {
        current.rubric.push(node);
        return;
      }
      for (const item of node.content ?? []) {
        if (!hasText(item)) continue;
        finish();
        for (const [index, child] of (item.content ?? []).entries())
          visit(child, index === 0);
      }
      return;
    }
    if (label(node) === "feedback")
      warnings.add(
        "Feedback columns are ignored. Only a Rubric column supplies marking guidance.",
      );
    if (
      !hasText(node) ||
      isQuestionHeading(node) ||
      label(node) === "feedback" ||
      /^\d+[.)]?$/.test(label(node))
    )
      return;
    const value = text(node).trim();
    if (rubricMarker.test(value)) {
      if (!current) {
        warnings.add(
          "A rubric without a preceding question could not be assigned. Check the pasted questions.",
        );
        return;
      }
      inRubric = true;
      const content = withoutPrefix(node, rubricMarker);
      if (hasText(content)) current.rubric.push(content);
      return;
    }
    if (label(node) === "rubric") return;
    const startsQuestion = listItem || questionMarker.test(value);
    if (
      startsQuestion ||
      !current ||
      (!inRubric &&
        /\?\s*$/.test(text(current.question[current.question.length - 1])))
    ) {
      finish();
      current = { question: [], rubric: [] };
    }
    const content = startsQuestion ? withoutPrefix(node, questionMarker) : node;
    if (hasText(content))
      (inRubric ? current?.rubric : current?.question)?.push(content);
  };
  for (const node of clipboardBlocks(source)) visit(node);
  finish();
  return questions;
}

/** Parse clipboard documents, preserving Word table cells until question/rubric pairing is resolved. */
export function parseStationImport(
  promptDocument: JSONContent,
  questionsDocument?: JSONContent,
): ParsedStationImport {
  const input = clipboardBlocks(promptDocument).filter(hasText);
  const warnings = new Set<string>();
  const title = input.find((n) =>
    /^(?:MMI\s+\d+\s+)?Station\s+\d+(?:\s*[:–-].*)?$/i.test(text(n).trim()),
  );
  const questionStart = input.findIndex(
    (n) => tableColumns(n) || isQuestionHeading(n),
  );
  const promptStart = input.findIndex(isPrompt);
  let promptBlocks = input.slice(
    0,
    questionStart < 0 ? input.length : questionStart,
  );
  if (promptStart >= 0) {
    const afterHeading = withoutPrefix(
      input[promptStart],
      /^(?:reading\s+)?prompt\s*:?\s*/i,
    );
    promptBlocks = [
      afterHeading,
      ...promptBlocks.slice(promptStart + 1),
    ].filter(hasText);
    const repeated = promptBlocks.findIndex(isPrompt);
    if (repeated >= 0) {
      const first = promptBlocks.slice(0, repeated);
      const second = [
        withoutPrefix(
          promptBlocks[repeated],
          /^(?:reading\s+)?prompt\s*:?\s*/i,
        ),
        ...promptBlocks.slice(repeated + 1),
      ].filter(hasText);
      if (text(document(first)).trim() === text(document(second)).trim())
        promptBlocks = first;
      else
        warnings.add(
          "More than one Prompt section was found. Check the prompt in the preview.",
        );
    }
  } else if (title) promptBlocks = promptBlocks.filter((n) => n !== title);
  const detectedQuestions = document(
    questionStart < 0 ? [] : input.slice(questionStart),
  );
  const source = questionsDocument ?? detectedQuestions;
  const questions = parseQuestions(source, warnings);
  if (questions.length > 100)
    warnings.add(
      "A station supports at most 100 questions. Split this document before adding it.",
    );
  return {
    name: title ? text(title).trim() : "",
    prompt: document(promptBlocks),
    questions,
    // The next paste step starts with a clean two-column table rather than
    // Word's numbering, feedback blanks and whitespace-only layout cells.
    questionDocument: document(
      questions.length
        ? [
            {
              type: "table",
              content: [
                {
                  type: "tableRow",
                  content: ["Question", "Rubric"].map((heading) => ({
                    type: "tableHeader",
                    content: [paragraph(heading)],
                  })),
                },
                ...questions.map((question) => ({
                  type: "tableRow",
                  content: [question.question, question.rubric].map(
                    (value) => ({
                      type: "tableCell",
                      content: value.content?.length
                        ? value.content
                        : [paragraph("")],
                    }),
                  ),
                })),
              ],
            },
          ]
        : [],
    ),
    warnings: [...warnings],
  };
}
