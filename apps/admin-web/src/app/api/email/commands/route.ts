import { NextRequest, NextResponse } from "next/server";
import { emailAccess } from "@/features/email/server/auth";
import { mailboxCommands } from "@/features/email/server/commands";
import { emailCommandSchema } from "@/features/email/types";
export async function POST(request: NextRequest) {
  const access = await emailAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const input = emailCommandSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!input.success)
    return NextResponse.json(
      { error: "Invalid email command." },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      await mailboxCommands(access.admin, access.staff)(input.data),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Email command failed. Refresh to check Microsoft before retrying.",
      },
      { status: 503 },
    );
  }
}
