import { useLocalSearchParams, useRouter } from "expo-router";
import { Copy, Screen } from "@/components/ui";
import { QuestionGrid } from "@/features/question-engine/components/question-grid";
import { useExamTools } from "@/features/question-engine/components/exam-tools";
import { useReviewNavigation } from "@/features/attempts/review-navigation";
export default function Navigator() {
  const tools = useExamTools();
  const { navigation: review } = useReviewNavigation();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isReview = mode === "review";
  const router = useRouter();
  const questions =
    (isReview ? review?.questions : tools.current?.questions) ?? [];
  return (
    <Screen>
      <Copy muted>
        {isReview
          ? "✓ Correct · ✕ Incorrect · ◐ Partly correct · — Not answered · ⚑ Flagged."
          : "✓ Answered · ⚑ Flagged."}
        {questions.some((q) => q.disabled)
          ? " Other mock sections are locked."
          : ""}
      </Copy>
      <QuestionGrid
        questions={questions}
        onSelect={(index) => {
          if (isReview) review?.jump(index);
          else tools.current?.jump?.(index);
          router.back();
        }}
      />
    </Screen>
  );
}
