import { emailListSchema } from "@/features/email/types";
import {
  buildPersonFieldOrFilters,
  buildCodeExactOrPrefixOrFilter,
  escapeIlikePattern,
  buildSubjectNameOrFilter,
  buildCodeContainsPattern,
  parseSubjectQualifiedSearch,
  type Database,
  type Tables,
} from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type {
  PaletteEntity,
  PaletteSearchResult,
  SearchPaletteEntities,
} from "../model";

function textFilter<T extends { or: (filters: string) => T }>(
  request: T,
  search: string,
  fields: string[],
): T {
  for (const filter of buildPersonFieldOrFilters(search, fields))
    request = request.or(filter);
  return request;
}

async function rows<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
const personName = (person: {
  first_name: string | null;
  last_name: string | null;
  id: string;
}) =>
  [person.first_name, person.last_name].filter(Boolean).join(" ") ||
  person.id.slice(0, 8);
const subjectName = (subject: Tables<"subjects">) =>
  subject.short_name || subject.long_name || subject.name;
type TopicRow = Tables<"topics"> & { subject: Tables<"subjects"> };
const topicName = (topic: Tables<"topics">) =>
  `${topic.code} ${topic.name}`.trim();

export function createPaletteSearchApi(db: SupabaseClient<Database>): {
  search: SearchPaletteEntities;
} {
  return {
    search: async ({
      type,
      search,
      limit,
      subjectId,
      topicId,
      offset: requestedOffset = 0,
    }): Promise<PaletteSearchResult> => {
      const take = Math.max(1, Math.min(Math.trunc(limit), 999));
      const offset = Math.max(0, Math.trunc(requestedOffset));
      const finish = (results: PaletteEntity[]) => ({
        results: results.slice(0, take),
        hasMore: results.length > take,
      });
      switch (type) {
        case "email": {
          const result = await db.rpc("email_list_threads", { p_folder_id: "", p_search: search, p_assignee: "all", p_offset: offset, p_limit: take });
          if (result.error) throw new Error(result.error.message);
          const page = emailListSchema.parse(result.data);
          return { results: page.threads.map((thread) => ({ type, id: thread.id, title: thread.subject || "Email conversation", subtitle: thread.senderName || thread.sender })), hasMore: page.hasMore };
        }
        case "student": {
          // An empty left embed permits OR with the independent in-person relationship.
          // Filter eligibility on the server, before the result limit; never alter mention search.
          const query = db
            .from("students")
            .select(
              "id,first_name,last_name,school,online:student_online_product_relationships()",
            )
            .is("deleted_at", null)
            .is("online.closed_at", null)
            .or("status.in.(ACTIVE,TRIAL),online.not.is.null");
          const data = await rows(
            textFilter(query, search, [
              "first_name",
              "last_name",
              "email",
              "phone",
            ])
              .order("last_name")
              .order("first_name")
              .order("id")
              .range(offset, offset + take),
          );
          return finish(
            data.map((student) => ({
              type,
              id: student.id,
              title: personName(student),
              subtitle: student.school ?? undefined,
            })),
          );
        }
        case "staff": {
          const data = await rows(
            textFilter(
              db
                .from("staff")
                .select("id,first_name,last_name,role")
                .in("status", ["ACTIVE", "TRIAL"]),
              search,
              ["first_name", "last_name", "email", "phone_number"],
            )
              .order("last_name")
              .order("id")
              .range(offset, offset + take),
          );
          return finish(
            data.map((staff) => ({
              type,
              id: staff.id,
              title: personName(staff),
              subtitle: staff.role,
            })),
          );
        }
        case "parent": {
          const data = await rows(
            textFilter(
              db.from("parents").select("id,first_name,last_name"),
              search,
              ["first_name", "last_name", "email", "phone"],
            )
              .order("last_name")
              .order("id")
              .range(offset, offset + take),
          );
          return finish(
            data.map((parent) => ({
              type,
              id: parent.id,
              title: personName(parent),
            })),
          );
        }
        case "class": {
          const data = await rows(
            textFilter(
              db
                .from("classes")
                .select("id,short_name,long_name")
                .eq("status", "ACTIVE"),
              search,
              ["short_name", "long_name"],
            )
              .order("short_name")
              .order("id")
              .range(offset, offset + take),
          );
          return finish(
            data.map((cls) => ({
              type,
              id: cls.id,
              title: cls.short_name || `Class ${cls.id.slice(0, 8)}`,
              subtitle: cls.long_name ?? undefined,
            })),
          );
        }
        case "session": {
          const data = await rows(
            textFilter(
              db
                .from("sessions")
                .select("id,short_name,long_name,start_at")
                .eq("status", "ACTIVE"),
              search,
              ["short_name", "long_name"],
            )
              .order("start_at", { ascending: false })
              .order("id")
              .range(offset, offset + take),
          );
          return finish(
            data.map((session) => ({
              type,
              id: session.id,
              title: session.short_name || `Session ${session.id.slice(0, 8)}`,
              subtitle: [
                session.long_name,
                session.start_at
                  ? new Date(session.start_at).toLocaleString("en-AU", {
                      timeZone: "Australia/Adelaide",
                    })
                  : "",
              ]
                .filter(Boolean)
                .join(" · "),
            })),
          );
        }
        case "subject": {
          const data = await rows(
            textFilter(db.from("subjects").select("*"), search, [
              "short_name",
              "long_name",
              "name",
            ])
              .order("short_name")
              .order("id")
              .range(offset, offset + take),
          );
          return finish(
            data.map((subject) => ({
              type,
              id: subject.id,
              title: subjectName(subject),
              subtitle: subject.long_name ?? undefined,
            })),
          );
        }
        case "task": {
          const data = await rows(
            textFilter(
              db.from("tasks").select("id,title").neq("status", "done"),
              search,
              ["title"],
            )
              .order("updated_at", { ascending: false })
              .order("id")
              .range(offset, offset + take),
          );
          return finish(
            data.map((task) => ({ type, id: task.id, title: task.title })),
          );
        }
        case "issue": {
          const data = await rows(
            textFilter(
              db.from("issues").select("id,name").neq("status", "resolved"),
              search,
              ["name"],
            )
              .order("updated_at", { ascending: false })
              .order("id")
              .range(offset, offset + take),
          );
          return finish(
            data.map((issue) => ({ type, id: issue.id, title: issue.name })),
          );
        }
        case "project": {
          const data = await rows(
            textFilter(
              db.from("projects").select("id,name").neq("status", "completed"),
              search,
              ["name"],
            )
              .order("updated_at", { ascending: false })
              .order("id")
              .range(offset, offset + take),
          );
          return finish(
            data.map((project) => ({
              type,
              id: project.id,
              title: project.name,
            })),
          );
        }
        case "note": {
          const data = await rows(
            textFilter(db.from("notes_documents").select("id,title"), search, [
              "title",
            ])
              .order("updated_at", { ascending: false })
              .order("id")
              .range(offset, offset + take),
          );
          return finish(
            data.map((document) => ({
              type,
              id: document.id,
              title: document.title || "Untitled document",
            })),
          );
        }
        case "topic": {
          let data: TopicRow[] = [];
          const select = "*,subject:subjects!inner(*)";
          if (subjectId) {
            // A subject tree is one scope. Page through it so descendant search is not
            // silently truncated by PostgREST's default response cap.
            for (let offset = 0; ; offset += 1000) {
              const page = await rows(
                db
                  .from("topics")
                  .select(select)
                  .eq("subject_id", subjectId)
                  .order("index")
                  .order("id")
                  .range(offset, offset + 999),
              );
              data.push(...page);
              if (page.length < 1000) break;
            }
          } else {
            let query = db.from("topics").select(select);
            const parsed = parseSubjectQualifiedSearch(search);
            if (parsed.mode === "qualified") {
              const subjects = await rows(
                db
                  .from("subjects")
                  .select("id")
                  .or(buildSubjectNameOrFilter(parsed.subjectQuery)),
              );
              if (subjects.length)
                query = query
                  .in(
                    "subject_id",
                    subjects.map((subject) => subject.id),
                  )
                  .ilike("code", buildCodeContainsPattern(parsed.codeQuery));
              // Short final words also look like codes. Without a matching
              // subject, retain ordinary name search for the complete phrase.
              else query = textFilter(query, search, ["code", "name"]);
            } else query = textFilter(query, search, ["code", "name"]);
            data = await rows(
              query
                .order("code")
                .order("id")
                .range(offset, offset + take),
            );
          }
          const byId = new Map(data.map((topic) => [topic.id, topic]));
          // Batch ancestor reads for root results, retaining complete breadcrumb paths.
          for (;;) {
            const missing = [
              ...new Set(
                [...byId.values()]
                  .map((topic) => topic.parent_id)
                  .filter((id): id is string => !!id && !byId.has(id)),
              ),
            ];
            if (!missing.length) break;
            const ancestors = await rows(
              db.from("topics").select(select).in("id", missing),
            );
            if (!ancestors.length) break;
            ancestors.forEach((topic) => byId.set(topic.id, topic));
          }
          const ancestors = (topic: TopicRow): TopicRow[] => {
            const trail: TopicRow[] = [],
              seen = new Set([topic.id]);
            let id = topic.parent_id;
            while (id && !seen.has(id)) {
              seen.add(id);
              const parent = byId.get(id);
              if (!parent) break;
              trail.unshift(parent);
              id = parent.parent_id;
            }
            return trail;
          };
          if (subjectId)
            data = data.filter((topic) => {
              if (!search.trim()) return topic.parent_id === (topicId ?? null);
              const inScope =
                !topicId ||
                ancestors(topic).some((parent) => parent.id === topicId);
              return (
                inScope &&
                search
                  .toLowerCase()
                  .split(/\s+/)
                  .every((token) =>
                    `${topic.code} ${topic.name}`.toLowerCase().includes(token),
                  )
              );
            });
          return finish(
            (subjectId ? data.slice(offset) : data).map((topic) => ({
              type,
              id: topic.id,
              title: topicName(topic),
              parents: [
                {
                  type: "subject",
                  id: topic.subject.id,
                  title: subjectName(topic.subject),
                },
                ...ancestors(topic).map((parent) => ({
                  type: "topic" as const,
                  id: parent.id,
                  title: topicName(parent),
                })),
              ],
            })),
          );
        }
        case "file": {
          let query = db
            .from("topics_files")
            .select(
              "id,code,file:files!inner(filename),filename_match:files(),topic:topics!inner(id,name,subject:subjects!inner(id,short_name,name))",
            )
            .is("file.deleted_at", null);
          const parsed = parseSubjectQualifiedSearch(search);
          let qualified = false;
          if (parsed.mode === "qualified") {
            const subjects = await rows(
              db
                .from("subjects")
                .select("id")
                .or(buildSubjectNameOrFilter(parsed.subjectQuery)),
            );
            if (subjects.length) {
              qualified = true;
              query = query
                .in(
                  "topic.subject_id",
                  subjects.map((subject) => subject.id),
                )
                .ilike("code", buildCodeContainsPattern(parsed.codeQuery));
            }
          }
          if (!qualified && search.trim()) {
            query = query
              .ilike(
                "filename_match.filename",
                `%${escapeIlikePattern(search.trim())}%`,
              )
              .or(
                `${buildCodeExactOrPrefixOrFilter("code", search)},filename_match.not.is.null`,
              );
          }
          const files = await rows(
            query
              .order("code")
              .order("id")
              .range(offset, offset + take),
          );
          return finish(
            files.map((file) => ({
              type,
              id: file.id,
              title: [file.code, file.file.filename].filter(Boolean).join(" "),
              parents: [
                {
                  type: "subject",
                  id: file.topic.subject.id,
                  title:
                    file.topic.subject.short_name || file.topic.subject.name,
                },
                { type: "topic", id: file.topic.id, title: file.topic.name },
              ],
            })),
          );
        }
      }
    },
  };
}

export const searchPaletteEntities: SearchPaletteEntities = (search) =>
  createPaletteSearchApi(getSupabaseClient()).search(search);
