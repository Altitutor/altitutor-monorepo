import {
  campaignProperties,
  safePostAuthReturnPath,
} from "@/features/auth/lib/return-intent";

export function buildEmailCtaLandingAttribution(
  pathname: string,
  searchParams: URLSearchParams,
): {
  dedupeKey: string;
  properties: Record<string, string>;
} | null {
  const campaign = campaignProperties(searchParams);
  if (campaign.utm_medium?.toLowerCase() !== "email") return null;

  const intendedDestination =
    pathname === "/login" || pathname === "/signup"
      ? safePostAuthReturnPath(searchParams.get("redirect"))
      : pathname;
  const intendedDestinationPath = new URL(
    intendedDestination,
    "https://ucat.altitutor.com",
  ).pathname;

  return {
    dedupeKey: [
      campaign.utm_source,
      campaign.utm_campaign,
      campaign.utm_content,
      intendedDestinationPath,
    ].join(":"),
    properties: {
      ...campaign,
      landing_path: pathname,
      intended_destination: intendedDestinationPath,
    },
  };
}
