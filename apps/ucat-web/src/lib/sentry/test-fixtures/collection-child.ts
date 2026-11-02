import { createServer } from "node:http";
import { once } from "node:events";
import { gunzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import * as Sentry from "@sentry/nextjs";

async function main() {
  const reports: { type: string; payload: Record<string, unknown> }[] = [];
  const collector = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    let body = Buffer.concat(chunks);
    if (request.headers["content-encoding"] === "gzip") body = gunzipSync(body);
    const lines = body.toString().split("\n");
    for (let index = 1; index + 1 < lines.length; index += 2) {
      const header = JSON.parse(lines[index]!) as { type: string };
      reports.push({
        type: header.type,
        payload: JSON.parse(lines[index + 1]!) as Record<string, unknown>,
      });
    }
    response.writeHead(200).end("{}");
  });
  let application: ReturnType<typeof createServer> | undefined;
  try {
    collector.listen(0, "127.0.0.1");
    await once(collector, "listening");
    const collectorPort = (collector.address() as AddressInfo).port;
    process.env.NEXT_PUBLIC_SENTRY_DSN = `http://fixture@127.0.0.1:${collectorPort}/1`;
    // Exercise the application's actual initialization, never a reconstructed test config.
    await import(
      pathToFileURL(join(process.cwd(), "src/sentry.server.config.ts")).href
    );
    application = createServer(async (request, response) => {
      request.resume();
      await once(request, "end");
      Sentry.setUser({ id: "fixture-student" });
      const error = new Error("Unexpected study fixture failure");
      Sentry.captureException(error);
      Sentry.captureException(error);
      response
        .writeHead(200, { "content-type": "application/json" })
        .end('{"saved":true}');
    });
    application.listen(0, "127.0.0.1");
    await once(application, "listening");
    const applicationPort = (application.address() as AddressInfo).port;
    await fetch(
      `http://127.0.0.1:${applicationPort}/study?topic=skills&token=private-fixture-token`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer private-fixture-authorization",
          cookie: "session=private-fixture-cookie; theme=dark",
          "x-forwarded-for": "198.51.100.9",
          "x-study-mode": "practice",
        },
        body: JSON.stringify({ password: "private-fixture-password" }),
      },
    );
    const random = Math.random;
    Math.random = () => 0.05;
    try {
      Sentry.setTag("fixture.study", "practice");
      Sentry.startNewTrace(() =>
        Sentry.startSpan(
          {
            name: "fixture safe study trace",
            op: "study",
            forceTransaction: true,
          },
          () => undefined,
        ),
      );
      Sentry.startNewTrace(() =>
        Sentry.startSpan(
          {
            name: "GET /api/auth/native/exchange?ticket=private-fixture-ticket",
            op: "http.server",
            forceTransaction: true,
          },
          () => undefined,
        ),
      );
    } finally {
      Math.random = random;
    }
    await Sentry.flush(3000);
  } finally {
    await Sentry.close(3000);
    application?.closeAllConnections();
    application?.close();
    collector.closeAllConnections();
    collector.close();
  }
  process.stdout.write(`${JSON.stringify({ reports })}\n`);
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
