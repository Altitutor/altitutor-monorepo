import assert from "node:assert/strict";
import test from "node:test";

import { ensureRecordingStorageLimit } from "./storage-limit.mjs";

test("raises the hosted ceiling for a fifteen-minute video without resetting Storage features", async () => {
  let config = { fileSizeLimit: 52_428_800, features: { imageTransformation: { enabled: true } } };
  const methods = [];
  const request = async (url, options) => {
    assert.equal(url, "https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/config/storage");
    assert.equal(options.headers.Authorization, "Bearer fixture-token");
    methods.push(options.method);
    if (options.method === "PATCH") {
      assert.deepEqual(JSON.parse(options.body), { fileSizeLimit: 209_715_200 });
      config = { ...config, ...JSON.parse(options.body) };
    }
    return Response.json(config);
  };

  const result = await ensureRecordingStorageLimit({
    projectRef: "abcdefghijklmnopqrst", accessToken: "fixture-token", request,
  });

  assert.deepEqual(methods, ["GET", "PATCH", "GET"]);
  assert.deepEqual(result, { previousBytes: 52_428_800, limitBytes: 209_715_200, changed: true });
  assert.ok(config.fileSizeLimit > 119_700_000);
  assert.deepEqual(config.features, { imageTransformation: { enabled: true } });
});

test("an existing larger upload allowance is retained without a write", async () => {
  const methods = [];
  const result = await ensureRecordingStorageLimit({
    projectRef: "abcdefghijklmnopqrst", accessToken: "fixture-token",
    request: async (_url, options) => {
      methods.push(options.method);
      return Response.json({ fileSizeLimit: 524_288_000 });
    },
  });
  assert.deepEqual(methods, ["GET"]);
  assert.deepEqual(result, { previousBytes: 524_288_000, limitBytes: 524_288_000, changed: false });
});

test("configuration failure stops delivery without exposing provider bodies", async () => {
  await assert.rejects(ensureRecordingStorageLimit({
    projectRef: "abcdefghijklmnopqrst", accessToken: "fixture-token",
    request: async () => new Response("private-provider-body", { status: 403 }),
  }), { message: "Storage configuration GET failed (HTTP 403)" });
});

test("unknown global limits never cause a blind configuration write", async () => {
  for (const config of [{}, { fileSizeLimit: "52428800" }, { fileSizeLimit: -1 }]) {
    const methods = [];
    await assert.rejects(ensureRecordingStorageLimit({
      projectRef: "abcdefghijklmnopqrst", accessToken: "fixture-token",
      request: async (_url, options) => {
        methods.push(options.method);
        return Response.json(config);
      },
    }), /invalid global file size limit/u);
    assert.deepEqual(methods, ["GET"]);
  }
});

test("an acknowledged write is insufficient until the read-back accepts the recording size", async () => {
  await assert.rejects(ensureRecordingStorageLimit({
    projectRef: "abcdefghijklmnopqrst", accessToken: "fixture-token",
    request: async () => Response.json({ fileSizeLimit: 52_428_800 }),
  }), /still rejects the configured recording size/u);
});

test("invalid project references and missing credentials fail before sending a request", async () => {
  const request = async () => assert.fail("must not send an unauthorised request");
  await assert.rejects(ensureRecordingStorageLimit({ projectRef: "../other-project", accessToken: "fixture-token", request }), /project reference/u);
  await assert.rejects(ensureRecordingStorageLimit({ projectRef: "abcdefghijklmnopqrst", accessToken: "", request }), /SUPABASE_ACCESS_TOKEN/u);
});
