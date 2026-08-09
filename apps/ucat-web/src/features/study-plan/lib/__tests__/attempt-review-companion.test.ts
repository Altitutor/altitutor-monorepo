import {
  describeAttemptReviewCompanionNotice,
  describeAttemptReviewCompanionStatus,
  selectCompanionSecondaryWhileReviewing,
  shouldDismissAttemptReviewPrompt,
} from "@/features/study-plan/lib/attempt-review-companion";
import { isAlreadyOnSuggestedActivity } from "@/features/study-plan/lib/companion-mode";

describe("attempt review companion helpers", () => {
  it("describes remaining review work for the prompt", () => {
    expect(describeAttemptReviewCompanionNotice({ remainingCount: 1 })).toEqual(
      {
        id: "attempt-review:1",
        eyebrow: "Review this attempt",
        title: "1 question left to review",
        detail:
          "Review the incorrect, partial, or unanswered questions while the attempt is fresh.",
      },
    );
    expect(
      describeAttemptReviewCompanionNotice({ remainingCount: 4 }).title,
    ).toBe("4 questions left to review");
  });

  it("mirrors the insight card status in the expanded orb", () => {
    expect(
      describeAttemptReviewCompanionStatus({
        viewedCount: 2,
        requiredCount: 5,
      }),
    ).toEqual({
      title: "Review this attempt",
      detail:
        "2 of 5 incorrect, partial, or unanswered questions viewed.",
      actionLabel: "Review next incorrect",
    });
  });

  it("dismisses the prompt once the student leaves the landing question", () => {
    expect(
      shouldDismissAttemptReviewPrompt({
        landingQuestionIndex: 0,
        selectedQuestionIndex: 0,
      }),
    ).toBe(false);
    expect(
      shouldDismissAttemptReviewPrompt({
        landingQuestionIndex: 0,
        selectedQuestionIndex: 2,
      }),
    ).toBe(true);
  });

  it("uses the normal next suggestion as secondary when it is not this review", () => {
    expect(
      selectCompanionSecondaryWhileReviewing({
        pathname: "/progress/set-attempts/attempt-1",
        items: [
          {
            launchPath: "/practice",
            title: "Practice",
          },
          {
            launchPath: "/skill-trainer",
            title: "Trainer",
          },
        ],
      }),
    ).toEqual({
      launchPath: "/practice",
      title: "Practice",
    });
  });

  it("skips a duplicated current-review primary and keeps its secondary", () => {
    expect(
      selectCompanionSecondaryWhileReviewing({
        pathname: "/progress/set-attempts/attempt-1",
        items: [
          {
            launchPath: "/progress/set-attempts/attempt-1",
            title: "Review this set",
          },
          {
            launchPath: "/practice",
            title: "Practice",
          },
        ],
      }),
    ).toEqual({
      launchPath: "/practice",
      title: "Practice",
    });
  });

  it("matches section-scoped review paths as the current page", () => {
    expect(
      isAlreadyOnSuggestedActivity(
        "/progress/sections/2/set-attempts/attempt-1",
        "/progress/set-attempts/attempt-1",
      ),
    ).toBe(true);
  });
});
