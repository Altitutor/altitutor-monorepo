import type { NextRequest } from "next/server";
import { issueNativeHandoff } from "@/features/auth/server/handoff-handler";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return issueNativeHandoff(request);
}
