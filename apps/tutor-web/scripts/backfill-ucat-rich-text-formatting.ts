import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Database } from "@altitutor/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { applyUcatMcpPublishedOperations } from "../src/features/ucat/mcp/server/workflow-service";
import { encodeAuthoringRevision } from "../src/features/ucat/mcp/server/revision";
import { getUcatMcpAggregate } from "../src/features/ucat/mcp/server/service";
import { planStemRichTextBackfill } from "../src/features/ucat/questions/backfills/rich-text-formatting-plan";

const APPLY_CONFIRMATION = "APPLY_PRODUCTION_UCAT_RICH_TEXT_BACKFILL";

type Options = {
  apply: boolean;
  batchSize: number;
  confirmation: string | null;
  cursor: string | null;
  checkpointPath: string;
  reportDirectory: string;
};

type ReportStatus =
  | "unchanged"
  | "proposed"
  | "applied"
  | "needs_review"
  | "revision_conflict"
  | "error";

type ReportEntry = {
  stemId: string;
  revision: string | null;
  status: ReportStatus;
  changedFields: string[];
  operationCount: number;
  boldSpans: number;
  inlineMathNodes: number;
  blockMathNodes: number;
  reviewedCorrections: string[];
  issueCodes: string[];
  issues: string[];
  changeId: string | null;
};

type ReportSummary = Record<ReportStatus, number> & {
  scanned: number;
  fieldsChanged: number;
  boldSpans: number;
  inlineMathNodes: number;
  blockMathNodes: number;
  reviewedCorrections: number;
};

function argumentValue(args: string[], name: string): string | null {
  const exactIndex = args.indexOf(name);
  if (exactIndex >= 0) return args[exactIndex + 1] ?? null;
  const prefix = `${name}=`;
  const inline = args.find((argument) => argument.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  name: string,
): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function parseOptions(args: string[]): Options {
  const apply = args.includes("--apply");
  const explicitDryRun = args.includes("--dry-run");
  const dryRunValue = argumentValue(args, "--dry-run");
  if (
    apply &&
    (explicitDryRun || (dryRunValue !== null && dryRunValue !== "false"))
  ) {
    throw new Error("--apply and --dry-run cannot be used together");
  }
  if (
    dryRunValue !== null &&
    dryRunValue !== "true" &&
    dryRunValue !== "false"
  ) {
    throw new Error("--dry-run accepts only true or false");
  }
  if (dryRunValue === "false" && !apply) {
    throw new Error(
      "--dry-run=false is not sufficient; use --apply with confirmation",
    );
  }

  const confirmation = argumentValue(args, "--confirm");
  if (apply && confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`--apply requires --confirm=${APPLY_CONFIRMATION}`);
  }
  return {
    apply,
    batchSize: parsePositiveInteger(
      argumentValue(args, "--batch-size"),
      20,
      "--batch-size",
    ),
    confirmation,
    cursor: argumentValue(args, "--cursor"),
    checkpointPath:
      argumentValue(args, "--checkpoint") ??
      path.resolve("artifacts/ucat-rich-text-backfill/checkpoint.json"),
    reportDirectory:
      argumentValue(args, "--report-dir") ??
      path.resolve("artifacts/ucat-rich-text-backfill"),
  };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

async function authenticatedClient(): Promise<SupabaseClient<Database>> {
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    (projectId ? `https://${projectId}.supabase.co` : null);
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_PROJECT_ID");
  }
  const apiKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey) throw new Error("Missing a Supabase API key");

  const client = createClient<Database>(url, apiKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: requiredEnvironment("UCAT_BACKFILL_TUTOR_EMAIL"),
    password: requiredEnvironment("UCAT_BACKFILL_TUTOR_PASSWORD"),
  });
  if (error)
    throw new Error(`Could not authenticate backfill tutor: ${error.message}`);
  if (!data.user || !data.session)
    throw new Error("Backfill tutor authentication returned no session");

  const { data: access, error: accessError } =
    await client.rpc("is_ucat_tutor");
  if (accessError)
    throw new Error(
      `Could not verify UCAT tutor access: ${accessError.message}`,
    );
  if (access !== true)
    throw new Error("Configured backfill user does not have UCAT tutor access");
  return client;
}

function serviceRoleClient(): SupabaseClient<Database> {
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    (projectId ? `https://${projectId}.supabase.co` : null);
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_PROJECT_ID");
  }
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Dry-run requires SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function queryError(error: { message: string } | null, label: string): void {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function getDryRunAggregate(
  client: SupabaseClient<Database>,
  stemId: string,
): Promise<Record<string, unknown>> {
  const stemResult = await client
    .from("question_stems")
    .select(
      "id,section_id,question_stem_category_id,stem_text,access_scope,tutor_source_note,updated_at,status",
    )
    .eq("id", stemId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  queryError(stemResult.error, "Could not read published stem");
  const stem = stemResult.data;
  if (!stem || !stem.updated_at) {
    throw new Error(
      "Published stem was not found or has no authoring revision",
    );
  }

  const questionsResult = await client
    .from("ucat_questions")
    .select(
      "id,question_text,answer_explanation,index,difficulty,time_burden_seconds,response_type,answer_scheme,source_channel,ai_generation_metadata",
    )
    .eq("question_stem_id", stemId)
    .is("deleted_at", null)
    .order("index", { ascending: true })
    .order("id", { ascending: true });
  queryError(questionsResult.error, "Could not read published-stem questions");
  const questions = questionsResult.data ?? [];
  const questionIds = questions.map((question) => question.id);

  const [optionsResult, tagsResult] =
    questionIds.length > 0
      ? await Promise.all([
          client
            .from("question_answer_options")
            .select(
              "id,question_id,answer_text,answer_explanation,index,answer_key_value",
            )
            .in("question_id", questionIds)
            .is("deleted_at", null)
            .order("index", { ascending: true })
            .order("id", { ascending: true }),
          client
            .from("questions_question_tags")
            .select("question_id,tag_id")
            .in("question_id", questionIds)
            .order("tag_id", { ascending: true }),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
  queryError(optionsResult.error, "Could not read published-stem options");
  queryError(tagsResult.error, "Could not read published-stem tags");
  const options = optionsResult.data ?? [];
  const tags = tagsResult.data ?? [];

  return {
    ...stem,
    revision: encodeAuthoringRevision(stem.id, stem.updated_at),
    questions: questions.map((question) => ({
      ...question,
      answer_options: options.filter(
        (option) => option.question_id === question.id,
      ),
      tags: tags
        .filter((tag) => tag.question_id === question.id)
        .map((tag) => ({ id: tag.tag_id })),
    })),
  };
}

function emptySummary(): ReportSummary {
  return {
    scanned: 0,
    unchanged: 0,
    proposed: 0,
    applied: 0,
    needs_review: 0,
    revision_conflict: 0,
    error: 0,
    fieldsChanged: 0,
    boldSpans: 0,
    inlineMathNodes: 0,
    blockMathNodes: 0,
    reviewedCorrections: 0,
  };
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

function csvReport(entries: ReportEntry[]): string {
  const headers: Array<keyof ReportEntry> = [
    "stemId",
    "revision",
    "status",
    "changedFields",
    "operationCount",
    "boldSpans",
    "inlineMathNodes",
    "blockMathNodes",
    "reviewedCorrections",
    "issueCodes",
    "issues",
    "changeId",
  ];
  const rows = entries.map((entry) =>
    headers
      .map((header) => {
        const value = entry[header];
        return csvCell(Array.isArray(value) ? value.join(" | ") : value);
      })
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n").concat("\n");
}

async function writeCheckpoint(
  checkpointPath: string,
  cursor: string | null,
  summary: ReportSummary,
): Promise<void> {
  await mkdir(path.dirname(checkpointPath), { recursive: true });
  const temporaryPath = `${checkpointPath}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(
      {
        version: 1,
        lastProcessedStemId: cursor,
        updatedAt: new Date().toISOString(),
        summary,
      },
      null,
      2,
    )}\n`,
  );
  await rename(temporaryPath, checkpointPath);
}

function isRevisionConflict(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("revision is stale") ||
      error.message.includes("mcp_stale_revision"))
  );
}

async function listPublishedStemIds(
  client: SupabaseClient<Database>,
  apply: boolean,
  cursor: string | null,
  batchSize: number,
): Promise<string[]> {
  const baseQuery = apply
    ? client
        .from("vtutor_ucat_question_stems")
        .select("id")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .limit(batchSize)
    : client
        .from("question_stems")
        .select("id")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .limit(batchSize);
  const query = cursor ? baseQuery.gt("id", cursor) : baseQuery;
  const { data, error } = await query;
  if (error)
    throw new Error(`Could not list published stems: ${error.message}`);
  return (data ?? [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const client = options.apply
    ? await authenticatedClient()
    : serviceRoleClient();
  const entries: ReportEntry[] = [];
  const summary = emptySummary();
  let cursor = options.cursor;

  while (true) {
    const stemIds = await listPublishedStemIds(
      client,
      options.apply,
      cursor,
      options.batchSize,
    );
    if (stemIds.length === 0) break;

    for (const stemId of stemIds) {
      let entry: ReportEntry;
      try {
        const aggregate = options.apply
          ? await getUcatMcpAggregate(client, "stem", stemId)
          : await getDryRunAggregate(client, stemId);
        const revision =
          typeof aggregate.revision === "string" ? aggregate.revision : null;
        if (!revision)
          throw new Error("Published stem has no exact authoring revision");
        const plan = planStemRichTextBackfill(aggregate);
        const totals = plan.fieldChanges.reduce(
          (result, change) => ({
            boldSpans: result.boldSpans + change.stats.boldSpans,
            inlineMathNodes:
              result.inlineMathNodes + change.stats.inlineMathNodes,
            blockMathNodes: result.blockMathNodes + change.stats.blockMathNodes,
          }),
          { boldSpans: 0, inlineMathNodes: 0, blockMathNodes: 0 },
        );
        let status: ReportStatus =
          plan.operations.length > 0 ? "proposed" : "unchanged";
        let changeId: string | null = null;
        if (plan.issues.length > 0) {
          status = "needs_review";
        } else if (options.apply && plan.operations.length > 0) {
          try {
            const result = await applyUcatMcpPublishedOperations(
              client,
              "stem",
              stemId,
              revision,
              plan.operations,
              {
                summary: "Backfill leaked UCAT rich-text formatting",
                rationale:
                  "Deterministically convert leaked bold and LaTeX delimiters to native TipTap nodes/marks.",
              },
            );
            status = "applied";
            changeId =
              typeof result.changeId === "string" ? result.changeId : null;
          } catch (applyError) {
            if (isRevisionConflict(applyError)) {
              status = "revision_conflict";
              plan.issues.push({
                code: "invalid_rich_text",
                path: "$",
                message:
                  applyError instanceof Error
                    ? applyError.message
                    : "Revision conflict",
              });
            } else {
              throw applyError;
            }
          }
        }
        entry = {
          stemId,
          revision,
          status,
          changedFields: plan.fieldChanges.map((change) => change.path),
          operationCount: plan.operations.length,
          ...totals,
          reviewedCorrections: plan.reviewedCorrections,
          issueCodes: plan.issues.map((issue) => issue.code),
          issues: plan.issues.map((issue) => `${issue.path}: ${issue.message}`),
          changeId,
        };
      } catch (stemError) {
        entry = {
          stemId,
          revision: null,
          status: "error",
          changedFields: [],
          operationCount: 0,
          boldSpans: 0,
          inlineMathNodes: 0,
          blockMathNodes: 0,
          reviewedCorrections: [],
          issueCodes: ["error"],
          issues: [
            stemError instanceof Error ? stemError.message : String(stemError),
          ],
          changeId: null,
        };
      }

      entries.push(entry);
      summary.scanned += 1;
      summary[entry.status] += 1;
      summary.fieldsChanged += entry.changedFields.length;
      summary.boldSpans += entry.boldSpans;
      summary.inlineMathNodes += entry.inlineMathNodes;
      summary.blockMathNodes += entry.blockMathNodes;
      summary.reviewedCorrections += entry.reviewedCorrections.length;
      cursor = stemId;
      await writeCheckpoint(options.checkpointPath, cursor, summary);
    }
  }

  await mkdir(options.reportDirectory, { recursive: true });
  const report = {
    version: 1,
    mode: options.apply ? "apply" : "dry-run",
    generatedAt: new Date().toISOString(),
    initialCursor: options.cursor,
    finalCursor: cursor,
    batchSize: options.batchSize,
    confirmationRequiredForApply: APPLY_CONFIRMATION,
    summary,
    entries,
  };
  await Promise.all([
    writeFile(
      path.join(options.reportDirectory, "report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    ),
    writeFile(
      path.join(options.reportDirectory, "report.csv"),
      csvReport(entries),
    ),
    writeCheckpoint(options.checkpointPath, cursor, summary),
  ]);
  console.log(JSON.stringify(report, null, 2));

  if (summary.error > 0 || summary.revision_conflict > 0) process.exitCode = 1;
}

if (process.env.NODE_ENV !== "test") {
  void run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
