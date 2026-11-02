import { NextRequest, NextResponse } from "next/server";
import { observeMailboxMessage } from "@/features/email/server/observe";
import { emailAccess } from "@/features/email/server/auth";
import { MAX_EMAIL_ATTACHMENT_BYTES } from "@/features/email/attachment-policy";
import { connectMailbox } from "@/features/email/server/connection";
export async function GET(request: NextRequest) {
  const access = await emailAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const id = request.nextUrl.searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "Message required." }, { status: 400 });
  try {
    const mailbox = await connectMailbox();
    const files = await mailbox.attachments(id);
    const selected = request.nextUrl.searchParams.get("attachment");
    if (!selected)
      return NextResponse.json(files, {
        headers: { "Cache-Control": "private, no-store" },
      });
    const file = files.find((item) => item.id === selected);
    if (!file || file.type === "#microsoft.graph.referenceAttachment")
      return NextResponse.json(
        { error: "This attachment cannot be downloaded here." },
        { status: 400 },
      );
    const preview =
      request.nextUrl.searchParams.get("preview") === "1" &&
      /^(?:application\/pdf|image\/(?:png|jpeg|gif|webp|avif))$/i.test(
        file.contentType,
      );
    const response = await mailbox.attachment(
      id,
      file.id,
      AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
    );
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": preview ? file.contentType : "application/octet-stream",
        "Content-Disposition": `${preview ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name).replaceAll("'", "%27")}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load this attachment from Microsoft." },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await emailAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const form = await request.formData();
  const id = form.get("id"),
    changeKey = form.get("changeKey"),
    token = form.get("editToken"),
    file = form.get("file");
  if (
    typeof id !== "string" ||
    typeof changeKey !== "string" ||
    typeof token !== "string" ||
    !(file instanceof File) ||
    file.size >= 3_000_000
  )
    return NextResponse.json(
      { error: "Choose a file smaller than 3 MB for this upload." },
      { status: 400 },
    );
  const claim = await access.admin.rpc("email_claim_draft", {
    p_message_id: id,
    p_change_key: changeKey,
    p_staff_id: access.staff.id,
    p_token: token,
  });
  if (
    claim.error ||
    !claim.data ||
    typeof claim.data !== "object" ||
    Array.isArray(claim.data) ||
    claim.data.state !== "ready"
  )
    return NextResponse.json(
      {
        error:
          "This shared draft changed or is being edited. Refresh before attaching a file.",
      },
      { status: 409 },
    );
  try {
    const extended = await access.admin
      .from("email_draft_edits")
      .update({
        expires_at: new Date(Date.now() + 120_000).toISOString(),
        writing_until: new Date(Date.now() + 90_000).toISOString(),
      })
      .eq("message_id", id)
      .eq("staff_id", access.staff.id)
      .eq("token", token)
      .select("message_id")
      .maybeSingle();
    if (extended.error || !extended.data) throw new Error("Draft lock changed");
    const mailbox = await connectMailbox();
    const draft = await mailbox.message(id);
    if (!draft.draft || draft.changeKey !== changeKey)
      return NextResponse.json(
        {
          error: "Microsoft's draft changed. Refresh before attaching a file.",
        },
        { status: 409 },
      );
    const existing = await mailbox.attachments(id);
    if (
      existing.reduce((sum, item) => sum + item.size, file.size) >
      MAX_EMAIL_ATTACHMENT_BYTES
    )
      return NextResponse.json(
        { error: "Keep all attachments together within 20 MB." },
        { status: 400 },
      );
    const attachment = await mailbox.addAttachment(id, {
      name: file.name,
      contentType: file.type || "application/octet-stream",
      contentBytes: Buffer.from(await file.arrayBuffer()).toString("base64"),
    });
    const message = await mailbox.message(id);
    const observed = await observeMailboxMessage(access.admin, message);
    return NextResponse.json({ state: "saved", message: observed, attachment });
  } catch {
    return NextResponse.json(
      {
        error:
          "Attachment outcome could not be confirmed. Check the Microsoft draft before adding it again.",
      },
      { status: 503 },
    );
  } finally {
    await access.admin
      .from("email_draft_edits")
      .update({ writing_until: null })
      .eq("message_id", id)
      .eq("token", token);
  }
}
