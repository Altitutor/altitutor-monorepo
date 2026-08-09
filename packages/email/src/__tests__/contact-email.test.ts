import { buildContactRequestEmail } from "../index";

describe("buildContactRequestEmail", () => {
  it("formats an escaped internal request with the user's reply address", () => {
    const email = buildContactRequestEmail({
      appName: "student-web",
      message: "Please help with <billing> & access.",
      user: { name: "Sam Lee", email: "sam@example.com", id: "user-1" },
      diagnostics: { path: "/billing" },
    });

    expect(email.subject).toBe("[student-web] Contact request");
    expect(email.replyTo).toBe("sam@example.com");
    expect(email.html).toContain("&lt;billing&gt; &amp; access");
    expect(email.html).not.toContain("<billing>");
    expect(email.text).toContain('"path": "/billing"');
  });
});
