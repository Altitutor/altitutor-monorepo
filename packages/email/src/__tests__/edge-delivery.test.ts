import { deliverEdgeEmail, type EdgeEmailFetch } from "../index";
import { renderEmail } from "../index";

describe("deliverEdgeEmail", () => {
  it("preserves idempotency, unsubscribe headers and provider message id", async () => {
    const requests: RequestInit[] = [];
    const fetchImpl: EdgeEmailFetch = async (_url, init) => {
      requests.push(init);
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({ id: "email_123" }),
      };
    };
    const email = renderEmail({
      brand: "ucat",
      subject: "Your weekly review",
      previewText: "Your week in review.",
      heading: "Your weekly review",
      bodyHtml: "<p>Your review.</p>",
      bodyText: "Your review.",
    });

    const result = await deliverEdgeEmail({
      apiKey: "resend_test_key",
      to: "sam@example.com",
      email,
      idempotencyKey: "ucat-lifecycle/week-1",
      headers: { "List-Unsubscribe": "<https://example.com/unsubscribe>" },
      tags: [{ name: "product", value: "ucat" }],
      fetchImpl,
    });

    expect(result).toEqual({ providerMessageId: "email_123" });
    expect(requests[0]?.headers).toMatchObject({
      "Idempotency-Key": "ucat-lifecycle/week-1",
    });
    const body = JSON.parse(String(requests[0]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      reply_to: "admin@altitutor.com",
      headers: { "List-Unsubscribe": "<https://example.com/unsubscribe>" },
      tags: [{ name: "product", value: "ucat" }],
    });
  });
});
