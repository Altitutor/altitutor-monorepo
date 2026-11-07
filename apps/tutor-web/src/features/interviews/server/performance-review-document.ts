import type { Json } from "@altitutor/shared";

const inline = ["text", "hardBreak", "inlineMath"];
const blocks = ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "codeBlock", "horizontalRule", "table", "details", "blockMath"];
const childrenByType: Record<string, string[]> = {
  doc: blocks,
  paragraph: inline,
  heading: inline,
  blockquote: blocks,
  bulletList: ["listItem"],
  orderedList: ["listItem"],
  listItem: blocks,
  codeBlock: ["text"],
  table: ["tableRow"],
  tableRow: ["tableCell", "tableHeader"],
  tableCell: blocks,
  tableHeader: blocks,
  details: ["detailsSummary", "detailsContent"],
  detailsSummary: inline,
  detailsContent: blocks,
  text: [],
  hardBreak: [],
  horizontalRule: [],
  inlineMath: [],
  blockMath: [],
};
const marks = new Set(["bold", "italic", "strike", "underline", "code", "link", "textStyle", "highlight", "subscript", "superscript"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeAttributes(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.values(value).every((entry) =>
    entry === null || typeof entry === "boolean" || typeof entry === "number" ||
    (typeof entry === "string" && !/[<>\u0000-\u001f]/.test(entry)) ||
    (Array.isArray(entry) && entry.every((item) => typeof item === "number")),
  );
}

function validMark(mark: unknown) {
  if (!isRecord(mark) || typeof mark.type !== "string" || !marks.has(mark.type)) return false;
  if (Object.keys(mark).some((key) => key !== "type" && key !== "attrs")) return false;
  if (mark.attrs !== undefined && !safeAttributes(mark.attrs)) return false;
  if (mark.type !== "link") return true;
  if (!isRecord(mark.attrs)) return false;
  const { href, target, rel, class: className } = mark.attrs;
  if ((target != null && target !== "_blank" && target !== "_self") || (className != null && className !== "")) return false;
  if (rel != null && (typeof rel !== "string" || !rel.split(/\s+/).every((token) => ["noopener", "noreferrer", "nofollow"].includes(token)))) return false;
  return typeof href === "string" && /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href) && !/[\s\\]/.test(href);
}

const maxTableColumns = 32;
const maxTableRows = 100;

function validSpan(value: unknown, max: number) {
  return value === undefined || (typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= max);
}

function validCellAttributes(value: unknown) {
  if (value === undefined) return true;
  if (!isRecord(value) || !validSpan(value.colspan, maxTableColumns) || !validSpan(value.rowspan, maxTableRows)) return false;
  return value.colwidth == null || (Array.isArray(value.colwidth) && value.colwidth.length <= maxTableColumns &&
    value.colwidth.every((width) => typeof width === "number" && Number.isSafeInteger(width) && width >= 0 && width <= 4_096));
}

function validTable(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > maxTableRows) return false;
  const occupiedUntil = Array<number>(maxTableColumns).fill(0);
  for (let rowIndex = 0; rowIndex < value.length; rowIndex += 1) {
    const row: unknown = value[rowIndex];
    if (!isRecord(row) || !Array.isArray(row.content) || row.content.length > maxTableColumns) return false;
    let column = 0;
    for (const cell of row.content) {
      if (!isRecord(cell) || !validCellAttributes(cell.attrs)) return false;
      const attrs = isRecord(cell.attrs) ? cell.attrs : {};
      const colspan = typeof attrs.colspan === "number" ? attrs.colspan : 1;
      const rowspan = typeof attrs.rowspan === "number" ? attrs.rowspan : 1;
      while (column < maxTableColumns && occupiedUntil[column] > rowIndex) column += 1;
      if (column + colspan > maxTableColumns || rowIndex + rowspan > value.length) return false;
      for (const end = column + colspan; column < end; column += 1) {
        if (occupiedUntil[column] > rowIndex) return false;
        occupiedUntil[column] = rowIndex + rowspan;
      }
    }
  }
  return true;
}

function validNode(node: unknown, allowed: string[], depth: number): boolean {
  if (depth > 32 || !isRecord(node) || typeof node.type !== "string" || !allowed.includes(node.type)) return false;
  if (Object.keys(node).some((key) => !["type", "attrs", "content", "text", "marks"].includes(key))) return false;
  if (node.attrs !== undefined && !safeAttributes(node.attrs)) return false;
  if ((node.type === "tableCell" || node.type === "tableHeader") && !validCellAttributes(node.attrs)) return false;
  if (node.type === "table" && !validTable(node.content)) return false;
  if (node.type === "text") {
    return typeof node.text === "string" && node.text.length > 0 && node.content === undefined &&
      (node.marks === undefined || (Array.isArray(node.marks) && node.marks.every(validMark)));
  }
  if (node.text !== undefined || node.marks !== undefined) return false;
  if (node.content === undefined) return true;
  return Array.isArray(node.content) && node.content.every((child) => validNode(child, childrenByType[node.type as string], depth + 1));
}

/** Reviews are shared across accounts. Embedded frames and media are outside this document surface. */
export function isInterviewReviewDocument(value: unknown): value is Json {
  return validNode(value, ["doc"], 0);
}
