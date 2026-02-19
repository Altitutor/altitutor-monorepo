export { sharedAuthApi, type UpdatePasswordRequest } from './auth';
export {
  sharedInvitesApi,
  type GenerateInviteRequest,
  type GenerateInviteResponse,
  type SendInviteEmailRequest,
  type SendInviteSmsRequest,
} from './invites';

// Re-export all feature APIs for convenience
export { authApi } from '@/features/auth/api';
// export { studentsApi } from '@/features/students/api'; // TODO: Tutor-web doesn't have students feature
export { staffApi } from '@/features/staff/api';
export { classesApi } from '@/features/classes/api';
export { sessionsApi } from '@/features/sessions/api';
export { subjectsApi } from '@/features/subjects/api';
export { topicsApi } from '@/features/topics/api'; 