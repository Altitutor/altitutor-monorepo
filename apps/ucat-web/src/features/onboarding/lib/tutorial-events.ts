export const TUTORIAL_SKIP_REQUEST_EVENT = "ucat:tutorial-skip-request";
export const TUTORIAL_FEEDBACK_EVENT = "ucat:tutorial-feedback";

export interface TutorialFeedback {
  title: string;
  description: string;
}

export function requestTutorialSkipConfirmation() {
  window.dispatchEvent(new Event(TUTORIAL_SKIP_REQUEST_EVENT));
}

export function showTutorialFeedback(feedback: TutorialFeedback) {
  window.dispatchEvent(
    new CustomEvent<TutorialFeedback>(TUTORIAL_FEEDBACK_EVENT, {
      detail: feedback,
    }),
  );
}
