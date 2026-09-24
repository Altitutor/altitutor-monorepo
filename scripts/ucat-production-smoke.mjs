import { pathToFileURL } from "node:url";

function requireCondition(condition, message) {
  if (!condition) throw new Error(`UCAT production smoke failed: ${message}`);
}

export async function smokeUcatProduction({ baseUrl, fetchImpl = fetch }) {
  const origin = new URL(baseUrl).origin;

  const login = await fetchImpl(new URL("/login", origin));
  requireCondition(login.ok, `/login returned ${login.status}`);

  const protectedPath = "/dashboard?source=production-smoke";
  const dashboard = await fetchImpl(new URL(protectedPath, origin), {
    redirect: "manual",
  });
  requireCondition(
    dashboard.status >= 300 && dashboard.status < 400,
    `/dashboard did not redirect anonymously (${dashboard.status})`,
  );
  const location = dashboard.headers.get("location");
  requireCondition(location, "/dashboard redirect omitted Location");
  const redirect = new URL(location, origin);
  requireCondition(
    redirect.pathname === "/login",
    `/dashboard redirected to ${redirect.pathname}`,
  );
  requireCondition(
    redirect.searchParams.get("redirect") === protectedPath,
    "/dashboard redirect did not preserve return intent",
  );

  const configResponse = await fetchImpl(
    new URL("/api/ucat/subscription-config", origin),
  );
  requireCondition(
    configResponse.ok,
    `/api/ucat/subscription-config returned ${configResponse.status}`,
  );
  const config = await configResponse.json();
  requireCondition(config.trialDays === 0, "trial days are not zero");
  requireCondition(
    config.unlimitedProductConfigured === true,
    "Unlimited Stripe product is not configured",
  );

  const weekly = config.planPrices?.find(
    (price) => price.tier === "unlimited" && price.interval === "week",
  );
  const monthly = config.planPrices?.find(
    (price) => price.tier === "unlimited" && price.interval === "month",
  );
  requireCondition(
    weekly?.basePriceCents === 1500 &&
      weekly.configured === true &&
      weekly.checkoutEnabled === true,
    "weekly price is not the configured $15 launch plan",
  );
  requireCondition(
    monthly?.basePriceCents === 4000 &&
      monthly.configured === true &&
      monthly.checkoutEnabled === true,
    "monthly price is not the configured $40 launch plan",
  );
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  await smokeUcatProduction({
    baseUrl:
      process.env.UCAT_PRODUCTION_BASE_URL ?? "https://ucat.altitutor.com",
  });
  console.log("UCAT production smoke passed");
}
