import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  FindWordItemContent,
  UcatSkillTrainerDifficulty,
} from "@altitutor/shared";

type WikipediaPage = {
  pageid: number;
  ns: number;
  title: string;
  extract?: string;
  fullurl?: string;
  canonicalurl?: string;
  lastrevid?: number;
  missing?: boolean;
};

type FindWordSeedItem = {
  id: string;
  title: string;
  content: FindWordItemContent & {
    difficulty: UcatSkillTrainerDifficulty;
    source: {
      provider: "wikipedia";
      title: string;
      pageid: number;
      revision_id?: number;
      url: string;
      license: "CC BY-SA 4.0";
      retrieved_at: string;
    };
  };
};

type ConflictMode = "overwrite" | "make-new";

type KeywordCandidate = {
  text: string;
  lower: string;
  count: number;
  score: number;
  positions: number[];
  sentenceStartCount: number;
};

const FIND_WORD_TRAINER_ID = "a1000001-0000-4000-8000-000000000001";
const DEFAULT_OUT =
  "../../supabase/seed/manual/ucat_skill_trainer_wikipedia_find_word_items.sql";
const DEFAULT_ARTICLES = [
  "Adelaide",
  "South Australia",
  "Kangaroo Island",
  "Great Barrier Reef",
  "Sydney Opera House",
  "Charles Darwin",
  "Marie Curie",
  "Rosalind Franklin",
  "Isaac Newton",
  "Ada Lovelace",
  "Alan Turing",
  "Florence Nightingale",
  "Ancient Egypt",
  "Roman Empire",
  "Industrial Revolution",
  "French Revolution",
  "Magna Carta",
  "Apollo 11",
  "International Space Station",
  "Hubble Space Telescope",
  "Photosynthesis",
  "Plate tectonics",
  "Volcano",
  "Earthquake",
  "Antarctica",
  "Amazon rainforest",
  "Sahara",
  "Nile",
  "Eiffel Tower",
  "Louvre",
  "Mona Lisa",
  "Vincent van Gogh",
  "Ludwig van Beethoven",
  "William Shakespeare",
  "Jane Austen",
  "World Health Organization",
  "United Nations",
  "European Union",
  "Olympic Games",
  "FIFA World Cup",
  "Electric vehicle",
  "Renewable energy",
  "Solar power",
  "Wind power",
  "Artificial intelligence",
  "Machine learning",
  "Internet",
  "World Wide Web",
  "Cryptography",
  "DNA",
  "Human genome",
  "Vaccine",
  "Penicillin",
  "Magnetic resonance imaging",
  "X-ray",
  "Periodic table",
  "Gold",
  "Carbon dioxide",
  "Inflation",
  "Supply and demand",
];

const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "again",
  "also",
  "although",
  "an",
  "among",
  "because",
  "became",
  "become",
  "been",
  "before",
  "being",
  "between",
  "during",
  "early",
  "first",
  "from",
  "have",
  "into",
  "known",
  "later",
  "many",
  "more",
  "most",
  "other",
  "over",
  "part",
  "such",
  "than",
  "that",
  "the",
  "their",
  "there",
  "these",
  "this",
  "through",
  "under",
  "were",
  "when",
  "where",
  "which",
  "while",
  "with",
  "within",
  "world",
  "they",
  "them",
  "then",
  "she",
  "her",
  "his",
  "him",
  "its",
]);

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";

const DATE_PATTERNS = [
  new RegExp(
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})(?:\\s+\\d{3,4})?\\b`,
    "gu",
  ),
  new RegExp(
    `\\b(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{3,4})?\\b`,
    "gu",
  ),
];

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

function argNumber(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`--${name} must be a non-negative integer`);
  return value;
}

function argString(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

function argList(name: string): string[] | null {
  const value = argString(name, "");
  if (!value.trim()) return null;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function argMode(): ConflictMode {
  const value = argString("mode", "overwrite");
  if (value === "overwrite" || value === "make-new") return value;
  throw new Error("--mode must be overwrite or make-new");
}

function stableUuid(index: number, batch: number): string {
  if (batch > 0xfff) throw new Error("--batch must be <= 4095");
  return `d1000001-0000-4000-8000-1${batch.toString(16).padStart(3, "0")}${index.toString(16).padStart(8, "0")}`;
}

function difficultyForKeywordCount(count: number): UcatSkillTrainerDifficulty {
  if (count <= 2) return "easy";
  if (count <= 4) return "medium";
  return "hard";
}

function plainTextToDoc(paragraphs: string[]): Record<string, unknown> {
  return {
    type: "doc",
    content: paragraphs.map((paragraph) => ({
      type: "paragraph",
      content: paragraph ? [{ type: "text", text: paragraph }] : [],
    })),
  };
}

function articleTitles(): string[] {
  const fromArg = argList("articles");
  return fromArg?.length ? fromArg : DEFAULT_ARTICLES;
}

const WIKIPEDIA_USER_AGENT =
  "AltitutorSkillTrainerSeed/1.0 (https://altitutor.com)";
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const RANDOM_PAGE_BATCH = 20;

async function fetchWikipediaPages(titles: string[]): Promise<WikipediaPage[]> {
  const pages: WikipediaPage[] = [];
  for (let index = 0; index < titles.length; index += 20) {
    pages.push(
      ...(await fetchWikipediaPageChunk(titles.slice(index, index + 20))),
    );
  }
  return pages;
}

async function wikipediaQuery(
  params: URLSearchParams,
): Promise<{ pages?: WikipediaPage[] }> {
  const response = await fetch(`${WIKIPEDIA_API}?${params}`, {
    headers: {
      "User-Agent": WIKIPEDIA_USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!response.ok)
    throw new Error(`Wikipedia request failed: ${response.status}`);
  const body = (await response.json()) as {
    error?: { code?: string; info?: string };
    query?: { pages?: WikipediaPage[] };
  };
  if (body.error) {
    throw new Error(
      `Wikipedia API error ${body.error.code ?? ""}: ${body.error.info ?? "unknown error"}`,
    );
  }
  return body.query ?? {};
}

async function fetchWikipediaPageChunk(
  titles: string[],
): Promise<WikipediaPage[]> {
  const params = new URLSearchParams({
    action: "query",
    prop: "extracts|info|revisions",
    exintro: "1",
    explaintext: "1",
    redirects: "1",
    inprop: "url",
    rvprop: "ids",
    format: "json",
    formatversion: "2",
    titles: titles.join("|"),
  });
  const query = await wikipediaQuery(params);
  return (query.pages ?? []).filter((page) => !page.missing && page.extract);
}

async function fetchRandomWikipediaPages(
  count: number,
): Promise<WikipediaPage[]> {
  const pages: WikipediaPage[] = [];
  while (pages.length < count) {
    const remaining = Math.min(RANDOM_PAGE_BATCH, count - pages.length);
    const params = new URLSearchParams({
      action: "query",
      generator: "random",
      grnnamespace: "0",
      grnlimit: String(remaining),
      prop: "extracts|info|revisions",
      exintro: "1",
      explaintext: "1",
      redirects: "1",
      inprop: "url",
      rvprop: "ids",
      format: "json",
      formatversion: "2",
    });
    const query = await wikipediaQuery(params);
    const batch = (query.pages ?? []).filter(
      (page) => !page.missing && page.extract,
    );
    if (!batch.length) break;
    pages.push(...batch);
  }
  return pages;
}

function chooseParagraphs(extract: string): string[] {
  const sourceParagraphs = extract
    .split(/\n{2,}/)
    .map((paragraph) => cleanParagraph(paragraph))
    .filter((paragraph) => paragraph.length >= 80)
    .filter((paragraph) => !paragraph.startsWith("Coordinates:"));

  const paragraphs = sourceParagraphs.flatMap((paragraph) =>
    paragraph.length > 520 ? splitLongParagraph(paragraph) : [paragraph],
  );

  const selected: string[] = [];
  let total = 0;
  for (const paragraph of paragraphs) {
    if (selected.length >= 4) break;
    if (selected.length > 0 && total + paragraph.length > 900) break;
    selected.push(paragraph);
    total += paragraph.length;
    if (selected.length >= 1 && total >= 420) break;
  }
  return selected.length ? selected : paragraphs.slice(0, 1);
}

function splitLongParagraph(paragraph: string): string[] {
  const sentences = paragraph.match(/[^.!?]+[.!?]+(?:["')\]]+)?/g) ?? [
    paragraph,
  ];
  const chunks: string[] = [];
  let current = "";
  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    if (current && `${current} ${sentence}`.length > 380) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
    if (chunks.length >= 4) break;
  }
  if (current && chunks.length < 4) chunks.push(current);
  return chunks.filter((chunk) => chunk.length >= 80);
}

function cleanParagraph(paragraph: string): string {
  return paragraph
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .replace(/\(\s*\)/g, "")
    .trim();
}

function selectKeywords(
  rng: Rng,
  title: string,
  paragraphs: string[],
): Array<{ id: string; text: string }> {
  const passage = paragraphs.join("\n");
  const titleTokens = new Set(
    tokenize(title).map((token) => token.toLowerCase()),
  );
  const tokenMatches = [
    ...passage.matchAll(
      /\b[\p{L}][\p{L}'-]{2,}\b|\b\d+(?:[.,]\d+)*(?:%|st|nd|rd|th)?\b/gu,
    ),
  ];
  const counts = new Map<string, KeywordCandidate>();

  for (const pattern of DATE_PATTERNS) {
    for (const match of passage.matchAll(pattern)) {
      const text = match[0].replace(/[.,;:!?]+$/g, "");
      const lower = text.toLowerCase();
      const position = match.index ?? 0;
      if (!counts.has(lower)) {
        counts.set(lower, {
          text,
          lower,
          count: 0,
          score: 0,
          positions: [],
          sentenceStartCount: 0,
        });
      }
      const entry = counts.get(lower)!;
      entry.count += 1;
      entry.positions.push(position);
      entry.score += /\d{3,4}\b/.test(text) ? 24 : 18;
    }
  }

  for (const match of tokenMatches) {
    const text = match[0].replace(/[.,;:!?]+$/g, "");
    const lower = text.toLowerCase();
    if (STOP_WORDS.has(lower)) continue;
    if (/^[a-z][a-z'-]{0,3}$/.test(text)) continue;
    const position = match.index ?? 0;
    const sentenceStart = isSentenceStart(passage, position);
    if (
      sentenceStart &&
      !titleTokens.has(lower) &&
      /^[A-Z][\p{L}'-]+$/u.test(text) &&
      text.length < 7
    ) {
      continue;
    }
    if (!counts.has(lower)) {
      counts.set(lower, {
        text,
        lower,
        count: 0,
        score: 0,
        positions: [],
        sentenceStartCount: 0,
      });
    }
    const entry = counts.get(lower)!;
    entry.count += 1;
    entry.positions.push(position);
    if (sentenceStart) entry.sentenceStartCount += 1;
    if (/^\d/.test(text)) entry.score += 12;
    if (/^[A-Z][\p{L}'-]+$/u.test(text)) entry.score += sentenceStart ? 4 : 10;
    if (titleTokens.has(lower)) entry.score += 10;
    if (text.length >= 7) entry.score += 2;
  }

  for (const entry of counts.values()) {
    if (entry.count > 1) entry.score += Math.min(10, entry.count * 3);
    if (
      entry.sentenceStartCount === entry.count &&
      entry.count === 1 &&
      !titleTokens.has(entry.lower)
    ) {
      entry.score -= 6;
    }
  }

  const candidates = [...counts.values()]
    .filter((entry) => entry.score >= 6)
    .sort(
      (a, b) =>
        b.score - a.score || b.count - a.count || a.text.localeCompare(b.text),
    );

  const targetCount = Math.min(5, Math.max(2, rng.int(2, 5)));
  const selected: string[] = [];
  const usedBuckets = new Set<number>();
  while (selected.length < targetCount && candidates.length > 0) {
    const available = candidates.filter(
      (candidate) =>
        !selected.some((text) => text.toLowerCase() === candidate.lower) &&
        passage.toLowerCase().includes(candidate.lower),
    );
    if (!available.length) break;
    const candidate = weightedKeywordPick(
      rng,
      available,
      passage.length,
      usedBuckets,
    );
    selected.push(candidate.text);
    usedBuckets.add(
      positionBucket(candidate.positions[0] ?? 0, passage.length),
    );
  }

  if (selected.length < 2) {
    throw new Error(`Could not find enough keywords for ${title}`);
  }

  return selected.map((text, index) => ({ id: `kw${index + 1}`, text }));
}

function isSentenceStart(text: string, index: number): boolean {
  const prefix = text.slice(0, index).trimEnd();
  if (!prefix) return true;
  return /[.!?]\s*$/.test(prefix);
}

function positionBucket(position: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(5, Math.floor((position / length) * 6));
}

function weightedKeywordPick(
  rng: Rng,
  candidates: KeywordCandidate[],
  passageLength: number,
  usedBuckets: Set<number>,
): KeywordCandidate {
  const weighted = candidates.map((candidate) => {
    const bucket = positionBucket(candidate.positions[0] ?? 0, passageLength);
    const baseBucketFactor = [0.5, 1.2, 1.6, 1.85, 2, 2][bucket] ?? 1;
    const bucketFactor = usedBuckets.has(bucket)
      ? baseBucketFactor * 0.35
      : baseBucketFactor;
    const repeatedFactor = Math.min(1.4, 1 + (candidate.count - 1) * 0.1);
    return {
      candidate,
      weight: Math.max(1, candidate.score) * bucketFactor * repeatedFactor,
    };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = rng.next() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.candidate;
  }
  return weighted[weighted.length - 1]!.candidate;
}

function tokenize(text: string): string[] {
  return [
    ...text.matchAll(
      /\b[\p{L}][\p{L}'-]{2,}\b|\b\d+(?:[.,]\d+)*(?:%|st|nd|rd|th)?\b/gu,
    ),
  ].map((match) => match[0]);
}

function validateItem(item: FindWordSeedItem): void {
  const plain = extractPlainText(item.content.passage);
  for (const keyword of item.content.keywords) {
    if (!plain.toLowerCase().includes(keyword.text.toLowerCase())) {
      throw new Error(`Keyword "${keyword.text}" missing from ${item.title}`);
    }
  }
}

function extractPlainText(doc: Record<string, unknown>): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as {
      type?: string;
      text?: string;
      content?: unknown[];
    };
    if (record.type === "text" && typeof record.text === "string") {
      parts.push(record.text);
      return;
    }
    if (Array.isArray(record.content)) record.content.forEach(walk);
    if (record.type === "paragraph") parts.push("\n");
  };
  walk(doc);
  return parts.join("").trim();
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function renderSql(
  items: FindWordSeedItem[],
  options: { seed: number; batch: number; mode: ConflictMode },
): string {
  const conflictSql =
    options.mode === "overwrite"
      ? `ON CONFLICT (id) DO UPDATE SET
  skill_trainer_id = EXCLUDED.skill_trainer_id,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active,
  approval_status = EXCLUDED.approval_status,
  approved_at = EXCLUDED.approved_at,
  updated_at = NOW()`
      : "ON CONFLICT (id) DO NOTHING";
  const batchLike = `d1000001-0000-4000-8000-1${options.batch.toString(16).padStart(3, "0")}%`;
  const values = items
    .map((item) => {
      const content = JSON.stringify(item.content);
      return `  (
    '${item.id}',
    '${FIND_WORD_TRAINER_ID}',
    ${sqlString(content)}::jsonb,
    true,
    'approved',
    NOW()
  )`;
    })
    .join(",\n");

  return `-- =============================================================================
-- UCAT skill trainer generated Find the Word items from Wikipedia lead extracts
-- =============================================================================
-- Generated by apps/tutor-web/scripts/generate-ucat-find-word-wikipedia-seed.ts
-- Seed: ${options.seed}
-- Batch: ${options.batch}
-- Mode: ${options.mode}
--
-- Wikipedia text is licensed CC BY-SA 4.0. Each item stores source metadata
-- including title, page id, revision id where available, source URL, and retrieval time.
-- Use --batch N to generate a non-overlapping UUID range.
-- Mode overwrite updates rows in this batch; mode make-new leaves existing rows untouched.
-- =============================================================================

INSERT INTO public.ucat_skill_trainer_items (
  id,
  skill_trainer_id,
  content,
  is_active,
  approval_status,
  approved_at
)
VALUES
${values}
${conflictSql};

SELECT
  t.key,
  COUNT(i.id) AS generated_approved_active_items
FROM public.ucat_skill_trainers t
LEFT JOIN public.ucat_skill_trainer_items i
  ON i.skill_trainer_id = t.id
  AND i.id::text LIKE '${batchLike}'
  AND i.deleted_at IS NULL
  AND i.is_active = true
  AND i.approval_status = 'approved'
WHERE t.id = '${FIND_WORD_TRAINER_ID}'
GROUP BY t.key, t.sort_order
ORDER BY t.sort_order;
`;
}

async function tryBuildItem(
  rng: Rng,
  page: WikipediaPage,
  id: string,
  retrievedAt: string,
): Promise<FindWordSeedItem | null> {
  const paragraphs = chooseParagraphs(page.extract ?? "");
  if (!paragraphs.length) return null;
  let keywords: Array<{ id: string; text: string }>;
  try {
    keywords = selectKeywords(rng, page.title, paragraphs);
  } catch {
    return null;
  }
  const item: FindWordSeedItem = {
    id,
    title: page.title,
    content: {
      passage: plainTextToDoc(paragraphs),
      keywords,
      difficulty: difficultyForKeywordCount(keywords.length),
      source: {
        provider: "wikipedia",
        title: page.title,
        pageid: page.pageid,
        revision_id: page.lastrevid,
        url:
          page.fullurl ??
          page.canonicalurl ??
          `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        license: "CC BY-SA 4.0",
        retrieved_at: retrievedAt,
      },
    },
  };
  try {
    validateItem(item);
  } catch {
    return null;
  }
  return item;
}

async function main(): Promise<void> {
  const seed = argNumber("seed", 20260702);
  const batch = argNumber("batch", 1);
  const mode = argMode();
  const limit = argNumber("limit", 60);
  const out = resolve(process.cwd(), argString("out", DEFAULT_OUT));
  const rng = new Rng(seed);
  const retrievedAt = new Date().toISOString();
  const preferredTitles = articleTitles();

  const items: FindWordSeedItem[] = [];
  const seenPageIds = new Set<number>();
  let preferredLoaded = 0;
  let randomLoaded = 0;
  let skipped = 0;

  const consumePages = async (pages: WikipediaPage[]) => {
    for (const page of pages) {
      if (items.length >= limit) break;
      if (seenPageIds.has(page.pageid)) continue;
      seenPageIds.add(page.pageid);
      const item = await tryBuildItem(
        rng,
        page,
        stableUuid(items.length + 1, batch),
        retrievedAt,
      );
      if (!item) {
        skipped += 1;
        continue;
      }
      items.push(item);
    }
  };

  const preferredPages = await fetchWikipediaPages(preferredTitles);
  preferredLoaded = preferredPages.length;
  await consumePages(preferredPages);

  let emptyBatches = 0;
  while (items.length < limit && emptyBatches < 8) {
    const needed = Math.max(
      RANDOM_PAGE_BATCH,
      Math.ceil((limit - items.length) * 1.5),
    );
    const batchPages = await fetchRandomWikipediaPages(
      Math.min(needed, RANDOM_PAGE_BATCH * 5),
    );
    const before = items.length;
    const unseen = batchPages.filter((page) => !seenPageIds.has(page.pageid));
    randomLoaded += unseen.length;
    await consumePages(unseen);
    if (items.length === before) emptyBatches += 1;
    else emptyBatches = 0;
  }

  if (items.length < limit) {
    throw new Error(
      `Only generated ${items.length}/${limit} Find the Word items (preferred=${preferredLoaded} random=${randomLoaded} skipped=${skipped})`,
    );
  }

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, renderSql(items, { seed, batch, mode }));
  console.log(`Wrote ${items.length} Wikipedia Find the Word items to ${out}`);
  console.log(
    `articles_requested=${preferredTitles.length} preferred_loaded=${preferredLoaded} random_loaded=${randomLoaded} skipped=${skipped} batch=${batch} mode=${mode}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
