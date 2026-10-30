import { deliverOperationalMailboxEmail } from "../operational-mailbox";
import { renderEmail } from "../render-email";
it("submits canonical operational email through a durable draft and shared Sent workflow", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const email = renderEmail({
    brand: "altitutor",
    subject: "Invoice ready",
    previewText: "Invoice available",
    heading: "Invoice ready",
    bodyHtml: "<p>Canonical invoice details.</p>",
    bodyText: "Canonical invoice details.",
  });
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith("/rpc/email_operational_prepare"))
      return Response.json({
        id: "operation-one",
        token: "lease-one",
        proceed: true,
        state: "creating",
        draftId: null,
        changeKey: null,
      });
    if (url.endsWith("/rpc/email_operational_update"))
      return Response.json(true);
    if (url.endsWith("/messages") && init?.method === "POST")
      return Response.json({ id: "provider-draft", changeKey: "one" });
    if (url.endsWith("/messages/provider-draft/send"))
      return new Response(null, { status: 202 });
    return Response.json({
      id: "provider-draft",
      isDraft: true,
      changeKey: "one",
    });
  };
  const result = await deliverOperationalMailboxEmail({
    mailbox: {
      environment: "production" as const,
      address: "admin@altitutor.com",
      allowedRecipients: [],
    },
    serviceUrl: "http://127.0.0.1:9999",
    serviceKey: "fixture-service-key",
    getAccessToken: async () => "fixture-graph-token",
    to: ["parent@example.test"],
    email,
    idempotencyKey: "core-invoice/invoice-fixture/parent@example.test",
    links: [],
    fetchImpl,
  });
  expect(result).toEqual({
    providerMessageId: "provider-draft",
    state: "submitted",
  });
  const draft = requests.find(
    (request) =>
      request.url.endsWith("/messages") && request.init?.method === "POST",
  )!;
  expect(JSON.parse(String(draft.init?.body))).toMatchObject({
    subject: "Invoice ready",
    body: { contentType: "HTML", content: email.html },
    from: {
      emailAddress: { name: "Altitutor Admin", address: "admin@altitutor.com" },
    },
    toRecipients: [{ emailAddress: { address: "parent@example.test" } }],
  });
  expect(new Headers(draft.init?.headers).get("Prefer")).toContain(
    'IdType="ImmutableId"',
  );
  const beginSend = requests.findIndex(
    (request) =>
      request.url.endsWith("email_operational_update") &&
      JSON.parse(String(request.init?.body)).p_state === "sending",
  );
  expect(beginSend).toBeLessThan(
    requests.findIndex((request) => request.url.endsWith("/send")),
  );
});
it("preserves an ambiguous operational send and does not repeat it on a domain retry", async () => {
  let state = "creating",
    claimed = false,
    sends = 0;
  const email = renderEmail({
    brand: "altitutor",
    subject: "Registration",
    previewText: "Registration link",
    heading: "Registration",
    bodyHtml: "<p>Register</p>",
    bodyText: "Register",
  });
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("email_operational_prepare")) {
      const proceed = !claimed;
      claimed = true;
      return Response.json({
        id: "operation-two",
        token: proceed ? "lease-two" : null,
        proceed,
        state,
        draftId: state === "creating" ? null : "uncertain-draft",
        changeKey: "one",
      });
    }
    if (url.endsWith("email_operational_update")) {
      state = JSON.parse(String(init?.body)).p_state;
      return Response.json(true);
    }
    if (url.endsWith("/send")) {
      sends++;
      throw new Error("Connection lost after submission");
    }
    return Response.json({
      id: "uncertain-draft",
      changeKey: "one",
      isDraft: true,
    });
  };
  const input = {
    mailbox: {
      environment: "production" as const,
      address: "admin@altitutor.com",
      allowedRecipients: [],
    },
    serviceUrl: "http://127.0.0.1:9999",
    serviceKey: "fixture-service-key",
    getAccessToken: async () => "fixture-graph-token",
    to: ["parent@example.test"],
    email,
    idempotencyKey: "registration-fixture",
    links: [],
    fetchImpl,
  };
  await expect(deliverOperationalMailboxEmail(input)).rejects.toThrow(
    "unresolved",
  );
  await expect(deliverOperationalMailboxEmail(input)).rejects.toThrow(
    "unresolved",
  );
  expect(state).toBe("uncertain_send");
  expect(sends).toBe(1);
});
it("keeps a definite Microsoft rejection retryable without mislabelling it as an ambiguous send", async () => {
  let state = "creating";
  const email = renderEmail({
    brand: "altitutor",
    subject: "Invoice",
    previewText: "Invoice",
    heading: "Invoice",
    bodyHtml: "<p>Invoice</p>",
    bodyText: "Invoice",
  });
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("email_operational_prepare"))
      return Response.json({
        id: "rejected-operation",
        token: "rejected-lease",
        state,
        proceed: true,
        draftId: null,
        changeKey: null,
      });
    if (url.endsWith("email_operational_update")) {
      state = JSON.parse(String(init?.body)).p_state;
      return Response.json(true);
    }
    return new Response(null, { status: 403 });
  };
  await expect(
    deliverOperationalMailboxEmail({
      mailbox: {
        environment: "production" as const,
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      serviceUrl: "http://127.0.0.1:9999",
      serviceKey: "fixture-key",
      getAccessToken: async () => "fixture-token",
      to: ["parent@example.test"],
      email,
      idempotencyKey: "rejected-fixture",
      links: [],
      fetchImpl,
    }),
  ).rejects.toThrow("403");
  expect(state).toBe("failed");
});
it("refuses to create provider mail when the registry omits its ownership token", async () => {
  const email = renderEmail({
    brand: "altitutor",
    subject: "Confirmation",
    previewText: "Confirmation",
    heading: "Confirmation",
    bodyHtml: "<p>Confirmation</p>",
    bodyText: "Confirmation",
  });
  let graphRequests = 0;
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).endsWith("email_operational_prepare"))
      return Response.json({
        id: "incomplete-claim",
        token: null,
        state: "creating",
        proceed: true,
        draftId: null,
        changeKey: null,
      });
    graphRequests++;
    throw new Error("Provider request without ownership");
  };
  await expect(
    deliverOperationalMailboxEmail({
      mailbox: {
        environment: "production" as const,
        address: "admin@altitutor.com",
        allowedRecipients: [],
      },
      serviceUrl: "http://127.0.0.1:9999",
      serviceKey: "fixture-key",
      getAccessToken: async () => "fixture-token",
      to: ["parent@example.test"],
      email,
      idempotencyKey: "incomplete-claim",
      links: [],
      fetchImpl,
    }),
  ).rejects.toThrow("registry response");
  expect(graphRequests).toBe(0);
});

it("uses the development mailbox for the provider and durable delivery payload", async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    requests.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")),
    });
    if (String(url).endsWith("email_operational_prepare"))
      return Response.json({
        id: "dev-operation",
        token: "dev-lease",
        proceed: true,
        state: "creating",
        draftId: null,
        changeKey: null,
      });
    if (String(url).endsWith("email_operational_update"))
      return Response.json(true);
    if (String(url).endsWith("/send"))
      return new Response(null, { status: 202 });
    return Response.json({ id: "dev-draft", changeKey: "one", isDraft: true });
  };
  await deliverOperationalMailboxEmail({
    mailbox: {
      environment: "development",
      address: "admin@development.altitutor.com",
      allowedRecipients: ["matt@altitutor.com"],
    },
    serviceUrl: "http://127.0.0.1:9999",
    serviceKey: "fixture-key",
    getAccessToken: async () => "fixture-token",
    to: ["matt@altitutor.com"],
    email: renderEmail({
      brand: "altitutor",
      subject: "Development invoice",
      previewText: "Test",
      heading: "Test",
      bodyHtml: "<p>Test</p>",
      bodyText: "Test",
    }),
    idempotencyKey: "development-invoice",
    links: [],
    fetchImpl,
  });
  const draft = requests.find((r) => r.url.endsWith("/messages"))!;
  expect(draft.url).toBe(
    "https://graph.microsoft.com/v1.0/users/admin%40development.altitutor.com/messages",
  );
  expect(draft.body).toMatchObject({
    from: { emailAddress: { address: "admin@development.altitutor.com" } },
    replyTo: [{ emailAddress: { address: "admin@development.altitutor.com" } }],
  });
  expect(requests[0].body).toMatchObject({
    p_mailbox_address: "admin@development.altitutor.com",
    p_payload: { email: { replyTo: "admin@development.altitutor.com" } },
  });
});

it("blocks non-test recipients before recording or contacting Microsoft in development", async () => {
  const fetchImpl = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockRejectedValue(new Error("Unexpected external request"));
  await expect(
    deliverOperationalMailboxEmail({
      mailbox: {
        environment: "development",
        address: "admin@development.altitutor.com",
        allowedRecipients: ["matt@altitutor.com"],
      },
      serviceUrl: "http://127.0.0.1:9999",
      serviceKey: "fixture-key",
      getAccessToken: async () => "fixture-token",
      to: ["customer@example.test"],
      email: renderEmail({
        brand: "altitutor",
        subject: "Test",
        previewText: "Test",
        heading: "Test",
        bodyHtml: "<p>Test</p>",
        bodyText: "Test",
      }),
      idempotencyKey: "blocked-fixture",
      links: [],
      fetchImpl,
    }),
  ).rejects.toThrow("configured test recipients");
  expect(fetchImpl).not.toHaveBeenCalled();
});
