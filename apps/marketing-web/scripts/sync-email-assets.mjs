import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(
  appRoot,
  "../../assets/ucat-photos/signature/Signature.png",
);
const destinations = [
  "public/assets/ucat/email/matt-signature.png",
  "public/assets/ucat/matt-signature.png",
];

for (const relativePath of destinations) {
  const destination = resolve(appRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

const emailAssets = resolve(appRoot, "../../assets/ucat-photos/email");
const emailDestination = resolve(appRoot, "public/assets/ucat/email");
mkdirSync(emailDestination, { recursive: true });
for (const filename of [
  "attempt-review.jpg",
  "timing-graph.jpg",
  "practice-pace.jpg",
  "category-breakdown.jpg",
  "qr-multipliers.jpg",
  "study-plan-tasks.jpg",
]) {
  copyFileSync(resolve(emailAssets, filename), resolve(emailDestination, filename));
}
