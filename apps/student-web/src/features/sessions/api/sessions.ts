// Re-export from shared - sessions feature uses shared student sessions API
// Alias studentSessionsApi as sessionsApi for backward compatibility within this feature
import { studentSessionsApi, type StudentSessionWithStaff } from '@/shared/api/sessions';

export type { StudentSessionWithStaff };
export const sessionsApi = {
  list: studentSessionsApi.list,
  getSessionWithDetails: studentSessionsApi.getSessionWithDetails,
};
