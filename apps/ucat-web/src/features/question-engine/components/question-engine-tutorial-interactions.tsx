"use client";

import { useEffect, useRef } from "react";
import { useNextStep } from "nextstepjs";
import {
  getTourStep,
  UCAT_QUESTION_ENGINE_CONTROLS_TOUR,
  UCAT_QUESTION_ENGINE_TOUR,
} from "@/features/onboarding/config/tour-steps";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";
import { showTutorialFeedback } from "@/features/onboarding/lib/tutorial-events";

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

const TOOLBAR_CONTROL_FEEDBACK = [
  {
    selector: "[data-tour='question-engine-toolbar-lag']",
    title: "Lag mode",
    description:
      "Lag mode adds a small delay to question controls so you can practice with response times closer to the real UCAT. You can freely switch it on or off here.",
  },
  {
    selector: "[data-tour='question-engine-toolbar-layout']",
    title: "Toolbar position",
    description:
      "This moves Altitutor's toolbar between the top and right of the screen. Your saved toolbar preference is not changed by the tutorial.",
  },
  {
    selector: "[data-tour='question-engine-toolbar-report']",
    title: "Report a problem",
    description:
      "In a real attempt, this opens a report form with the current question and attempt details attached. The form stays closed during the tutorial.",
    preventDefault: true,
  },
  {
    selector: "[data-tour='question-engine-toolbar-exit']",
    title: "Exit safely",
    description:
      "In a real attempt, Exit asks for confirmation before you leave or discard anything. It cannot close this tutorial.",
    preventDefault: true,
  },
] as const;

function shortcutLetter(event: KeyboardEvent): string {
  return event.code.startsWith("Key")
    ? event.code.slice(3).toLowerCase()
    : event.key.toLowerCase();
}

function isQuestionEngineKey(event: KeyboardEvent): boolean {
  const letter = shortcutLetter(event);
  return (
    (event.altKey && event.code.startsWith("Key")) ||
    (!event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      ["a", "b", "c", "d", "e", "f"].includes(letter))
  );
}

export function QuestionEngineTutorialInteractions() {
  const { currentTour, currentStep, setCurrentStep, closeNextStep } =
    useNextStep();
  const completeTour = useCompleteOnboardingTour();
  const transitionLockedRef = useRef(false);

  useEffect(() => {
    const isFullTutorial = currentTour === UCAT_QUESTION_ENGINE_TOUR;
    if (!isFullTutorial && currentTour !== UCAT_QUESTION_ENGINE_CONTROLS_TOUR)
      return;
    transitionLockedRef.current = false;
    const selector = STEP_TARGETS[currentStep];
    const freeInteractionContainer = FREE_INTERACTION_CONTAINERS[currentStep];
    let targetObserver: MutationObserver | null = null;
    let toolbarTargetObserver: MutationObserver | null = null;
    let advanceTimer: number | null = null;
    let recoveryTimer: number | null = null;

    const repaintSpotlight = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
        });
      });
    };

    if (currentStep === 1) {
      let toolbarTarget = document.querySelector(
        "[data-tour='question-engine-settings']",
      );
      repaintSpotlight();
      toolbarTargetObserver = new MutationObserver(() => {
        const nextToolbarTarget = document.querySelector(
          "[data-tour='question-engine-settings']",
        );
        if (!nextToolbarTarget || nextToolbarTarget === toolbarTarget) return;
        toolbarTarget = nextToolbarTarget;
        repaintSpotlight();
      });
      toolbarTargetObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    const advanceWhenNextTargetIsReady = () => {
      const nextStepIndex = currentStep + 1;
      const nextSelector = getTourStep(
        UCAT_QUESTION_ENGINE_TOUR,
        nextStepIndex,
      )?.selector;
      const commit = () => {
        targetObserver?.disconnect();
        targetObserver = null;
        if (recoveryTimer !== null) window.clearTimeout(recoveryTimer);
        advanceTimer = window.setTimeout(() => {
          setCurrentStep(nextStepIndex);
          repaintSpotlight();
        }, 160);
      };

      if (!nextSelector || document.querySelector(nextSelector)) {
        commit();
        return;
      }

      targetObserver = new MutationObserver(() => {
        if (document.querySelector(nextSelector)) commit();
      });
      targetObserver.observe(document.body, { childList: true, subtree: true });
      recoveryTimer = window.setTimeout(() => {
        targetObserver?.disconnect();
        targetObserver = null;
        transitionLockedRef.current = false;
      }, 5000);
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (currentStep === 1 && target) {
        const feedback = TOOLBAR_CONTROL_FEEDBACK.find((control) =>
          target.closest(control.selector),
        );
        if (!feedback) return;
        showTutorialFeedback({
          title: feedback.title,
          description: feedback.description,
        });
        if ("preventDefault" in feedback && feedback.preventDefault) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
        return;
      }
      if (!isFullTutorial) return;
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

      advanceWhenNextTargetIsReady();
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
      if (!isFullTutorial) return;
      if (currentStep === 3) {
        const calculatorKey = event.key.toLowerCase();
        const isCalculatorKey =
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          (/^[0-9]$/.test(calculatorKey) ||
            [
              ".",
              "+",
              "-",
              "*",
              "x",
              "/",
              "%",
              "enter",
              "=",
              "c",
              "p",
              "m",
              "backspace",
              "delete",
            ].includes(calculatorKey));
        if (isCalculatorKey) return;
        if (isQuestionEngineKey(event)) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (currentStep === 11) {
        if (isQuestionEngineKey(event)) {
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
      targetObserver?.disconnect();
      toolbarTargetObserver?.disconnect();
      if (advanceTimer !== null) window.clearTimeout(advanceTimer);
      if (recoveryTimer !== null) window.clearTimeout(recoveryTimer);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("dblclick", handleDoubleClick, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [closeNextStep, completeTour, currentStep, currentTour, setCurrentStep]);

  return null;
}
