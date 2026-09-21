import type { FlashcardReviewCard } from '@altitutor/shared';
import { getRetrievability } from './fsrs';

type DailyUsage = { newStudied: number; reviewsStudied: number };
type StudyPolicy = { newLimit: number; reviewLimit: number; learnAheadMinutes: number; studyDaySeed?: string };

export type StudySnapshot = {
  cards: FlashcardReviewCard[];
  counts: { new: number; learning: number; relearning: number; review: number; total: number };
  held: { buried: number; suspended: number; newLimit: number; reviewLimit: number; newBlockedByReviews: number; futureLearning: number };
  nextDueAt: string | null;
};

function deterministicNewOrder(card: FlashcardReviewCard, day: string) {
  let hash = 2166136261;
  for (const char of `${day}:${card.id}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function buildStudySnapshot(cards: FlashcardReviewCard[], usage: DailyUsage, policy: StudyPolicy, now: Date): StudySnapshot {
  const held = { buried: 0, suspended: 0, newLimit: 0, reviewLimit: 0, newBlockedByReviews: 0, futureLearning: 0 };
  const active = cards.filter((card) => {
    if (card.suspended_at) { held.suspended += 1; return false; }
    if (card.buried_until && new Date(card.buried_until) > now) { held.buried += 1; return false; }
    return true;
  });
  const learning = active.filter((card) => card.state === 'Learning' || card.state === 'Relearning');
  const dueLearning = learning.filter((card) => new Date(card.due_at) <= now);
  const learnAhead = learning.filter((card) => {
    const due = new Date(card.due_at).getTime();
    return due > now.getTime() && due <= now.getTime() + (card.learn_ahead_minutes ?? policy.learnAheadMinutes) * 60_000;
  });
  const futureLearning = learning.filter((card) => new Date(card.due_at).getTime() > now.getTime() + (card.learn_ahead_minutes ?? policy.learnAheadMinutes) * 60_000);
  held.futureLearning = futureLearning.length;
  const dueReviews = active.filter((card) => card.state === 'Review' && new Date(card.due_at) <= now);
  const newCards = active.filter((card) => card.state === 'New');
  const byDueAt = (a: FlashcardReviewCard, b: FlashcardReviewCard) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  const intradayLearning = dueLearning.filter((card) => card.scheduled_days === 0).sort(byDueAt);
  const interdayLearning = dueLearning.filter((card) => card.scheduled_days > 0).sort(byDueAt);
  const orderedLearnAhead = learnAhead.sort(byDueAt);
  const orderedReviews = dueReviews.sort((a, b) => (a.retrievability ?? getRetrievability(a, now)) - (b.retrievability ?? getRetrievability(b, now)));
  const day = policy.studyDaySeed ?? now.toISOString().slice(0,10);
  const orderedNew = newCards.sort((a, b) => deterministicNewOrder(a, day) - deterministicNewOrder(b, day));
  const remainingReview = policy.reviewLimit === 9999 ? orderedReviews.length : Math.max(0, policy.reviewLimit - usage.reviewsStudied);
  const admittedReviews = orderedReviews.slice(0, remainingReview);
  held.reviewLimit = dueReviews.length - admittedReviews.length;
  const reviewsRemainHeld = held.reviewLimit > 0;
  const remainingNew = policy.newLimit === 9999 ? newCards.length : Math.max(0, policy.newLimit - usage.newStudied);
  const admittedNew = reviewsRemainHeld ? [] : orderedNew.slice(0, remainingNew);
  held.newLimit = reviewsRemainHeld ? 0 : newCards.length - admittedNew.length;
  held.newBlockedByReviews = reviewsRemainHeld ? newCards.length : 0;

  const admittedLearning = [...intradayLearning, ...interdayLearning, ...orderedLearnAhead];
  const queue = [
    ...intradayLearning,
    ...interdayLearning,
    ...admittedReviews,
    ...admittedNew,
    ...orderedLearnAhead,
  ];
  const counts = { new: admittedNew.length, learning: admittedLearning.filter((c)=>c.state==='Learning').length,
    relearning: admittedLearning.filter((c)=>c.state==='Relearning').length, review: admittedReviews.length, total: queue.length };
  const nextDue = futureLearning.sort((a,b)=>new Date(a.due_at).getTime()-new Date(b.due_at).getTime())[0];
  return { cards: queue, counts, held, nextDueAt: nextDue?.due_at ?? null };
}
