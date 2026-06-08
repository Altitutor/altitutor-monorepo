import { SkillTrainerDetailPage } from "@/features/skill-trainer/components/skill-trainer-detail-page";
import { isUcatSkillTrainerKey } from "@altitutor/shared";
import { notFound } from "next/navigation";

export default function SkillTrainerDetailRoute({
  params,
}: {
  params: { key: string };
}) {
  if (!isUcatSkillTrainerKey(params.key)) notFound();
  return <SkillTrainerDetailPage trainerKey={params.key} />;
}
