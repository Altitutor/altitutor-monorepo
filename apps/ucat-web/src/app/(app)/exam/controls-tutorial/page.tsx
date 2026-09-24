import { QuestionEngineTutorialPage } from "@/features/question-engine/components/question-engine-tutorial-page";
import { UCAT_QUESTION_ENGINE_CONTROLS_TOUR } from "@/features/onboarding/config/tour-catalog";

export default function QuestionEngineControlsTutorialRoute() {
  return (
    <QuestionEngineTutorialPage
      tourId={UCAT_QUESTION_ENGINE_CONTROLS_TOUR}
    />
  );
}
