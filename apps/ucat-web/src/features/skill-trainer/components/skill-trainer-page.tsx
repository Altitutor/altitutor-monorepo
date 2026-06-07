import { QuotaUsageCard } from "@/features/ucat-access/components/quota-usage-card";
import { UcatPageHeader } from "@/features/layout";

export function SkillTrainerPage() {
  return (
    <div className="space-y-6">
      <QuotaUsageCard area="skill_trainer" />
      <UcatPageHeader
        title="Skill trainer"
        description="Targeted skill drills — placeholder until launch."
      />
    </div>
  );
}
