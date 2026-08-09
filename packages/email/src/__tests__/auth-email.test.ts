import { buildAuthEmails } from "../index";

describe("buildAuthEmails", () => {
  it("builds one product-neutral identity email family for Supabase Auth", () => {
    const emails = buildAuthEmails({ year: "__CURRENT_YEAR__" });

    expect(Object.keys(emails)).toEqual([
      "confirmation",
      "invite",
      "magic_link",
      "recovery",
      "email_change",
      "reauthentication",
    ]);
    expect(emails.confirmation.subject).toBe("Your Altitutor signup code");
    expect(emails.confirmation.html).toContain("{{ .Token }}");
    expect(emails.magic_link.html).toContain("{{ .Token }}");
    expect(emails.recovery.html).toContain("{{ .TokenHash }}");
    expect(emails.email_change.html).toContain("{{ .NewEmail }}");
    expect(emails.reauthentication.html).toContain("{{ .Token }}");

    for (const email of Object.values(emails)) {
      expect(email.html).toContain(">Altitutor</p>");
      expect(email.html).toContain("__CURRENT_YEAR__");
      expect(email.html).not.toContain("Altitutor UCAT");
      expect(email.from).toBe("Altitutor <admin@altitutor.com>");
    }
  });
});
