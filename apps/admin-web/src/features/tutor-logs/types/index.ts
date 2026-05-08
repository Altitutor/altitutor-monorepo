import type { Tables } from '@altitutor/shared';

export type TutorLogFormData = {
  sessionId: string;
  staffAttendance: {
    staffId: string;
    attended: boolean;
    type: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR';
  }[];
  studentAttendance: {
    studentId: string;
    attended: boolean;
  }[];
  parentAttendance?: {
    parentId: string;
    attended: boolean;
  }[];
  topics: {
    topicId: string;
    studentIds: string[];
  }[];
  topicFiles: {
    topicsFilesId: string;
    topicId: string;
    studentIds: string[];
  }[];
  notes: string[];
};

export type TutorLogWithDetails = Tables<'tutor_logs'> & {
  session: Tables<'sessions'> & {
    class:
      | (Tables<'classes'> & {
          subject: Tables<'subjects'>;
        })
      | null;
    sessions_parents?: Array<
      Tables<'sessions_parents'> & {
        parent: Tables<'parents'>;
      }
    >;
  };
  staffAttendance: Array<Tables<'tutor_logs_staff_attendance'> & {
    staff: Tables<'staff'>;
  }>;
  studentAttendance: Array<Tables<'tutor_logs_student_attendance'> & {
    student: Tables<'students'>;
  }>;
  parentAttendance?: Array<Tables<'tutor_logs_parent_attendance'> & {
    parent: Tables<'parents'>;
  }>;
  topics: Array<Tables<'tutor_logs_topics'> & {
    topic: Tables<'topics'>;
    students: Array<Tables<'tutor_logs_topics_students'> & {
      student: Tables<'students'>;
    }>;
  }>;
  topicFiles: Array<Tables<'tutor_logs_topics_files'> & {
    topicFile: Tables<'topics_files'>;
    students: Array<Tables<'tutor_logs_topics_files_students'> & {
      student: Tables<'students'>;
    }>;
  }>;
};


