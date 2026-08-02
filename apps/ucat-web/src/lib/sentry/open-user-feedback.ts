"use client";

import * as Sentry from "@sentry/nextjs";

const FEEDBACK_ENTRANCE_DURATION_MS = 200;
const FEEDBACK_ENTRANCE_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const FEEDBACK_MOTION_STYLE_ATTRIBUTE = "data-altitutor-feedback-motion";

function installFeedbackMotionStyles(container: HTMLElement): void {
  if (container.querySelector(`[${FEEDBACK_MOTION_STYLE_ATTRIBUTE}]`)) return;

  const style = document.createElement("style");
  style.setAttribute(FEEDBACK_MOTION_STYLE_ATTRIBUTE, "");
  style.textContent = `
    .dialog,
    .dialog__content {
      transition-duration: ${FEEDBACK_ENTRANCE_DURATION_MS}ms;
      transition-timing-function: ${FEEDBACK_ENTRANCE_EASING};
    }
    .dialog__content {
      transition-property: opacity, transform;
    }
    .dialog:not([open]) .dialog__content {
      opacity: 0;
      transform: translateY(12px) scale(0.98);
    }
    @media (prefers-reduced-motion: reduce) {
      .dialog,
      .dialog__content {
        transition-duration: 0ms;
      }
    }
  `;
  container.prepend(style);
}

function animateFeedbackEntrance(container: unknown): void {
  if (!(container instanceof HTMLElement)) return;
  installFeedbackMotionStyles(container);
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const backdrop = container.querySelector<HTMLElement>(".dialog");
  const content = container.querySelector<HTMLElement>(".dialog__content");
  const timing: KeyframeAnimationOptions = {
    duration: FEEDBACK_ENTRANCE_DURATION_MS,
    easing: FEEDBACK_ENTRANCE_EASING,
  };

  backdrop?.animate([{ opacity: 0 }, { opacity: 1 }], timing);
  content?.animate(
    [
      { opacity: 0, transform: "translateY(12px) scale(0.98)" },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ],
    timing,
  );
}

export async function openUserFeedback(
  context?: Record<string, string | number | boolean | null>,
): Promise<void> {
  if (context) {
    Sentry.setContext("ucat_exam", context);
  }
  const feedback = Sentry.getFeedback();
  if (!feedback) return;

  const form = await feedback.createForm();
  form.appendToDom();
  form.open();
  animateFeedbackEntrance(form.el);
}
