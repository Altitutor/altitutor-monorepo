"use client";

import { subjectsKeys } from "../hooks/useSubjectsQuery";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { subjectsApi } from "../api";
import { getSignedUrlFromBucket } from "@/shared/lib/supabase/storage";

export function SubjectCover({ subjectId }: { subjectId: string }) {
  const { data: url } = useQuery({
    queryKey: subjectsKeys.cover(subjectId),
    queryFn: async () => {
      const file = await subjectsApi.getSubjectImageFile(subjectId);
      return file?.storage_path && file.bucket === "resources"
        ? getSignedUrlFromBucket("resources", file.storage_path, 3600)
        : null;
    },
    staleTime: 30 * 60 * 1000,
  });
  if (!url) return null;
  return (
    <Image
      width={800}
      height={450}
      unoptimized
      src={url}
      alt=""
      className="mb-3 aspect-video w-full rounded-md object-cover"
    />
  );
}
