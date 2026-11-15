import assert from "node:assert/strict";
import * as Sentry from "npm:@sentry/deno@10.65.0";

for (const { disabled, ci } of [{ disabled: true, ci: false }, { disabled: false, ci: false }, { disabled: false, ci: true }]) {
  const collectionOff = disabled || ci;
  Deno.test(`Edge reporter preserves diagnostic context with collection ${collectionOff ? "off" : "on"}, CI=${ci}`, async () => {
    const environment = {
      SENTRY_DSN: "https://public@sentry.example.test/1",
      SENTRY_DISABLED: String(disabled),
      SENTRY_TEST_OPT_IN: "true",
      CI: String(ci),
    };
    const previous = Object.fromEntries(Object.keys(environment).map((key) => [key, Deno.env.get(key)]));
    const originalServe = Object.getOwnPropertyDescriptor(Deno, "serve")!;
    const handlers: Array<(request: Request) => Response | Promise<Response>> = [];
    const events: Sentry.ErrorEvent[] = [];
    try {
      for (const [key, value] of Object.entries(environment)) Deno.env.set(key, value);
      Object.defineProperty(Deno, "serve", {
        configurable: true,
        enumerable: originalServe.enumerable,
        writable: true,
        value: (handler: (request: Request) => Response | Promise<Response>) => { handlers.push(handler); },
      });
      const { serveWithSentry } = ci
        ? await import("./sentry.ts?collection=ci")
        : disabled
        ? await import("./sentry.ts?collection=off")
        : await import("./sentry.ts?collection=on");
      // An in-memory SDK transport: this test never sends an event externally.
      Sentry.init({
        dsn: environment.SENTRY_DSN,
        enabled: true,
        defaultIntegrations: false,
        transport: () => ({ send: () => Promise.resolve({}), flush: () => Promise.resolve(true) }),
        beforeSend(event) { events.push(event); return null; },
      });
      const diagnostic = { phase: "draft_create", failure_kind: "timeout", http_status: null, elapsed_ms: 15000 };
      serveWithSentry("billing-runner", (_request, reporter) => {
        reporter.captureException(new Error("Operational mailbox outcome uncertain"), {
          fingerprint: ["billing-runner-operational-mail-uncertain"],
          contexts: { operational_mail: diagnostic },
        });
        return new Response("saved", { status: 200 });
      });
      assert.equal(handlers.length, 1);
      const response = await handlers[0](new Request("https://private.example.test/?private-query=secret", {
        headers: { authorization: "private-token" },
      }));
      assert.equal(response.status, 200);
      assert.equal(await response.text(), "saved");
      assert.equal(events.length, collectionOff ? 0 : 1);
      if (!collectionOff) {
        assert.deepEqual(events[0].contexts?.operational_mail, diagnostic);
        assert.deepEqual(events[0].fingerprint, ["billing-runner-operational-mail-uncertain"]);
        assert.ok(!JSON.stringify(events).includes("private"));
      }
    } finally {
      await Sentry.close();
      Object.defineProperty(Deno, "serve", originalServe);
      for (const [key, value] of Object.entries(previous)) value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
    }
  });
}
