import { NextRequest, NextResponse } from "next/server";
import { buildPersonFieldOrFilters } from "@altitutor/shared";
import { emailAccess } from "@/features/email/server/auth";

/** Staff-only contact suggestions. Provider traffic is never needed for typing. */
export async function GET(request: NextRequest) {
  const access = await emailAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const search = (request.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .slice(0, 100);
  if (search.length < 2) return NextResponse.json({ people: [] });
  const kinds = ["student", "parent", "staff"] as const;
  const results = await Promise.all(
    kinds.map(async (type) => {
      const table =
        type === "student"
          ? "students"
          : type === "parent"
            ? "parents"
            : "staff";
      let query = access.db
        .from(table)
        .select("id,first_name,last_name,email")
        .not("email", "is", null);
      if (type === "student") query = query.is("deleted_at", null);
      for (const filter of buildPersonFieldOrFilters(search, [
        "first_name",
        "last_name",
        "email",
      ]))
        query = query.or(filter);
      const result = await query.limit(15);
      if (result.error) throw new Error("Could not search email contacts.");
      return (result.data ?? []).flatMap((person) =>
        person.email
          ? [
              {
                id: person.id,
                type,
                email: person.email.trim().toLowerCase(),
                label:
                  [person.first_name, person.last_name]
                    .filter(Boolean)
                    .join(" ") || person.email,
              },
            ]
          : [],
      );
    }),
  ).catch(() => null);
  if (!results)
    return NextResponse.json(
      { error: "Could not search email contacts." },
      { status: 503 },
    );
  return NextResponse.json(
    { people: results.flat() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
