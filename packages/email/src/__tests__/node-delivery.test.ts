import { deliverEmail, type EmailFetch } from "../node";
import { buildInvitationEmail } from "../index";

describe("deliverEmail", () => {
  it("sends the complete rendered email and base64 attachments to Resend", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: EmailFetch = async (url, init) => {
      requests.push({ url, init });
      return { ok: true, status: 200, text: async () => "" };
    };
    const email = buildInvitationEmail({
      recipientName: "Sam Lee",
      inviteUrl: "https://student.altitutor.com/invite/token",
    });

    await deliverEmail({
      apiKey: "resend_test_key",
      to: ["sam@example.com"],
      email,
      attachments: [
        {
          filename: "welcome.txt",
          content: new TextEncoder().encode("hello"),
          contentType: "text/plain",
        },
      ],
      fetchImpl,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(requests[0]?.init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: "Altitutor <admin@altitutor.com>",
      reply_to: "admin@altitutor.com",
      to: ["sam@example.com"],
      subject: "You’ve been invited to Altitutor",
      text: email.text,
      html: email.html,
      attachments: [
        {
          filename: "welcome.txt",
          content: "aGVsbG8=",
          content_type: "text/plain",
        },
      ],
    });
  });
});
