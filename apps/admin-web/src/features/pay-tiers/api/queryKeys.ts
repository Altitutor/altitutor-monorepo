export const payTiersKeys = {
  all: ['pay-tiers'] as const,
  tiers: () => [...payTiersKeys.all, 'tiers'] as const,
  requirements: (tierNumber: number) => [...payTiersKeys.all, 'requirements', tierNumber] as const,
  staffSummaries: () => [...payTiersKeys.all, 'staff-summaries'] as const,
  staffProgress: (staffId: string) => [...payTiersKeys.all, 'staff-progress', staffId] as const,
  staffCheckIns: (staffId: string) => [...payTiersKeys.all, 'staff-check-ins', staffId] as const,
};
