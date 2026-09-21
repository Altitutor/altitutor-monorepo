import { useOpenScreen } from "@/features/navigation/use-open-screen";
import { useCurrentAttempt } from "@/features/practice/components/current-attempt";
import { useState } from "react";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
export type LaunchableActivity = {
  id?: string;
  taskType: string;
  learningModuleId?: string | null;
  questionSetId?: string | null;
  mockId?: string | null;
  launchPath?: string;
  launchConfig: Record<string, unknown>;
};
export function useLaunchActivity() {
  const { beforeStart } = useCurrentAttempt();
  const router = useRouter();
  const openScreen = useOpenScreen();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function performLaunch(task: LaunchableActivity) {
    setBusy(true);
    setError(null);
    try {
      if (task.taskType === "review") {
        const path = task.launchPath ?? "";
        const match = path.match(
          /(set-attempts|mock-attempts|practice-sessions)\/([^/?]+)/,
        );
        if (!match) throw new Error("This review is not ready yet.");
        openScreen({
          pathname: "/review",
          params: {
            id: match[2],
            kind:
              match[1] === "set-attempts"
                ? "set"
                : match[1] === "mock-attempts"
                  ? "mock"
                  : "practice",
          },
        });
      } else if (task.learningModuleId)
        openScreen({
          pathname: "/lesson-start",
          params: { id: task.learningModuleId, taskId: task.id },
        });
      else if (task.questionSetId || task.mockId)
        openScreen({
          pathname: "/exam-start",
          params: {
            id: task.mockId ?? task.questionSetId ?? "",
            kind: task.mockId ? "mock" : "set",
            taskId: task.id,
          },
        });
      else if (task.taskType === "practice") {
        const c = task.launchConfig;
        const result = await api<{ id: string }>("/practice-sessions", {
          method: "POST",
          body: {
            sectionKey: c.section,
            ucatSectionId: c.ucatSectionId,
            unlimited: false,
            filtersSnapshot: {
              ...c,
              unansweredOnly: true,
              incorrectOnly: false,
              categoryIds: c.categoryIds ?? [],
              questionTagIds: c.questionTagIds ?? [],
              customTimeMinutes: null,
              reviewTiming: "atEnd",
              studyPlanTaskId: task.id,
            },
          },
        });
        openScreen({
          pathname: "/exam-start",
          params: { id: result.id, kind: "practice", taskId: task.id },
        });
      } else if (task.taskType === "skill_trainer")
        openScreen({
          pathname: "/trainer-start",
          params: {
            trainerKey: String(task.launchConfig.skillTrainerKey ?? ""),
            taskId: task.id,
          },
        });
      else router.navigate("/progress");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function launch(task: LaunchableActivity) {
    try {
      if (
        task.taskType !== "review" &&
        (task.taskType === "practice" || task.questionSetId || task.mockId)
      )
        await beforeStart(() => performLaunch(task));
      else await performLaunch(task);
    } catch (e) {
      setError(e);
    }
  }
  return { launch, busy, error };
}
