import type { NextRequest } from "next/server";
import { exchangeHandoff } from "@/features/auth/server/handoff-handler";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return exchangeHandoff(request, "native");
}
