import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { Database, Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  UcatAccessScope,
  UcatContentStatus,
  UcatPublicationIssue,
  UcatQuestionStem,
  UcatQuestionStemBundlePayload,
} from "@/features/ucat/shared/types";
import { fetchAllSupabaseRows } from "@/features/ucat/shared/lib/fetch-all-supabase-rows";
import {
  readUcatBulkStatusResponse,
  throwFirstUcatBulkStatusFailure,
} from "@/features/ucat/shared/lifecycle-errors";
import { humanizeQuestionStemError } from "@/features/ucat/questions/lib/question-stem-error";
import {
  buildQuestionStemListIndex,
  type UcatQuestionStemListIndex,
} from "@/features/ucat/questions/lib/build-question-stem-list-index";
import type {
  UcatAssessmentResponse,
  UcatFormatCheck,
} from "@/features/ucat/questions/lib/ai-assessment/schema";
import {
  serializeQuestionCatalogQuery,
  type QuestionCatalogQuery,
} from "@/features/ucat/questions/lib/question-catalog-query";
import type { BulkImportAiReviewSubmission } from "@/features/ucat/questions/lib/bulk-import-ai-review";

export type { UcatQuestionStemListIndex };

export type UcatGenerationDebugCall = {
  stemIndex: number;
  categoryName: string | null;
  operation: string;
  model: string | null;
  durationMs: number;
  status: "ok" | "error";
  error?: string;
  request: {
    systemPrompt: string;
    userPrompt: string;
    maxCompletionTokens: number;
    timeoutMs: number;
    providerSort?: "price" | "throughput" | "latency";
    reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
  };
  response?: {
    content: string;
    finishReason: string | null;
    usage: unknown;
    contentLength: number;
  };
  parsedSummary?: {
    stemCount: number;
    categories: Array<string | null>;
    questionCounts: number[];
  };
};

export type UcatGenerationDebugInfo = {
  runId?: string | null;
  requestedStemCount: number;
  sectionName: string | null;
  selectedCategoryName: string | null;
  sourceSampleIds: string[];
  promptLayerCount: number;
  calls: UcatGenerationDebugCall[];
  gateIssues: Array<{
    severity: string;
    code: string;
    message: string;
    stemIndex: number;
    questionIndex?: number;
    details?: Record<string, unknown>;
  }>;
};

export type UcatGenerationProgress = {
  step: "setup" | "sources" | "generating" | "gates" | "images" | "drafts";
  message: string;
  completedStems?: number;
  totalStems?: number;
  runId?: string | null;
};

export type UcatGenerationRun = {
  id: string;
  status: "running" | "completed" | "failed";
  requested_stem_count: number;
  accepted_stem_count: number;
  discarded_stem_count: number;
  processed_stem_count: number;
  progress_step: UcatGenerationProgress["step"] | null;
  progress_message: string | null;
  error_message: string | null;
  generated_stem_ids: string[];
  created_at: string;
  completed_at: string | null;
  dismissed_at: string | null;
};

export class UcatGenerationApiError extends Error {
  debug: UcatGenerationDebugInfo | null;

  constructor(message: string, debug: UcatGenerationDebugInfo | null) {
    super(message);
    this.name = "UcatGenerationApiError";
    this.debug = debug;
  }
}

export type UcatGeneratedDraftStem = {
  sectionId: string;
  categoryId: string | null;
  stemText: Json;
  accessScope: UcatAccessScope;
  questions: Array<{
    index: number;
    questionText: Json;
    answerExplanation: Json | null;
    difficulty: number | null;
    timeBurdenSeconds: number | null;
    questionType: "multiple_choice" | "syllogism";
    tagIds: string[];
    options: Array<{
      index: number;
      answerText: Json;
      answerExplanation: Json | null;
      isAnswer: boolean;
    }>;
  }>;
  aiGenerationMetadata: Json | null;
};

export type UcatGenerateDraftsResult = {
  discardedCount?: number;
  debug?: UcatGenerationDebugInfo | null;
  debugRunId?: string | null;
  stems: UcatGeneratedDraftStem[];
};

export type UcatQuestionStemRow = UcatQuestionStem & {
  ai_generation_metadata?: Json | null;
  source_channel?: UcatQuestionSourceChannel | null;
  tutor_source_note?: string | null;
  status: UcatContentStatus;
  access_scope: UcatAccessScope;
  publication_issues?: UcatPublicationIssue[] | null;
  status_changed_at?: string | null;
  status_changed_by?: string | null;
  status_changed_by_first_name?: string | null;
  status_changed_by_last_name?: string | null;
};

export type UcatQuestionSourceChannel =
  | "individual"
  | "bulk_import"
  | "ai_generation";

export type UcatQuestionCatalogRow = UcatQuestionStemRow & {
  tag_ids: string[];
  question_types: string[];
  set_ids: Json;
  set_names: Json;
  question_count: number;
  is_available_in_question_pool: boolean;
};

export type UcatQuestionCatalogPage = {
  items: UcatQuestionCatalogRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type UcatQuestionCatalogCreator = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type StemDetailQuestion = {
  id: string;
  question_text: Json;
  answer_explanation: Json | null;
  index: number;
  difficulty: number | null;
  time_burden_seconds: number | null;
  question_type: "multiple_choice" | "syllogism";
  source_channel?: UcatQuestionSourceChannel | null;
  ai_generation_metadata?: Json | null;
  tags?: Array<{ id: string; name: string }>;
  answer_options: Array<{
    id: string;
    answer_text: Json;
    answer_explanation: Json | null;
    index: number;
    is_answer: boolean;
    option_text_file_ids?: string[];
    option_explanation_file_ids?: string[];
  }>;
};

export type StemDetailRow = {
  id: string;
  section_id: string;
  section_name: string;
  section_number: number;
  display_columns: number;
  question_stem_category_id: string | null;
  category_name: string | null;
  status: UcatContentStatus;
  access_scope: UcatAccessScope;
  publication_issues?: UcatPublicationIssue[] | null;
  ai_generation_metadata?: Json | null;
  source_channel?: UcatQuestionSourceChannel | null;
  tutor_source_note?: string | null;
  status_changed_at?: string | null;
  status_changed_by?: string | null;
  status_changed_by_first_name?: string | null;
  status_changed_by_last_name?: string | null;
  created_by?: string | null;
  created_by_first_name?: string | null;
  created_by_last_name?: string | null;
  created_at?: string | null;
  stem_text: Json;
  questions: StemDetailQuestion[];
};

export type UcatAiAssessmentRun = {
  id: string;
  cycle_id: string;
  stem_id: string;
  trigger_kind: string;
  scope_type: "full" | "questions";
  target_question_ids: string[];
  content_fingerprint: string;
  status: "queued" | "running" | "deferred" | "completed" | "failed" | "superseded" | "format_blocked";
  attempt_count: number;
  blind_solver_model: string | null;
  assessment_model: string | null;
  format_checks: UcatFormatCheck[];
  assessment_result: UcatAssessmentResponse | null;
  error_message: string | null;
  requested_at: string;
  started_at: string | null;
  deferred_until: string | null;
  completed_at: string | null;
  sharedCurrent: boolean;
  currentTargetQuestionIds: string[];
  contentCurrent: boolean;
};

export type UcatAiAssessmentDecision = {
  id: string;
  run_id: string;
  finding_key: string;
  decision: "dismissed" | "suggestion_accepted" | "suggestion_rejected";
  reason: string | null;
  reviewed_content_fingerprint: string;
  patch: Json | null;
  decided_by: string | null;
  decided_at: string;
};

export type UcatAiAssessment = {
  environment: { enabled: boolean; automaticEnabled: boolean; source: string };
  status:
    | "disabled"
    | "not_requested"
    | "reviewing"
    | "deferred"
    | "format_blocked"
    | "unavailable"
    | "unreviewable"
    | "passed"
    | "concerns"
    | "critical";
  currentContentFingerprint: string;
  currentCycle: { id: string; stem_id: string; is_current: boolean; started_at: string } | null;
  cycles: Array<{ id: string; stem_id: string; is_current: boolean; started_at: string }>;
  runs: UcatAiAssessmentRun[];
  effectiveRunIds: string[];
  decisions: UcatAiAssessmentDecision[];
};

export const ucatQuestionsApi = {
  async listCatalog(query: QuestionCatalogQuery): Promise<UcatQuestionCatalogPage> {
    const response = await fetch(
      `/api/ucat/question-stems/catalog?${serializeQuestionCatalogQuery(query)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to load question catalog");
    }
    return response.json() as Promise<UcatQuestionCatalogPage>;
  },

  async listCatalogReviewIds(query: QuestionCatalogQuery): Promise<string[]> {
    const params = new URLSearchParams(serializeQuestionCatalogQuery(query));
    params.set("idsOnly", "1");
    params.set("page", "1");
    params.set("pageSize", "50000");
    const response = await fetch(
      `/api/ucat/question-stems/catalog?${params}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to load review queue");
    }
    const page = await response.json() as { items?: Array<{ id?: unknown }> };
    return (page.items ?? []).flatMap((item) =>
      typeof item.id === "string" ? [item.id] : [],
    );
  },

  async getCatalogCreators(): Promise<UcatQuestionCatalogCreator[]> {
    const response = await fetch("/api/ucat/question-stems/catalog/creators");
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to load question creators");
    }
    return response.json() as Promise<UcatQuestionCatalogCreator[]>;
  },

  async getAiAssessment(stemId: string) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}/ai-assessment`, { cache: "no-store" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to load AI review");
    }
    return response.json() as Promise<UcatAiAssessment>;
  },

  async retryAiAssessment(stemId: string, runId: string) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}/ai-assessment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry", runId }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to retry AI review");
    }
    return response.json() as Promise<{ queued: boolean }>;
  },

  async requestAiAssessment(stemId: string) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}/ai-assessment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request" }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to request AI review");
    }
    return response.json() as Promise<{
      kind: "existing" | "format_blocked" | "unavailable" | "queued";
      runId?: string;
    }>;
  },

  async recordAiAssessmentDecision(stemId: string, input: {
    runId: string;
    findingKey: string;
    decision: UcatAiAssessmentDecision["decision"];
    reason?: string | null;
  }) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}/ai-assessment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to record AI review decision");
    }
    return response.json() as Promise<{ decision: UcatAiAssessmentDecision }>;
  },

  async list(options?: {
    status?: UcatContentStatus | null;
    sourceChannel?: UcatQuestionSourceChannel | null;
    sectionId?: string | null;
    categoryId?: string | null;
  }) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    /** List columns only — omit unused metadata; keep stem_text for search/display. */
    const listSelect = [
      "id",
      "section_id",
      "section_number",
      "section_name",
      "question_stem_category_id",
      "category_name",
      "access_scope",
      "status",
      "stem_text",
      "question_count",
      "set_names",
      "set_ids",
      "created_at",
      "updated_at",
      "created_by",
      "created_by_first_name",
      "created_by_last_name",
      "deleted_at",
      "source_channel",
      "tutor_source_note",
      "ai_generation_metadata",
      "status_changed_at",
      "status_changed_by_first_name",
      "status_changed_by_last_name",
      "is_available_in_question_pool",
    ].join(",");

    let query = supabase
      .from("vtutor_ucat_question_stems")
      .select(listSelect)
      .order("updated_at", { ascending: false })
      .order("id");

    if (options?.sectionId) {
      query = query.eq("section_id", options.sectionId);
    }
    if (options?.categoryId) {
      query = query.eq("question_stem_category_id", options.categoryId);
    }
    if (options?.status) {
      query = query.eq("status", options.status);
    }
    if (options?.sourceChannel) {
      query = query.eq("source_channel", options.sourceChannel);
    }

    const data = await fetchAllSupabaseRows((from, to) =>
      query.range(from, to),
    );
    return data as unknown as UcatQuestionStemRow[];
  },

  async getSections() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from("vtutor_ucat_sections")
      .select("*")
      .order("section_number");
    if (error) throw error;
    return data ?? [];
  },

  async getCategories() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from("vtutor_ucat_question_stem_categories")
      .select("*")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },

  async getTags() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { data, error } = await supabase
      .from("vtutor_ucat_question_tags")
      .select("*")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },

  async getDetail(stemId: string) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const [detailResult, metaResult] = await Promise.all([
      supabase
        .from("vtutor_ucat_question_stem_detail")
        .select("*")
        .eq("id", stemId)
        .maybeSingle(),
      supabase
        .from("vtutor_ucat_question_stems")
        .select(
          "created_by, created_by_first_name, created_by_last_name, created_at, status_changed_by, status_changed_at, status_changed_by_first_name, status_changed_by_last_name",
        )
        .eq("id", stemId)
        .maybeSingle(),
    ]);

    if (detailResult.error) throw detailResult.error;
    if (metaResult.error) throw metaResult.error;
    if (!detailResult.data) return null;

    const meta = metaResult.data as {
      created_by?: string | null;
      created_by_first_name?: string | null;
      created_by_last_name?: string | null;
      created_at?: string | null;
      status_changed_by?: string | null;
      status_changed_at?: string | null;
      status_changed_by_first_name?: string | null;
      status_changed_by_last_name?: string | null;
    } | null;

    return {
      ...(detailResult.data as Record<string, unknown>),
      created_by: meta?.created_by ?? null,
      created_by_first_name: meta?.created_by_first_name ?? null,
      created_by_last_name: meta?.created_by_last_name ?? null,
      created_at: meta?.created_at ?? null,
      status_changed_by: meta?.status_changed_by ?? null,
      status_changed_at: meta?.status_changed_at ?? null,
      status_changed_by_first_name: meta?.status_changed_by_first_name ?? null,
      status_changed_by_last_name: meta?.status_changed_by_last_name ?? null,
    } as StemDetailRow;
  },

  /**
   * One detail fetch for the questions table index (types + tags + search text).
   * Replaces the previous triple fetch of `id,questions`.
   */
  async getStemListIndex(): Promise<UcatQuestionStemListIndex> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const data = await fetchAllSupabaseRows((from, to) =>
      supabase
        .from("vtutor_ucat_question_stem_detail")
        .select("id,questions")
        .order("id")
        .range(from, to),
    );

    return buildQuestionStemListIndex(
      (data ?? []) as Array<{ id: string | null; questions: unknown }>,
    );
  },

  async getStemCatalog(options?: { publishedOnly?: boolean }) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const publishedOnly = options?.publishedOnly ?? false;
    const [detailData, listData] = await Promise.all([
      fetchAllSupabaseRows((from, to) =>
        (publishedOnly
          ? supabase
              .from("vtutor_ucat_question_stem_detail")
              .select(
                "id,stem_text,questions,section_name,section_number,section_id,question_stem_category_id,category_name,status,access_scope,source_channel,created_at,deleted_at",
              )
              .is("deleted_at", null)
              .eq("status", "published")
          : supabase
              .from("vtutor_ucat_question_stem_detail")
              .select(
                "id,stem_text,questions,section_name,section_number,section_id,question_stem_category_id,category_name,status,access_scope,source_channel,created_at,deleted_at",
              )
              .is("deleted_at", null)
        )
          .order("id")
          .range(from, to),
      ),
      fetchAllSupabaseRows((from, to) =>
        supabase
          .from("vtutor_ucat_question_stems")
          .select("id,set_names,set_ids")
          .is("deleted_at", null)
          .order("id")
          .range(from, to),
      ),
    ]);

    const setInfoById = new Map(
      listData.map((row) => [
        row.id ?? "",
        {
          setNames: row.set_names,
          setIds: row.set_ids,
        },
      ]),
    );

    return (
      detailData as Array<{
        id: string | null;
        stem_text: Json | null;
        questions: unknown;
        section_name: string | null;
        section_number: number | null;
        section_id: string | null;
        question_stem_category_id: string | null;
        category_name: string | null;
        status: UcatContentStatus;
        access_scope: UcatAccessScope;
        source_channel: UcatQuestionSourceChannel | null;
        created_at: string | null;
        set_names?: unknown;
        set_ids?: unknown;
      }>
    ).map((row) => {
      const setInfo = row.id ? setInfoById.get(row.id) : undefined;
      return {
        ...row,
        set_names: setInfo?.setNames ?? null,
        set_ids: setInfo?.setIds ?? null,
      };
    });
  },

  async create(payload: UcatQuestionStemBundlePayload) {
    const response = await fetch("/api/ucat/question-stems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serializePayload(payload)),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        humanizeQuestionStemError(
          body.error ?? "Failed to create question stem",
        ),
      );
    }

    return response.json() as Promise<{ id: string }>;
  },

  async update(
    stemId: string,
    payload: UcatQuestionStemBundlePayload,
    options?: { requestAssessment?: boolean },
  ) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...serializePayload({ ...payload, stemId }),
        requestAssessment: options?.requestAssessment ?? false,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        humanizeQuestionStemError(
          body.error ?? "Failed to update question stem",
        ),
      );
    }

    return response.json() as Promise<{ id: string }>;
  },

  async addQuestionTag(stemId: string, questionId: string, tagId: string) {
    return this.addQuestionTags(stemId, questionId, [tagId]);
  },

  async addQuestionTags(stemId: string, questionId: string, tagIds: string[]) {
    const detail = await this.getDetail(stemId);
    if (!detail) throw new Error("Question stem not found");
    const questions = (detail.questions ?? []) as StemDetailQuestion[];
    const questionIndex = questions.findIndex((q) => q.id === questionId);
    if (questionIndex === -1) throw new Error("Question not found");
    const existingTagIds = (questions[questionIndex].tags ?? []).map(
      (t) => t.id,
    );
    const newTagIds = Array.from(new Set([...existingTagIds, ...tagIds]));
    if (newTagIds.length === existingTagIds.length) return;
    const payload = stemDetailToBundlePayload(detail, (q, i) =>
      i === questionIndex ? newTagIds : (q.tags ?? []).map((t) => t.id),
    );
    return this.update(stemId, payload);
  },

  async addQuestionTagsBulk(
    updates: Array<{ stemId: string; questionId: string; tagIds: string[] }>,
  ) {
    const updatesByStem = new Map<string, Map<string, Set<string>>>();
    for (const update of updates) {
      let questions = updatesByStem.get(update.stemId);
      if (!questions) {
        questions = new Map();
        updatesByStem.set(update.stemId, questions);
      }
      let tagIds = questions.get(update.questionId);
      if (!tagIds) {
        tagIds = new Set();
        questions.set(update.questionId, tagIds);
      }
      update.tagIds.forEach((tagId) => tagIds.add(tagId));
    }

    const stemUpdates = Array.from(updatesByStem.entries());
    const concurrency = 5;
    let updatedQuestionCount = 0;
    let failedQuestionCount = 0;
    const failedStemIds: string[] = [];

    for (let index = 0; index < stemUpdates.length; index += concurrency) {
      const batch = stemUpdates.slice(index, index + concurrency);
      const results = await Promise.allSettled(
        batch.map(async ([stemId, questionUpdates]) => {
          const detail = await this.getDetail(stemId);
          if (!detail) throw new Error("Question stem not found");
          const payload = stemDetailToBundlePayload(detail, (question) => {
            const existingTagIds = (question.tags ?? []).map((tag) => tag.id);
            const inferredTagIds = questionUpdates.get(question.id);
            return inferredTagIds
              ? Array.from(new Set([...existingTagIds, ...inferredTagIds]))
              : existingTagIds;
          });
          await this.update(stemId, payload);
          return questionUpdates.size;
        }),
      );

      results.forEach((result, resultIndex) => {
        if (result.status === "fulfilled") {
          updatedQuestionCount += result.value;
          return;
        }
        const [stemId, questionUpdates] = batch[resultIndex];
        failedStemIds.push(stemId);
        failedQuestionCount += questionUpdates.size;
      });
    }

    return {
      updatedQuestionCount,
      failedQuestionCount,
      failedStemIds,
    };
  },

  async remove(stemId: string) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to delete question stem");
    }
  },

  async bulkRemove(stemIds: string[]) {
    const response = await fetch("/api/ucat/question-stems/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stemIds }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to bulk delete question stems");
    }
    return response.json() as Promise<{ ok: true }>;
  },

  async restore(stemId: string) {
    const response = await fetch(`/api/ucat/question-stems/${stemId}/restore`, {
      method: "POST",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to restore question stem");
    }
  },

  async bulkUpdateMetadata(
    stemIds: string[],
    updates: { categoryId?: string | null; accessScope?: UcatAccessScope },
  ) {
    const response = await fetch("/api/ucat/question-stems/bulk-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stemIds,
        categoryId: updates.categoryId ?? null,
        accessScope: updates.accessScope ?? null,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to bulk update question stems");
    }

    return response.json() as Promise<{ ok: true }>;
  },

  async bulkImport(
    sectionId: string,
    stems: UcatQuestionStemBundlePayload[],
    aiReviews?: BulkImportAiReviewSubmission[],
  ) {
    const response = await fetch("/api/ucat/question-stems/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionId,
        stems: stems.map((stem) => serializePayload(stem)),
        ...(aiReviews && aiReviews.length > 0 ? { aiReviews } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to bulk import question stems");
    }

    return response.json() as Promise<{
      ids: string[];
      aiReviewPersistence?: {
        persistedStemIds: string[];
        skipped: Array<{ stemId: string; reason: string }>;
      };
    }>;
  },

  async startGeneration(input: {
    sectionId: string;
    categoryId?: string | null;
    modelProfileId?: string | null;
    sourceMode: "none" | "random" | "selected";
    includeAiSourceStems?: boolean;
    imageGenerationMode?: "auto" | "deterministic" | "ai";
    sourceStemIds?: string[];
    stemCount: number;
    difficultyTarget: "easy" | "medium" | "hard" | "mixed";
    timeBurdenTarget: "low" | "medium" | "high" | "mixed";
    targetTagIds: string[];
    runInstructions?: string | null;
  }): Promise<{ runId: string }> {
    const response = await fetch(
      "/api/ucat/question-stems/generated/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: input.sectionId,
          categoryId: input.categoryId,
          modelProfileId: input.modelProfileId,
          sourceMode: input.sourceMode,
          includeAiSourceStems: input.includeAiSourceStems ?? false,
          imageGenerationMode: input.imageGenerationMode ?? "auto",
          sourceStemIds: input.sourceStemIds,
          stemCount: input.stemCount,
          difficultyTarget: input.difficultyTarget,
          timeBurdenTarget: input.timeBurdenTarget,
          targetTagIds: input.targetTagIds,
          runInstructions: input.runInstructions,
        }),
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(body.error ?? "Failed to start question generation");
    }
    return response.json() as Promise<{ runId: string }>;
  },

  async getGenerationRuns(): Promise<UcatGenerationRun[]> {
    const response = await fetch("/api/ucat/question-stems/generated/runs");
    if (response.status === 403) return [];
    if (!response.ok) throw new Error("Failed to load generation tasks");
    const body = (await response.json()) as { runs: UcatGenerationRun[] };
    return body.runs;
  },

  async getGenerationRun(runId: string): Promise<UcatGenerationRun | null> {
    const response = await fetch(
      `/api/ucat/question-stems/generated/runs/${runId}`,
    );
    if (response.status === 404) return null;
    if (response.status === 403) return null;
    if (!response.ok) throw new Error("Failed to load generation task");
    const body = (await response.json()) as { run: UcatGenerationRun };
    return body.run;
  },

  async dismissGenerationRun(runId: string): Promise<void> {
    const response = await fetch(
      `/api/ucat/question-stems/generated/runs/${runId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      },
    );
    if (!response.ok) throw new Error("Failed to dismiss generation task");
  },

  async getGenerationModelProfiles() {
    const response = await fetch(
      "/api/ucat/question-stems/generated/model-profiles",
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to load generation model profiles");
    }
    return response.json() as Promise<{
      modelProfiles: Array<{
        id: string;
        name: string;
        model: string;
        isDefault: boolean;
      }>;
      settings: {
        maxRequestedStems: number;
      };
    }>;
  },

  async generateExplanations(input: {
    modelProfileId?: string | null;
    concurrency?: number;
    signal?: AbortSignal;
    stems: Array<{
      id?: string;
      sectionId: string;
      sectionName?: string | null;
      categoryId?: string | null;
      categoryName?: string | null;
      stemText: unknown;
      isPrivate?: boolean;
      questions: Array<{
        questionText: unknown;
        questionType: "multiple_choice" | "syllogism";
        answerExplanation?: unknown;
        difficulty?: number | null;
        timeBurdenSeconds?: string | null;
        tagIds?: string[];
        options: Array<{
          answerText: unknown;
          answerExplanation?: unknown;
          isAnswer: boolean;
        }>;
      }>;
      questionIndices?: number[];
    }>;
  }) {
    const response = await fetch(
      "/api/ucat/question-stems/explanations/generate",
      {
        method: "POST",
        signal: input.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelProfileId: input.modelProfileId ?? null,
          concurrency: input.concurrency,
          stems: input.stems,
        }),
      },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ?? "Failed to generate explanations",
      );
    }
    return response.json() as Promise<{
      results: Array<{
        stemIndex: number;
        id: string | null;
        updates: Array<{
          questionIndex: number;
          answerExplanation?: string | null;
          optionExplanations?: Array<string | null>;
          confidence?: number;
          unresolved?: boolean;
          rationale?: string | null;
          reviewRequired?: boolean;
          reviewMessage?: string | null;
          suggestedCorrectOptionIndex?: number | null;
          suggestedAnswerExplanation?: string | null;
          suggestedChanges?: string | null;
        }>;
        error: string | null;
      }>;
      appliedStemCount: number;
      errorCount: number;
    }>;
  },

  async importGenerated(
    sectionId: string,
    stems: Array<Record<string, unknown>>,
  ) {
    const response = await fetch("/api/ucat/question-stems/generated/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId, stems }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.error ?? "Failed to import generated question stems",
      );
    }
    return response.json() as Promise<{ ids: string[] }>;
  },

  async setStatus(stemId: string, status: UcatContentStatus) {
    const result = await this.bulkSetStatus([stemId], status);
    throwFirstUcatBulkStatusFailure(result);
    return result;
  },

  async bulkSetStatus(stemIds: string[], status: UcatContentStatus) {
    const response = await fetch("/api/ucat/content-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: "stem",
        contentIds: stemIds,
        status,
      }),
    });
    return readUcatBulkStatusResponse(
      response,
      "Failed to update question status",
    );
  },

  async bulkRestoreStatus(
    stemIds: string[],
    currentStatus: UcatContentStatus,
    previousStatus: UcatContentStatus,
  ) {
    const response = await fetch("/api/ucat/content-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: "stem",
        contentIds: stemIds,
        status: currentStatus,
        previousStatus,
      }),
    });
    return readUcatBulkStatusResponse(
      response,
      "Failed to restore question status",
    );
  },
};

/** Ensure we send actual null for DB, never the string "null". */
function toJsonOrNull(value: unknown): Json | null {
  if (value == null) return null;
  if (typeof value === "string" && value === "null") return null;
  return value as Json;
}

function stemDetailToBundlePayload(
  detail: StemDetailRow,
  getTagIds: (q: StemDetailQuestion, index: number) => string[],
): UcatQuestionStemBundlePayload {
  const questions = (detail.questions ?? []) as StemDetailQuestion[];
  return {
    stemId: detail.id,
    sectionId: detail.section_id,
    categoryId: detail.question_stem_category_id ?? null,
    stemText: detail.stem_text ?? {},
    accessScope: detail.access_scope,
    sourceChannel: detail.source_channel ?? null,
    tutorSourceNote: detail.tutor_source_note ?? null,
    questions: questions.map((q, i) => ({
      index: q.index,
      id: q.id,
      questionText: q.question_text ?? {},
      questionType: q.question_type ?? "multiple_choice",
      answerExplanation: toJsonOrNull(q.answer_explanation),
      difficulty: q.difficulty ?? null,
      timeBurdenSeconds: q.time_burden_seconds ?? null,
      sourceChannel: q.source_channel ?? detail.source_channel ?? null,
      aiGenerationMetadata: q.ai_generation_metadata ?? null,
      tagIds: getTagIds(q, i),
      options: (q.answer_options ?? []).map((opt) => ({
        id: opt.id,
        index: opt.index,
        answerText: opt.answer_text ?? {},
        answerExplanation: toJsonOrNull(opt.answer_explanation),
        isAnswer: opt.is_answer,
      })),
    })),
  };
}

function serializePayload(payload: UcatQuestionStemBundlePayload) {
  return {
    stemId: payload.stemId ?? null,
    sectionId: payload.sectionId,
    categoryId: payload.categoryId ?? null,
    stemText: payload.stemText,
    accessScope: payload.accessScope,
    sourceChannel: payload.sourceChannel ?? null,
    tutorSourceNote: payload.tutorSourceNote ?? null,
    questions: payload.questions.map((question) => ({
      index: question.index,
      id: question.id ?? null,
      question_text: question.questionText,
      answer_explanation: toJsonOrNull(question.answerExplanation),
      difficulty: question.difficulty ?? null,
      time_burden_seconds: question.timeBurdenSeconds ?? null,
      question_type: question.questionType,
      source_channel: question.sourceChannel ?? payload.sourceChannel ?? null,
      ai_generation_metadata: question.aiGenerationMetadata ?? null,
      tag_ids: question.tagIds,
      answer_options: question.options.map((option) => ({
        id: option.id ?? null,
        index: option.index,
        answer_text: option.answerText,
        answer_explanation: toJsonOrNull(option.answerExplanation),
        is_answer: option.isAnswer,
      })),
    })),
  };
}
