import { pathToFileURL } from "node:url";
import { smokeUcatProduction } from "./ucat-production-smoke.mjs";

function requireCondition(condition, message) {
  if (!condition) throw new Error(`Production web smoke failed: ${message}`);
}

async function smokePublicPage({ app, origin, pathname, fetchImpl }) {
  const response = await fetchImpl(new URL(pathname, origin));
  requireCondition(response.ok, `${app} ${pathname} returned ${response.status}`);
}

async function smokePortal({ app, origin, fetchImpl }) {
  await smokePublicPage({ app, origin, pathname: "/login", fetchImpl });
  const response = await fetchImpl(new URL("/dashboard", origin), {
    redirect: "manual",
  });
  requireCondition(
    response.status >= 300 && response.status < 400,
    `${app} dashboard did not redirect anonymously (${response.status})`,
  );
  const location = response.headers.get("location");
  requireCondition(location, `${app} dashboard redirect omitted Location`);
  requireCondition(
    new URL(location, origin).pathname === "/login",
    `${app} dashboard did not redirect to login`,
  );
}

export async function smokeProductionWeb({ origins, fetchImpl = fetch }) {
  await Promise.all([
    smokePortal({ app: "admin", origin: origins.admin, fetchImpl }),
    smokePublicPage({
      app: "marketing",
      origin: origins.marketing,
      pathname: "/ucat/",
      fetchImpl,
    }),
    smokePortal({ app: "student", origin: origins.student, fetchImpl }),
    smokePortal({ app: "tutor", origin: origins.tutor, fetchImpl }),
    smokeUcatProduction({ baseUrl: origins.ucat, fetchImpl }),
  ]);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  await smokeProductionWeb({
    origins: {
      admin:
        process.env.ADMIN_PRODUCTION_BASE_URL ?? "https://admin.altitutor.com",
      marketing:
        process.env.MARKETING_PRODUCTION_BASE_URL ?? "https://altitutor.com",
      student:
        process.env.STUDENT_PRODUCTION_BASE_URL ?? "https://student.altitutor.com",
      tutor:
        process.env.TUTOR_PRODUCTION_BASE_URL ?? "https://tutor.altitutor.com",
      ucat:
        process.env.UCAT_PRODUCTION_BASE_URL ?? "https://ucat.altitutor.com",
    },
  });
  console.log("Production web smoke passed");
}
