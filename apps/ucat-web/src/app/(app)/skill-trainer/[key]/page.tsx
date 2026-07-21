import { SkillTrainerDetailPage } from "@/features/skill-trainer/components/skill-trainer-detail-page";
import { trainerKeyToSlug, trainerSlugToKey } from "@altitutor/shared";
import { notFound } from "next/navigation";

export default function SkillTrainerDetailRoute({
  params,
}: {
  params: { key: string };
}) {
  const trainerKey = trainerSlugToKey(params.key);
  if (!trainerKey || trainerKeyToSlug(trainerKey) !== params.key) notFound();
  return <SkillTrainerDetailPage trainerKey={trainerKey} />;
}
