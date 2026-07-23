import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UCAT_APP_ORIGIN =
  process.env.UCAT_APP_ORIGIN ??
  process.env.NEXT_PUBLIC_UCAT_APP_ORIGIN ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3004"
    : "https://ucat.altitutor.com");

export async function GET() {
  try {
    const response = await fetch(
      `${UCAT_APP_ORIGIN}/api/ucat/subscription-config`,
      { next: { revalidate: 60 } },
    );
    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
        "Cache-Control":
          "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[marketing/ucat/subscription-config]", error);
    return NextResponse.json(
      { error: "Pricing is temporarily unavailable" },
      { status: 502 },
    );
  }
}
