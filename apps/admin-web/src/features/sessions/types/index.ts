import type { Tables } from '@altitutor/shared';

export type { Tables, TablesInsert, TablesUpdate, Enums } from '@altitutor/shared';
export type {
  AbsenceAction,
  AbsenceOperation,
  UndoAbsenceOperation,
  AbsenceDecision,
  RescheduleSession,
  StudentSession,
  LogAbsencesResponse,
  UndoAbsencesResponse,
  GetRescheduleSessionsParams,
} from './absence';

export type {
  StaffAbsenceAction,
  StaffAbsenceOperation,
  UndoStaffAbsenceOperation,
  StaffAbsenceDecision,
  StaffSession,
  ReplacementStaff,
  LogStaffAbsencesResponse,
  UndoStaffAbsencesResponse,
  GetReplacementStaffParams,
} from './staff-absence';

export type StudentWithAttendance = Tables<'students'> & {
  planned_absence?: boolean;
  actual_attended?: boolean | null;
  invoice_status_payload?: import('@/features/billing/utils/invoiceFormatters').InvoiceStatusPayload | null;
  sessions_students_id?: string;
  was_trial?: boolean;
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

export type {
  SessionDetailsSession,
  SessionDetailsTutorLog,
  SessionDetailsTutorLogTopic,
  SessionDetailsTutorLogTopicFile,
} from './session-details';
