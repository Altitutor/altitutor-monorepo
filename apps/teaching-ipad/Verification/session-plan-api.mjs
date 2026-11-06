// Generate fictional PDFs with make-preview-pdf.swift into an evidence directory, then run
// pnpm dev:isolated exec -- node apps/teaching-ipad/Verification/session-plan-api.mjs /absolute/evidence-directory
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(
  path.join(process.cwd(), "apps/tutor-web/package.json"),
);
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const manifest = fs.realpathSync(process.env.ALTITUTOR_WORKTREE_DEV_MANIFEST);
const proof = JSON.parse(fs.readFileSync(manifest));
assert.ok(proof.project_id.startsWith("altitutor-agent-test-"));
assert.equal(fs.realpathSync(proof.repository), fs.realpathSync(process.cwd()));
assert.equal(fs.realpathSync(proof.workdir), path.dirname(manifest));
const owned = JSON.parse(
  fs.readFileSync(path.join(path.dirname(manifest), "environment.json")),
);
assert.equal(process.env.SUPABASE_URL, owned.SUPABASE_URL);
assert.equal(
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  owned.SUPABASE_SERVICE_ROLE_KEY,
);
assert.equal(new URL(owned.SUPABASE_URL).hostname, "127.0.0.1");
const evidence = fs.realpathSync(process.argv[2]);
const origin = owned.NEXT_PUBLIC_TUTOR_WEB_URL;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const admin = createClient(
  owned.SUPABASE_URL,
  owned.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
function data(result) {
  if (result.error) throw Error(result.error.message);
  return result.data;
}
async function tutor(name) {
  const email = `plan-${randomUUID()}@example.test`,
    password = randomBytes(24).toString("hex");
  const user = data(
    await admin.auth.admin.createUser({ email, password, email_confirm: true }),
  ).user;
  const id = randomUUID();
  data(
    await admin
      .from("staff")
      .insert({
        id,
        user_id: user.id,
        email,
        first_name: name,
        last_name: "Planning",
        role: "TUTOR",
        status: "ACTIVE",
      }),
  );
  let cookies = [];
  const client = createServerClient(
    owned.SUPABASE_URL,
    owned.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: { name: proof.project_id + "-tutor-web" },
      cookies: {
        getAll: () => cookies,
        setAll: (values) => {
          cookies = values;
        },
      },
    },
  );
  const signed = data(
    await client.auth.signInWithPassword({ email, password }),
  );
  return {
    id,
    email,
    password,
    client,
    token: signed.session.access_token,
    cookie: () => cookies.map((c) => `${c.name}=${c.value}`).join("; "),
  };
}
const first = await tutor("Plan"),
  second = await tutor("Shared"),
  outsider = await tutor("Outside");
const subject = randomUUID(),
  topic = randomUUID(),
  worksheet = randomUUID(),
  answer = randomUUID(),
  session = randomUUID();
data(
  await admin
    .from("subjects")
    .insert({
      id: subject,
      name: "Planning mathematics",
      short_name: "PLAN-" + subject.slice(0, 8),
      year_level: 12,
    }),
);
data(
  await admin
    .from("staff_subjects")
    .insert({ staff_id: first.id, subject_id: subject }),
);
data(
  await admin
    .from("topics")
    .insert({
      id: topic,
      subject_id: subject,
      name: "Planned functions",
      index: 1,
      code: "PLAN" + topic.slice(0, 6),
    }),
);
if (
  !data(await admin.storage.listBuckets()).some(
    (bucket) => bucket.id === "resources",
  )
)
  data(await admin.storage.createBucket("resources", { public: false }));
for (const [id, solutions] of [
  [worksheet, false],
  [answer, true],
]) {
  const file = randomUUID(),
    key = `${subject}/${topic}/${file}.pdf`,
    bytes = fs.readFileSync(
      path.join(evidence, solutions ? "solutions.pdf" : "worksheet.pdf"),
    );
  data(
    await admin.storage
      .from("resources")
      .upload(key, bytes, { contentType: "application/pdf" }),
  );
  data(
    await admin
      .from("files")
      .insert({
        id: file,
        filename: solutions ? "Worked answers.pdf" : "Functions worksheet.pdf",
        mimetype: "application/pdf",
        size_bytes: bytes.length,
        bucket: "resources",
        storage_path: key,
        storage_provider: "supabase",
        created_by: first.id,
      }),
  );
  data(
    await admin
      .from("topics_files")
      .insert({
        id,
        topic_id: topic,
        file_id: file,
        type: "PRACTICE_QUESTIONS",
        index: solutions ? 2 : 1,
        is_solutions: solutions,
        is_solutions_of_id: solutions ? worksheet : null,
      }),
  );
}
const start = new Date(Date.now() + 86400000),
  end = new Date(start.getTime() + 5400000);
data(
  await admin
    .from("sessions")
    .insert({
      id: session,
      type: "DRAFTING",
      status: "ACTIVE",
      subject_id: subject,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      long_name: "Planning verification",
    }),
);
data(
  await admin
    .from("sessions_staff")
    .insert(
      [first, second].map((t) => ({
        session_id: session,
        staff_id: t.id,
        type: "MAIN_TUTOR",
      })),
    ),
);
async function api(actor, body) {
  const response = await fetch(`${origin}/api/sessions/${session}/plan`, {
    method: body ? "PUT" : "GET",
    headers: {
      ...(actor ? { Cookie: actor.cookie() } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120000),
  });
  return { status: response.status, body: await response.json() };
}
async function native(actor, endpoint) {
  const response = await fetch(origin + "/api/teaching/" + endpoint, {
    headers: { Authorization: "Bearer " + actor.token },
    signal: AbortSignal.timeout(120000),
  });
  return { status: response.status, body: await response.json() };
}
assert.equal((await api(null)).status, 401);
assert.equal((await api(outsider)).status, 404);
assert.equal((await api(first)).body.revision, 0);
const saved = await api(first, {
  expectedRevision: 0,
  topicIds: [topic],
  fileIds: [worksheet],
});
assert.equal(saved.status, 200, JSON.stringify(saved.body));
assert.equal(saved.body.revision, 1);
assert.equal(saved.body.topics[0].id, topic);
assert.equal(saved.body.resources[0].solutions.id, answer);
assert.deepEqual(
  (await api(second)).body,
  saved.body,
  "co-assigned tutor without catalog subject sees shared plan",
);
assert.equal(
  (await native(second, "session-plan?sessionID=" + session)).body.resources[0]
    .id,
  worksheet,
);
const download = await native(
  second,
  `documents/${answer}?sessionID=${session}`,
);
assert.equal(download.status, 200);
assert.equal(
  (await fetch(download.body.url)).status,
  200,
  "substitute can download scoped private PDF",
);
assert.equal(
  (await native(outsider, `documents/${answer}?sessionID=${session}`)).status,
  404,
);
assert.equal(
  (await api(first, { expectedRevision: 1, topicIds: [], fileIds: [answer] }))
    .status,
  403,
  "solutions cannot be standalone selection",
);
const edits = await Promise.all(
  [first, second].map((actor) =>
    api(actor, {
      expectedRevision: 1,
      topicIds: [topic],
      fileIds: [worksheet],
    }),
  ),
);
assert.deepEqual(
  edits.map((r) => r.status).sort(),
  [200, 409],
  "one concurrent writer succeeds",
);
assert.equal((await api(second)).body.revision, 2);
assert.ok(
  (
    await first.client.rpc("save_session_lesson_plan", {
      p_session_id: session,
      p_actor_id: first.id,
      p_expected_revision: 2,
      p_topic_ids: [],
      p_file_ids: [],
    })
  ).error,
  "direct client command denied",
);
assert.deepEqual(
  data(await first.client.from("session_lesson_plans").select("*")),
  [],
  "base table RLS denies tutor reads",
);
data(await admin.from("staff").update({ status: "TRIAL" }).eq("id", second.id));
assert.equal(
  (await api(second, { expectedRevision: 2, topicIds: [], fileIds: [] }))
    .status,
  403,
);
data(
  await admin.from("staff").update({ status: "ACTIVE" }).eq("id", second.id),
);
data(
  await admin
    .from("sessions")
    .update({ start_at: new Date(Date.now() - 3600000).toISOString() })
    .eq("id", session),
);
assert.equal(
  (await api(first, { expectedRevision: 2, topicIds: [], fileIds: [] })).status,
  409,
  "started session is read only",
);
data(
  await admin
    .from("sessions")
    .update({ start_at: start.toISOString() })
    .eq("id", session),
);
fs.writeFileSync(
  path.join(evidence, "dev284-api-fixture.json"),
  JSON.stringify({
    origin,
    project: proof.project_id,
    session,
    subject,
    topic,
    worksheet,
    first: { email: first.email, password: first.password },
  }),
  { mode: 0o600 },
);
console.log(
  "PASS: plan HTTP save/reload, assigned scope, substitute access, concurrent edits, trial restriction, past restriction, direct write denial and native session/document access",
);
