import {
  formatEmailDate,
  renderEmail,
  renderEmailButton,
  renderEmailPanel,
} from "../index";

describe("formatEmailDate", () => {
  it("renders ISO, US, and Australian date inputs as dd/mm/yyyy", () => {
    expect(formatEmailDate("2026-08-15T00:00:00.000Z")).toBe("15/08/2026");
    expect(formatEmailDate("8/15/2026")).toBe("15/08/2026");
    expect(formatEmailDate("15/08/2026")).toBe("15/08/2026");
  });
});

describe("renderEmail", () => {
  it("renders a complete Altitutor email with a monitored identity", () => {
    const email = renderEmail({
      brand: "altitutor",
      subject: "Your booking changed",
      previewText: "Your new session time is ready.",
      heading: "Your booking changed",
      bodyHtml: '<p class="email-copy">New time: 4:00 pm.</p>',
      bodyText: "New time: 4:00 pm.",
    });

    expect(email).toMatchObject({
      subject: "Your booking changed",
      previewText: "Your new session time is ready.",
      text: "Your booking changed\n\nNew time: 4:00 pm.",
      from: "Altitutor <admin@altitutor.com>",
      replyTo: "admin@altitutor.com",
    });
    expect(email.html).toContain(">Altitutor</p>");
    expect(email.html).toContain("Your new session time is ready.");
    expect(email.html).toContain("New time: 4:00 pm.");
    expect(email.html).toContain("Level 1, 17A Solomon St, Adelaide SA 5000");
    expect(email.html).toContain("Phone:");
    expect(email.html).toContain("+61 483 849 842");
    expect(email.html).toContain("Email:");
    expect(email.html).toContain("admin@altitutor.com");
    expect(email.html).toContain("Web:");
    expect(email.html).toContain("altitutor.com");
    expect(email.html).toContain("https://altitutor.com");
    expect(email.html).not.toContain("Need help?");
    expect(email.html).not.toContain("Altitutor UCAT");
    expect(email.html).not.toContain("A not-for-profit initiative by Altitutor.");
  });

  it("preserves the Altitutor UCAT visual identity and safe primitives", () => {
    const button = renderEmailButton(
      "https://ucat.altitutor.com/results?from=a&next=b",
      "Review <results>",
    );
    const panel = renderEmailPanel("<p>Current estimate: <strong>650</strong></p>");
    const email = renderEmail({
      brand: "ucat",
      subject: "Your estimate is ready",
      previewText: "See your current estimate.",
      heading: "Your estimate is ready",
      bodyHtml: `${panel}${button}`,
      bodyText: "Current estimate: 650\n\nReview results: https://ucat.altitutor.com/results",
    });

    expect(email.from).toBe("Altitutor UCAT <admin@altitutor.com>");
    expect(email.html).toContain(">Altitutor UCAT</p>");
    expect(email.html).toContain("UCAT preparation from Altitutor");
    expect(email.html).toContain("A not-for-profit initiative by Altitutor.");
    expect(email.html).toContain("Email:");
    expect(email.html).toContain("admin@altitutor.com");
    expect(email.html).toContain("Web:");
    expect(email.html).toContain("altitutor.com/ucat");
    expect(email.html).toContain("https://altitutor.com/ucat");
    expect(email.html).not.toContain("Phone:");
    expect(email.html).not.toContain("Level 1, 17A Solomon St");
    expect(email.html).toContain("class=\"email-panel\"");
    expect(email.html).toContain("https://ucat.altitutor.com/results?from=a&amp;next=b");
    expect(email.html).toContain("Review &lt;results&gt;");
    expect(email.html).toContain(".email-panel td");
    expect(email.html).toContain(".email-content a");
    expect(email.html).toContain("color: #b7d4df !important");
    expect(email.html).toContain(
      ".email-panel td { border-color: #383838 !important; }",
    );
    expect(email.html).toContain(".email-content a.email-button");
    expect(email.html).toMatch(
      /\.email-content a\.email-button[\s\S]*color: #1c1c1c !important/,
    );
  });
});
