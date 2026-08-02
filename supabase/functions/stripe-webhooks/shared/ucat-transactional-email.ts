import {
  buildUcatEmailActionUrl,
  escapeEmailHtml,
  renderUcatEmail,
  renderUcatEmailButton,
  renderUcatEmailPanel,
  UCAT_EMAIL_SENDERS,
} from "../../_shared/ucat-email.ts";

export const UCAT_TRANSACTIONAL_FROM = UCAT_EMAIL_SENDERS.formal.from;
export const UCAT_TRANSACTIONAL_REPLY_TO = UCAT_EMAIL_SENDERS.formal.replyTo;

export {
  buildUcatEmailActionUrl,
  escapeEmailHtml,
  renderUcatEmailButton,
  renderUcatEmailPanel,
};

export function renderUcatTransactionalEmail(input: {
  previewText: string;
  heading: string;
  bodyHtml: string;
}): string {
  return renderUcatEmail({
    ...input,
    footerHtml:
      `<p style="margin:0;color:#52606a;font-size:12px;line-height:1.6">Need help? Reply to this email or contact <a class="email-link" href="mailto:${UCAT_TRANSACTIONAL_REPLY_TO}" style="color:#0a2941">${UCAT_TRANSACTIONAL_REPLY_TO}</a>.</p>`,
  });
}
