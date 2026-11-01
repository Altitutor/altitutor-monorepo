import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { emailAccess } from "@/features/email/server/auth";
import { emailMessageSchema } from "@/features/email/types";
export async function GET(request: NextRequest) {
  const access = await emailAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const input = z
    .object({
      type: z.enum(["student", "parent", "staff", "session", "invoice"]),
      id: z.string().guid('Invalid uuid'),
      offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
    })
    .safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!input.success)
    return NextResponse.json(
      { error: "Choose a correspondence record." },
      { status: 400 },
    );
  const result = await access.db.rpc("email_correspondence_for_record", {
    p_record_type: input.data.type,
    p_record_id: input.data.id,
    p_offset: input.data.offset,
    p_limit: 50,
  });
  if (result.error)
    return NextResponse.json(
      { error: "Could not load email correspondence." },
      { status: 503 },
    );
  return NextResponse.json(
    {
      items: result.data.map((row) =>
        emailMessageSchema.parse({
          ...(row.data &&
          typeof row.data === "object" &&
          !Array.isArray(row.data)
            ? row.data
            : {}),
          id: row.id,
          threadId: row.thread_id,
          folderId: row.folder_id,
          removed: row.removed,
        }),
      ),
      next: result.data.length === 50 ? input.data.offset + 50 : null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
