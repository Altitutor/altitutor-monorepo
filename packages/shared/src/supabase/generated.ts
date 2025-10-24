export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      classes: {
        Row: {
          created_at: string | null
          created_by: string | null
          day_of_week: number
          end_time: string
          id: string
          level: string | null
          room: string | null
          start_time: string
          status: string
          subject_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          day_of_week: number
          end_time: string
          id: string
          level?: string | null
          room?: string | null
          start_time: string
          status: string
          subject_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          level?: string | null
          room?: string | null
          start_time?: string
          status?: string
          subject_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes_staff: {
        Row: {
          class_id: string
          created_at: string | null
          created_by: string | null
          end_date: string | null
          id: string
          staff_id: string
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id: string
          staff_id: string
          start_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          staff_id?: string
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_staff_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      classes_students: {
        Row: {
          class_id: string
          created_at: string | null
          created_by: string | null
          end_date: string | null
          id: string
          start_date: string
          status: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id: string
          start_date: string
          status: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          start_date?: string
          status?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_type: string
          created_at: string | null
          display_name: string | null
          id: string
          is_opted_out: boolean
          opted_out_at: string | null
          parent_id: string | null
          phone_e164: string
          staff_id: string | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          contact_type: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_opted_out?: boolean
          opted_out_at?: string | null
          parent_id?: string | null
          phone_e164: string
          staff_id?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_type?: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_opted_out?: boolean
          opted_out_at?: string | null
          parent_id?: string | null
          phone_e164?: string
          staff_id?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_reads: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          last_read_at: string | null
          last_read_message_id: string | null
          staff_id: string
          updated_at: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          staff_id: string
          updated_at?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          staff_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_reads_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_reads_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_staff_id: string | null
          contact_id: string
          created_at: string | null
          created_by_staff_id: string | null
          id: string
          is_pinned: boolean
          last_message_at: string | null
          last_message_id: string | null
          owned_number_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_staff_id?: string | null
          contact_id: string
          created_at?: string | null
          created_by_staff_id?: string | null
          id?: string
          is_pinned?: boolean
          last_message_at?: string | null
          last_message_id?: string | null
          owned_number_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_staff_id?: string | null
          contact_id?: string
          created_at?: string | null
          created_by_staff_id?: string | null
          id?: string
          is_pinned?: boolean
          last_message_at?: string | null
          last_message_id?: string | null
          owned_number_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_owned_number_id_fkey"
            columns: ["owned_number_id"]
            isOneToOne: false
            referencedRelation: "owned_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          bucket: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          filename: string
          id: string
          metadata: Json | null
          mimetype: string
          size_bytes: number
          storage_path: string
          storage_provider: string
          updated_at: string | null
        }
        Insert: {
          bucket: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          filename: string
          id?: string
          metadata?: Json | null
          mimetype: string
          size_bytes: number
          storage_path: string
          storage_provider?: string
          updated_at?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          filename?: string
          id?: string
          metadata?: Json | null
          mimetype?: string
          size_bytes?: number
          storage_path?: string
          storage_provider?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          account_sid: string | null
          body: string
          conversation_id: string
          created_at: string | null
          created_by_staff_id: string | null
          delivered_at: string | null
          direction: string
          error_code: number | null
          error_message: string | null
          from_number_e164: string
          id: string
          message_sid: string | null
          messaging_service_sid: string | null
          received_at: string | null
          sent_at: string | null
          status: string
          status_updated_at: string | null
          to_number_e164: string
          updated_at: string | null
        }
        Insert: {
          account_sid?: string | null
          body: string
          conversation_id: string
          created_at?: string | null
          created_by_staff_id?: string | null
          delivered_at?: string | null
          direction: string
          error_code?: number | null
          error_message?: string | null
          from_number_e164: string
          id?: string
          message_sid?: string | null
          messaging_service_sid?: string | null
          received_at?: string | null
          sent_at?: string | null
          status: string
          status_updated_at?: string | null
          to_number_e164: string
          updated_at?: string | null
        }
        Update: {
          account_sid?: string | null
          body?: string
          conversation_id?: string
          created_at?: string | null
          created_by_staff_id?: string | null
          delivered_at?: string | null
          direction?: string
          error_code?: number | null
          error_message?: string | null
          from_number_e164?: string
          id?: string
          message_sid?: string | null
          messaging_service_sid?: string | null
          received_at?: string | null
          sent_at?: string | null
          status?: string
          status_updated_at?: string | null
          to_number_e164?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      owned_numbers: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean
          label: string | null
          messaging_service_sid: string | null
          phone_e164: string
          twilio_phone_sid: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          messaging_service_sid?: string | null
          phone_e164: string
          twilio_phone_sid?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          messaging_service_sid?: string | null
          phone_e164?: string
          twilio_phone_sid?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      parents: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          invite_token: string | null
          last_name: string
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          invite_token?: string | null
          last_name: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          invite_token?: string | null
          last_name?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      parents_students: {
        Row: {
          created_at: string | null
          id: string
          parent_id: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          parent_id: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          parent_id?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parents_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          class_id: string | null
          created_at: string | null
          end_at: string | null
          id: string
          start_at: string | null
          subject_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          end_at?: string | null
          id: string
          start_at?: string | null
          subject_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          end_at?: string | null
          id?: string
          start_at?: string | null
          subject_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions_staff: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_swapped: boolean
          planned_absence: boolean
          planned_absence_logged_at: string | null
          planned_absence_logged_by: string | null
          session_id: string
          staff_id: string
          swapped_at: string | null
          swapped_sessions_staff_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_swapped?: boolean
          planned_absence?: boolean
          planned_absence_logged_at?: string | null
          planned_absence_logged_by?: string | null
          session_id: string
          staff_id: string
          swapped_at?: string | null
          swapped_sessions_staff_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_swapped?: boolean
          planned_absence?: boolean
          planned_absence_logged_at?: string | null
          planned_absence_logged_by?: string | null
          session_id?: string
          staff_id?: string
          swapped_at?: string | null
          swapped_sessions_staff_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_staff_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_staff_planned_absence_logged_by_fkey"
            columns: ["planned_absence_logged_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_staff_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_staff_swapped_sessions_staff_id_fkey"
            columns: ["swapped_sessions_staff_id"]
            isOneToOne: false
            referencedRelation: "sessions_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions_students: {
        Row: {
          created_at: string
          created_by: string | null
          credited_at: string | null
          credited_by: string | null
          id: string
          is_credited: boolean
          is_rescheduled: boolean
          planned_absence: boolean
          planned_absence_logged_at: string | null
          planned_absence_logged_by: string | null
          rescheduled_at: string | null
          rescheduled_sessions_students_id: string | null
          session_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credited_at?: string | null
          credited_by?: string | null
          id?: string
          is_credited?: boolean
          is_rescheduled?: boolean
          planned_absence?: boolean
          planned_absence_logged_at?: string | null
          planned_absence_logged_by?: string | null
          rescheduled_at?: string | null
          rescheduled_sessions_students_id?: string | null
          session_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credited_at?: string | null
          credited_by?: string | null
          id?: string
          is_credited?: boolean
          is_rescheduled?: boolean
          planned_absence?: boolean
          planned_absence_logged_at?: string | null
          planned_absence_logged_by?: string | null
          rescheduled_at?: string | null
          rescheduled_sessions_students_id?: string | null
          session_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_credited_by_fkey"
            columns: ["credited_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_planned_absence_logged_by_fkey"
            columns: ["planned_absence_logged_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_rescheduled_sessions_students_id_fkey"
            columns: ["rescheduled_sessions_students_id"]
            isOneToOne: false
            referencedRelation: "sessions_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          availability_friday: boolean | null
          availability_monday: boolean | null
          availability_saturday_am: boolean | null
          availability_saturday_pm: boolean | null
          availability_sunday_am: boolean | null
          availability_sunday_pm: boolean | null
          availability_thursday: boolean | null
          availability_tuesday: boolean | null
          availability_wednesday: boolean | null
          created_at: string | null
          email: string | null
          first_name: string
          has_parking_remote: string | null
          id: string
          invite_token: string | null
          last_name: string
          notes: string | null
          office_key_number: number | null
          phone_number: string | null
          role: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          availability_friday?: boolean | null
          availability_monday?: boolean | null
          availability_saturday_am?: boolean | null
          availability_saturday_pm?: boolean | null
          availability_sunday_am?: boolean | null
          availability_sunday_pm?: boolean | null
          availability_thursday?: boolean | null
          availability_tuesday?: boolean | null
          availability_wednesday?: boolean | null
          created_at?: string | null
          email?: string | null
          first_name: string
          has_parking_remote?: string | null
          id: string
          invite_token?: string | null
          last_name: string
          notes?: string | null
          office_key_number?: number | null
          phone_number?: string | null
          role: string
          status: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          availability_friday?: boolean | null
          availability_monday?: boolean | null
          availability_saturday_am?: boolean | null
          availability_saturday_pm?: boolean | null
          availability_sunday_am?: boolean | null
          availability_sunday_pm?: boolean | null
          availability_thursday?: boolean | null
          availability_tuesday?: boolean | null
          availability_wednesday?: boolean | null
          created_at?: string | null
          email?: string | null
          first_name?: string
          has_parking_remote?: string | null
          id?: string
          invite_token?: string | null
          last_name?: string
          notes?: string | null
          office_key_number?: number | null
          phone_number?: string | null
          role?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      staff_subjects: {
        Row: {
          created_at: string | null
          id: string
          staff_id: string
          subject_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          staff_id: string
          subject_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          staff_id?: string
          subject_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_subjects_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          availability_friday: boolean | null
          availability_monday: boolean | null
          availability_saturday_am: boolean | null
          availability_saturday_pm: boolean | null
          availability_sunday_am: boolean | null
          availability_sunday_pm: boolean | null
          availability_thursday: boolean | null
          availability_tuesday: boolean | null
          availability_wednesday: boolean | null
          created_at: string | null
          created_by: string | null
          curriculum: string | null
          email: string | null
          first_name: string
          id: string
          invite_token: string | null
          last_name: string
          parent_first_name: string | null
          parent_last_name: string | null
          phone: string | null
          school: string | null
          status: string
          updated_at: string | null
          user_id: string | null
          year_level: number | null
        }
        Insert: {
          availability_friday?: boolean | null
          availability_monday?: boolean | null
          availability_saturday_am?: boolean | null
          availability_saturday_pm?: boolean | null
          availability_sunday_am?: boolean | null
          availability_sunday_pm?: boolean | null
          availability_thursday?: boolean | null
          availability_tuesday?: boolean | null
          availability_wednesday?: boolean | null
          created_at?: string | null
          created_by?: string | null
          curriculum?: string | null
          email?: string | null
          first_name: string
          id?: string
          invite_token?: string | null
          last_name: string
          parent_first_name?: string | null
          parent_last_name?: string | null
          phone?: string | null
          school?: string | null
          status: string
          updated_at?: string | null
          user_id?: string | null
          year_level?: number | null
        }
        Update: {
          availability_friday?: boolean | null
          availability_monday?: boolean | null
          availability_saturday_am?: boolean | null
          availability_saturday_pm?: boolean | null
          availability_sunday_am?: boolean | null
          availability_sunday_pm?: boolean | null
          availability_thursday?: boolean | null
          availability_tuesday?: boolean | null
          availability_wednesday?: boolean | null
          created_at?: string | null
          created_by?: string | null
          curriculum?: string | null
          email?: string | null
          first_name?: string
          id?: string
          invite_token?: string | null
          last_name?: string
          parent_first_name?: string | null
          parent_last_name?: string | null
          phone?: string | null
          school?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
          year_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      students_subjects: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          student_id: string
          subject_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          student_id: string
          subject_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          student_id?: string
          subject_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_subjects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_subjects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          color: string | null
          created_at: string | null
          curriculum: Database["public"]["Enums"]["subject_curriculum"] | null
          discipline: Database["public"]["Enums"]["subject_discipline"] | null
          id: string
          level: string | null
          name: string
          updated_at: string | null
          year_level: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          curriculum?: Database["public"]["Enums"]["subject_curriculum"] | null
          discipline?: Database["public"]["Enums"]["subject_discipline"] | null
          id?: string
          level?: string | null
          name: string
          updated_at?: string | null
          year_level?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          curriculum?: Database["public"]["Enums"]["subject_curriculum"] | null
          discipline?: Database["public"]["Enums"]["subject_discipline"] | null
          id?: string
          level?: string | null
          name?: string
          updated_at?: string | null
          year_level?: number | null
        }
        Relationships: []
      }
      topics: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          index: number
          name: string
          parent_id: string | null
          subject_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          index: number
          name: string
          parent_id?: string | null
          subject_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          index?: number
          name?: string
          parent_id?: string | null
          subject_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      topics_files: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_id: string
          id: string
          index: number
          is_solutions: boolean
          is_solutions_of_id: string | null
          topic_id: string
          type: Database["public"]["Enums"]["resource_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_id: string
          id?: string
          index: number
          is_solutions?: boolean
          is_solutions_of_id?: string | null
          topic_id: string
          type: Database["public"]["Enums"]["resource_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_id?: string
          id?: string
          index?: number
          is_solutions?: boolean
          is_solutions_of_id?: string | null
          topic_id?: string
          type?: Database["public"]["Enums"]["resource_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_is_solutions_of_id_fkey"
            columns: ["is_solutions_of_id"]
            isOneToOne: false
            referencedRelation: "topics_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_logs: {
        Row: {
          created_at: string
          created_by: string
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_logs_staff_attendance: {
        Row: {
          attended: boolean
          created_at: string
          id: string
          staff_id: string
          tutor_log_id: string
          type: string
          updated_at: string
        }
        Insert: {
          attended?: boolean
          created_at?: string
          id?: string
          staff_id: string
          tutor_log_id: string
          type: string
          updated_at?: string
        }
        Update: {
          attended?: boolean
          created_at?: string
          id?: string
          staff_id?: string
          tutor_log_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_logs_staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_staff_attendance_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "tutor_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_logs_student_attendance: {
        Row: {
          attended: boolean
          created_at: string
          created_by: string
          id: string
          student_id: string
          tutor_log_id: string
          updated_at: string
        }
        Insert: {
          attended?: boolean
          created_at?: string
          created_by: string
          id?: string
          student_id: string
          tutor_log_id: string
          updated_at?: string
        }
        Update: {
          attended?: boolean
          created_at?: string
          created_by?: string
          id?: string
          student_id?: string
          tutor_log_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_logs_student_attendance_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_student_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_student_attendance_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "tutor_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_logs_topics: {
        Row: {
          created_at: string
          created_by: string
          id: string
          topic_id: string
          tutor_log_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          topic_id: string
          tutor_log_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          topic_id?: string
          tutor_log_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_logs_topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "tutor_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_logs_topics_files: {
        Row: {
          created_at: string
          created_by: string
          id: string
          topics_files_id: string
          tutor_log_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          topics_files_id: string
          tutor_log_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          topics_files_id?: string
          tutor_log_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_logs_topics_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_files_topics_files_id_fkey"
            columns: ["topics_files_id"]
            isOneToOne: false
            referencedRelation: "topics_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_files_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "tutor_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_logs_topics_files_students: {
        Row: {
          created_at: string
          created_by: string
          id: string
          student_id: string
          tutor_logs_topics_files_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          student_id: string
          tutor_logs_topics_files_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          student_id?: string
          tutor_logs_topics_files_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_logs_topics_files_student_tutor_logs_topics_files_id_fkey"
            columns: ["tutor_logs_topics_files_id"]
            isOneToOne: false
            referencedRelation: "tutor_logs_topics_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_files_students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_files_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_logs_topics_students: {
        Row: {
          created_at: string
          created_by: string
          id: string
          student_id: string
          tutor_logs_topics_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          student_id: string
          tutor_logs_topics_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          student_id?: string
          tutor_logs_topics_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_logs_topics_students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_students_tutor_logs_topics_id_fkey"
            columns: ["tutor_logs_topics_id"]
            isOneToOne: false
            referencedRelation: "tutor_logs_topics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_student_subjects: {
        Args: { student_id: string }
        Returns: {
          color: string | null
          created_at: string | null
          curriculum: Database["public"]["Enums"]["subject_curriculum"] | null
          discipline: Database["public"]["Enums"]["subject_discipline"] | null
          id: string
          level: string | null
          name: string
          updated_at: string | null
          year_level: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "subjects"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_subjects_for_student: {
        Args: { p_curriculum: string; p_year_level: number }
        Returns: {
          color: string | null
          created_at: string | null
          curriculum: Database["public"]["Enums"]["subject_curriculum"] | null
          discipline: Database["public"]["Enums"]["subject_discipline"] | null
          id: string
          level: string | null
          name: string
          updated_at: string | null
          year_level: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "subjects"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_student_selected_subjects: {
        Args: { student_id: string }
        Returns: boolean
      }
      is_adminstaff_active: { Args: never; Returns: boolean }
      map_day_to_number: { Args: { day_string: string }; Returns: number }
      map_subject_to_id: { Args: { subject_code: string }; Returns: string }
      map_tutor_to_id: {
        Args: { first_name: string; last_name: string }
        Returns: string
      }
      precreate_sessions: {
        Args: {
          end_date: string
          p_class_id?: string
          p_created_by: string
          start_date: string
        }
        Returns: number
      }
      resend_confirmation_email: {
        Args: { email_address: string }
        Returns: string
      }
      set_claim: {
        Args: { claim: string; uid: string; value: Json }
        Returns: undefined
      }
      verify_email: { Args: { user_email: string }; Returns: undefined }
    }
    Enums: {
      resource_answers: "BLANK" | "ANSWERS"
      resource_type:
        | "NOTES"
        | "TEST"
        | "PRACTICE_QUESTIONS"
        | "VIDEO"
        | "EXAM"
        | "FLASHCARDS"
        | "REVISION_SHEET"
        | "CHEAT_SHEET"
      subject_curriculum: "SACE" | "IB" | "PRESACE" | "PRIMARY" | "MEDICINE"
      subject_discipline:
        | "MATHEMATICS"
        | "SCIENCE"
        | "HUMANITIES"
        | "ENGLISH"
        | "ART"
        | "LANGUAGE"
        | "MEDICINE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      resource_answers: ["BLANK", "ANSWERS"],
      resource_type: [
        "NOTES",
        "TEST",
        "PRACTICE_QUESTIONS",
        "VIDEO",
        "EXAM",
        "FLASHCARDS",
        "REVISION_SHEET",
        "CHEAT_SHEET",
      ],
      subject_curriculum: ["SACE", "IB", "PRESACE", "PRIMARY", "MEDICINE"],
      subject_discipline: [
        "MATHEMATICS",
        "SCIENCE",
        "HUMANITIES",
        "ENGLISH",
        "ART",
        "LANGUAGE",
        "MEDICINE",
      ],
    },
  },
} as const
