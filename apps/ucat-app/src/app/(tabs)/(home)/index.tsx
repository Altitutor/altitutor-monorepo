import { useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
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
  const { refetch: refetchPlan } = plan;
  const { refetch: refetchActivity } = activity;
  const refresh = useCallback(() => {
    void refetchPlan();
    void refetchActivity();
  }, [refetchPlan, refetchActivity]);
  useFocusEffect(refresh);
  const openPlan = () => router.push("/study-orb");
  return (
    <Screen
      refreshing={plan.isRefetching || activity.isRefetching}
      onRefresh={refresh}
    >
      <HeaderActions />
      {plan.isPending ? (
        <Loading />
      ) : plan.error ? (
        <Failure error={plan.error} retry={() => void plan.refetch()} />
      ) : (
        <TestCountdownCard plan={plan.data} onOpenPlan={openPlan} />
      )}
      {activity.isPending ? (
        <Loading />
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
