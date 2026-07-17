"use client";

import { useEffect, useRef } from "react";
import { useNextStep } from "nextstepjs";
import { UCAT_QUESTION_ENGINE_TOUR } from "@/features/onboarding/config/tour-steps";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";

const STEP_TARGETS: Record<number, string> = {
  2: "[data-tour='question-engine-calculator']",
  3: "[data-tour='question-engine-calculator-close']",
  4: "[data-tour='question-engine-flag']",
  6: "[data-tour='question-engine-question'] label",
  7: "[data-tour='question-engine-next']",
  8: "[data-tour='question-engine-previous']",
  9: "[data-tour='question-engine-navigator']",
  10: "[data-tour='question-engine-navigator-close']",
  12: "[data-tour='question-engine-next']",
  13: "[data-tour='question-engine-finish-tutorial']",
};

const STEP_SHORTCUTS: Record<number, string> = {
  2: "c",
  4: "f",
  7: "n",
  8: "p",
  9: "v",
  12: "s",
};

const FREE_INTERACTION_CONTAINERS: Record<number, string> = {
  3: "[data-tour='question-engine-calculator-panel']",
  10: "[data-tour='question-engine-navigator-panel']",
};

function shortcutLetter(event: KeyboardEvent): string {
  return event.code.startsWith("Key")
    ? event.code.slice(3).toLowerCase()
    : event.key.toLowerCase();
}

function isQuestionEngineKey(event: KeyboardEvent): boolean {
  const letter = shortcutLetter(event);
  return (
    (event.altKey && ["c", "f", "p", "v", "n", "s"].includes(letter)) ||
    (!event.altKey && ["a", "b", "c", "d", "e", "f"].includes(letter))
  );
}

export function QuestionEngineTutorialInteractions() {
  const { currentTour, currentStep, setCurrentStep, closeNextStep } =
    useNextStep();
  const completeTour = useCompleteOnboardingTour();
  const transitionLockedRef = useRef(false);

  useEffect(() => {
    if (currentTour !== UCAT_QUESTION_ENGINE_TOUR) return;
    transitionLockedRef.current = false;
    const selector = STEP_TARGETS[currentStep];
    const freeInteractionContainer = FREE_INTERACTION_CONTAINERS[currentStep];

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!selector) return;
      if (target?.closest("[data-name='nextstep-card']")) return;
      if (
        freeInteractionContainer &&
        target?.closest(freeInteractionContainer) &&
        !target.closest(selector)
      )
        return;
      if (!target?.closest(selector) || transitionLockedRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      transitionLockedRef.current = true;

      if (currentStep === 13) {
        event.preventDefault();
        void completeTour
          .mutateAsync(UCAT_QUESTION_ENGINE_TOUR)
          .then(() => closeNextStep());
        return;
      }

      window.setTimeout(() => setCurrentStep(currentStep + 1), 160);
    };

    const handleDoubleClick = (event: MouseEvent) => {
      if (currentStep !== 10 || transitionLockedRef.current) return;
      const target = event.target as Element | null;
      if (!target?.closest("[data-tour='question-engine-navigator-question']"))
        return;
      const closeButton = document.querySelector(
        "[data-tour='question-engine-navigator-close']",
      );
      if (closeButton instanceof HTMLElement) closeButton.click();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (currentStep === 3) {
        const calculatorKey = event.key.toLowerCase();
        const isCalculatorKey =
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          (/^[0-9]$/.test(calculatorKey) ||
            [".", "+", "-", "*", "x", "/", "%", "enter", "=", "c", "p", "m", "backspace", "delete"].includes(
              calculatorKey,
            ));
        if (isCalculatorKey) return;
        if (isQuestionEngineKey(event)) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (currentStep === 11) {
        if (event.altKey && shortcutLetter(event) === "s") {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (!isQuestionEngineKey(event)) return;

      const letter = shortcutLetter(event);
      const answerStep = currentStep === 6 && !event.altKey;
      const expectedShortcut = STEP_SHORTCUTS[currentStep];
      const matchesCurrentStep = answerStep
        ? ["a", "b", "c", "d"].includes(letter)
        : event.altKey && expectedShortcut === letter;

      event.preventDefault();
      event.stopPropagation();
      if (!matchesCurrentStep || transitionLockedRef.current || !selector) {
        return;
      }

      const actionTarget = answerStep
        ? document.querySelectorAll(selector)[letter.charCodeAt(0) - 97]
        : document.querySelector(selector);
      if (actionTarget instanceof HTMLElement) {
        actionTarget.click();
      }
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("dblclick", handleDoubleClick, true);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("dblclick", handleDoubleClick, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    closeNextStep,
    completeTour,
    currentStep,
    currentTour,
    setCurrentStep,
  ]);

  return null;
}
