import type { NextRequest } from "next/server";
import { exchangeBrowserHandoff } from "@/features/auth/server/browser-handoff-handler";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return exchangeBrowserHandoff(request);
}
