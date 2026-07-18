import { SkillTrainerPlayPage } from "@/features/skill-trainer/components/skill-trainer-play-page";
import { trainerKeyToSlug, trainerSlugToKey } from "@altitutor/shared";
import { notFound, redirect } from "next/navigation";

export default function SkillTrainerPlayRoute({
  params,
}: {
  params: { key: string };
}) {
  const trainerKey = trainerSlugToKey(params.key);
  if (!trainerKey) notFound();
  if (params.key.includes("_")) {
    const slug = trainerKeyToSlug(trainerKey);
    redirect(`/skill-trainer/${slug}/play`);
  }
  return <SkillTrainerPlayPage trainerKey={trainerKey} />;
}
