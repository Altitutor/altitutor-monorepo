import type { LifecycleCampaign, LifecycleCandidate } from "./logic.ts";

const APP_URL = (Deno.env.get("UCAT_WEB_URL") || "https://ucat.altitutor.com").replace(/\/$/, "");
const ADMIN_EMAIL = "admin@altitutor.com";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function copy(candidate: LifecycleCandidate, campaign: LifecycleCampaign) {
  const firstName = candidate.first_name?.trim() || "there";
  const nextTitle = candidate.next_step_title?.trim() || "your next study activity";
  const nextPath = candidate.next_step_path?.startsWith("/") ? candidate.next_step_path : "/dashboard";
  const questions = candidate.questions_last_7_days ?? 0;
  const sets = candidate.sets_last_7_days ?? 0;
  const mocks = candidate.mocks_last_7_days ?? 0;
  const countLabel = (count: number, singular: string, plural = `${singular}s`) =>
    `${count} ${count === 1 ? singular : plural}`;

  switch (campaign.key) {
    case "onboarding_welcome":
      return { subject: "You’re in. Let’s find your starting point.", preview: "Your Altitutor UCAT preparation starts with one useful next step.", heading: `Welcome, ${firstName}`, paragraphs: ["Altitutor UCAT is built to help you understand where you stand and what to do next.", "Start with a small piece of practice. As you build evidence, your progress and recommendations become more useful."], cta: "Start your first practice", path: "/dashboard", from: "Matt at Altitutor <noreply@altitutor.com>", replyTo: "matt@altitutor.com" };
    case "onboarding_first_signal":
      return { subject: "Your first useful UCAT score signal", preview: "A short piece of practice gives Altitutor something useful to work with.", heading: "Give your plan a starting point", paragraphs: [`Hi ${firstName}, you do not need to begin with a full mock. A focused practice session is enough to start identifying useful patterns.`, "Once you submit some answers, Altitutor can begin showing where your attention will be most valuable."], cta: "Start a short practice", path: "/practice", from: "Matt at Altitutor <noreply@altitutor.com>", replyTo: "matt@altitutor.com" };
    case "onboarding_plan":
      return { subject: "Turn your practice into a plan", preview: "Set a target, test year and realistic weekly availability.", heading: "Make your preparation fit your life", paragraphs: [`Hi ${firstName}, a useful study plan begins with your target, test date and the time you actually have available.`, "Set those details once, then Altitutor can organise your next steps around them."], cta: "Set up your study plan", path: "/settings/study-plan", from: "Matt at Altitutor <noreply@altitutor.com>", replyTo: "matt@altitutor.com" };
    case "onboarding_tracking":
      return { subject: "What your score estimate is telling you", preview: "Your estimate is a direction signal, not a promise.", heading: "Use your estimate as a direction signal", paragraphs: [`Hi ${firstName}, your current estimate is ${candidate.current_estimate}. It will change as you add better and more varied evidence.`, "The useful question is not whether one number is perfect. It is whether your trajectory and weak points are becoming clearer."], cta: "View your progress", path: "/progress", from: "Matt at Altitutor <noreply@altitutor.com>", replyTo: "matt@altitutor.com" };
    case "onboarding_free_forever":
      return { subject: "You don’t need to pay to keep going", preview: "Free is an ongoing way to practice, not a trial you use up.", heading: "Keep preparing for free", paragraphs: [`Hi ${firstName}, Altitutor UCAT Free is not a short trial or a fixed sample that disappears once you have used it.`, "Your free allowances reset, so you can keep practising, reviewing and building a clearer picture of your progress. Unlimited is there when you want to prepare without waiting."], cta: "Continue preparing", path: "/dashboard", from: "Matt at Altitutor <noreply@altitutor.com>", replyTo: "matt@altitutor.com" };
    case "inactive_7_days":
      return { subject: "Your UCAT plan is still here", preview: `You do not need to catch up all at once. Continue with ${nextTitle}.`, heading: "Pick up with one useful step", paragraphs: [`Hi ${firstName}, you do not need to restart or catch up all at once.`, `Based on your plan, a useful place to continue is ${nextTitle}.`], cta: "Continue with your next step", path: nextPath, from: "Altitutor UCAT <noreply@altitutor.com>", replyTo: ADMIN_EMAIL };
    case "weekly_progress":
      return { subject: "Your UCAT week: one clear next step", preview: `You completed ${countLabel(questions, "question")}, ${countLabel(sets, "set")} and ${countLabel(mocks, "mock")}.`, heading: "Your week in review", paragraphs: [`Hi ${firstName}, this week you completed ${countLabel(questions, "question")}, ${countLabel(sets, "set")} and ${countLabel(mocks, "mock")}.`, candidate.current_estimate ? `Your current estimated score is ${candidate.current_estimate}. Treat it as a direction signal that becomes more reliable as your evidence grows.` : "You are building the evidence needed for a more useful score estimate.", `Your next useful step is ${nextTitle}.`], cta: "Continue with your next step", path: nextPath, from: "Altitutor UCAT <noreply@altitutor.com>", replyTo: ADMIN_EMAIL };
  }
}

export function buildLifecycleEmail(candidate: LifecycleCandidate, campaign: LifecycleCampaign) {
  const content = copy(candidate, campaign);
  const actionUrl = `${APP_URL}${content.path}`;
  const unsubscribeUrl = `${APP_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(candidate.unsubscribe_token)}`;
  const preferencesUrl = `${APP_URL}/settings/communications`;
  const paragraphs = content.paragraphs.map((paragraph) => `<p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">${escapeHtml(paragraph)}</p>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.subject)}</title></head><body style="margin:0;background:#f2f0e9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(content.preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f0e9"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #dce5e8;border-radius:16px;overflow:hidden"><tr><td style="padding:30px 36px;background:#0a2941"><p style="margin:0;color:#f2f0e9;font-size:24px;font-weight:700">Altitutor UCAT</p><p style="margin:6px 0 0;color:#b9d1d9;font-size:13px">UCAT preparation from Altitutor</p></td></tr><tr><td style="padding:36px"><h1 style="margin:0 0 18px;color:#0a2941;font-size:26px;line-height:1.25">${escapeHtml(content.heading)}</h1>${paragraphs}<p style="margin:26px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:14px 22px;background:#0a2941;border-radius:9px;color:#fff;font-size:15px;font-weight:700;text-decoration:none">${escapeHtml(content.cta)}</a></p></td></tr><tr><td style="padding:24px 36px;background:#eaf1f3;border-top:1px solid #dce5e8"><p style="margin:0 0 8px;color:#0a2941;font-size:13px;font-weight:600">A not-for-profit initiative by Altitutor.</p><p style="margin:0 0 8px;color:#52606a;font-size:12px;line-height:1.6">Questions? Reply or contact <a href="mailto:${ADMIN_EMAIL}" style="color:#0a2941">${ADMIN_EMAIL}</a>.</p><p style="margin:0;color:#73808a;font-size:11px;line-height:1.6"><a href="${escapeHtml(preferencesUrl)}" style="color:#52606a">Email preferences</a> · <a href="${escapeHtml(unsubscribeUrl)}" style="color:#52606a">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>`;
  const text = `${content.heading}\n\n${content.paragraphs.join("\n\n")}\n\n${content.cta}: ${actionUrl}\n\nA not-for-profit initiative by Altitutor.\nQuestions? ${ADMIN_EMAIL}\nEmail preferences: ${preferencesUrl}\nUnsubscribe: ${unsubscribeUrl}`;
  return { ...content, html, text, unsubscribeUrl };
}
