import { SkillTrainerPlayPage } from "@/features/skill-trainer/components/skill-trainer-play-page";
import { isUcatSkillTrainerKey } from "@altitutor/shared";
import { notFound } from "next/navigation";

export default function SkillTrainerPlayRoute({
  params,
  searchParams,
}: {
  params: { key: string };
  searchParams: { attemptId?: string };
}) {
  if (!isUcatSkillTrainerKey(params.key)) notFound();
  if (!searchParams.attemptId) notFound();
  return (
    <SkillTrainerPlayPage
      trainerKey={params.key}
      attemptId={searchParams.attemptId}
    />
  );
}
