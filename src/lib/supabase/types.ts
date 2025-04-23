export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      students: {
        Row: {
          id: string
          first_name: string
          last_name: string
          email: string | null
          phone_number: string | null
          parent_name: string | null
          parent_email: string | null
          parent_phone: string | null
          status: 'CURRENT' | 'INACTIVE' | 'TRIAL' | 'DISCONTINUED'
          notes: string | null
          user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name: string
          last_name: string
          email?: string | null
          phone_number?: string | null
          parent_name?: string | null
          parent_email?: string | null
          parent_phone?: string | null
          status: 'CURRENT' | 'INACTIVE' | 'TRIAL' | 'DISCONTINUED'
          notes?: string | null
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          email?: string | null
          phone_number?: string | null
          parent_name?: string | null
          parent_email?: string | null
          parent_phone?: string | null
          status?: 'CURRENT' | 'INACTIVE' | 'TRIAL' | 'DISCONTINUED'
          notes?: string | null
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      staff: {
        Row: {
          id: string
          first_name: string
          last_name: string
          email: string
          phone_number: string | null
          role: 'ADMIN' | 'TUTOR'
          status: 'ACTIVE' | 'INACTIVE' | 'TRIAL'
          notes: string | null
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name: string
          last_name: string
          email: string
          phone_number?: string | null
          role: 'ADMIN' | 'TUTOR'
          status: 'ACTIVE' | 'INACTIVE' | 'TRIAL'
          notes?: string | null
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          email?: string
          phone_number?: string | null
          role?: 'ADMIN' | 'TUTOR'
          status?: 'ACTIVE' | 'INACTIVE' | 'TRIAL'
          notes?: string | null
          user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      classes: {
        Row: {
          id: string
          subject: string
          day_of_week: number
          start_time: string
          end_time: string
          max_capacity: number
          status: 'ACTIVE' | 'INACTIVE' | 'FULL'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          subject: string
          day_of_week: number
          start_time: string
          end_time: string
          max_capacity: number
          status: 'ACTIVE' | 'INACTIVE' | 'FULL'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subject?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          max_capacity?: number
          status?: 'ACTIVE' | 'INACTIVE' | 'FULL'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      class_enrollments: {
        Row: {
          id: string
          student_id: string
          class_id: string
          start_date: string
          end_date: string | null
          status: 'ACTIVE' | 'DISCONTINUED' | 'TRIAL'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          student_id: string
          class_id: string
          start_date: string
          end_date?: string | null
          status: 'ACTIVE' | 'DISCONTINUED' | 'TRIAL'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          class_id?: string
          start_date?: string
          end_date?: string | null
          status?: 'ACTIVE' | 'DISCONTINUED' | 'TRIAL'
          created_at?: string
          updated_at?: string
        }
      }
      class_assignments: {
        Row: {
          id: string
          staff_id: string
          class_id: string
          start_date: string
          end_date: string | null
          is_substitute: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          staff_id: string
          class_id: string
          start_date: string
          end_date?: string | null
          is_substitute: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          class_id?: string
          start_date?: string
          end_date?: string | null
          is_substitute?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      absences: {
        Row: {
          id: string
          student_id: string
          date: string
          type: 'PLANNED' | 'UNPLANNED'
          reason: string | null
          is_rescheduled: boolean
          rescheduled_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          student_id: string
          date: string
          type: 'PLANNED' | 'UNPLANNED'
          reason?: string | null
          is_rescheduled: boolean
          rescheduled_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          date?: string
          type?: 'PLANNED' | 'UNPLANNED'
          reason?: string | null
          is_rescheduled?: boolean
          rescheduled_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      meetings: {
        Row: {
          id: string
          student_id: string
          date: string
          type: 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | 'PARENT_MEETING' | 'OTHER'
          notes: string | null
          outcome: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          student_id: string
          date: string
          type: 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | 'PARENT_MEETING' | 'OTHER'
          notes?: string | null
          outcome?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          date?: string
          type?: 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | 'PARENT_MEETING' | 'OTHER'
          notes?: string | null
          outcome?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      drafting_sessions: {
        Row: {
          id: string
          student_id: string
          date: string
          type: 'ENGLISH' | 'ASSIGNMENT'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          student_id: string
          date: string
          type: 'ENGLISH' | 'ASSIGNMENT'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          date?: string
          type?: 'ENGLISH' | 'ASSIGNMENT'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      shift_swaps: {
        Row: {
          id: string
          assignment_id: string
          substitute_staff_id: string
          date: string
          reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          assignment_id: string
          substitute_staff_id: string
          date: string
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          assignment_id?: string
          substitute_staff_id?: string
          date?: string
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          date: string
          type: 'CLASS' | 'DRAFTING' | 'SUBSIDY_INTERVIEW' | 'TRIAL_SESSION' | 'TRIAL_SHIFT'
          subject: string
          class_id: string | null
          staff_id: string
          teaching_content: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          date: string
          type: 'CLASS' | 'DRAFTING' | 'SUBSIDY_INTERVIEW' | 'TRIAL_SESSION' | 'TRIAL_SHIFT'
          subject: string
          class_id?: string | null
          staff_id: string
          teaching_content?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          type?: 'CLASS' | 'DRAFTING' | 'SUBSIDY_INTERVIEW' | 'TRIAL_SESSION' | 'TRIAL_SHIFT'
          subject?: string
          class_id?: string | null
          staff_id?: string
          teaching_content?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      session_attendances: {
        Row: {
          id: string
          session_id: string
          student_id: string
          attended: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          session_id: string
          student_id: string
          attended: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          student_id?: string
          attended?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          student_id: string
          type: 'EMAIL' | 'SMS' | 'INTERNAL_NOTE'
          content: string
          status: 'DRAFT' | 'SENT' | 'FAILED'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          student_id: string
          type: 'EMAIL' | 'SMS' | 'INTERNAL_NOTE'
          content: string
          status: 'DRAFT' | 'SENT' | 'FAILED'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          type?: 'EMAIL' | 'SMS' | 'INTERNAL_NOTE'
          content?: string
          status?: 'DRAFT' | 'SENT' | 'FAILED'
          created_at?: string
          updated_at?: string
        }
      }
      files: {
        Row: {
          id: string
          student_id: string
          filename: string
          path: string
          type: 'DOCUMENT' | 'IMAGE' | 'OTHER'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          student_id: string
          filename: string
          path: string
          type: 'DOCUMENT' | 'IMAGE' | 'OTHER'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          filename?: string
          path?: string
          type?: 'DOCUMENT' | 'IMAGE' | 'OTHER'
          created_at?: string
          updated_at?: string
        }
      }
      student_audit_logs: {
        Row: {
          id: string
          student_id: string
          action: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'ENROLLMENT_CHANGED' | 'OTHER'
          details: Json
          created_at: string
        }
        Insert: {
          id: string
          student_id: string
          action: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'ENROLLMENT_CHANGED' | 'OTHER'
          details: Json
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          action?: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'ENROLLMENT_CHANGED' | 'OTHER'
          details?: Json
          created_at?: string
        }
      }
      staff_audit_logs: {
        Row: {
          id: string
          staff_id: string
          action: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'ASSIGNMENT_CHANGED' | 'OTHER'
          details: Json
          created_at: string
        }
        Insert: {
          id: string
          staff_id: string
          action: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'ASSIGNMENT_CHANGED' | 'OTHER'
          details: Json
          created_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          action?: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'ASSIGNMENT_CHANGED' | 'OTHER'
          details?: Json
          created_at?: string
        }
      }
      class_audit_logs: {
        Row: {
          id: string
          class_id: string
          action: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'OTHER'
          details: Json
          created_at: string
        }
        Insert: {
          id: string
          class_id: string
          action: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'OTHER'
          details: Json
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          action?: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'OTHER'
          details?: Json
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 