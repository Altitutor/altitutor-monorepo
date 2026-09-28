import { rm } from "node:fs/promises";
import { resolve } from "node:path";

if (process.env.ALTITUTOR_CI_BUILD === "true") {
  await rm(resolve(process.cwd(), ".next/cache"), {
    recursive: true,
    force: true,
  });
}
