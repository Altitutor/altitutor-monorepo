import preview from "../preview.json";
import { profileTitle } from "../profile-title";
import { subjectBadges } from "../subject-badges";
import { unstable_cache } from "next/cache";

export const STAFF_PROFILES_TAG = "marketing-staff-profiles";
export type StaffProfile = {
  id: string;
  name: string;
  title: string;
  bio: string;
  subjects: string[];
  image: string | null;
  crop: { x: number; y: number; zoom: number };
};

export function staffDatabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid staff profile response");
  return value as Record<string, unknown>;
}
const text = (value: unknown) => (typeof value === "string" ? value : "");
const number = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;

export function parseStaffProfiles(
  data: unknown,
  origin: string,
): StaffProfile[] {
  if (!Array.isArray(data)) throw new Error("Invalid staff profile list");
  return data.map((value) => {
    const row = record(value);
    if (!text(row.staff_id) || !text(row.display_name))
      throw new Error("Missing staff identity");
    const metadata = row.profile_image_metadata
      ? record(row.profile_image_metadata)
      : {};
    const crop = metadata.profileImageCrop
      ? record(metadata.profileImageCrop)
      : {};
    const path = text(row.profile_image_storage_path);
    return {
      id: text(row.staff_id),
      name: text(row.display_name),
      title: profileTitle(
        text(row.public_title),
        row.is_administrative_staff === true,
      ),
      bio: text(row.profile_bio),
      subjects: subjectBadges(
        (Array.isArray(row.subjects) ? row.subjects : []).map((value) => {
          const subject = record(value);
          return {
            name: text(subject.name),
            curriculum: text(subject.curriculum) || null,
          };
        }),
      ),
      image:
        row.profile_image_bucket === "staff-profile-images" && path
          ? `${origin}/storage/v1/object/public/staff-profile-images/${path.split("/").map(encodeURIComponent).join("/")}`
          : null,
      crop: {
        x: number(crop.x, 50, 0, 100),
        y: number(crop.y, 50, 0, 100),
        zoom: number(crop.zoom, 1, 1, 3),
      },
    };
  });
}

// unstable_cache bypasses the inner fetch cache itself; an explicit no-store
// fetch would opt this route out of static generation in Next.js 14.
// Cache only successful, validated reads. Throwing preserves the last successful
// ISR page during outages, instead of publishing an empty or legacy staff list.
const readProfiles = unstable_cache(
  async (url: string, key: string) => {
    const response = await fetch(
      `${url}/rest/v1/vmarketing_staff_profiles?select=staff_id,display_name,public_title,profile_bio,profile_image_bucket,profile_image_storage_path,profile_image_metadata,subjects&order=display_order.asc,display_name.asc`,
      {
        headers: { apikey: key },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      throw new Error(`Staff profiles unavailable (${response.status})`);
    return parseStaffProfiles(await response.json(), url);
  },
  ["staff-profiles-v3"],
  { revalidate: 86400, tags: [STAFF_PROFILES_TAG] },
);

export async function getStaffProfiles(): Promise<StaffProfile[]> {
  const config = staffDatabaseConfig();
  if (!config) {
    // Unconfigured local/CI previews use a public production-data snapshot. Hosted builds
    // must explicitly configure the database, never silently ship stale people.
    if (process.env.VERCEL)
      throw new Error("Configure marketing Supabase environment variables");
    return parseStaffProfiles(preview.profiles, preview.origin);
  }
  return readProfiles(config.url, config.key);
}
