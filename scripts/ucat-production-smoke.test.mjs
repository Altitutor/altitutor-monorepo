import assert from "node:assert/strict";
import test from "node:test";
import { smokeUcatProduction } from "./ucat-production-smoke.mjs";

const validConfig = {
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

function response({ status = 200, location, json = {} } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(location ? { location } : undefined),
    json: async () => json,
  };
}

test("production smoke verifies access routing and launch billing configuration", async () => {
  const fetchImpl = async (url, init) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/login") return response();
    if (pathname === "/dashboard") {
      assert.equal(init?.redirect, "manual");
      return response({
        status: 307,
        location: "/login?redirect=%2Fdashboard%3Fsource%3Dproduction-smoke",
      });
    }
    return response({ json: validConfig });
  };

  await smokeUcatProduction({
    baseUrl: "https://ucat.altitutor.com",
    fetchImpl,
  });
});

test("production smoke rejects billing drift", async () => {
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/login") return response();
    if (pathname === "/dashboard") {
      return response({
        status: 307,
        location: "/login?redirect=%2Fdashboard%3Fsource%3Dproduction-smoke",
      });
    }
    return response({
      json: {
        ...validConfig,
        planPrices: validConfig.planPrices.map((price) =>
          price.interval === "week"
            ? { ...price, basePriceCents: 1600 }
            : price,
        ),
      },
    });
  };

  await assert.rejects(
    smokeUcatProduction({
      baseUrl: "https://ucat.altitutor.com",
      fetchImpl,
    }),
    /weekly price/u,
  );
});
