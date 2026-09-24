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
  return renderUcatEmail(input);
}
