import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createAndroidSheetDiagnostics,
  createSheetDiagnostics,
  type SheetBreadcrumb,
} from "../features/navigation/sheet-diagnostics";

test("Android adapter respects the current Sentry client collection gate", () => {
  const events: SheetBreadcrumb[] = [];
  let client: { getOptions: () => { enabled?: boolean } } | undefined;
  const diagnostic = createAndroidSheetDiagnostics("android", {
    getClient: () => client,
    addBreadcrumb: (event) => events.push(event),
  });
  diagnostic.listeners("study-orb").focus();
  assert.equal(events.length, 0);
  client = { getOptions: () => ({ enabled: false }) };
  diagnostic.listeners("study-orb").focus();
  assert.equal(events.length, 0);
  client = { getOptions: () => ({ enabled: true }) };
  diagnostic.listeners("study-orb").focus();
  assert.equal(events.length, 1);
  client = { getOptions: () => ({}) };
  diagnostic.listeners("study-orb").focus();
  assert.equal(events.length, 2);
  client = { getOptions: () => ({ enabled: false }) };
  let updated = false;
  diagnostic.requestFullHeight("study-orb", () => {
    updated = true;
  });
  assert.equal(events.length, 2);
  assert.equal(updated, true);
});

test("non-Android adapter never consults or writes to Sentry", () => {
  for (const platform of ["ios", "web", undefined]) {
    const diagnostic = createAndroidSheetDiagnostics(platform, {
      getClient: () => assert.fail("non-Android client lookup"),
      addBreadcrumb: () => assert.fail("non-Android capture"),
    });
    diagnostic.listeners("trainer-start").focus();
    let updated = false;
    diagnostic.requestFullHeight("trainer-start", () => {
      updated = true;
    });
    assert.equal(updated, true);
  }
});

test("Android adapter isolates both client lookup and capture failures", () => {
  for (const failure of ["lookup", "capture"]) {
    const diagnostic = createAndroidSheetDiagnostics("android", {
      getClient: () => {
        if (failure === "lookup") throw new Error("client unavailable");
        return { getOptions: () => ({ enabled: true }) };
      },
      addBreadcrumb: () => {
        throw new Error("sink unavailable");
      },
    });
    assert.doesNotThrow(() => diagnostic.listeners("study-orb").focus());
    let updated = false;
    diagnostic.requestFullHeight("study-orb", () => {
      updated = true;
    });
    assert.equal(updated, true);
  }
});

test("sheet listeners and expansion action capture ordered evidence before changing state", () => {
  const events: SheetBreadcrumb[] = [];
  const diagnostic = createSheetDiagnostics(true, (event) =>
    events.push(event),
  );
  const listeners = diagnostic.listeners("study-orb");
  listeners.focus();
  listeners.transitionStart({ data: { closing: false } });
  listeners.sheetDetentChange({ data: { index: 0, stable: true } });
  diagnostic.requestFullHeight("study-orb", () => {
    assert.equal(events.at(-1)?.data.phase, "request_full_height");
  });
  listeners.sheetDetentChange({ data: { index: 0, stable: false } });
  listeners.transitionEnd({ data: { closing: false } });
  assert.deepEqual(
    events.map((event) => event.data.phase),
    [
      "focus",
      "transition_start",
      "detent_change",
      "request_full_height",
      "detent_change",
      "transition_end",
    ],
  );
  assert.deepEqual(events[3]?.data, {
    schema: 1,
    route: "study-orb",
    initial_detents: "half_full",
    phase: "request_full_height",
    requested_detents: "full",
  });
});

test("fixed single-detent menus retain distinct baseline evidence", () => {
  const events: SheetBreadcrumb[] = [];
  const diagnostic = createSheetDiagnostics(true, (event) =>
    events.push(event),
  );
  diagnostic.listeners("exam-menu").focus();
  diagnostic
    .listeners("trainer-menu")
    .transitionStart({ data: { closing: true } });
  assert.equal(events[0]?.data.initial_detents, "half");
  assert.deepEqual(events[1]?.data, {
    schema: 1,
    route: "trainer-menu",
    initial_detents: "half",
    phase: "transition_start",
    closing: true,
  });
});

test("allowlists exclude arbitrary routes and callback properties", () => {
  const events: SheetBreadcrumb[] = [];
  const diagnostic = createSheetDiagnostics(true, (event) =>
    events.push(event),
  );
  for (const route of [
    "/exam/private-id?token=secret",
    "constructor",
    "__proto__",
    "(tabs)",
  ])
    diagnostic.listeners(route).focus();
  const data = {
    index: 0,
    stable: true,
    token: "secret",
    params: { studentId: "private" },
  };
  diagnostic.listeners("trainer-start").sheetDetentChange({ data });
  assert.deepEqual(events, [
    {
      category: "ucat.sheet",
      level: "info",
      data: {
        schema: 1,
        route: "trainer-start",
        initial_detents: "half_full",
        phase: "detent_change",
        index: 0,
        stable: true,
      },
    },
  ]);
  assert.doesNotMatch(JSON.stringify(events), /secret|private|token|params/);
});

test("invalid native values are dropped instead of retaining arbitrary payloads", () => {
  const events: SheetBreadcrumb[] = [];
  const listeners = createSheetDiagnostics(true, (event) =>
    events.push(event),
  ).listeners("study-orb");
  for (const index of [NaN, Infinity, -2, 3, 0.5])
    listeners.sheetDetentChange({ data: { index, stable: true } });
  assert.equal(events.length, 0);
  listeners.sheetDetentChange({ data: { index: -1, stable: true } });
  assert.equal(events[0]?.data.index, -1);
});

test("disabled diagnostics preserve actions without capturing evidence", () => {
  let updated = false;
  const diagnostic = createSheetDiagnostics(false, () =>
    assert.fail("disabled capture"),
  );
  diagnostic.listeners("study-orb").focus();
  diagnostic.requestFullHeight("study-orb", () => {
    updated = true;
  });
  assert.equal(updated, true);
});

test("sink failures cannot interrupt native callbacks or state updates", () => {
  const diagnostic = createSheetDiagnostics(true, () => {
    throw new Error("sink offline");
  });
  assert.doesNotThrow(() => diagnostic.listeners("study-orb").focus());
  let updated = false;
  diagnostic.requestFullHeight("trainer-start", () => {
    updated = true;
  });
  assert.equal(updated, true);
  const failure = new Error("state update failed");
  assert.throws(
    () =>
      diagnostic.requestFullHeight("trainer-start", () => {
        throw failure;
      }),
    (error) => error === failure,
  );
});
