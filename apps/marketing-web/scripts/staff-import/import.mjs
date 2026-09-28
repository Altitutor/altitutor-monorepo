// One-time production backfill. Dry-run by default; explicit --apply writes.
// Credentials are read from the existing ignored production secrets file.
import { readFile, writeFile, mkdir, copyFile, stat } from "node:fs/promises";
import { resolve, basename, extname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const secrets = Object.fromEntries(
  (await readFile(resolve(root, "secrets/.env.production"), "utf8"))
    .split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const index = line.indexOf("=");
      return [
        line.slice(0, index),
        line
          .slice(index + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, "$2"),
      ];
    }),
);
if (secrets.SUPABASE_PROJECT_REF !== "mzgunxjfgvcyivcyqimn")
  throw new Error("Expected Altitutor production project");
const origin = `https://${secrets.SUPABASE_PROJECT_REF}.supabase.co`;
const key = secrets.SUPABASE_SECRET_KEY;
if (!key) throw new Error("Missing production credentials");
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const apply = process.argv.includes("--apply");
const backup = resolve(root, ".local-backups/staff-profiles-2026-09-28");
await mkdir(backup, { recursive: true });
async function api(path, options = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...options,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok)
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
const staff = await api(
  "/rest/v1/staff?select=id,first_name,last_name,status,profile_bio,profile_image_file_id&order=first_name",
);
const seed = JSON.parse(
  await readFile(new URL("./website-profiles.json", import.meta.url), "utf8"),
);
const existingFileIds = staff
  .map((s) => s.profile_image_file_id)
  .filter(Boolean);
const files = existingFileIds.length
  ? await api(`/rest/v1/files?select=*&id=in.(${existingFileIds.join(",")})`)
  : [];
// Never replace the pre-import snapshot on reruns.
await writeFile(
  resolve(backup, "production-before.json"),
  JSON.stringify({ staff, files }, null, 2),
  { flag: "wx" },
).catch((error) => {
  if (error.code !== "EEXIST") throw error;
});
for (const file of files) {
  const destination = resolve(backup, `${file.id}-${basename(file.filename)}`);
  try {
    await stat(destination);
  } catch {
    const response = await fetch(
      `${origin}/storage/v1/object/public/${file.bucket}/${file.storage_path}`,
    );
    if (!response.ok) throw new Error("Could not back up existing photo");
    await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  }
}
// Archive every current website image, including staff without database matches.
for (const person of seed) {
  if (!person.image) continue;
  const original = resolve(
    root,
    "apps/marketing-web/public",
    person.image.slice(1),
  );
  await copyFile(
    original,
    resolve(
      backup,
      `${person.name.replaceAll(" ", "_")}-${basename(original)}`,
    ),
  );
}
const report = [];
for (const person of seed) {
  const normalized = person.name.toLowerCase();
  const matches = staff.filter(
    (s) =>
      `${s.first_name.trim()} ${s.last_name.trim()}`.toLowerCase() ===
      normalized,
  );
  if (matches.length !== 1) {
    report.push({
      name: person.name,
      skipped: matches.length ? "Ambiguous staff name" : "No production record",
    });
    continue;
  }
  const row = matches[0];
  const suppliedName =
    person.name === "Darshil Jangra"
      ? "darshil_jang"
      : normalized.replaceAll(" ", "_");
  const supplied = resolve(
    "/Users/matthewchua/Desktop/photos/staff",
    `${suppliedName}.jpeg`,
  );
  let photo;
  try {
    await stat(supplied);
    photo = supplied;
  } catch {
    /* Fall back to archived website photo. */
  }
  if (person.image) {
    const original = resolve(
      root,
      "apps/marketing-web/public",
      person.image.slice(1),
    );
    await copyFile(
      original,
      resolve(
        backup,
        `${person.name.replaceAll(" ", "_")}-${basename(original)}`,
      ),
    );
    if (!photo && !person.image.includes("Square-logo-transparent"))
      photo = original;
  }
  const bio =
    !row.profile_bio?.trim() &&
    person.bio &&
    !person.bio.includes("Bio coming soon")
      ? person.bio
      : null;
  const item = {
    name: person.name,
    staffId: row.id,
    bio: bio ? "import website bio" : "preserve existing/empty",
    photo: photo ? basename(photo) : "preserve existing/none",
  };
  report.push(item);
  if (!apply) continue;
  if (bio)
    await api(
      `/rest/v1/staff?id=eq.${row.id}&or=(profile_bio.is.null,profile_bio.eq.)`,
      { method: "PATCH", body: JSON.stringify({ profile_bio: bio }) },
    );
  if (photo) {
    const bytes = await readFile(photo);
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 20);
    const storagePath = `${row.id}/website-import-${hash}${extname(photo).toLowerCase()}`;
    const existing = await api(
      `/rest/v1/files?select=id&bucket=eq.staff-profile-images&storage_path=eq.${encodeURIComponent(storagePath)}`,
    );
    let fileId = existing[0]?.id;
    if (!fileId) {
      const mimetype =
        extname(photo).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
      const upload = await fetch(
        `${origin}/storage/v1/object/staff-profile-images/${storagePath}`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": mimetype,
            "x-upsert": "false",
            "Cache-Control": "max-age=31536000",
          },
          body: bytes,
        },
      );
      if (!upload.ok)
        throw new Error(
          `Photo upload failed for ${person.name}: ${await upload.text()}`,
        );
      fileId = randomUUID();
      await api("/rest/v1/files", {
        method: "POST",
        body: JSON.stringify({
          id: fileId,
          filename: basename(photo),
          mimetype,
          size_bytes: bytes.length,
          bucket: "staff-profile-images",
          storage_path: storagePath,
          storage_provider: "supabase",
          created_by: row.id,
          metadata: {
            purpose: "staff-profile-image",
            source: "website-import-2026-09-28",
            profileImageCrop: { x: 50, y: 50, zoom: 1 },
          },
        }),
      });
    }
    // Optimistic guard protects a photo edited after the initial read.
    await api(
      `/rest/v1/staff?id=eq.${row.id}&profile_image_file_id=${row.profile_image_file_id ? `eq.${row.profile_image_file_id}` : "is.null"}`,
      {
        method: "PATCH",
        body: JSON.stringify({ profile_image_file_id: fileId }),
      },
    );
    item.fileId = fileId;
  }
}
await writeFile(
  resolve(backup, apply ? "import-report.json" : "dry-run.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify({ apply, backup, report }, null, 2));
