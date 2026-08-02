import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(
  appRoot,
  "../../assets/ucat-photos/signature/Signature.png",
);
const destination = resolve(
  appRoot,
  "public/assets/ucat/email/matt-signature.png",
);

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
