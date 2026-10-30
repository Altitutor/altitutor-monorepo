import { SkillTrainerDetailPage } from "@/features/skill-trainer/components/skill-trainer-detail-page";
import { trainerKeyToSlug, trainerSlugToKey } from "@altitutor/shared";
import { notFound } from "next/navigation";

export default async function SkillTrainerDetailRoute(
  props: {
    params: Promise<{ key: string }>;
  }
) {
  const params = await props.params;
  const trainerKey = trainerSlugToKey(params.key);
  if (!trainerKey || trainerKeyToSlug(trainerKey) !== params.key) notFound();
  return <SkillTrainerDetailPage trainerKey={trainerKey} />;
}
