import type { ReviewContract } from "@altitutor/ucat-response-contract";

type Badge = { label: string; tone: "correct" | "incorrect" | "neutral" };

/** Use the canonical marking review for both single-choice and placement rows. */
export function answerOptionReview(review: ReviewContract, optionId: string) {
  const badges: Badge[] = [];
  if (review.kind === "single_select") {
    const correct = review.correctOptionId === optionId;
    const selected = review.selectedOptionId === optionId;
    if (selected)
      badges.push({
        label: "Your answer",
        tone: correct ? "correct" : "incorrect",
      });
    if (correct) badges.push({ label: "Correct answer", tone: "correct" });
    return {
      badges,
      tone: correct ? "correct" : selected ? "incorrect" : "neutral",
    } as const;
  }

  const row = review.rows.find((entry) => entry.targetId === optionId);
  if (!row) return { badges, tone: "neutral" } as const;
  const label = (token: string) =>
    token === "most"
      ? "Most appropriate"
      : token === "least"
        ? "Least appropriate"
        : token === "yes"
          ? "Yes"
          : "No";
  if (row.placedToken)
    badges.push({
      label: `Your answer: ${label(row.placedToken)}`,
      tone: row.placedToken === row.correctToken ? "correct" : "incorrect",
    });
  else if (row.correctToken)
    badges.push({
      label:
        row.correctToken === "most" || row.correctToken === "least"
          ? "Not selected"
          : "Not answered",
      tone: "neutral",
    });
  if (row.correctToken)
    badges.push({
      label: `Correct answer: ${label(row.correctToken)}`,
      tone: "correct",
    });
  return {
    badges,
    tone:
      row.placedToken && row.placedToken !== row.correctToken
        ? "incorrect"
        : row.correctToken
          ? "correct"
          : "neutral",
  } as const;
}

export function hasReviewedAnswer(review: ReviewContract) {
  return review.kind === "single_select"
    ? review.selectedOptionId !== null
    : review.rows.some((row) => row.placedToken !== null);
}
