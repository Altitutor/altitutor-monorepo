import { Copy, Group } from "@/components/ui";
import type { StudyPlanResponse } from "@/features/study-plan/model/types";

export function StudyGoal({
  profile,
}: {
  profile: StudyPlanResponse["profile"];
}) {
  const date = profile?.testDate;
  return (
    <Group>
      <Copy large>
        {profile ? `Target ${profile.targetScore}` : "No target yet"}
      </Copy>
      <Copy muted>
        {date
          ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "Exam date to be confirmed"}
      </Copy>
    </Group>
  );
}
