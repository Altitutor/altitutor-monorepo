import assert from "node:assert/strict";
import test from "node:test";
import { smokeProductionWeb } from "./production-web-smoke.mjs";

function response({ status = 200, location, json = {} } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(location ? { location } : undefined),
    json: async () => json,
  };
}

const origins = {
  admin: "https://admin.example.com",
  marketing: "https://example.com",
  student: "https://student.example.com",
  tutor: "https://tutor.example.com",
  ucat: "https://ucat.example.com",
};

const validUcatConfig = {
  trialDays: 0,
  unlimitedProductConfigured: true,
  planPrices: [
    {
      tier: "unlimited",
      interval: "week",
      basePriceCents: 1500,
      configured: true,
      checkoutEnabled: true,
    },
    {
      tier: "unlimited",
      interval: "month",
      basePriceCents: 4000,
      configured: true,
      checkoutEnabled: true,
    },
  ],
};

test("production smoke checks every public surface and auth boundary", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    const parsed = new URL(url);
    seen.push(`${parsed.host}${parsed.pathname}`);
    if (parsed.host === "example.com") return response();
    if (parsed.pathname === "/login") return response();
    if (parsed.pathname === "/dashboard") {
      assert.equal(init?.redirect, "manual");
      const query = parsed.host === "ucat.example.com"
        ? "?redirect=%2Fdashboard%3Fsource%3Dproduction-smoke"
        : "";
      return response({ status: 307, location: `/login${query}` });
    }
    if (parsed.pathname === "/api/ucat/subscription-config") {
      return response({ json: validUcatConfig });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  await smokeProductionWeb({ origins, fetchImpl });

  for (const host of [
    "admin.example.com",
    "example.com",
    "student.example.com",
    "tutor.example.com",
    "ucat.example.com",
  ]) {
    assert.ok(seen.some((request) => request.startsWith(host)), host);
  }
});

test("production smoke fails when a portal no longer protects its dashboard", async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.host === "example.com" || parsed.pathname === "/login") {
      return response();
    }
    if (parsed.host === "student.example.com" && parsed.pathname === "/dashboard") {
      return response();
    }
    if (parsed.pathname === "/dashboard") {
      const query = parsed.host === "ucat.example.com"
        ? "?redirect=%2Fdashboard%3Fsource%3Dproduction-smoke"
        : "";
      return response({ status: 307, location: `/login${query}` });
    }
    return response({ json: validUcatConfig });
  };

  await assert.rejects(
    smokeProductionWeb({ origins, fetchImpl }),
    /student.*dashboard did not redirect/u,
  );
});
