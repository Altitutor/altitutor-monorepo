export const studentPushCategories = ['sessions', 'payments'] as const;
export const ucatPushCategories = [
  'payments',
  'referrals',
  'quota_grants',
  'quota_limits',
  'new_content',
] as const;

export type StudentPushCategory = (typeof studentPushCategories)[number];
export type UcatPushCategory = (typeof ucatPushCategories)[number];
export type PushCategory = StudentPushCategory | UcatPushCategory;
export type PushAppScope = 'student_web' | 'ucat_web';

export const pushCategoryLabels: Record<PushCategory, string> = {
  sessions: 'Sessions',
  payments: 'Payments',
  referrals: 'Referrals',
  quota_grants: 'Quota grants',
  quota_limits: 'Quota-limit alerts',
  new_content: 'New content',
};

export function pushCategoriesFor(scope: PushAppScope): readonly PushCategory[] {
  return scope === 'student_web' ? studentPushCategories : ucatPushCategories;
}

export function isPushCategory(scope: PushAppScope, value: unknown): value is PushCategory {
  return typeof value === 'string' && pushCategoriesFor(scope).includes(value as PushCategory);
}

export function defaultPushCategoryEnabled(category: PushCategory): boolean {
  return category !== 'quota_limits' && category !== 'new_content';
}

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === 'string'
    && /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/u.test(value)
    && value.length <= 255;
}
