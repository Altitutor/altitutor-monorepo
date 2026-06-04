import {
  evaluateRequirement,
  evaluateRequirements,
  getHighestEligiblePromotionTier,
  getPromotionTierOptions,
  isEligibleForReview,
  validateApprovedPromotionTier,
} from '../evaluate';
import { METRIC_KEYS } from '../metric-keys';

describe('pay tier requirement evaluation', () => {
  const metrics = {
    [METRIC_KEYS.tenureDays]: 400,
    [METRIC_KEYS.tenureMonths]: 13,
    'sessions.CLASS.MAIN_TUTOR': 50,
    'sessions.CLASS.any': 55,
    [METRIC_KEYS.teachingAll]: 80,
    [METRIC_KEYS.adminAll]: 10,
  };

  it('evaluates tenure days', () => {
    const result = evaluateRequirement(
      {
        id: '1',
        requirement_kind: 'TENURE_DAYS',
        params: { min: 365 },
      },
      metrics
    );
    expect(result.met).toBe(true);
    expect(result.current).toBe(400);
  });

  it('evaluates session count with specific role', () => {
    const result = evaluateRequirement(
      {
        id: '2',
        requirement_kind: 'SESSION_COUNT',
        params: { min: 40, session_types: ['CLASS'], attendance_types: ['MAIN_TUTOR'] },
      },
      metrics
    );
    expect(result.met).toBe(true);
    expect(result.current).toBe(50);
  });

  it('evaluates teaching aggregate', () => {
    const result = evaluateRequirement(
      {
        id: '3',
        requirement_kind: 'SESSION_COUNT',
        params: { min: 100, session_types: ['CLASS', 'DRAFTING', 'EXAM_COURSE'] },
      },
      metrics
    );
    expect(result.met).toBe(false);
    expect(result.current).toBe(80);
  });

  it('is eligible only when all requirements met', () => {
    const progress = evaluateRequirements(
      [
        {
          id: 'a',
          tier_number: 1,
          requirement_kind: 'TENURE_DAYS',
          params: { min: 365 },
          sort_order: 0,
        },
        {
          id: 'b',
          tier_number: 1,
          requirement_kind: 'SESSION_COUNT',
          params: { min: 100, session_types: ['CLASS'], attendance_types: ['MAIN_TUTOR'] },
          sort_order: 1,
        },
      ],
      metrics
    );
    expect(isEligibleForReview(progress)).toBe(false);
  });

  it('computes highest eligible promotion tier across multiple tiers', () => {
    const requirements = [
      {
        id: 't1',
        tier_number: 1,
        requirement_kind: 'TENURE_DAYS' as const,
        params: { min: 365 },
        sort_order: 0,
      },
      {
        id: 't2',
        tier_number: 2,
        requirement_kind: 'TENURE_DAYS' as const,
        params: { min: 500 },
        sort_order: 0,
      },
      {
        id: 't3',
        tier_number: 3,
        requirement_kind: 'TENURE_DAYS' as const,
        params: { min: 800 },
        sort_order: 0,
      },
    ];
    expect(getHighestEligiblePromotionTier(1, 3, requirements, metrics)).toBe(2);
    expect(getPromotionTierOptions(1, 2)).toEqual([2]);
    expect(validateApprovedPromotionTier(1, 2, 2)).toBeNull();
    expect(validateApprovedPromotionTier(1, 3, 2)).toMatch(/eligible/);
  });
});
