export const stripeSyncKeys = {
  all: ['stripe-sync'] as const,
  student: (studentId: string) => [...stripeSyncKeys.all, 'student', studentId] as const,
  customer: (customerId: string) => [...stripeSyncKeys.all, 'customer', customerId] as const,
  exactMatches: (studentId: string, email: string | null, name: string) =>
    [...stripeSyncKeys.all, 'exact-matches', studentId, email ?? '', name] as const,
  paymentMethods: (studentId: string) =>
    [...stripeSyncKeys.all, 'payment-methods', studentId] as const,
};
