import { buildInvitationEmail, buildRegistrationEmail } from "../index";

describe("buildInvitationEmail", () => {
  it("keeps canonical invitation guidance around a safe staff introduction", () => {
    const email = buildInvitationEmail({
      recipientName: "Sam Lee",
      inviteUrl: "https://student.altitutor.com/invite/token?a=1&b=2",
      staffIntroduction: "Welcome <Sam> & family!\nPlease start here.",
      expiresIn: "1 hour",
    });

    expect(email.subject).toBe("You’ve been invited to Altitutor");
    expect(email.from).toBe("Altitutor <admin@altitutor.com>");
    expect(email.html).toContain("Welcome &lt;Sam&gt; &amp; family!<br />Please start here.");
    expect(email.html).not.toContain("Welcome <Sam>");
    expect(email.html).toContain("Create account");
    expect(email.html).toContain("This invitation link expires in 1 hour");
    expect(email.html).toContain("token?a=1&amp;b=2");
    expect(email.text).toContain("Welcome <Sam> & family!");
    expect(email.text).toContain("Create account: https://student.altitutor.com/invite/token?a=1&b=2");
  });
});

describe("buildRegistrationEmail", () => {
  it("addresses the recipient while preserving the student registration action", () => {
    const email = buildRegistrationEmail({
      recipientName: "Pat Lee",
      studentName: "Sam Lee",
      registrationUrl: "https://student.altitutor.com/register/token",
      staffIntroduction: "Thanks for meeting us.",
    });

    expect(email.subject).toBe("Complete registration for Sam Lee — Altitutor");
    expect(email.html).toContain("Hello Pat Lee,");
    expect(email.html).toContain("complete Sam Lee’s student registration");
    expect(email.html).toContain("Thanks for meeting us.");
    expect(email.html).toContain("Complete registration");
    expect(email.text).toContain(
      "Complete registration: https://student.altitutor.com/register/token",
    );
  });
});
