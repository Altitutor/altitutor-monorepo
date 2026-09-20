import { HeaderActions } from "@/components/header-actions";
import { useQuery } from "@tanstack/react-query";
import {
  Action,
  Copy,
  Failure,
  Group,
  Loading,
  Meter,
  Row,
  Screen,
} from "@/components/ui";
import { dataApi } from "@/features/dashboard/api";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
export default function Today() {
  const router = useRouter();
  const profile = useQuery({ queryKey: ["profile"], queryFn: dataApi.profile });
  const plan = useQuery({ queryKey: ["plan"], queryFn: dataApi.plan });
  const active = useQuery({
    queryKey: ["active"],
    queryFn: () =>
      api<{ active: ActiveExamAttempt | null }>("/exam-attempts/active"),
  });
  return (
    <Screen
      refreshing={plan.isRefetching}
      onRefresh={() => {
        void plan.refetch();
        void active.refetch();
      }}
    >
      <HeaderActions />
      <Group>
        <Copy large>
          {profile.data?.firstName
            ? `Hello, ${profile.data.firstName}`
            : "Make a little progress today."}
        </Copy>
        <Copy muted>One focused session at a time.</Copy>
        <Action
          title="Start practising"
          onPress={() => router.navigate("/practice")}
        />
      </Group>
      <Group title="Your preparation">
        {plan.isPending ? (
          <Loading />
        ) : plan.error ? (
          <Failure error={plan.error} retry={() => void plan.refetch()} />
        ) : (
          <>
            <Copy>
              {plan.data?.completion.completed ?? 0} activities completed
            </Copy>
            <Meter value={plan.data?.completion.percent ?? 0} />
            {plan.data?.todayTasks.slice(0, 3).map((task) => (
              <Row
                key={task.id}
                title={task.title}
                detail={`${task.estimatedMinutes} min · ${task.status.replaceAll("_", " ")}`}
                href="/study-plan"
              />
            ))}
            {!plan.data?.todayTasks.length && (
              <Copy muted>
                Choose a practice session or explore a lesson to keep learning.
              </Copy>
            )}
            <Row
              title="Study plan"
              detail="Your goals and daily activities"
              href="/study-plan"
            />
          </>
        )}
      </Group>
      <Group>
        <Row
          title="Question sets & mock exams"
          detail="Put your preparation to the test"
          href="/catalogue"
        />
      </Group>
    </Screen>
  );
}
