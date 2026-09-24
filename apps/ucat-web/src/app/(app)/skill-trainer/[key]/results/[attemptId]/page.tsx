import { notFound } from "next/navigation";
import { trainerKeyToSlug, trainerSlugToKey } from "@altitutor/shared";
import { SkillTrainerResultsPage } from "@/features/skill-trainer/components/skill-trainer-results-page";

export default function SkillTrainerResultsRoute({
  params,
}: {
  params: { key: string; attemptId: string };
}) {
  const trainerKey = trainerSlugToKey(params.key);
  if (!trainerKey || trainerKeyToSlug(trainerKey) !== params.key) notFound();
  return (
    <SkillTrainerResultsPage
      trainerKey={trainerKey}
      attemptId={params.attemptId}
    />
  );
}
