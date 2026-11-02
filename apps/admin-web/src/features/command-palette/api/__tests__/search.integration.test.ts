/** @jest-environment node */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { createPaletteSearchApi } from "../search";

// Run explicitly through dev:isolated exec; ordinary unit runs never choose a database.
const localDatabaseTest =
  process.env.COMMAND_PALETTE_DATABASE_TEST === "1" ? describe : describe.skip;
localDatabaseTest("palette search against its owned local database", () => {
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const marker = `Palette${randomUUID().replaceAll("-", "")}`;
  const url = process.env.SUPABASE_URL ?? "";
  const db = createClient<Database>(
    url || "http://127.0.0.1:1",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "unused",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  let api = createPaletteSearchApi(db);
  let ownedTarget = false;
  beforeAll(async () => {
    if (
      !process.env.ALTITUTOR_WORKTREE_DEV_MANIFEST ||
      !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)
    )
      throw new Error(
        "Run through dev:isolated exec against its owned loopback database",
      );
    ownedTarget = true;
    const { error } = await db.from("students").insert([
      {
        id: ids[0],
        first_name: marker,
        last_name: "A Closed",
        status: "DISCONTINUED",
      },
      {
        id: ids[1],
        first_name: marker,
        last_name: "B Online",
        status: "DISCONTINUED",
      },
      {
        id: ids[2],
        first_name: marker,
        last_name: "C Inperson",
        status: "ACTIVE",
      },
      {
        id: ids[3],
        first_name: marker,
        last_name: "D OnlineOnly",
        status: null,
      },
      {
        id: ids[4],
        first_name: marker,
        last_name: "E Deleted",
        status: "DISCONTINUED",
      },
    ]);
    if (error) throw error;
    const relationships = await db
      .from("student_online_product_relationships")
      .insert([
        {
          student_id: ids[0],
          product: "UCAT_WEB",
          started_at: "2026-01-01T00:00:00Z",
          closed_at: "2026-02-01T00:00:00Z",
        },
        {
          student_id: ids[1],
          product: "UCAT_WEB",
          started_at: "2026-01-01T00:00:00Z",
        },
        {
          student_id: ids[3],
          product: "UCAT_WEB",
          started_at: "2026-01-01T00:00:00Z",
        },
      ]);
    if (relationships.error) throw relationships.error;
    const admin = createClient<Database>(url, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await admin.auth.signInWithPassword({
      email: "admin@altitutor.test",
      password: "test-password",
    });
    if (login.error) throw login.error;
    const retired = await admin.rpc("retire_student", { p_student_id: ids[4] });
    if (retired.error) throw retired.error;
    api = createPaletteSearchApi(admin);
  });
  afterAll(async () => {
    if (!ownedTarget) return;
    await db
      .from("student_online_product_relationships")
      .delete()
      .in("student_id", ids);
    await db.from("students").delete().in("id", ids);
  });
  it("includes either active relationship and excludes closed/deleted Students before the limit", async () => {
    const result = await api.search({
      type: "student",
      search: marker,
      limit: 2,
    });
    expect(result.results.map((student) => student.title)).toEqual([
      `${marker} B Online`,
      `${marker} C Inperson`,
    ]);
    expect(result.hasMore).toBe(true);
    const nextPage = await api.search({
      type: "student",
      search: marker,
      limit: 2,
      offset: 2,
    });
    expect(nextPage.results.map((student) => student.id)).toEqual([ids[3]]);
    expect(nextPage.hasMore).toBe(false);
    const onlineOnly = await api.search({
      type: "student",
      search: `${marker} OnlineOnly`,
      limit: 2,
    });
    expect(onlineOnly.results.map((student) => student.id)).toEqual([ids[3]]);
  });
  it("finds multiword topic names as well as subject-qualified codes", async () => {
    const byName = await api.search({
      type: "topic",
      search: "Functions and Graphs",
      limit: 20,
    });
    expect(byName.results.map((topic) => topic.title)).toEqual([
      "1 Functions and Graphs",
    ]);
    const byCode = await api.search({
      type: "topic",
      search: "12MATH 1.1",
      limit: 20,
    });
    expect(byCode.results.map((topic) => topic.title)).toEqual([
      "1.1 Linear Functions",
    ]);
  });
  it("returns complete topic ancestry and restricts descendant searches to the selected subtree", async () => {
    const root = await api.search({
      type: "topic",
      search: "Functions",
      limit: 20,
    });
    const linear = root.results.find(
      (topic) => topic.title === "1.1 Linear Functions",
    );
    expect(linear?.parents?.map((parent) => parent.title)).toEqual([
      "12MATH",
      "1 Functions and Graphs",
    ]);
    const subjectId = linear!.parents![0].id;
    const functionsId = linear!.parents![1].id;
    const child = await api.search({
      type: "topic",
      search: "",
      subjectId,
      topicId: functionsId,
      limit: 20,
    });
    expect(child.results.map((topic) => topic.title)).toEqual([
      "1.1 Linear Functions",
    ]);
    const outside = await api.search({
      type: "topic",
      search: "Calculus",
      subjectId,
      topicId: functionsId,
      limit: 20,
    });
    expect(outside.results).toEqual([]);
  });
  it("searches file names and paginates the merged code/name matches without duplicates", async () => {
    const first = await api.search({
      type: "file",
      search: "functions",
      limit: 1,
    });
    expect(first.results).toHaveLength(1);
    expect(first.hasMore).toBe(true);
    const second = await api.search({
      type: "file",
      search: "functions",
      limit: 1,
      offset: 1,
    });
    expect(second.results).toHaveLength(1);
    expect(second.results[0].id).not.toBe(first.results[0].id);
    expect(second.hasMore).toBe(false);
    expect(
      [...first.results, ...second.results]
        .map((file) => file.title.replace(/^\S+\s/, ""))
        .sort(),
    ).toEqual(["functions_answers.pdf", "functions_worksheet.pdf"]);
  });
  it("finds a multiword file name whose final word resembles a code", async () => {
    const fileId = randomUUID();
    const linkId = randomUUID();
    const filename = `${marker} guide`;
    const topic = await db.from("topics").select("id").limit(1).single();
    if (topic.error) throw topic.error;
    try {
      const file = await db.from("files").insert({
        id: fileId,
        mimetype: "application/pdf",
        filename,
        size_bytes: 1,
        storage_provider: "supabase",
        bucket: "resources",
        storage_path: `palette-tests/${fileId}.pdf`,
      });
      if (file.error) throw file.error;
      const link = await db.from("topics_files").insert({
        id: linkId,
        topic_id: topic.data.id,
        file_id: fileId,
        type: "NOTES",
        index: 99,
        code: `palette-${linkId}`,
      });
      if (link.error) throw link.error;
      const result = await api.search({
        type: "file",
        search: filename,
        limit: 20,
      });
      expect(result.results.map((file) => file.id)).toEqual([linkId]);
    } finally {
      await db.from("topics_files").delete().eq("id", linkId);
      await db.from("files").delete().eq("id", fileId);
    }
  });
});
