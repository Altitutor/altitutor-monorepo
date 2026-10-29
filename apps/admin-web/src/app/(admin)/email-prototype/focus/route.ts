import { readFile } from "node:fs/promises";
import path from "node:path";

// Throwaway prototype only. The same fictional HTML is portable through Lavish.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }
  const source = await readFile(
    path.join(process.cwd(), "src/features/email/prototype/DEV250-focus-mail-v2.prototype.html"),
    "utf8",
  );
  return new Response(source, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
