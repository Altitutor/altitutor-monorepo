import {
  EMAIL_SENDERS,
  escapeEmailHtml,
  renderEmail,
  renderEmailButton,
  renderEmailPanel,
} from "./email.generated.ts";

export const UCAT_APP_URL = (
  Deno.env.get("UCAT_WEB_URL") || "https://ucat.altitutor.com"
).replace(/\/$/, "");

export const UCAT_EMAIL_SENDERS = {
  founder: EMAIL_SENDERS.founder,
  product: EMAIL_SENDERS["ucat-product"],
  formal: EMAIL_SENDERS.altitutor,
} as const;

export type UcatEmailSender = keyof typeof UCAT_EMAIL_SENDERS;

export { escapeEmailHtml };

export function buildUcatEmailActionUrl(input: {
  path: string;
  campaign: string;
  content?: string;
}): string {
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const url = new URL(path, `${UCAT_APP_URL}/`);
  url.searchParams.set("utm_source", "altitutor");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", input.campaign);
  if (input.content) url.searchParams.set("utm_content", input.content);
  return url.toString();
}

export const renderUcatEmailButton = renderEmailButton;
export const renderUcatEmailPanel = renderEmailPanel;

export function renderUcatEmail(input: {
  previewText: string;
  heading: string;
  bodyHtml: string;
  marketingFooterHtml?: string;
}): string {
  return renderEmail({
    brand: "ucat",
    sender: "ucat-product",
    subject: input.heading,
    previewText: input.previewText,
    heading: input.heading,
    bodyHtml: input.bodyHtml,
    bodyText: "",
    marketingFooterHtml: input.marketingFooterHtml,
  }).html;
}
