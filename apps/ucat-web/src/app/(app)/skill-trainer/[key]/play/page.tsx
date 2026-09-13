import { SkillTrainerPlayPage } from "@/features/skill-trainer/components/skill-trainer-play-page";
import { trainerKeyToSlug, trainerSlugToKey } from "@altitutor/shared";
import { notFound } from "next/navigation";

export default function SkillTrainerPlayRoute({
  params,
  searchParams,
}: {
  params: { key: string };
  searchParams: { studyPlanTaskId?: string };
}) {
  const trainerKey = trainerSlugToKey(params.key);
  if (!trainerKey || trainerKeyToSlug(trainerKey) !== params.key) notFound();
  return (
    <SkillTrainerPlayPage
      trainerKey={trainerKey}
      studyPlanTaskId={searchParams.studyPlanTaskId ?? null}
    />
  );
}
