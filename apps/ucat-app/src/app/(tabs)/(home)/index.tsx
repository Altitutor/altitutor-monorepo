import { useState } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { HeaderActions } from "@/components/header-actions";
import { Failure, Loading, Screen } from "@/components/ui";
import {
  HomeStreakCard,
  NextActivityCard,
  TestCountdownCard,
} from "@/features/dashboard/components/home-cards";
import { progressApi } from "@/features/progress/api";
import { useStudyCompanion } from "@/features/study-plan/components/study-orb";
import { useLaunchActivity } from "@/features/study-plan/use-launch-activity";

export default function Home() {
  const router = useRouter();
  const { query: plan, next } = useStudyCompanion();
  const activity = useQuery({
    queryKey: ["activity"],
    queryFn: progressApi.activity,
  });
  const { launch, busy, error } = useLaunchActivity();
  const [pulling, setPulling] = useState(false);
  const openPlan = () => router.push("/study-orb");
  return (
    <Screen
      refreshing={pulling}
      onRefresh={() => {
        setPulling(true);
        void Promise.all([plan.refetch(), activity.refetch()]).finally(() =>
          setPulling(false),
        );
      }}
    >
      <HeaderActions />
      {plan.isPending ? (
        <Loading variant="card" />
      ) : plan.error ? (
        <Failure error={plan.error} retry={() => void plan.refetch()} />
      ) : (
        <TestCountdownCard plan={plan.data} onOpenPlan={openPlan} />
      )}
      {activity.isPending ? (
        <Loading variant="card" />
      ) : activity.error ? (
        <Failure error={activity.error} retry={() => void activity.refetch()} />
      ) : (
        <HomeStreakCard activity={activity.data} />
      )}
      {plan.data && (
        <NextActivityCard
          next={next}
          hasPlan={!!plan.data.profile}
          busy={busy}
          onLaunch={() => {
            if (next)
              void launch({
                ...next,
                id: "status" in next ? next.id : undefined,
              });
          }}
          onOpenPlan={openPlan}
          onPractice={() => router.navigate("/practice")}
        />
      )}
      {error ? <Failure error={error} /> : null}
    </Screen>
  );
}
