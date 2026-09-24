import { readFile } from "node:fs/promises";

const productionUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!productionUrl || !serviceRoleKey) {
  throw new Error("Production URL and service-role key are required.");
}

const migration = await readFile(
  new URL("../supabase/migrations/20260810143000_reclassify_reviewed_decision_making_content.sql", import.meta.url),
  "utf8",
);
const mapping = new Map(
  [...migration.matchAll(/\('([0-9a-f-]{36})'::uuid, '([0-9a-f-]{36})'::uuid\)/gu)].map(
    ([, stemId, targetCategoryId]) => [stemId, targetCategoryId],
  ),
);

if (mapping.size !== 413) {
  throw new Error(`Expected 413 reviewed mappings; found ${mapping.size}.`);
}

const syllogismsId = "b35d193a-d054-4ac2-8ae3-669ac1ff79bc";
const stemIds = [...mapping.keys()];
const rows = [];

function semanticText(value) {
  if (Array.isArray(value)) return value.map(semanticText).filter(Boolean).join(" ");
  if (!value || typeof value !== "object") return "";
  return [typeof value.text === "string" ? value.text : "", semanticText(value.content)]
    .filter(Boolean)
    .join(" ");
}

for (let offset = 0; offset < stemIds.length; offset += 75) {
  const ids = stemIds.slice(offset, offset + 75).join(",");
  const query = new URLSearchParams({
    select: "id,question_stem_category_id,question_stem_categories(name),status,deleted_at,updated_at,stem_text,ucat_questions(question_text)",
    id: `in.(${ids})`,
  });
  const response = await fetch(`${productionUrl}/rest/v1/question_stems?${query}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Read-only production query failed with status ${response.status}.`);
  }
  rows.push(...(await response.json()));
}

const mismatches = rows
  .filter((row) => {
    const targetCategoryId = mapping.get(row.id);
    return (
      row.question_stem_category_id !== syllogismsId &&
      row.question_stem_category_id !== targetCategoryId
    );
  })
  .map((row) => ({
    stemId: row.id,
    currentCategoryId: row.question_stem_category_id,
    currentCategoryName: row.question_stem_categories?.name ?? null,
    reviewedTargetCategoryId: mapping.get(row.id),
    status: row.status,
    deleted: row.deleted_at !== null,
    updatedAt: row.updated_at,
    stemText: semanticText(row.stem_text),
    questionTexts: row.ucat_questions.map((question) => semanticText(question.question_text)),
  }));

console.log(JSON.stringify({ reviewedRowsFound: rows.length, mismatches }, null, 2));
if (mismatches.length > 0) process.exitCode = 1;
