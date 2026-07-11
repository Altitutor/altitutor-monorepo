import { notFound, redirect } from "next/navigation";
import { trainerKeyToSlug, trainerSlugToKey } from "@altitutor/shared";
import { SkillTrainerTutorialPage } from "@/features/skill-trainer/components/skill-trainer-tutorial-page";

export default function SkillTrainerTutorialRoute({
  params,
}: {
  params: { key: string };
}) {
  const trainerKey = trainerSlugToKey(params.key);
  if (!trainerKey) notFound();
  if (params.key.includes("_")) {
    redirect(`/skill-trainer/${trainerKeyToSlug(trainerKey)}/tutorial`);
  }

  return <SkillTrainerTutorialPage trainerKey={trainerKey} />;
}
