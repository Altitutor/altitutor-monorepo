import { z } from "zod";
import type { Json } from "@altitutor/shared";
import { isInterviewReviewDocument } from "@/features/interviews/server/performance-review-document";
import {
  createInterviewServiceClient,
  interviewApiError,
  interviewResponse,
  readInterviewCommandBody,
  requireInterviewAccess,
  resolveInterviewActor,
} from "@/features/interviews/server/context";

export const dynamic = "force-dynamic";

const id = z.guid();
const date = z.string().date();
const document = z.custom<Json>(isInterviewReviewDocument);
const fields = z.object({
  studentId: id.nullable(),
  date,
  template: z.string().max(160),
  body: document,
});
const command = z.union([
  z.object({ type: z.literal("createReview"), id, commandId: id, date }),
  z.object({ type: z.enum(["saveReview", "publishReview"]), id, commandId: id, expectedVersion: z.number().int().positive(), fields }),
  z.object({ type: z.literal("saveTemplate"), id, commandId: id, expectedVersion: z.number().int().nonnegative(), name: z.string().trim().min(1).max(160), body: document }),
]);

async function pages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const results: T[] = [];
  const size = 250;
  for (let start = 0; ; start += size) {
    const { data, error } = await read(start, start + size - 1);
    if (error) throw error;
    results.push(...(data ?? []));
    if (!data || data.length < size) return results;
  }
}

export async function GET(request: Request) {
  try {
    const actor = await resolveInterviewActor(request);
    if ("response" in actor) return actor.response;
    const denied = await requireInterviewAccess(actor);
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const studentId = params.get("student");
    const reviewId = params.get("review");
    const templateId = params.get("template");
    const db = actor.userClient;
    if (studentId !== null) {
      if (!id.safeParse(studentId).success) return interviewResponse({ error: "Invalid student." }, 400);
      const { data, error } = await db.from("vtutor_interview_performance_review_mocks")
        .select("data").eq("student_id", studentId).maybeSingle();
      if (error) throw error;
      return interviewResponse(data?.data ?? []);
    }

    if (reviewId !== null) {
      if (!id.safeParse(reviewId).success) return interviewResponse({ error: "Review unavailable." }, 404);
      const { data, error } = await db.from("vtutor_interview_performance_reviews").select("data").eq("id", reviewId).maybeSingle();
      if (error) throw error;
      return data ? interviewResponse(data.data) : interviewResponse({ error: "Review unavailable." }, 404);
    }
    if (templateId !== null) {
      if (!id.safeParse(templateId).success) return interviewResponse({ error: "Template unavailable." }, 404);
      const { data, error } = await db.from("vtutor_interview_performance_review_templates")
        .select("id,name,body,version").eq("id", templateId).maybeSingle();
      if (error) throw error;
      return data ? interviewResponse(data) : interviewResponse({ error: "Template unavailable." }, 404);
    }

    const [reviews, templates, students] = await Promise.all([
      pages((from, to) => db.from("vtutor_interview_performance_reviews").select("summary").order("id").range(from, to)),
      pages((from, to) => db.from("vtutor_interview_performance_review_templates").select("id,name,version").order("id").range(from, to)),
      pages((from, to) => db.from("vtutor_interview_performance_review_students").select("id,name").order("id").range(from, to)),
    ]);
    return interviewResponse({
      reviews: reviews.map((row) => row.summary),
      templates,
      students: students.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    });
  } catch (error) {
    return interviewApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await resolveInterviewActor(request);
    if ("response" in actor) return actor.response;
    const denied = await requireInterviewAccess(actor);
    if (denied) return denied;
    const input = await readInterviewCommandBody(request);
    if ("response" in input) return input.response;
    const parsed = command.safeParse(input.body);
    if (!parsed.success) return interviewResponse({ error: "Invalid performance review changes." }, 400);
    let payload;
    if ("fields" in parsed.data) {
      const { fields, ...action } = parsed.data;
      payload = { ...action, ...fields };
    } else payload = parsed.data;
    const { data, error } = await createInterviewServiceClient().rpc("interview_performance_review_command", {
      p_actor_user_id: actor.userId,
      p_command: payload as Json,
    });
    if (error) throw error;
    return interviewResponse(data);
  } catch (error) {
    return interviewApiError(error);
  }
}
