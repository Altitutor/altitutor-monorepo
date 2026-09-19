import type { FlashcardReviewCard } from '@altitutor/shared';
import { buildStudySnapshot } from '../study-snapshot';

const now = new Date('2026-09-19T00:00:00Z');
function card(id: string, state: FlashcardReviewCard['state'], dueAt = now.toISOString()): FlashcardReviewCard {
  return { id, flashcard_id: id, cloze_index: 1, topic_id: 'topic', card_type: 'text_cloze', cloze_text: '{{c1::x}}', extra: null,
    image_file_id: null, image_alt_text: null, image_storage_path: null, image_mimetype: null, occlusion_data: null, flashcard_index: 0,
    due_at: dueAt, stability: state === 'New' ? null : 10, difficulty: state === 'New' ? null : 5, scheduled_days: 1,
    learning_steps: 0, reps: state === 'New' ? 0 : 1, lapses: 0, state, last_reviewed_at: null, last_rating: null,
    revision: 0, buried_until: null, buried_reason: null, suspended_at: null, leech_at: null };
}

describe('buildStudySnapshot', () => {
  it('prioritises due learning, review, new, then learn-ahead cards', () => {
    const snapshot = buildStudySnapshot([card('n','New'), card('r','Review'), card('i','Learning','2026-09-19T00:10:00Z'), card('l','Relearning')],
      { newStudied: 0, reviewsStudied: 0 }, { newLimit: 20, reviewLimit: 200, learnAheadMinutes: 20 }, now);
    expect(snapshot.cards.map((item) => item.id)).toEqual(['l','r','n','i']);
    expect(snapshot.counts).toEqual({ new: 1, learning: 1, relearning: 1, review: 1, total: 4 });
  });

  it('blocks new cards when the review allowance is exhausted with reviews still due', () => {
    const snapshot = buildStudySnapshot([card('n','New'), card('r','Review')], { newStudied: 0, reviewsStudied: 1 },
      { newLimit: 20, reviewLimit: 1, learnAheadMinutes: 20 }, now);
    expect(snapshot.cards).toEqual([]);
    expect(snapshot.held.reviewLimit).toBe(1);
    expect(snapshot.held.newBlockedByReviews).toBe(1);
  });

  it('learning and relearning bypass daily limits and suspended or buried cards are held', () => {
    const suspended = { ...card('s','Learning'), suspended_at: now.toISOString() };
    const buried = { ...card('b','Review'), buried_until: '2026-09-20T00:00:00Z' };
    const snapshot = buildStudySnapshot([card('l','Learning'), card('x','Relearning'), suspended, buried],
      { newStudied: 20, reviewsStudied: 200 }, { newLimit: 20, reviewLimit: 200, learnAheadMinutes: 20 }, now);
    expect(snapshot.cards.map((item) => item.id)).toEqual(['l','x']);
    expect(snapshot.held.suspended).toBe(1);
    expect(snapshot.held.buried).toBe(1);
  });

  it('sorts reviews before applying the daily allowance', () => {
    const high = { ...card('high', 'Review'), retrievability: 0.9 };
    const low = { ...card('low', 'Review'), retrievability: 0.2 };
    const snapshot = buildStudySnapshot([high, low], { newStudied: 0, reviewsStudied: 0 },
      { newLimit: 20, reviewLimit: 1, learnAheadMinutes: 20 }, now);
    expect(snapshot.cards.map((item) => item.id)).toEqual(['low']);
  });

  it('selects new cards deterministically before applying the allowance', () => {
    const policy = { newLimit: 1, reviewLimit: 200, learnAheadMinutes: 20, studyDaySeed: '2026-09-18' };
    const first = buildStudySnapshot([card('one', 'New'), card('two', 'New')], { newStudied: 0, reviewsStudied: 0 }, policy, now);
    const second = buildStudySnapshot([card('two', 'New'), card('one', 'New')], { newStudied: 0, reviewsStudied: 0 }, policy, now);
    expect(second.cards[0]?.id).toBe(first.cards[0]?.id);
  });

  it('places due intraday learning before due interday learning', () => {
    const intraday = { ...card('intraday', 'Learning'), scheduled_days: 0 };
    const interday = { ...card('interday', 'Relearning'), scheduled_days: 1 };
    const snapshot = buildStudySnapshot([interday, intraday], { newStudied: 0, reviewsStudied: 0 },
      { newLimit: 20, reviewLimit: 200, learnAheadMinutes: 20 }, now);
    expect(snapshot.cards.map((item) => item.id)).toEqual(['intraday', 'interday']);
  });
});
