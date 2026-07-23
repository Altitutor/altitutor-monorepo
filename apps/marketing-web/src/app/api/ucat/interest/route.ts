import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const UCAT_APP_ORIGIN =
  process.env.UCAT_APP_ORIGIN ??
  process.env.NEXT_PUBLIC_UCAT_APP_ORIGIN ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3004"
    : "https://ucat.altitutor.com");

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const response = await fetch(`${UCAT_APP_ORIGIN}/api/ucat/public-interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[marketing/ucat/interest]", error);
    return NextResponse.json(
      { error: "Applications are temporarily unavailable. Please email admin@altitutor.com." },
      { status: 502 },
    );
  }
}
