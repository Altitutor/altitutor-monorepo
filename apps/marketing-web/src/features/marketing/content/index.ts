import production from "./production.json";

export type ContentItem = { title: string; html: string; role?: string };
export type ContentBlock = {
  id: string;
  kind: string;
  title?: string;
  html?: string;
  detailTitle?: string;
  detailHtml?: string;
  image?: string;
  alt?: string;
  href?: string;
  value?: string;
  items?: ContentItem[];
};

const pages: Record<string, ContentBlock[]> = production;

export function pageContent(path: string): ContentBlock[] {
  return pages[path] ?? [];
}

/** IDs identify original production copy; page components own its presentation. */
export function content(path: string, id: string): ContentBlock {
  const block = pageContent(path).find((item) => item.id === id);
  if (!block) throw new Error(`Missing production content: ${path} ${id}`);
  return block;
}

export const coursePaths = [
  "/classes/weekly-classes/",
  "/classes/english-assignment-drafting/",
  "/classes/examprep/",
  "/classes/ucatprep/",
  "/classes/medical-interview-preparation/",
] as const;
