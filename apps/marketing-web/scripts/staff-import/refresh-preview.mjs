// Read-only production export of public staff fields for unconfigured local previews.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const env = Object.fromEntries(
  (await readFile(resolve(root, "secrets/.env.production"), "utf8"))
    .split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const i = line.indexOf("=");
      return [
        line.slice(0, i),
        line
          .slice(i + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, "$2"),
      ];
    }),
);
if (env.SUPABASE_PROJECT_REF !== "mzgunxjfgvcyivcyqimn")
  throw new Error("Expected production project");
const origin = `https://${env.SUPABASE_PROJECT_REF}.supabase.co`;
async function get(query) {
  const response = await fetch(`${origin}/rest/v1/${query}`, {
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    },
  });
  if (!response.ok) throw new Error(`Export failed: ${response.status}`);
  return response.json();
}
const editorial = JSON.parse(
  await readFile(new URL("./website-profiles.json", import.meta.url), "utf8"),
);
const staff = await get(
  "staff?status=eq.ACTIVE&select=id,first_name,last_name,role,profile_bio,profile_image_file_id,staff_subjects(subjects(name,curriculum))",
);
const files = await get(
  "files?bucket=eq.staff-profile-images&deleted_at=is.null&select=id,bucket,storage_path,metadata",
);
// Once the publication migration is deployed, respect current admin settings.
const publicationResponse = await fetch(
  `${origin}/rest/v1/staff_marketing_profiles?select=staff_id,published,display_name,public_title,display_order`,
  {
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    },
  },
);
let publications = null;
if (publicationResponse.ok) publications = await publicationResponse.json();
else {
  const error = await publicationResponse.json();
  if (error.code !== "PGRST205" && error.code !== "42P01")
    throw new Error("Could not read publication settings");
}
const profiles = staff
  .flatMap((person) => {
    const name = `${person.first_name.trim()} ${person.last_name.trim()}`;
    const legacy = editorial.find((item) => item.name === name);
    const publication = publications?.find(
      (item) => item.staff_id === person.id,
    );
    if (publications ? !publication?.published : !legacy) return [];
    const image = files.find(
      (file) => file.id === person.profile_image_file_id,
    );
    return [
      {
        staff_id: person.id,
        display_name: publication?.display_name || legacy?.display_name || name,
        public_title: publication?.public_title ?? legacy?.title ?? "",
        is_administrative_staff: person.role === "ADMINSTAFF",
        profile_bio: person.profile_bio,
        profile_image_bucket: image?.bucket ?? null,
        profile_image_storage_path: image?.storage_path ?? null,
        profile_image_metadata: {
          profileImageCrop: image?.metadata?.profileImageCrop ?? null,
        },
        subjects: person.staff_subjects
          .map((assignment) => assignment.subjects)
          .filter(Boolean),
        display_order: publication?.display_order ?? legacy?.order ?? 1000,
      },
    ];
  })
  .sort(
    (a, b) =>
      a.display_order - b.display_order ||
      a.display_name.localeCompare(b.display_name),
  );
await writeFile(
  resolve(root, "apps/marketing-web/src/features/staff/preview.json"),
  JSON.stringify({ origin, profiles }, null, 2) + "\n",
);
console.log(
  `Exported ${profiles.length} public profiles; no production data changed.`,
);
