import type { RenderedEmail } from "./render-email";
export const OPERATIONAL_MAIL_PROPERTY =
  "String {b257c4a8-842d-48f5-a740-9bb850be94dc} Name AltitutorOperationalMail";
export type OperationalMailLink = {
  type:
    | "student"
    | "parent"
    | "staff"
    | "session"
    | "invoice"
    | "onboarding_journey";
  id: string;
  purpose?: "registration_link" | "ucat_link" | "followup";
};
export type OperationalMailInput = {
  serviceUrl: string;
  serviceKey: string;
  getAccessToken: () => Promise<string>;
  to: string[];
  email: RenderedEmail;
  idempotencyKey: string;
  links: OperationalMailLink[];
  actorStaffId?: string;
  attachments?: Array<{
    name: string;
    contentType: string;
    contentBytes: string;
  }>;
  fetchImpl?: typeof fetch;
};
class MicrosoftOperationalError extends Error {
  constructor(readonly status: number) {
    super(`Microsoft operational email request failed (${status}).`);
  }
}
type Operation = {
  id: string;
  token: string | null;
  proceed: boolean;
  state: string;
  draftId: string | null;
  changeKey: string | null;
};
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
/** Shared by Node and Edge. Content and eligibility stay with domain callers. */
export async function deliverOperationalMailboxEmail(
  input: OperationalMailInput,
): Promise<{ providerMessageId: string; state: "submitted" | "sent" }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  if (
    !input.to.length ||
    input.email.replyTo.toLowerCase() !== "admin@altitutor.com"
  )
    throw new Error(
      "Operational email requires the shared admin mailbox and recipients.",
    );
  if (input.attachments?.some((file) => file.contentBytes.length > 3_900_000))
    throw new Error("This attachment requires a large-file upload session.");
  async function rpc(
    name: string,
    values: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await fetchImpl(
      `${input.serviceUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`,
      {
        method: "POST",
        headers: {
          apikey: input.serviceKey,
          Authorization: `Bearer ${input.serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok)
      throw new Error(`Mailbox delivery registry failed (${response.status}).`);
    return response.json();
  }
  const value = await rpc("email_operational_prepare", {
    p_key: input.idempotencyKey,
    p_payload: {
      to: input.to,
      email: input.email,
      ...(input.attachments ? { attachments: input.attachments } : {}),
    },
    p_links: input.links,
    p_actor: input.actorStaffId ?? null,
  });
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    typeof value.proceed !== "boolean" ||
    typeof value.state !== "string"
  )
    throw new Error("Invalid mailbox delivery registry response.");
  if (
    (value.proceed &&
      (typeof value.token !== "string" ||
        !value.token ||
        !["creating", "ready"].includes(value.state))) ||
    !(value.draftId === null || typeof value.draftId === "string") ||
    !(value.changeKey === null || typeof value.changeKey === "string")
  )
    throw new Error("Invalid mailbox delivery registry response.");
  const operation = value as Operation;
  if (!operation.proceed) {
    if (
      (operation.state === "submitted" || operation.state === "sent") &&
      operation.draftId
    )
      return { providerMessageId: operation.draftId, state: operation.state };
    throw new Error(
      `Operational email ${operation.id} is unresolved. Check the shared mailbox before sending another copy.`,
    );
  }
  let token = "";
  const base = "https://graph.microsoft.com/v1.0/users/admin%40altitutor.com";
  async function graph(path: string, method = "GET", body?: unknown) {
    const response = await fetchImpl(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: 'IdType="ImmutableId"',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new MicrosoftOperationalError(response.status);
    return response;
  }
  async function update(
    expected: string,
    state: string,
    draftId?: string,
    changeKey?: string,
  ) {
    const saved = await rpc("email_operational_update", {
      p_id: operation.id,
      p_token: operation.token,
      p_expected: expected,
      p_state: state,
      p_draft_id: draftId ?? null,
      p_change_key: changeKey ?? null,
    });
    if (saved !== true)
      throw new Error(
        "Another request changed this operational email. Check the shared mailbox before retrying.",
      );
  }
  let stage = operation.state;
  let externalRequestStarted = false;
  let draftId = operation.draftId;
  let changeKey = operation.changeKey;
  try {
    token = await input.getAccessToken();
    if (!draftId) {
      externalRequestStarted = true;
      const response: unknown = await (
        await graph("/messages", "POST", {
          subject: input.email.subject,
          body: { contentType: "HTML", content: input.email.html },
          from: {
            emailAddress: {
              name: "Altitutor Admin",
              address: "admin@altitutor.com",
            },
          },
          replyTo: [{ emailAddress: { address: "admin@altitutor.com" } }],
          toRecipients: input.to.map((address) => ({
            emailAddress: { address },
          })),
          singleValueExtendedProperties: [
            { id: OPERATIONAL_MAIL_PROPERTY, value: operation.id },
          ],
          ...(input.attachments?.length
            ? {
                attachments: input.attachments.map((file) => ({
                  "@odata.type": "#microsoft.graph.fileAttachment",
                  ...file,
                })),
              }
            : {}),
        })
      ).json();
      if (
        !record(response) ||
        typeof response.id !== "string" ||
        typeof response.changeKey !== "string"
      )
        throw new Error("Microsoft omitted the operational draft identity.");
      draftId = response.id;
      changeKey = response.changeKey;
      await update("creating", "ready", draftId, changeKey);
      stage = "ready";
      externalRequestStarted = false;
    }
    const current: unknown = await (
      await graph(`/messages/${encodeURIComponent(draftId)}`)
    ).json();
    if (
      !record(current) ||
      current.isDraft !== true ||
      current.changeKey !== changeKey
    )
      throw new Error(
        "The operational draft changed in another client. Review the shared draft before sending.",
      );
    await update("ready", "sending");
    stage = "sending";
    externalRequestStarted = true;
    const accepted = await graph(
      `/messages/${encodeURIComponent(draftId)}/send`,
      "POST",
    );
    if (accepted.status !== 202)
      throw new Error(
        "Microsoft did not confirm operational email submission. Check the shared mailbox before retrying.",
      );
    await update("sending", "submitted");
    return { providerMessageId: draftId, state: "submitted" };
  } catch (error) {
    const definiteRejection =
      error instanceof MicrosoftOperationalError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 408;
    const unresolved =
      externalRequestStarted &&
      !definiteRejection &&
      (stage === "creating" || stage === "sending");
    try {
      await update(
        stage,
        unresolved
          ? stage === "creating"
            ? "uncertain_create"
            : "uncertain_send"
          : "failed",
      );
    } catch {
      /* Durable creating/sending ownership still blocks blind resubmission. */
    }
    if (unresolved)
      throw new Error(
        `Operational email ${operation.id} has an unresolved outcome. Check the shared mailbox before sending another copy.`,
      );
    throw error;
  }
}
