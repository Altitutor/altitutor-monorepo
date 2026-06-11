import { SkillTrainerDetailPage } from "@/features/skill-trainer/components/skill-trainer-detail-page";
import { trainerKeyToSlug, trainerSlugToKey } from "@altitutor/shared";
import { notFound, redirect } from "next/navigation";

export default function SkillTrainerDetailRoute({
  params,
}: {
  params: { key: string };
}) {
  const trainerKey = trainerSlugToKey(params.key);
  if (!trainerKey) notFound();
  if (params.key.includes("_")) {
    redirect(`/skill-trainer/${trainerKeyToSlug(trainerKey)}`);
  }
  return <SkillTrainerDetailPage trainerKey={trainerKey} />;
}
