export type MarketingStaffProfile = {
  staff_id: string;
  first_name: string | null;
  last_name: string | null;
  profile_bio: string | null;
  profile_image_bucket: string | null;
  profile_image_storage_path: string | null;
};

function getSupabasePublicUrl(bucket: string, path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export function getStaffProfileImageUrl(profile: MarketingStaffProfile) {
  if (!profile.profile_image_bucket || !profile.profile_image_storage_path) return null;
  return getSupabasePublicUrl(profile.profile_image_bucket, profile.profile_image_storage_path);
}

export async function getMarketingStaffProfiles(): Promise<MarketingStaffProfile[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return [];

  const searchParams = new URLSearchParams({
    select: "staff_id,first_name,last_name,profile_bio,profile_image_bucket,profile_image_storage_path",
    order: "first_name.asc,last_name.asc",
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/vmarketing_staff_profiles?${searchParams}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    next: {
      revalidate: 3600,
      tags: ["marketing-staff-profiles"],
    },
  });

  if (!response.ok) {
    console.error("Failed to fetch marketing staff profiles", response.status);
    return [];
  }

  return response.json();
}
