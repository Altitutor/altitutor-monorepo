import { SkillTrainerPlayPage } from "@/features/skill-trainer/components/skill-trainer-play-page";
import { trainerKeyToSlug, trainerSlugToKey } from "@altitutor/shared";
import { notFound, redirect } from "next/navigation";

export default function SkillTrainerPlayRoute({
  params,
  searchParams,
}: {
  params: { key: string };
  searchParams: { attemptId?: string };
}) {
  const trainerKey = trainerSlugToKey(params.key);
  if (!trainerKey || !searchParams.attemptId) notFound();
  if (params.key.includes("_")) {
    const slug = trainerKeyToSlug(trainerKey);
    const query = new URLSearchParams(
      Object.entries(searchParams).filter((entry): entry is [string, string] => entry[1] != null),
    );
    redirect(`/skill-trainer/${slug}/play?${query.toString()}`);
  }
  return (
    <SkillTrainerPlayPage
      trainerKey={trainerKey}
      attemptId={searchParams.attemptId}
    />
  );
}
