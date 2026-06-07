import { UcatPageHeader } from "@/features/layout";
import { QuotaUsageCard } from "@/features/ucat-access/components/quota-usage-card";

export function LearningPage() {
  return (
    <div className="space-y-6">
      <UcatPageHeader title="Learn" description="LMS homepage placeholder." />
      <QuotaUsageCard area="learn" />
    </div>
  );
}
