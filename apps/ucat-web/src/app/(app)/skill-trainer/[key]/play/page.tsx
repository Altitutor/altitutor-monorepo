import { SkillTrainerPlayPage } from "@/features/skill-trainer/components/skill-trainer-play-page";
import { trainerKeyToSlug, trainerSlugToKey } from "@altitutor/shared";
import { notFound } from "next/navigation";

export default async function SkillTrainerPlayRoute(
  props: {
    params: Promise<{ key: string }>;
    searchParams: Promise<{ studyPlanTaskId?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const trainerKey = trainerSlugToKey(params.key);
  if (!trainerKey || trainerKeyToSlug(trainerKey) !== params.key) notFound();
  return (
    <SkillTrainerPlayPage
      trainerKey={trainerKey}
      studyPlanTaskId={searchParams.studyPlanTaskId ?? null}
    />
  );
}
