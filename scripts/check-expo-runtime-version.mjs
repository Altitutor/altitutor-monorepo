#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const base = process.argv[2] ?? "HEAD^";
const apps = ["student-app", "ucat-app"];

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const changed = new Set(git("diff", "--name-only", base, "HEAD").split("\n"));
let failed = false;

for (const app of apps) {
  const root = `apps/${app}/`;
  const nativeChanged = [...changed].some((path) => {
    if (!path.startsWith(root)) return false;
    const file = path.slice(root.length);
    if (file === "eas.json") {
      const previous = JSON.parse(git("show", `${base}:${path}`));
      const current = JSON.parse(readFileSync(path, "utf8"));
      // EAS Submit only uploads an existing binary; it cannot change its runtime.
      delete previous.submit;
      delete current.submit;
      return !isDeepStrictEqual(previous, current);
    }
    return ["app.json", "package.json", "google-services.json",
      "assets/expo.icon", "assets/images/icon.png",
      "assets/images/splash-icon.png", "assets/images/android-icon-foreground.png",
      "assets/images/android-icon-background.png", "assets/images/android-icon-monochrome.png"].includes(file)
      || file.startsWith("ios/") || file.startsWith("android/");
  });
  if (!nativeChanged) continue;

  const appJson = `${root}app.json`;
  const previous = JSON.parse(git("show", `${base}:${appJson}`)).expo.version;
  const current = JSON.parse(readFileSync(appJson, "utf8")).expo.version;
  if (previous === current) {
    console.error(`${app}: native configuration changed without an expo.version bump (${current}).`);
    failed = true;
  } else {
    console.log(`${app}: runtime version ${previous} → ${current}`);
  }
}

if (failed) process.exitCode = 1;
