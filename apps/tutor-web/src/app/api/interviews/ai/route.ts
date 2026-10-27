import {
  callUcatAiJson,
  UcatAiBudgetExceededError,
} from "@/features/ucat/shared/server/ucat-ai-client";
import {
  buildQuestionTagsPrompt,
  buildStationNamePrompt,
  QUESTION_TAGS_SYSTEM,
  readSelectedTagIds,
  readStationName,
  STATION_NAME_SYSTEM,
} from "@/features/interviews/lib/station-ai";
import {
  createInterviewServiceClient,
  interviewApiError,
  interviewResponse,
  requireInterviewAccess,
  resolveInterviewActor,
} from "@/features/interviews/server/context";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEXT_LIMIT = 20_000;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function boundedText(value: unknown): string | null {
  return typeof value === "string" && value.length <= TEXT_LIMIT ? value : null;
}

function aiFailure(error: unknown) {
  if (error instanceof UcatAiBudgetExceededError) {
    return interviewResponse({ error: error.message }, 429);
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("No default UCAT model profile")) {
    return interviewResponse(
      { error: "No UCAT AI model is configured." },
      503,
    );
  }
  if (
    message.includes("is not configured") ||
    message.includes("is not available")
  ) {
    return interviewResponse(
      { error: "The UCAT AI model is not available." },
      503,
    );
  }
  return interviewApiError(error);
}

export async function POST(request: Request) {
  try {
    const actor = await resolveInterviewActor(request);
    if ("response" in actor) return actor.response;
    const denied = await requireInterviewAccess(actor);
    if (denied) return denied;
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return interviewResponse({ error: "Invalid AI request." }, 400);
    }
    const kind = (body as { type?: unknown }).type;
    const service = createInterviewServiceClient();
    if (kind === "station-name") {
      const prompt = boundedText((body as { prompt?: unknown }).prompt);
      const questions = (body as { questions?: unknown }).questions;
      if (
        prompt == null ||
        !Array.isArray(questions) ||
        questions.length > 100
      ) {
        return interviewResponse({ error: "Invalid station name request." }, 400);
      }
      const questionText: string[] = [];
      for (const question of questions) {
        const text = boundedText(question);
        if (text == null) {
          return interviewResponse(
            { error: "Invalid station name request." },
            400,
          );
        }
        questionText.push(text);
      }
      if (!prompt.trim() && !questionText.some((question) => question.trim())) {
        return interviewResponse(
          { error: "Add a prompt or a question before naming the station." },
          400,
        );
      }
      const result = await callUcatAiJson({
        client: service,
        operation: "interview-station-name",
        systemPrompt: STATION_NAME_SYSTEM,
        userPrompt: buildStationNamePrompt(prompt, questionText),
        temperature: 0.2,
        maxCompletionTokens: 120,
        timeoutMs: 45_000,
      });
      const name = readStationName(result.parsed);
      if (!name) {
        return interviewResponse(
          { error: "The model did not return a station name." },
          502,
        );
      }
      return interviewResponse({ name });
    }
    if (kind === "question-tags") {
      const prompt = boundedText((body as { prompt?: unknown }).prompt);
      const question = boundedText((body as { question?: unknown }).question);
      const tags = (body as { tags?: unknown }).tags;
      if (prompt == null || question == null || !question.trim()) {
        return interviewResponse({ error: "Invalid tag request." }, 400);
      }
      if (!Array.isArray(tags) || tags.length === 0 || tags.length > 300) {
        return interviewResponse(
          { error: "Add tags before auto-tagging a question." },
          400,
        );
      }
      const offered: Array<{ id: string; name: string }> = [];
      for (const tag of tags) {
        if (!tag || typeof tag !== "object" || Array.isArray(tag)) {
          return interviewResponse({ error: "Invalid tag request." }, 400);
        }
        const id = (tag as { id?: unknown }).id;
        const name = (tag as { name?: unknown }).name;
        if (
          typeof id !== "string" ||
          !UUID.test(id) ||
          typeof name !== "string" ||
          !name.trim() ||
          name.length > 200
        ) {
          return interviewResponse({ error: "Invalid tag request." }, 400);
        }
        offered.push({ id, name: name.trim() });
      }
      const result = await callUcatAiJson({
        client: service,
        operation: "interview-question-tags",
        systemPrompt: QUESTION_TAGS_SYSTEM,
        userPrompt: buildQuestionTagsPrompt(prompt, question, offered),
        temperature: 0,
        maxCompletionTokens: 500,
        timeoutMs: 45_000,
      });
      return interviewResponse({
        tagIds: readSelectedTagIds(result.parsed, offered),
      });
    }
    return interviewResponse({ error: "Invalid AI request." }, 400);
  } catch (error) {
    return aiFailure(error);
  }
}
