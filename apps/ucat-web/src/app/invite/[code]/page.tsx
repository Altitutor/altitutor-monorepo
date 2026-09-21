import { notFound, redirect } from "next/navigation";
import { normalizeUcatInvitationCode } from "@altitutor/shared";

/** Compatibility for previously distributed links; no separate invitation screen. */
export default async function InvitationRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const code = normalizeUcatInvitationCode((await params).code);
  if (!code) notFound();
  const query = new URLSearchParams({
    [code.startsWith("F-") ? "offer" : "ref"]: code,
  });
  for (const [key, value] of Object.entries(await searchParams)) {
    if (key.startsWith("utm_") && typeof value === "string")
      query.set(key, value);
  }
  redirect(`/signup?${query.toString()}`);
}
