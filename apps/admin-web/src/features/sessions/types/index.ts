export type { Tables, TablesInsert, TablesUpdate, Enums } from '@altitutor/shared';
export type {
  AbsenceAction,
  AbsenceOperation,
  AbsenceDecision,
  RescheduleSession,
  StudentSession,
  LogAbsencesResponse,
  GetRescheduleSessionsParams,
} from './absence';

export type StudentWithAttendance = Tables<'students'> & {
  planned_absence?: boolean;
  actual_attended?: boolean | null;
  invoice_status?: string | null;
  sessions_students_id?: string;
};

export type StaffWithAttendance = Tables<'staff'> & {
  planned_absence?: boolean;
  actual_attended?: boolean | null;
};

export type TutorLogInfo = {
  id: string;
  created_by: string;
  created_by_name: {
    first_name: string;
    last_name: string;
  };
};

export type InvoiceStatusInfo = Record<string, string | null>;