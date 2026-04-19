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
      activity_events: {
        Row: {
          changed_fields: Json | null
          class_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          issue_id: string | null
          metadata: Json | null
          parent_id: string | null
          performed_at: string
          performed_by: string | null
          project_id: string | null
          session_id: string | null
          staff_id: string | null
          student_id: string | null
          task_id: string | null
        }
        Insert: {
          changed_fields?: Json | null
          class_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          issue_id?: string | null
          metadata?: Json | null
          parent_id?: string | null
          performed_at?: string
          performed_by?: string | null
          project_id?: string | null
          session_id?: string | null
          staff_id?: string | null
          student_id?: string | null
          task_id?: string | null
        }
        Update: {
          changed_fields?: Json | null
          class_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          issue_id?: string | null
          metadata?: Json | null
          parent_id?: string | null
          performed_at?: string
          performed_by?: string | null
          project_id?: string | null
          session_id?: string | null
          staff_id?: string | null
          student_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vstudent_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "activity_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "activity_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "activity_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "activity_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "activity_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "activity_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "activity_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "activity_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_shifts: {
        Row: {
          created_at: string
          created_by: string | null
          day_of_week: number
          end_time: string
          id: string
          session_end_date: string | null
          session_start_date: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_of_week: number
          end_time: string
          id?: string
          session_end_date?: string | null
          session_start_date?: string | null
          start_time: string
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          session_end_date?: string | null
          session_start_date?: string | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_shifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_shifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_shifts_staff: {
        Row: {
          admin_shift_id: string
          assigned_at: string
          created_at: string
          created_by: string | null
          id: string
          staff_id: string
          unassigned_at: string | null
          updated_at: string
        }
        Insert: {
          admin_shift_id: string
          assigned_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          staff_id: string
          unassigned_at?: string | null
          updated_at?: string
        }
        Update: {
          admin_shift_id?: string
          assigned_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          staff_id?: string
          unassigned_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_shifts_staff_admin_shift_id_fkey"
            columns: ["admin_shift_id"]
            isOneToOne: false
            referencedRelation: "admin_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_shifts_staff_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_shifts_staff_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_shifts_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_shifts_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_option_files: {
        Row: {
          answer_option_id: string
          file_id: string
          id: string
          usage: string
        }
        Insert: {
          answer_option_id: string
          file_id: string
          id?: string
          usage: string
        }
        Update: {
          answer_option_id?: string
          file_id?: string
          id?: string
          usage?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_option_files_answer_option_id_fkey"
            columns: ["answer_option_id"]
            isOneToOne: false
            referencedRelation: "question_answer_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_option_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_actions: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string | null
          id: string
          order_index: number | null
          rule_id: string
        }
        Insert: {
          action_config: Json
          action_type: string
          created_at?: string | null
          id?: string
          order_index?: number | null
          rule_id: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string | null
          id?: string
          order_index?: number | null
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_actions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          conditions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          enabled: boolean | null
          entity_type: string
          event_types: string[]
          id: string
          name: string
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          entity_type: string
          event_types: string[]
          id?: string
          name: string
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          entity_type?: string
          event_types?: string[]
          id?: string
          name?: string
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_duplicates_work: {
        Row: {
          canonical_invoice_id: string
          canonical_invoice_item_ids: string[]
          created_at: string
          duplicate_invoice_ids: string[]
          duplicate_invoice_item_ids: string[]
          sessions_students_id: string
        }
        Insert: {
          canonical_invoice_id: string
          canonical_invoice_item_ids: string[]
          created_at?: string
          duplicate_invoice_ids: string[]
          duplicate_invoice_item_ids: string[]
          sessions_students_id: string
        }
        Update: {
          canonical_invoice_id?: string
          canonical_invoice_item_ids?: string[]
          created_at?: string
          duplicate_invoice_ids?: string[]
          duplicate_invoice_item_ids?: string[]
          sessions_students_id?: string
        }
        Relationships: []
      }
      billing_pricing: {
        Row: {
          billing_type: Database["public"]["Enums"]["billing_type"]
          created_at: string
          currency: string
          hourly_rate_cents: number
          updated_at: string
        }
        Insert: {
          billing_type: Database["public"]["Enums"]["billing_type"]
          created_at?: string
          currency?: string
          hourly_rate_cents: number
          updated_at?: string
        }
        Update: {
          billing_type?: Database["public"]["Enums"]["billing_type"]
          created_at?: string
          currency?: string
          hourly_rate_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      billing_pricing_overrides: {
        Row: {
          billing_type: Database["public"]["Enums"]["billing_type"]
          created_at: string
          currency: string
          effective_from: string
          effective_until: string | null
          hourly_rate_cents: number
          id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          billing_type: Database["public"]["Enums"]["billing_type"]
          created_at?: string
          currency?: string
          effective_from?: string
          effective_until?: string | null
          hourly_rate_cents: number
          id?: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          billing_type?: Database["public"]["Enums"]["billing_type"]
          created_at?: string
          currency?: string
          effective_from?: string
          effective_until?: string | null
          hourly_rate_cents?: number
          id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_pricing_overrides_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_pricing_overrides_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_pricing_overrides_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_runner_logs: {
        Row: {
          created_at: string
          error_message: string
          error_type: string | null
          id: string
          invoice_date: string | null
          run_id: string | null
          session_id: string | null
          sessions_students_id: string | null
          student_id: string | null
        }
        Insert: {
          created_at?: string
          error_message: string
          error_type?: string | null
          id?: string
          invoice_date?: string | null
          run_id?: string | null
          session_id?: string | null
          sessions_students_id?: string | null
          student_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string
          error_type?: string | null
          id?: string
          invoice_date?: string | null
          run_id?: string | null
          session_id?: string | null
          sessions_students_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_runner_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_runner_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "billing_runner_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "billing_runner_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "billing_runner_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "billing_runner_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "billing_runner_logs_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "sessions_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_runner_logs_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vadmin_reconciliation_uninvoiced_sessions"
            referencedColumns: ["sessions_students_id"]
          },
          {
            foreignKeyName: "billing_runner_logs_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "billing_runner_logs_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "billing_runner_logs_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "billing_runner_logs_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions_students"
            referencedColumns: ["sessions_students_id"]
          },
          {
            foreignKeyName: "billing_runner_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_runner_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_runner_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_runner_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
        ]
      }
      billing_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_settings: {
        Row: {
          description: string
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          description: string
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          description?: string
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_staff_unavailability: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_at: string
          id: string
          reason: string | null
          staff_id: string
          start_at: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_at: string
          id?: string
          reason?: string | null
          staff_id: string
          start_at: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_at?: string
          id?: string
          reason?: string | null
          staff_id?: string
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_staff_unavailability_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_staff_unavailability_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_staff_unavailability_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_staff_unavailability_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      call_routing_rules: {
        Row: {
          audio_url: string | null
          created_at: string | null
          forward_to_phone: string | null
          id: string
          is_active: boolean | null
          message_text: string | null
          message_type: string | null
          owned_number_id: string
          priority: number
          rule_type: string
          updated_at: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          forward_to_phone?: string | null
          id?: string
          is_active?: boolean | null
          message_text?: string | null
          message_type?: string | null
          owned_number_id: string
          priority?: number
          rule_type: string
          updated_at?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          forward_to_phone?: string | null
          id?: string
          is_active?: boolean | null
          message_text?: string | null
          message_type?: string | null
          owned_number_id?: string
          priority?: number
          rule_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_routing_rules_owned_number_id_fkey"
            columns: ["owned_number_id"]
            isOneToOne: false
            referencedRelation: "owned_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string | null
          created_by: string | null
          day_of_week: number
          end_time: string
          id: string
          level: string | null
          long_name: string | null
          room: string | null
          session_end_date: string | null
          session_start_date: string | null
          short_name: string | null
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
          long_name?: string | null
          room?: string | null
          session_end_date?: string | null
          session_start_date?: string | null
          short_name?: string | null
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
          long_name?: string | null
          room?: string | null
          session_end_date?: string | null
          session_start_date?: string | null
          short_name?: string | null
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
            foreignKeyName: "classes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes_staff: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          class_id: string
          created_at: string | null
          created_by: string | null
          id: string
          staff_id: string
          unassigned_at: string | null
          unassigned_by: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_at: string
          assigned_by?: string | null
          class_id: string
          created_at?: string | null
          created_by?: string | null
          id: string
          staff_id: string
          unassigned_at?: string | null
          unassigned_by?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          class_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          staff_id?: string
          unassigned_at?: string | null
          unassigned_by?: string | null
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
            foreignKeyName: "class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vstudent_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_classes"
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
            foreignKeyName: "class_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_staff_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_staff_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_staff_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_staff_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_staff_unassigned_by_fkey"
            columns: ["unassigned_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_staff_unassigned_by_fkey"
            columns: ["unassigned_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      classes_students: {
        Row: {
          class_id: string
          created_at: string | null
          created_by: string | null
          enrolled_at: string
          enrolled_by: string | null
          id: string
          student_id: string
          unenrolled_at: string | null
          unenrolled_by: string | null
          updated_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          created_by?: string | null
          enrolled_at: string
          enrolled_by?: string | null
          id: string
          student_id: string
          unenrolled_at?: string | null
          unenrolled_by?: string | null
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          created_by?: string | null
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          student_id?: string
          unenrolled_at?: string | null
          unenrolled_by?: string | null
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
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vstudent_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_classes"
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
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "classes_students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_students_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_students_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_students_unenrolled_by_fkey"
            columns: ["unenrolled_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_students_unenrolled_by_fkey"
            columns: ["unenrolled_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_type: string
          created_at: string | null
          email: string | null
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
          email?: string | null
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
          email?: string | null
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
            foreignKeyName: "contacts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
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
          {
            foreignKeyName: "conversation_reads_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_staff_id: string | null
          contact_id: string | null
          created_at: string | null
          created_by_staff_id: string | null
          group_chat_id: string | null
          group_chat_name: string | null
          id: string
          is_group_chat: boolean
          is_pinned: boolean
          last_message_at: string | null
          last_message_id: string | null
          needs_follow_up: boolean
          owned_number_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_staff_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by_staff_id?: string | null
          group_chat_id?: string | null
          group_chat_name?: string | null
          id?: string
          is_group_chat?: boolean
          is_pinned?: boolean
          last_message_at?: string | null
          last_message_id?: string | null
          needs_follow_up?: boolean
          owned_number_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_staff_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by_staff_id?: string | null
          group_chat_id?: string | null
          group_chat_name?: string | null
          id?: string
          is_group_chat?: boolean
          is_pinned?: boolean
          last_message_at?: string | null
          last_message_id?: string | null
          needs_follow_up?: boolean
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
            foreignKeyName: "conversations_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "conversations_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
      credit_balance_transactions: {
        Row: {
          amount_cents: number
          created_at: string
          credit_note_id: string | null
          credit_type: string | null
          currency: string
          debit_type: string | null
          description: string | null
          effective_at: string
          id: string
          invoice_id: string | null
          raw: Json
          stripe_credit_balance_transaction_id: string
          stripe_credit_grant_id: string | null
          stripe_customer_id: string | null
          stripe_invoice_id: string | null
          stripe_invoice_line_item_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credit_note_id?: string | null
          credit_type?: string | null
          currency?: string
          debit_type?: string | null
          description?: string | null
          effective_at: string
          id?: string
          invoice_id?: string | null
          raw: Json
          stripe_credit_balance_transaction_id: string
          stripe_credit_grant_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_invoice_line_item_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credit_note_id?: string | null
          credit_type?: string | null
          currency?: string
          debit_type?: string | null
          description?: string | null
          effective_at?: string
          id?: string
          invoice_id?: string | null
          raw?: Json
          stripe_credit_balance_transaction_id?: string
          stripe_credit_grant_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_invoice_line_item_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_balance_transactions_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_balance_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_balance_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vstudent_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount_cents: number
          created_at: string
          credit_amount_cents: number | null
          currency: string
          id: string
          invoice_id: string
          metadata: Json | null
          out_of_band_amount_cents: number | null
          reason: string | null
          refund_amount_cents: number | null
          status: string
          stripe_credit_note_id: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credit_amount_cents?: number | null
          currency?: string
          id?: string
          invoice_id: string
          metadata?: Json | null
          out_of_band_amount_cents?: number | null
          reason?: string | null
          refund_amount_cents?: number | null
          status?: string
          stripe_credit_note_id: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credit_amount_cents?: number | null
          currency?: string
          id?: string
          invoice_id?: string
          metadata?: Json | null
          out_of_band_amount_cents?: number | null
          reason?: string | null
          refund_amount_cents?: number | null
          status?: string
          stripe_credit_note_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vstudent_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_class_plan_slots: {
        Row: {
          created_at: string | null
          day_of_week: number
          draft_class_plan_id: string | null
          end_time: string
          id: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          draft_class_plan_id?: string | null
          end_time: string
          id?: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          draft_class_plan_id?: string | null
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_class_plan_slots_draft_class_plan_id_fkey"
            columns: ["draft_class_plan_id"]
            isOneToOne: false
            referencedRelation: "draft_class_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_class_plans: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          created_at: string | null
          created_by: string | null
          default_class_length_hours: number | null
          id: string
          name: string
          status: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string | null
          created_by?: string | null
          default_class_length_hours?: number | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string | null
          created_by?: string | null
          default_class_length_hours?: number | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "draft_class_plans_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_class_plans_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_class_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_class_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_classes: {
        Row: {
          created_at: string | null
          day_of_week: number | null
          draft_class_plan_id: string | null
          end_time: string
          id: string
          level: string | null
          room: string | null
          start_time: string
          status: string | null
          subject_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week?: number | null
          draft_class_plan_id?: string | null
          end_time: string
          id?: string
          level?: string | null
          room?: string | null
          start_time: string
          status?: string | null
          subject_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number | null
          draft_class_plan_id?: string | null
          end_time?: string
          id?: string
          level?: string | null
          room?: string | null
          start_time?: string
          status?: string | null
          subject_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_classes_draft_class_plan_id_fkey"
            columns: ["draft_class_plan_id"]
            isOneToOne: false
            referencedRelation: "draft_class_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_classes_staff: {
        Row: {
          created_at: string | null
          draft_class_id: string | null
          id: string
          staff_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          draft_class_id?: string | null
          id?: string
          staff_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          draft_class_id?: string | null
          id?: string
          staff_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_classes_staff_draft_class_id_fkey"
            columns: ["draft_class_id"]
            isOneToOne: false
            referencedRelation: "draft_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_classes_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_classes_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_classes_students: {
        Row: {
          created_at: string | null
          draft_class_id: string | null
          id: string
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          draft_class_id?: string | null
          id?: string
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          draft_class_id?: string | null
          id?: string
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_classes_students_draft_class_id_fkey"
            columns: ["draft_class_id"]
            isOneToOne: false
            referencedRelation: "draft_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_classes_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_classes_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_classes_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_classes_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
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
          {
            foreignKeyName: "files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      group_chat_participants: {
        Row: {
          contact_id: string
          conversation_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          contact_id: string
          conversation_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          contact_id?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_chat_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount_cents: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          is_fee: boolean
          is_subsidy: boolean
          session_id: string | null
          sessions_students_id: string | null
          stripe_invoice_item_id: string
          student_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          is_fee?: boolean
          is_subsidy?: boolean
          session_id?: string | null
          sessions_students_id?: string | null
          stripe_invoice_item_id: string
          student_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          is_fee?: boolean
          is_subsidy?: boolean
          session_id?: string | null
          sessions_students_id?: string | null
          stripe_invoice_item_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vstudent_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "invoice_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "invoice_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "invoice_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "invoice_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "invoice_items_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "sessions_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vadmin_reconciliation_uninvoiced_sessions"
            referencedColumns: ["sessions_students_id"]
          },
          {
            foreignKeyName: "invoice_items_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "invoice_items_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "invoice_items_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "invoice_items_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions_students"
            referencedColumns: ["sessions_students_id"]
          },
          {
            foreignKeyName: "invoice_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due_cents: number
          amount_paid_cents: number
          amount_paid_from_balance_cents: number | null
          auto_advance: boolean | null
          billing_source: Database["public"]["Enums"]["invoice_billing_source"]
          collection_method: string | null
          created_at: string
          credited_at: string | null
          currency: string
          dispute_amount_cents: number | null
          dispute_created_at: string | null
          dispute_currency: string | null
          dispute_id: string | null
          dispute_reason: string | null
          dispute_resolved_at: string | null
          dispute_status: string | null
          dispute_updated_at: string | null
          fee_cents: number | null
          finalized_at: string | null
          has_credit_notes: boolean
          hosted_invoice_url: string | null
          id: string
          invoice_date: string
          invoice_pdf: string | null
          is_refunded: boolean
          metadata: Json | null
          net_cents: number | null
          paid_at: string | null
          receipt_url: string | null
          refunded_at: string | null
          refunded_via_cn_at: string | null
          status: string
          stripe_charge_id: string | null
          stripe_invoice_id: string
          stripe_invoice_number: string | null
          stripe_payment_intent_id: string | null
          student_id: string
          student_subscription_id: string | null
          subtotal_cents: number | null
          total_cents: number | null
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          amount_due_cents: number
          amount_paid_cents?: number
          amount_paid_from_balance_cents?: number | null
          auto_advance?: boolean | null
          billing_source?: Database["public"]["Enums"]["invoice_billing_source"]
          collection_method?: string | null
          created_at?: string
          credited_at?: string | null
          currency?: string
          dispute_amount_cents?: number | null
          dispute_created_at?: string | null
          dispute_currency?: string | null
          dispute_id?: string | null
          dispute_reason?: string | null
          dispute_resolved_at?: string | null
          dispute_status?: string | null
          dispute_updated_at?: string | null
          fee_cents?: number | null
          finalized_at?: string | null
          has_credit_notes?: boolean
          hosted_invoice_url?: string | null
          id?: string
          invoice_date: string
          invoice_pdf?: string | null
          is_refunded?: boolean
          metadata?: Json | null
          net_cents?: number | null
          paid_at?: string | null
          receipt_url?: string | null
          refunded_at?: string | null
          refunded_via_cn_at?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id: string
          stripe_invoice_number?: string | null
          stripe_payment_intent_id?: string | null
          student_id: string
          student_subscription_id?: string | null
          subtotal_cents?: number | null
          total_cents?: number | null
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          amount_due_cents?: number
          amount_paid_cents?: number
          amount_paid_from_balance_cents?: number | null
          auto_advance?: boolean | null
          billing_source?: Database["public"]["Enums"]["invoice_billing_source"]
          collection_method?: string | null
          created_at?: string
          credited_at?: string | null
          currency?: string
          dispute_amount_cents?: number | null
          dispute_created_at?: string | null
          dispute_currency?: string | null
          dispute_id?: string | null
          dispute_reason?: string | null
          dispute_resolved_at?: string | null
          dispute_status?: string | null
          dispute_updated_at?: string | null
          fee_cents?: number | null
          finalized_at?: string | null
          has_credit_notes?: boolean
          hosted_invoice_url?: string | null
          id?: string
          invoice_date?: string
          invoice_pdf?: string | null
          is_refunded?: boolean
          metadata?: Json | null
          net_cents?: number | null
          paid_at?: string | null
          receipt_url?: string | null
          refunded_at?: string | null
          refunded_via_cn_at?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id?: string
          stripe_invoice_number?: string | null
          stripe_payment_intent_id?: string | null
          student_id?: string
          student_subscription_id?: string | null
          subtotal_cents?: number | null
          total_cents?: number | null
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "invoices_student_subscription_id_fkey"
            columns: ["student_subscription_id"]
            isOneToOne: false
            referencedRelation: "student_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_tags: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          invoice_id: string | null
          issue_id: string
          parent_id: string | null
          session_id: string | null
          staff_id: string | null
          student_id: string | null
          subject_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          issue_id: string
          parent_id?: string | null
          session_id?: string | null
          staff_id?: string | null
          student_id?: string | null
          subject_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          issue_id?: string
          parent_id?: string | null
          session_id?: string | null
          staff_id?: string | null
          student_id?: string | null
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_tags_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vstudent_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "issue_tags_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "issue_tags_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vstudent_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "issue_tags_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "issue_tags_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "issue_tags_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "issue_tags_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "issue_tags_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "issue_tags_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_tags_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          created_at: string
          created_by: string | null
          description: Json | null
          due_date: string | null
          id: string
          name: string
          resolved_at: string | null
          resolved_by: string | null
          search_vector: unknown
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: Json | null
          due_date?: string | null
          id?: string
          name: string
          resolved_at?: string | null
          resolved_by?: string | null
          search_vector?: unknown
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: Json | null
          due_date?: string | null
          id?: string
          name?: string
          resolved_at?: string | null
          resolved_by?: string | null
          search_vector?: unknown
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string | null
          filename: string | null
          id: string
          message_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_url: string
        }
        Insert: {
          created_at?: string | null
          filename?: string | null
          id?: string
          message_id: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_url: string
        }
        Update: {
          created_at?: string | null
          filename?: string | null
          id?: string
          message_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          template_key: string | null
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          template_key?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          template_key?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          account_sid: string | null
          associated_message_guid: string | null
          body: string
          conversation_id: string
          created_at: string | null
          created_by_staff_id: string | null
          delivered_at: string | null
          direction: string
          error_code: number | null
          error_message: string | null
          from_number_e164: string | null
          id: string
          imessage_guid: string | null
          is_announcement: boolean
          is_reaction: boolean
          message_sid: string | null
          messaging_service_sid: string | null
          reaction_type: string | null
          received_at: string | null
          sent_at: string | null
          status: string
          status_updated_at: string | null
          to_number_e164: string
          updated_at: string | null
        }
        Insert: {
          account_sid?: string | null
          associated_message_guid?: string | null
          body: string
          conversation_id: string
          created_at?: string | null
          created_by_staff_id?: string | null
          delivered_at?: string | null
          direction: string
          error_code?: number | null
          error_message?: string | null
          from_number_e164?: string | null
          id?: string
          imessage_guid?: string | null
          is_announcement?: boolean
          is_reaction?: boolean
          message_sid?: string | null
          messaging_service_sid?: string | null
          reaction_type?: string | null
          received_at?: string | null
          sent_at?: string | null
          status: string
          status_updated_at?: string | null
          to_number_e164: string
          updated_at?: string | null
        }
        Update: {
          account_sid?: string | null
          associated_message_guid?: string | null
          body?: string
          conversation_id?: string
          created_at?: string | null
          created_by_staff_id?: string | null
          delivered_at?: string | null
          direction?: string
          error_code?: number | null
          error_message?: string | null
          from_number_e164?: string | null
          id?: string
          imessage_guid?: string | null
          is_announcement?: boolean
          is_reaction?: boolean
          message_sid?: string | null
          messaging_service_sid?: string | null
          reaction_type?: string | null
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
          {
            foreignKeyName: "messages_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: Json
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note?: Json
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: Json
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
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      notes_daily: {
        Row: {
          content: Json
          date: string
          id: string
          search_vector: unknown
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json
          date: string
          id?: string
          search_vector?: unknown
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          date?: string
          id?: string
          search_vector?: unknown
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_daily_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_daily_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      notes_documents: {
        Row: {
          content: Json | null
          created_at: string
          created_by: string
          folder_id: string | null
          id: string
          project_id: string | null
          search_vector: unknown
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string
          created_by: string
          folder_id?: string | null
          id?: string
          project_id?: string | null
          search_vector?: unknown
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string
          created_by?: string
          folder_id?: string | null
          id?: string
          project_id?: string | null
          search_vector?: unknown
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "notes_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_documents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_documents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      notes_folders: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "notes_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          activity_event_id: string | null
          body: string | null
          created_at: string | null
          id: string
          notification_type: string
          read_at: string | null
          staff_id: string | null
          student_id: string | null
          title: string
        }
        Insert: {
          action_url?: string | null
          activity_event_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          notification_type: string
          read_at?: string | null
          staff_id?: string | null
          student_id?: string | null
          title: string
        }
        Update: {
          action_url?: string | null
          activity_event_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          notification_type?: string
          read_at?: string | null
          staff_id?: string | null
          student_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_activity_event_id_fkey"
            columns: ["activity_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
        ]
      }
      on_call_schedules: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          staff_id: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          staff_id: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          staff_id?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "on_call_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_call_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      owned_numbers: {
        Row: {
          alphanumeric_sender_id: string | null
          created_at: string | null
          id: string
          imessage_api_key: string | null
          imessage_chat_id: string | null
          is_default: boolean
          label: string | null
          messaging_service_sid: string | null
          phone_e164: string | null
          provider: string | null
          sender_type: string | null
          twilio_phone_sid: string | null
          updated_at: string | null
        }
        Insert: {
          alphanumeric_sender_id?: string | null
          created_at?: string | null
          id?: string
          imessage_api_key?: string | null
          imessage_chat_id?: string | null
          is_default?: boolean
          label?: string | null
          messaging_service_sid?: string | null
          phone_e164?: string | null
          provider?: string | null
          sender_type?: string | null
          twilio_phone_sid?: string | null
          updated_at?: string | null
        }
        Update: {
          alphanumeric_sender_id?: string | null
          created_at?: string | null
          id?: string
          imessage_api_key?: string | null
          imessage_chat_id?: string | null
          is_default?: boolean
          label?: string | null
          messaging_service_sid?: string | null
          phone_e164?: string | null
          provider?: string | null
          sender_type?: string | null
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
          {
            foreignKeyName: "parents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
          {
            foreignKeyName: "parents_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parents_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parents_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
        ]
      }
      policies: {
        Row: {
          content: Json | null
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          content?: Json | null
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          content?: Json | null
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: Json | null
          id: string
          name: string
          priority: number
          project_lead_id: string | null
          search_vector: unknown
          start_date: string | null
          status: string
          target_date: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: Json | null
          id?: string
          name: string
          priority?: number
          project_lead_id?: string | null
          search_vector?: unknown
          start_date?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: Json | null
          id?: string
          name?: string
          priority?: number
          project_lead_id?: string | null
          search_vector?: unknown
          start_date?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_lead_id_fkey"
            columns: ["project_lead_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_lead_id_fkey"
            columns: ["project_lead_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      question_answer_options: {
        Row: {
          answer_explanation: Json | null
          answer_text: Json
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          index: number
          is_answer: boolean
          question_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          answer_explanation?: Json | null
          answer_text: Json
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          index: number
          is_answer?: boolean
          question_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          answer_explanation?: Json | null
          answer_text?: Json
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          index?: number
          is_answer?: boolean
          question_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_answer_options_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_answer_options_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_answer_options_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_answer_options_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_answer_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ucat_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_answer_options_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_answer_options_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      question_sets: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: Json | null
          id: string
          is_private: boolean
          is_student_generated: boolean
          name: Json | null
          sections: Json | null
          speed: number | null
          time_limit_at_exam_speed_seconds: number | null
          time_limit_seconds: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: Json | null
          id?: string
          is_private?: boolean
          is_student_generated?: boolean
          name?: Json | null
          sections?: Json | null
          speed?: number | null
          time_limit_at_exam_speed_seconds?: number | null
          time_limit_seconds?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: Json | null
          id?: string
          is_private?: boolean
          is_student_generated?: boolean
          name?: Json | null
          sections?: Json | null
          speed?: number | null
          time_limit_at_exam_speed_seconds?: number | null
          time_limit_seconds?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      question_sets_ucat_mocks: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          index: number
          question_set_id: string
          ucat_mock_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          index: number
          question_set_id: string
          ucat_mock_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          index?: number
          question_set_id?: string
          ucat_mock_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_sets_ucat_mocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_ucat_mocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_ucat_mocks_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_ucat_mocks_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_ucat_mocks_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_ucat_mocks_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_ucat_mocks_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_ucat_mocks_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_ucat_mocks_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_ucat_mocks_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_ucat_mocks_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_ucat_mocks_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_ucat_mocks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_ucat_mocks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      question_stem_categories: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: Json | null
          id: string
          name: string
          parent_question_stem_category_id: string | null
          ucat_section_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: Json | null
          id?: string
          name: string
          parent_question_stem_category_id?: string | null
          ucat_section_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: Json | null
          id?: string
          name?: string
          parent_question_stem_category_id?: string | null
          ucat_section_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stem_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_parent_question_stem_category_id_fkey"
            columns: ["parent_question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_parent_question_stem_category_id_fkey"
            columns: ["parent_question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_parent_question_stem_category_id_fkey"
            columns: ["parent_question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_question_attempts"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_question_attempts_for_progress"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stem_categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      question_stems: {
        Row: {
          ai_generation_metadata: Json | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_ai_generated: boolean
          is_private: boolean
          question_stem_category_id: string | null
          section_id: string
          stem_text: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ai_generation_metadata?: Json | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_ai_generated?: boolean
          is_private?: boolean
          question_stem_category_id?: string | null
          section_id: string
          stem_text: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ai_generation_metadata?: Json | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_ai_generated?: boolean
          is_private?: boolean
          question_stem_category_id?: string | null
          section_id?: string
          stem_text?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stems_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_question_attempts"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_question_attempts_for_progress"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stems_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      question_stems_files: {
        Row: {
          file_id: string
          id: string
          question_stem_id: string
        }
        Insert: {
          file_id: string
          id?: string
          question_stem_id: string
        }
        Update: {
          file_id?: string
          id?: string
          question_stem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_stems_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_files_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_files_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_files_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_files_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_files_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_files_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_approved"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_files_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_generated"
            referencedColumns: ["id"]
          },
        ]
      }
      question_stems_question_sets: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          index: number
          question_set_id: string
          question_stem_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          index: number
          question_set_id: string
          question_stem_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          index?: number
          question_set_id?: string
          question_stem_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stems_question_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_approved"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_generated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_sets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      question_tags: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: Json | null
          id: string
          name: string
          parent_question_tag_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: Json | null
          id?: string
          name: string
          parent_question_tag_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: Json | null
          id?: string
          name?: string
          parent_question_tag_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_parent_question_tag_id_fkey"
            columns: ["parent_question_tag_id"]
            isOneToOne: false
            referencedRelation: "question_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_parent_question_tag_id_fkey"
            columns: ["parent_question_tag_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_files: {
        Row: {
          file_id: string
          id: string
          question_id: string
        }
        Insert: {
          file_id: string
          id?: string
          question_id: string
        }
        Update: {
          file_id?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_files_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ucat_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_question_tags: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          question_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          question_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          question_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_question_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_question_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_question_tags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ucat_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_question_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "question_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_question_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_filters: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          target_entity: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          config: Json
          created_at?: string
          id?: string
          name: string
          target_entity: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          target_entity?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rich_text_templates: {
        Row: {
          content: Json
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rich_text_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rich_text_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          admin_shift_id: string | null
          billing_type: Database["public"]["Enums"]["billing_type"] | null
          class_id: string | null
          created_at: string | null
          end_at: string | null
          id: string
          long_name: string | null
          short_name: string | null
          start_at: string | null
          status: string
          subject_id: string | null
          type: Database["public"]["Enums"]["session_type"]
          updated_at: string | null
        }
        Insert: {
          admin_shift_id?: string | null
          billing_type?: Database["public"]["Enums"]["billing_type"] | null
          class_id?: string | null
          created_at?: string | null
          end_at?: string | null
          id: string
          long_name?: string | null
          short_name?: string | null
          start_at?: string | null
          status?: string
          subject_id?: string | null
          type: Database["public"]["Enums"]["session_type"]
          updated_at?: string | null
        }
        Update: {
          admin_shift_id?: string | null
          billing_type?: Database["public"]["Enums"]["billing_type"] | null
          class_id?: string | null
          created_at?: string | null
          end_at?: string | null
          id?: string
          long_name?: string | null
          short_name?: string | null
          start_at?: string | null
          status?: string
          subject_id?: string | null
          type?: Database["public"]["Enums"]["session_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_admin_shift_id_fkey"
            columns: ["admin_shift_id"]
            isOneToOne: false
            referencedRelation: "admin_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vstudent_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions_files: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          display_order: number
          file_id: string
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          display_order?: number
          file_id: string
          id?: string
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          display_order?: number
          file_id?: string
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
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
          was_trial: boolean
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
          was_trial?: boolean
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
          was_trial?: boolean
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
            foreignKeyName: "sessions_staff_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "sessions_staff_planned_absence_logged_by_fkey"
            columns: ["planned_absence_logged_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "sessions_staff_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_staff_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_staff_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_staff_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_staff_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
          was_trial: boolean
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
          was_trial?: boolean
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
          was_trial?: boolean
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
            foreignKeyName: "sessions_students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "sessions_students_credited_by_fkey"
            columns: ["credited_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "sessions_students_planned_absence_logged_by_fkey"
            columns: ["planned_absence_logged_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "sessions_students_rescheduled_sessions_students_id_fkey"
            columns: ["rescheduled_sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vadmin_reconciliation_uninvoiced_sessions"
            referencedColumns: ["sessions_students_id"]
          },
          {
            foreignKeyName: "sessions_students_rescheduled_sessions_students_id_fkey"
            columns: ["rescheduled_sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "sessions_students_rescheduled_sessions_students_id_fkey"
            columns: ["rescheduled_sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "sessions_students_rescheduled_sessions_students_id_fkey"
            columns: ["rescheduled_sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "sessions_students_rescheduled_sessions_students_id_fkey"
            columns: ["rescheduled_sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions_students"
            referencedColumns: ["sessions_students_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
        ]
      }
      slot_reservations: {
        Row: {
          created_at: string | null
          end_at: string
          expires_at: string
          id: string
          reserved_by: string | null
          session_type: Database["public"]["Enums"]["session_type"]
          staff_id: string | null
          start_at: string
          subject_id: string | null
        }
        Insert: {
          created_at?: string | null
          end_at: string
          expires_at?: string
          id?: string
          reserved_by?: string | null
          session_type: Database["public"]["Enums"]["session_type"]
          staff_id?: string | null
          start_at: string
          subject_id?: string | null
        }
        Update: {
          created_at?: string | null
          end_at?: string
          expires_at?: string
          id?: string
          reserved_by?: string | null
          session_type?: Database["public"]["Enums"]["session_type"]
          staff_id?: string | null
          start_at?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slot_reservations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_reservations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_reservations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_reservations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_reservations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
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
          drafting_availability: boolean | null
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
          subsidy_interview_availability: boolean | null
          trial_session_availability: boolean | null
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
          drafting_availability?: boolean | null
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
          subsidy_interview_availability?: boolean | null
          trial_session_availability?: boolean | null
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
          drafting_availability?: boolean | null
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
          subsidy_interview_availability?: boolean | null
          trial_session_availability?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      staff_files: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          display_order: number
          file_id: string
          id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          display_order?: number
          file_id: string
          id?: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          display_order?: number
          file_id?: string
          id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_files_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_files_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_notepad: {
        Row: {
          content: string | null
          staff_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          staff_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_notepad_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_notepad_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "staff_subjects_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_data: Json
          event_type: string
          id: string
          processed: boolean
          processed_at: string | null
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_data: Json
          event_type: string
          id?: string
          processed?: boolean
          processed_at?: string | null
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          processed?: boolean
          processed_at?: string | null
          stripe_event_id?: string
        }
        Relationships: []
      }
      student_payment_methods: {
        Row: {
          card_brand: string
          card_country: string | null
          card_exp_month: number
          card_exp_year: number
          card_last4: string
          created_at: string
          id: string
          is_default: boolean
          stripe_payment_method_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          card_brand: string
          card_country?: string | null
          card_exp_month: number
          card_exp_year: number
          card_last4: string
          created_at?: string
          id?: string
          is_default?: boolean
          stripe_payment_method_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          card_brand?: string
          card_country?: string | null
          card_exp_month?: number
          card_exp_year?: number
          card_last4?: string
          created_at?: string
          id?: string
          is_default?: boolean
          stripe_payment_method_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_payment_methods_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_payment_methods_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_payment_methods_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_payment_methods_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_practice_sessions: {
        Row: {
          completed_at: string | null
          filters_snapshot: Json | null
          id: string
          question_count: number | null
          score_points: number | null
          section_key: string
          started_at: string
          stems_snapshot: Json | null
          student_id: string
          total_points: number | null
          ucat_section_id: string
          unlimited: boolean
        }
        Insert: {
          completed_at?: string | null
          filters_snapshot?: Json | null
          id?: string
          question_count?: number | null
          score_points?: number | null
          section_key: string
          started_at?: string
          stems_snapshot?: Json | null
          student_id: string
          total_points?: number | null
          ucat_section_id: string
          unlimited?: boolean
        }
        Update: {
          completed_at?: string | null
          filters_snapshot?: Json | null
          id?: string
          question_count?: number | null
          score_points?: number | null
          section_key?: string
          started_at?: string
          stems_snapshot?: Json | null
          student_id?: string
          total_points?: number | null
          ucat_section_id?: string
          unlimited?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "student_practice_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_practice_sessions_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_sessions_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_question_attempts"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "student_practice_sessions_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_sessions_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_sessions_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_question_attempts_for_progress"
            referencedColumns: ["ucat_section_id"]
          },
        ]
      }
      student_question_attempts: {
        Row: {
          answer_snapshot: Json | null
          attempted_at: string
          id: string
          is_flagged: boolean
          is_submitted: boolean
          mode: string | null
          question_answer_option_id: string | null
          question_id: string
          score: number
          student_id: string
          student_practice_session_id: string | null
          student_question_set_attempt_id: string | null
          student_question_speed: number | null
          time_spent_seconds: number | null
          was_timed: boolean
        }
        Insert: {
          answer_snapshot?: Json | null
          attempted_at?: string
          id?: string
          is_flagged?: boolean
          is_submitted?: boolean
          mode?: string | null
          question_answer_option_id?: string | null
          question_id: string
          score?: number
          student_id: string
          student_practice_session_id?: string | null
          student_question_set_attempt_id?: string | null
          student_question_speed?: number | null
          time_spent_seconds?: number | null
          was_timed?: boolean
        }
        Update: {
          answer_snapshot?: Json | null
          attempted_at?: string
          id?: string
          is_flagged?: boolean
          is_submitted?: boolean
          mode?: string | null
          question_answer_option_id?: string | null
          question_id?: string
          score?: number
          student_id?: string
          student_practice_session_id?: string | null
          student_question_set_attempt_id?: string | null
          student_question_speed?: number | null
          time_spent_seconds?: number | null
          was_timed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "student_question_attempts_question_answer_option_id_fkey"
            columns: ["question_answer_option_id"]
            isOneToOne: false
            referencedRelation: "question_answer_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ucat_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_practice_session_id_fkey"
            columns: ["student_practice_session_id"]
            isOneToOne: false
            referencedRelation: "student_practice_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_practice_session_id_fkey"
            columns: ["student_practice_session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_practice_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "student_question_set_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_set_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_set_attempt_detail"
            referencedColumns: ["attempt_id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_set_attempts"
            referencedColumns: ["attempt_id"]
          },
        ]
      }
      student_question_set_attempts: {
        Row: {
          attempted_at: string
          completed_at: string | null
          id: string
          question_set_id: string
          scaled_score: number | null
          score_points: number | null
          set_speed: number | null
          set_time_limit_at_exam_speed_seconds: number | null
          set_time_limit_seconds: number | null
          student_exam_speed: number | null
          student_id: string
          student_set_speed: number | null
          student_ucat_mock_attempt_id: string | null
          time_taken_seconds: number | null
          total_points: number | null
          was_timed: boolean
        }
        Insert: {
          attempted_at?: string
          completed_at?: string | null
          id?: string
          question_set_id: string
          scaled_score?: number | null
          score_points?: number | null
          set_speed?: number | null
          set_time_limit_at_exam_speed_seconds?: number | null
          set_time_limit_seconds?: number | null
          student_exam_speed?: number | null
          student_id: string
          student_set_speed?: number | null
          student_ucat_mock_attempt_id?: string | null
          time_taken_seconds?: number | null
          total_points?: number | null
          was_timed?: boolean
        }
        Update: {
          attempted_at?: string
          completed_at?: string | null
          id?: string
          question_set_id?: string
          scaled_score?: number | null
          score_points?: number | null
          set_speed?: number | null
          set_time_limit_at_exam_speed_seconds?: number | null
          set_time_limit_seconds?: number | null
          student_exam_speed?: number | null
          student_id?: string
          student_set_speed?: number | null
          student_ucat_mock_attempt_id?: string | null
          time_taken_seconds?: number | null
          total_points?: number | null
          was_timed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_ucat_mock_attempt_id_fkey"
            columns: ["student_ucat_mock_attempt_id"]
            isOneToOne: false
            referencedRelation: "student_ucat_mock_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_ucat_mock_attempt_id_fkey"
            columns: ["student_ucat_mock_attempt_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_mock_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_ucat_mock_attempt_id_fkey"
            columns: ["student_ucat_mock_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_mock_attempt_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_ucat_mock_attempt_id_fkey"
            columns: ["student_ucat_mock_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_mock_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_price_id: string | null
          stripe_product_id: string | null
          stripe_subscription_id: string
          student_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id: string
          student_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string
          student_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_subscriptions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subscriptions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subscriptions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subsidies: {
        Row: {
          billing_type: Database["public"]["Enums"]["billing_type"]
          created_at: string
          created_by: string | null
          currency: string
          effective_from: string
          effective_until: string | null
          id: string
          price_cents: number
          student_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          billing_type: Database["public"]["Enums"]["billing_type"]
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          price_cents: number
          student_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          billing_type?: Database["public"]["Enums"]["billing_type"]
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          price_cents?: number
          student_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subsidies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subsidies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subsidies_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subsidies_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subsidies_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subsidies_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_subsidies_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subsidies_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subsidies_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_ucat_mock_attempts: {
        Row: {
          attempted_at: string
          completed_at: string | null
          id: string
          mock_time_limit_at_exam_speed_seconds: number | null
          mock_time_limit_seconds: number | null
          scaled_score: number | null
          score_points: number | null
          student_id: string
          student_mock_speed: number | null
          time_taken: number | null
          total_points: number | null
          ucat_mock_id: string
        }
        Insert: {
          attempted_at?: string
          completed_at?: string | null
          id?: string
          mock_time_limit_at_exam_speed_seconds?: number | null
          mock_time_limit_seconds?: number | null
          scaled_score?: number | null
          score_points?: number | null
          student_id: string
          student_mock_speed?: number | null
          time_taken?: number | null
          total_points?: number | null
          ucat_mock_id: string
        }
        Update: {
          attempted_at?: string
          completed_at?: string | null
          id?: string
          mock_time_limit_at_exam_speed_seconds?: number | null
          mock_time_limit_seconds?: number | null
          scaled_score?: number | null
          score_points?: number | null
          student_id?: string
          student_mock_speed?: number | null
          time_taken?: number | null
          total_points?: number | null
          ucat_mock_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mocks"
            referencedColumns: ["id"]
          },
        ]
      }
      student_ucat_practice_day_credits: {
        Row: {
          created_at: string
          credit_date: string
          discount_cents: number
          id: string
          stripe_invoice_item_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          credit_date: string
          discount_cents: number
          id?: string
          stripe_invoice_item_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          credit_date?: string
          discount_cents?: number
          id?: string
          stripe_invoice_item_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_ucat_practice_day_credits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_practice_day_credits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_practice_day_credits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_practice_day_credits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
        ]
      }
      students: {
        Row: {
          active_at: string | null
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
          discontinued_at: string | null
          email: string | null
          first_name: string
          id: string
          invite_token: string | null
          last_name: string
          phone: string | null
          registered_at: string | null
          school: string | null
          status: string
          timezone: string
          updated_at: string | null
          user_id: string | null
          welcome_modal_acknowledged_at: string | null
          year_level: number | null
        }
        Insert: {
          active_at?: string | null
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
          discontinued_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          invite_token?: string | null
          last_name: string
          phone?: string | null
          registered_at?: string | null
          school?: string | null
          status: string
          timezone?: string
          updated_at?: string | null
          user_id?: string | null
          welcome_modal_acknowledged_at?: string | null
          year_level?: number | null
        }
        Update: {
          active_at?: string | null
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
          discontinued_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          invite_token?: string | null
          last_name?: string
          phone?: string | null
          registered_at?: string | null
          school?: string | null
          status?: string
          timezone?: string
          updated_at?: string | null
          user_id?: string | null
          welcome_modal_acknowledged_at?: string | null
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
          {
            foreignKeyName: "students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      students_billing: {
        Row: {
          auto_bill_enabled: boolean
          created_at: string
          invoice_email_to_parents: boolean
          invoice_email_to_student: boolean
          stripe_customer_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          auto_bill_enabled?: boolean
          created_at?: string
          invoice_email_to_parents?: boolean
          invoice_email_to_student?: boolean
          stripe_customer_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          auto_bill_enabled?: boolean
          created_at?: string
          invoice_email_to_parents?: boolean
          invoice_email_to_student?: boolean
          stripe_customer_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_billing_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_billing_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_billing_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_billing_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
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
            foreignKeyName: "students_subjects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "students_subjects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_subjects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_subjects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "students_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
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
          long_name: string | null
          name: string
          short_name: string | null
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
          long_name?: string | null
          name: string
          short_name?: string | null
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
          long_name?: string | null
          name?: string
          short_name?: string | null
          updated_at?: string | null
          year_level?: number | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          description: Json | null
          due_date: string | null
          estimate: number | null
          id: string
          issue_id: string | null
          priority: number | null
          project_id: string | null
          search_vector: unknown
          source_activity_id: string | null
          source_rule_id: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: Json | null
          due_date?: string | null
          estimate?: number | null
          id?: string
          issue_id?: string | null
          priority?: number | null
          project_id?: string | null
          search_vector?: unknown
          source_activity_id?: string | null
          source_rule_id?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: Json | null
          due_date?: string | null
          estimate?: number | null
          id?: string
          issue_id?: string | null
          priority?: number | null
          project_id?: string | null
          search_vector?: unknown
          source_activity_id?: string | null
          source_rule_id?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_activity_id_fkey"
            columns: ["source_activity_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_rule_id_fkey"
            columns: ["source_rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          code: string
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
          code: string
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
          code?: string
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
            foreignKeyName: "topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "vstudent_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "vtutor_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      topics_files: {
        Row: {
          code: string
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
          code: string
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
          code?: string
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
            foreignKeyName: "topics_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "topics_files_is_solutions_of_id_fkey"
            columns: ["is_solutions_of_id"]
            isOneToOne: false
            referencedRelation: "vstudent_topics_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_is_solutions_of_id_fkey"
            columns: ["is_solutions_of_id"]
            isOneToOne: false
            referencedRelation: "vtutor_topics_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "vstudent_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "vtutor_topics"
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
          session_type: Database["public"]["Enums"]["session_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          session_id: string
          session_type: Database["public"]["Enums"]["session_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          session_id?: string
          session_type?: Database["public"]["Enums"]["session_type"]
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
            foreignKeyName: "tutor_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
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
          was_trial: boolean
        }
        Insert: {
          attended?: boolean
          created_at?: string
          id?: string
          staff_id: string
          tutor_log_id: string
          type: string
          updated_at?: string
          was_trial?: boolean
        }
        Update: {
          attended?: boolean
          created_at?: string
          id?: string
          staff_id?: string
          tutor_log_id?: string
          type?: string
          updated_at?: string
          was_trial?: boolean
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
            foreignKeyName: "tutor_logs_staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_staff_attendance_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "tutor_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_staff_attendance_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "vstudent_tutor_log"
            referencedColumns: ["tutor_log_id"]
          },
          {
            foreignKeyName: "tutor_logs_staff_attendance_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "vtutor_tutor_log"
            referencedColumns: ["tutor_log_id"]
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
          was_trial: boolean
        }
        Insert: {
          attended?: boolean
          created_at?: string
          created_by: string
          id?: string
          student_id: string
          tutor_log_id: string
          updated_at?: string
          was_trial?: boolean
        }
        Update: {
          attended?: boolean
          created_at?: string
          created_by?: string
          id?: string
          student_id?: string
          tutor_log_id?: string
          updated_at?: string
          was_trial?: boolean
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
            foreignKeyName: "tutor_logs_student_attendance_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "tutor_logs_student_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_student_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_student_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "tutor_logs_student_attendance_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "tutor_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_student_attendance_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "vstudent_tutor_log"
            referencedColumns: ["tutor_log_id"]
          },
          {
            foreignKeyName: "tutor_logs_student_attendance_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "vtutor_tutor_log"
            referencedColumns: ["tutor_log_id"]
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
            foreignKeyName: "tutor_logs_topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "tutor_logs_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "vstudent_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "vtutor_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "tutor_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "vstudent_tutor_log"
            referencedColumns: ["tutor_log_id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "vtutor_tutor_log"
            referencedColumns: ["tutor_log_id"]
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
            foreignKeyName: "tutor_logs_topics_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "tutor_logs_topics_files_topics_files_id_fkey"
            columns: ["topics_files_id"]
            isOneToOne: false
            referencedRelation: "vstudent_topics_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_files_topics_files_id_fkey"
            columns: ["topics_files_id"]
            isOneToOne: false
            referencedRelation: "vtutor_topics_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_files_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "tutor_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_files_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "vstudent_tutor_log"
            referencedColumns: ["tutor_log_id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_files_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            isOneToOne: false
            referencedRelation: "vtutor_tutor_log"
            referencedColumns: ["tutor_log_id"]
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
            foreignKeyName: "tutor_logs_topics_files_students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_files_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_files_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_files_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_files_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
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
            foreignKeyName: "tutor_logs_topics_students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "tutor_logs_topics_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_topics_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
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
      ucat_mocks: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          instructions_text: Json | null
          is_private: boolean
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          instructions_text?: Json | null
          is_private?: boolean
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          instructions_text?: Json | null
          is_private?: boolean
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ucat_mocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      ucat_questions: {
        Row: {
          answer_explanation: Json | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          difficulty: number | null
          id: string
          index: number
          question_stem_id: string
          question_text: Json
          question_type: Database["public"]["Enums"]["ucat_question_type"]
          time_burden_seconds: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          answer_explanation?: Json | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          difficulty?: number | null
          id?: string
          index: number
          question_stem_id: string
          question_text: Json
          question_type: Database["public"]["Enums"]["ucat_question_type"]
          time_burden_seconds?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          answer_explanation?: Json | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          difficulty?: number | null
          id?: string
          index?: number
          question_stem_id?: string
          question_text?: Json
          question_type?: Database["public"]["Enums"]["ucat_question_type"]
          time_burden_seconds?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ucat_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_approved"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_generated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      ucat_sections: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_columns: number
          id: string
          instructions_text: Json | null
          instructions_time_limit_seconds: number | null
          name: string
          number_of_questions: number | null
          section_number: number
          time_limit_seconds: number | null
          time_per_question: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_columns: number
          id?: string
          instructions_text?: Json | null
          instructions_time_limit_seconds?: number | null
          name: string
          number_of_questions?: number | null
          section_number: number
          time_limit_seconds?: number | null
          time_per_question?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_columns?: number
          id?: string
          instructions_text?: Json | null
          instructions_time_limit_seconds?: number | null
          name?: string
          number_of_questions?: number | null
          section_number?: number
          time_limit_seconds?: number | null
          time_per_question?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ucat_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      ucat_sessions_resources: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          index: number
          question_set_id: string | null
          question_stem_id: string | null
          session_id: string
          ucat_mock_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          index: number
          question_set_id?: string | null
          question_stem_id?: string | null
          session_id: string
          ucat_mock_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          index?: number
          question_set_id?: string | null
          question_stem_id?: string | null
          session_id?: string
          ucat_mock_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ucat_sessions_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_approved"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_generated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mocks"
            referencedColumns: ["id"]
          },
        ]
      }
      ucat_subscription_config: {
        Row: {
          base_price_cents: number
          billing_interval: string
          created_at: string
          currency: string
          discount_per_day_cents: number
          id: string
          min_questions_per_day: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          trial_days: number
          updated_at: string
        }
        Insert: {
          base_price_cents?: number
          billing_interval?: string
          created_at?: string
          currency?: string
          discount_per_day_cents?: number
          id?: string
          min_questions_per_day?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_days?: number
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          billing_interval?: string
          created_at?: string
          currency?: string
          discount_per_day_cents?: number
          id?: string
          min_questions_per_day?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      vadmin_reconciliation_uninvoiced_sessions: {
        Row: {
          actual_attended: boolean | null
          actual_was_trial: boolean | null
          billing_type: Database["public"]["Enums"]["billing_type"] | null
          created_at: string | null
          has_tutor_log: boolean | null
          is_credited: boolean | null
          is_extra: boolean | null
          is_rescheduled: boolean | null
          planned_absence: boolean | null
          session_end_at: string | null
          session_id: string | null
          session_name: string | null
          session_start_at: string | null
          session_type: Database["public"]["Enums"]["session_type"] | null
          sessions_students_id: string | null
          student_email: string | null
          student_first_name: string | null
          student_id: string | null
          student_last_name: string | null
          student_phone: string | null
          subject_id: string | null
          subject_long_name: string | null
          subject_name: string | null
          updated_at: string | null
          was_trial: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_billing: {
        Row: {
          created_at: string | null
          default_payment_method: Json | null
          payment_methods: Json | null
          stripe_customer_id: string | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_payment_method?: never
          payment_methods?: never
          stripe_customer_id?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_payment_method?: never
          payment_methods?: never
          stripe_customer_id?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_billing_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_billing_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_billing_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_billing_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
        ]
      }
      vstudent_class_detail: {
        Row: {
          class_id: string | null
          class_level: string | null
          class_status: string | null
          day_of_week: number | null
          end_time: string | null
          room: string | null
          staff: Json | null
          start_time: string | null
          students: Json | null
          subject_color: string | null
          subject_curriculum:
            | Database["public"]["Enums"]["subject_curriculum"]
            | null
          subject_discipline:
            | Database["public"]["Enums"]["subject_discipline"]
            | null
          subject_id: string | null
          subject_level: string | null
          subject_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_classes: {
        Row: {
          class_id: string | null
          class_level: string | null
          class_status: string | null
          day_of_week: number | null
          end_time: string | null
          enrolled_at: string | null
          enrolled_by: string | null
          enrollment_created_at: string | null
          enrollment_id: string | null
          enrollment_status: string | null
          enrollment_updated_at: string | null
          room: string | null
          start_time: string | null
          student_id: string | null
          subject_color: string | null
          subject_curriculum:
            | Database["public"]["Enums"]["subject_curriculum"]
            | null
          subject_discipline:
            | Database["public"]["Enums"]["subject_discipline"]
            | null
          subject_id: string | null
          subject_level: string | null
          subject_name: string | null
          subject_year_level: number | null
          unenrolled_at: string | null
          unenrolled_by: string | null
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
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vstudent_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_classes"
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
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "classes_students_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_students_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_students_unenrolled_by_fkey"
            columns: ["unenrolled_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_students_unenrolled_by_fkey"
            columns: ["unenrolled_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_invoice_items: {
        Row: {
          amount_cents: number | null
          created_at: string | null
          description: string | null
          id: string | null
          invoice_id: string | null
          is_subsidy: boolean | null
          session_end_at: string | null
          session_id: string | null
          session_start_at: string | null
          session_type: Database["public"]["Enums"]["session_type"] | null
          sessions_students_id: string | null
          student_id: string | null
          subject_curriculum:
            | Database["public"]["Enums"]["subject_curriculum"]
            | null
          subject_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vstudent_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "invoice_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "invoice_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "invoice_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "invoice_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "invoice_items_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "sessions_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vadmin_reconciliation_uninvoiced_sessions"
            referencedColumns: ["sessions_students_id"]
          },
          {
            foreignKeyName: "invoice_items_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "invoice_items_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "invoice_items_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "invoice_items_sessions_students_id_fkey"
            columns: ["sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions_students"
            referencedColumns: ["sessions_students_id"]
          },
          {
            foreignKeyName: "invoice_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
        ]
      }
      vstudent_invoices: {
        Row: {
          amount_due_cents: number | null
          amount_paid_cents: number | null
          billing_source:
            | Database["public"]["Enums"]["invoice_billing_source"]
            | null
          created_at: string | null
          currency: string | null
          finalized_at: string | null
          hosted_invoice_url: string | null
          id: string | null
          invoice_date: string | null
          invoice_pdf: string | null
          item_count: number | null
          paid_at: string | null
          receipt_url: string | null
          status: string | null
          stripe_invoice_id: string | null
          stripe_invoice_number: string | null
          student_id: string | null
          student_subscription_id: string | null
          total_charges_cents: number | null
          total_subsidies_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "invoices_student_subscription_id_fkey"
            columns: ["student_subscription_id"]
            isOneToOne: false
            referencedRelation: "student_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_my_subject_access: {
        Row: {
          access_source: string | null
          student_id: string | null
          subject_id: string | null
        }
        Relationships: []
      }
      vstudent_notifications: {
        Row: {
          action_url: string | null
          activity_event_id: string | null
          body: string | null
          created_at: string | null
          id: string | null
          notification_type: string | null
          read_at: string | null
          student_id: string | null
          title: string | null
        }
        Insert: {
          action_url?: string | null
          activity_event_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string | null
          notification_type?: string | null
          read_at?: string | null
          student_id?: string | null
          title?: string | null
        }
        Update: {
          action_url?: string | null
          activity_event_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string | null
          notification_type?: string | null
          read_at?: string | null
          student_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_activity_event_id_fkey"
            columns: ["activity_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
        ]
      }
      vstudent_profile: {
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
          curriculum: string | null
          email: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          phone: string | null
          school: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          welcome_modal_acknowledged_at: string | null
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
          curriculum?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          phone?: string | null
          school?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          welcome_modal_acknowledged_at?: string | null
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
          curriculum?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          phone?: string | null
          school?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          welcome_modal_acknowledged_at?: string | null
          year_level?: number | null
        }
        Relationships: []
      }
      vstudent_session_base: {
        Row: {
          class_id: string | null
          class_level: string | null
          class_status: string | null
          credited_at: string | null
          day_of_week: number | null
          end_at: string | null
          end_time: string | null
          is_credited: boolean | null
          is_rescheduled: boolean | null
          planned_absence: boolean | null
          planned_absence_logged_at: string | null
          rescheduled_at: string | null
          room: string | null
          session_created_at: string | null
          session_id: string | null
          session_student_id: string | null
          session_type: Database["public"]["Enums"]["session_type"] | null
          session_updated_at: string | null
          staff: Json | null
          start_at: string | null
          start_time: string | null
          students: Json | null
          subject_color: string | null
          subject_curriculum:
            | Database["public"]["Enums"]["subject_curriculum"]
            | null
          subject_discipline:
            | Database["public"]["Enums"]["subject_discipline"]
            | null
          subject_id: string | null
          subject_level: string | null
          subject_long_name: string | null
          subject_name: string | null
          subject_short_name: string | null
          subject_year_level: number | null
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
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vstudent_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_session_detail: {
        Row: {
          class_id: string | null
          class_level: string | null
          class_status: string | null
          credited_at: string | null
          day_of_week: number | null
          end_at: string | null
          end_time: string | null
          is_credited: boolean | null
          is_rescheduled: boolean | null
          planned_absence: boolean | null
          planned_absence_logged_at: string | null
          rescheduled_at: string | null
          room: string | null
          session_created_at: string | null
          session_id: string | null
          session_student_id: string | null
          session_type: Database["public"]["Enums"]["session_type"] | null
          session_updated_at: string | null
          staff: Json | null
          start_at: string | null
          start_time: string | null
          students: Json | null
          subject_color: string | null
          subject_curriculum:
            | Database["public"]["Enums"]["subject_curriculum"]
            | null
          subject_discipline:
            | Database["public"]["Enums"]["subject_discipline"]
            | null
          subject_id: string | null
          subject_level: string | null
          subject_long_name: string | null
          subject_name: string | null
          subject_short_name: string | null
          subject_year_level: number | null
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
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vstudent_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_sessions: {
        Row: {
          class_id: string | null
          class_level: string | null
          class_status: string | null
          credited_at: string | null
          day_of_week: number | null
          end_at: string | null
          end_time: string | null
          is_credited: boolean | null
          is_rescheduled: boolean | null
          planned_absence: boolean | null
          planned_absence_logged_at: string | null
          rescheduled_at: string | null
          room: string | null
          session_created_at: string | null
          session_id: string | null
          session_student_id: string | null
          session_type: Database["public"]["Enums"]["session_type"] | null
          session_updated_at: string | null
          staff: Json | null
          start_at: string | null
          start_time: string | null
          students: Json | null
          subject_color: string | null
          subject_curriculum:
            | Database["public"]["Enums"]["subject_curriculum"]
            | null
          subject_discipline:
            | Database["public"]["Enums"]["subject_discipline"]
            | null
          subject_id: string | null
          subject_level: string | null
          subject_name: string | null
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
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vstudent_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_subject_resources: {
        Row: {
          depth: number | null
          files: Json | null
          parent_id: string | null
          subject_id: string | null
          topic_id: string | null
          topic_index: number | null
          topic_name: string | null
          topic_path: string[] | null
        }
        Relationships: []
      }
      vstudent_subjects: {
        Row: {
          color: string | null
          created_at: string | null
          curriculum: Database["public"]["Enums"]["subject_curriculum"] | null
          discipline: Database["public"]["Enums"]["subject_discipline"] | null
          id: string | null
          level: string | null
          long_name: string | null
          name: string | null
          short_name: string | null
          updated_at: string | null
          year_level: number | null
        }
        Relationships: []
      }
      vstudent_topics: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          index: number | null
          name: string | null
          parent_id: string | null
          subject_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          index?: number | null
          name?: string | null
          parent_id?: string | null
          subject_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          index?: number | null
          name?: string | null
          parent_id?: string | null
          subject_id?: string | null
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
            foreignKeyName: "topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "vstudent_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "vtutor_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_topics_files: {
        Row: {
          bucket: string | null
          code: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          file_id: string | null
          file_metadata: Json | null
          filename: string | null
          id: string | null
          index: number | null
          is_solutions: boolean | null
          is_solutions_of_id: string | null
          mimetype: string | null
          size_bytes: number | null
          storage_path: string | null
          storage_provider: string | null
          topic_id: string | null
          type: Database["public"]["Enums"]["resource_type"] | null
          updated_at: string | null
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
            foreignKeyName: "topics_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "topics_files_is_solutions_of_id_fkey"
            columns: ["is_solutions_of_id"]
            isOneToOne: false
            referencedRelation: "vstudent_topics_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_is_solutions_of_id_fkey"
            columns: ["is_solutions_of_id"]
            isOneToOne: false
            referencedRelation: "vtutor_topics_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "vstudent_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "vtutor_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_tutor_log: {
        Row: {
          attendance_created_at: string | null
          attended: boolean | null
          files: Json | null
          session_id: string | null
          staff_attendance: Json | null
          student_attendance_id: string | null
          topics: Json | null
          tutor_log_created_at: string | null
          tutor_log_id: string | null
          tutor_log_updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      vstudent_ucat_mock_detail: {
        Row: {
          created_at: string | null
          id: string | null
          instructions_text: Json | null
          name: string | null
          sets: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          instructions_text?: Json | null
          name?: string | null
          sets?: never
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          instructions_text?: Json | null
          name?: string | null
          sets?: never
          updated_at?: string | null
        }
        Relationships: []
      }
      vstudent_ucat_mocks: {
        Row: {
          created_at: string | null
          created_by: string | null
          has_timed_sets: boolean | null
          id: string | null
          name: string | null
          set_count: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          has_timed_sets?: never
          id?: string | null
          name?: string | null
          set_count?: never
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          has_timed_sets?: never
          id?: string | null
          name?: string | null
          set_count?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ucat_mocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_ucat_my_access: {
        Row: {
          has_in_person_access: boolean | null
          has_online_access: boolean | null
          has_ucat_access: boolean | null
        }
        Relationships: []
      }
      vstudent_ucat_my_mock_attempts: {
        Row: {
          attempted_at: string | null
          completed_at: string | null
          id: string | null
          mock_time_limit_at_exam_speed_seconds: number | null
          mock_time_limit_seconds: number | null
          scaled_score: number | null
          score_points: number | null
          student_id: string | null
          student_mock_speed: number | null
          time_taken: number | null
          total_points: number | null
          ucat_mock_id: string | null
        }
        Insert: {
          attempted_at?: string | null
          completed_at?: string | null
          id?: string | null
          mock_time_limit_at_exam_speed_seconds?: number | null
          mock_time_limit_seconds?: number | null
          scaled_score?: number | null
          score_points?: number | null
          student_id?: string | null
          student_mock_speed?: number | null
          time_taken?: number | null
          total_points?: number | null
          ucat_mock_id?: string | null
        }
        Update: {
          attempted_at?: string | null
          completed_at?: string | null
          id?: string | null
          mock_time_limit_at_exam_speed_seconds?: number | null
          mock_time_limit_seconds?: number | null
          scaled_score?: number | null
          score_points?: number | null
          student_id?: string | null
          student_mock_speed?: number | null
          time_taken?: number | null
          total_points?: number | null
          ucat_mock_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mocks"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_ucat_my_practice_sessions: {
        Row: {
          completed_at: string | null
          id: string | null
          question_count: number | null
          score_points: number | null
          section_key: string | null
          section_name: string | null
          started_at: string | null
          stems_snapshot: Json | null
          student_id: string | null
          total_points: number | null
          ucat_section_id: string | null
          unlimited: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "student_practice_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_practice_sessions_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_sessions_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_question_attempts"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "student_practice_sessions_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_sessions_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_practice_sessions_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_question_attempts_for_progress"
            referencedColumns: ["ucat_section_id"]
          },
        ]
      }
      vstudent_ucat_my_progress_summary: {
        Row: {
          avg_scaled_score: number | null
          avg_score_points: number | null
          last_attempted_at: string | null
          student_id: string | null
          total_mocks_attempted: number | null
          total_sets_attempted: number | null
        }
        Relationships: []
      }
      vstudent_ucat_my_question_attempts: {
        Row: {
          answer_snapshot: Json | null
          attempted_at: string | null
          category_name: string | null
          id: string | null
          is_flagged: boolean | null
          is_submitted: boolean | null
          mode: string | null
          question_answer_option_id: string | null
          question_id: string | null
          question_index: number | null
          question_stem_category_id: string | null
          question_stem_id: string | null
          question_text: Json | null
          question_type:
            | Database["public"]["Enums"]["ucat_question_type"]
            | null
          score: number | null
          section_name: string | null
          section_number: number | null
          selected_answer_text: Json | null
          stem_text: Json | null
          student_id: string | null
          student_practice_session_id: string | null
          student_question_set_attempt_id: string | null
          student_question_speed: number | null
          time_burden_seconds: number | null
          time_spent_seconds: number | null
          ucat_section_id: string | null
          was_timed: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_question_answer_option_id_fkey"
            columns: ["question_answer_option_id"]
            isOneToOne: false
            referencedRelation: "question_answer_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ucat_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_practice_session_id_fkey"
            columns: ["student_practice_session_id"]
            isOneToOne: false
            referencedRelation: "student_practice_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_practice_session_id_fkey"
            columns: ["student_practice_session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_practice_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "student_question_set_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_set_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_set_attempt_detail"
            referencedColumns: ["attempt_id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_set_attempts"
            referencedColumns: ["attempt_id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_approved"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_questions_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_generated"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_ucat_my_set_attempts: {
        Row: {
          attempted_at: string | null
          completed_at: string | null
          id: string | null
          question_set_id: string | null
          scaled_score: number | null
          score_points: number | null
          set_speed: number | null
          set_time_limit_at_exam_speed_seconds: number | null
          set_time_limit_seconds: number | null
          student_exam_speed: number | null
          student_id: string | null
          student_set_speed: number | null
          student_ucat_mock_attempt_id: string | null
          time_taken_seconds: number | null
          total_points: number | null
          was_timed: boolean | null
        }
        Insert: {
          attempted_at?: string | null
          completed_at?: string | null
          id?: string | null
          question_set_id?: string | null
          scaled_score?: number | null
          score_points?: number | null
          set_speed?: number | null
          set_time_limit_at_exam_speed_seconds?: number | null
          set_time_limit_seconds?: number | null
          student_exam_speed?: number | null
          student_id?: string | null
          student_set_speed?: number | null
          student_ucat_mock_attempt_id?: string | null
          time_taken_seconds?: number | null
          total_points?: number | null
          was_timed?: boolean | null
        }
        Update: {
          attempted_at?: string | null
          completed_at?: string | null
          id?: string | null
          question_set_id?: string | null
          scaled_score?: number | null
          score_points?: number | null
          set_speed?: number | null
          set_time_limit_at_exam_speed_seconds?: number | null
          set_time_limit_seconds?: number | null
          student_exam_speed?: number | null
          student_id?: string | null
          student_set_speed?: number | null
          student_ucat_mock_attempt_id?: string | null
          time_taken_seconds?: number | null
          total_points?: number | null
          was_timed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_ucat_mock_attempt_id_fkey"
            columns: ["student_ucat_mock_attempt_id"]
            isOneToOne: false
            referencedRelation: "student_ucat_mock_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_ucat_mock_attempt_id_fkey"
            columns: ["student_ucat_mock_attempt_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_mock_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_ucat_mock_attempt_id_fkey"
            columns: ["student_ucat_mock_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_mock_attempt_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_ucat_mock_attempt_id_fkey"
            columns: ["student_ucat_mock_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_mock_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_ucat_public_question_counts: {
        Row: {
          question_stem_category_id: string | null
          section_id: string | null
          total_questions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_question_attempts"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_question_attempts_for_progress"
            referencedColumns: ["ucat_section_id"]
          },
        ]
      }
      vstudent_ucat_question_set_detail: {
        Row: {
          created_at: string | null
          description: Json | null
          id: string | null
          is_student_generated: boolean | null
          name: Json | null
          stems: Json | null
          time_limit_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: Json | null
          id?: string | null
          is_student_generated?: boolean | null
          name?: Json | null
          stems?: never
          time_limit_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: Json | null
          id?: string | null
          is_student_generated?: boolean | null
          name?: Json | null
          stems?: never
          time_limit_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vstudent_ucat_question_sets: {
        Row: {
          created_at: string | null
          description: Json | null
          id: string | null
          is_student_generated: boolean | null
          name: Json | null
          sections: Json | null
          speed: number | null
          time_limit_at_exam_speed_seconds: number | null
          time_limit_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: Json | null
          id?: string | null
          is_student_generated?: boolean | null
          name?: Json | null
          sections?: Json | null
          speed?: number | null
          time_limit_at_exam_speed_seconds?: number | null
          time_limit_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: Json | null
          id?: string | null
          is_student_generated?: boolean | null
          name?: Json | null
          sections?: Json | null
          speed?: number | null
          time_limit_at_exam_speed_seconds?: number | null
          time_limit_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vstudent_ucat_question_stem_categories: {
        Row: {
          id: string | null
          name: string | null
          ucat_section_id: string | null
        }
        Insert: {
          id?: string | null
          name?: string | null
          ucat_section_id?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
          ucat_section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_question_attempts"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_question_attempts_for_progress"
            referencedColumns: ["ucat_section_id"]
          },
        ]
      }
      vstudent_ucat_question_stem_detail: {
        Row: {
          created_at: string | null
          display_columns: number | null
          id: string | null
          question_stem_category_id: string | null
          questions: Json | null
          section_id: string | null
          section_instructions_text: Json | null
          section_instructions_time_limit_seconds: number | null
          section_name: string | null
          section_number: number | null
          section_time_limit_seconds: number | null
          stem_text: Json | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_question_attempts"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_question_attempts_for_progress"
            referencedColumns: ["ucat_section_id"]
          },
        ]
      }
      vstudent_ucat_question_stems: {
        Row: {
          created_at: string | null
          display_columns: number | null
          id: string | null
          question_stem_category_id: string | null
          section_id: string | null
          section_name: string | null
          section_number: number | null
          stem_text: Json | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_question_attempts"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_question_attempts_for_progress"
            referencedColumns: ["ucat_section_id"]
          },
        ]
      }
      vstudent_ucat_sections: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_columns: number | null
          id: string | null
          instructions_text: Json | null
          instructions_time_limit_seconds: number | null
          name: string | null
          number_of_questions: number | null
          section_number: number | null
          time_limit_seconds: number | null
          time_per_question: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_columns?: number | null
          id?: string | null
          instructions_text?: Json | null
          instructions_time_limit_seconds?: number | null
          name?: string | null
          number_of_questions?: number | null
          section_number?: number | null
          time_limit_seconds?: number | null
          time_per_question?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_columns?: number | null
          id?: string | null
          instructions_text?: Json | null
          instructions_time_limit_seconds?: number | null
          name?: string | null
          number_of_questions?: number | null
          section_number?: number | null
          time_limit_seconds?: number | null
          time_per_question?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ucat_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vstudent_ucat_sessions_resources: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string | null
          index: number | null
          question_set_id: string | null
          question_stem_id: string | null
          session_id: string | null
          ucat_mock_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ucat_sessions_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_approved"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_generated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mocks"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_blockouts: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_at: string | null
          id: string | null
          reason: string | null
          staff_id: string | null
          start_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_at?: string | null
          id?: string | null
          reason?: string | null
          staff_id?: string | null
          start_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_at?: string | null
          id?: string | null
          reason?: string | null
          staff_id?: string | null
          start_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_staff_unavailability_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_staff_unavailability_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_staff_unavailability_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_staff_unavailability_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_class_detail: {
        Row: {
          class_id: string | null
          class_level: string | null
          class_status: string | null
          created_at: string | null
          day_of_week: number | null
          end_time: string | null
          long_name: string | null
          room: string | null
          short_name: string | null
          staff: Json | null
          start_time: string | null
          students: Json | null
          subject_color: string | null
          subject_curriculum:
            | Database["public"]["Enums"]["subject_curriculum"]
            | null
          subject_discipline:
            | Database["public"]["Enums"]["subject_discipline"]
            | null
          subject_id: string | null
          subject_level: string | null
          subject_name: string | null
          subject_year_level: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_classes: {
        Row: {
          created_at: string | null
          day_of_week: number | null
          end_time: string | null
          id: string | null
          level: string | null
          long_name: string | null
          room: string | null
          short_name: string | null
          start_time: string | null
          status: string | null
          subject_color: string | null
          subject_curriculum:
            | Database["public"]["Enums"]["subject_curriculum"]
            | null
          subject_discipline:
            | Database["public"]["Enums"]["subject_discipline"]
            | null
          subject_id: string | null
          subject_level: string | null
          subject_name: string | null
          subject_year_level: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_notes: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string | null
          note: Json | null
          staff: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          note?: Json | null
          staff?: never
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          note?: Json | null
          staff?: never
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_notifications: {
        Row: {
          action_url: string | null
          activity_event_id: string | null
          body: string | null
          created_at: string | null
          id: string | null
          notification_type: string | null
          read_at: string | null
          staff_id: string | null
          title: string | null
        }
        Insert: {
          action_url?: string | null
          activity_event_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string | null
          notification_type?: string | null
          read_at?: string | null
          staff_id?: string | null
          title?: string | null
        }
        Update: {
          action_url?: string | null
          activity_event_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string | null
          notification_type?: string | null
          read_at?: string | null
          staff_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_activity_event_id_fkey"
            columns: ["activity_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_profile: {
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
          first_name: string | null
          id: string | null
          last_name: string | null
          phone: string | null
          role: string | null
          status: string | null
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
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
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
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      vtutor_session_detail: {
        Row: {
          class_id: string | null
          class_level: string | null
          class_status: string | null
          day_of_week: number | null
          end_at: string | null
          end_time: string | null
          room: string | null
          session_created_at: string | null
          session_id: string | null
          session_type: Database["public"]["Enums"]["session_type"] | null
          session_updated_at: string | null
          staff: Json | null
          start_at: string | null
          start_time: string | null
          students: Json | null
          subject_color: string | null
          subject_curriculum:
            | Database["public"]["Enums"]["subject_curriculum"]
            | null
          subject_discipline:
            | Database["public"]["Enums"]["subject_discipline"]
            | null
          subject_id: string | null
          subject_level: string | null
          subject_long_name: string | null
          subject_name: string | null
          subject_short_name: string | null
          subject_year_level: number | null
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
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vstudent_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_sessions: {
        Row: {
          class_day_of_week: number | null
          class_end_time: string | null
          class_id: string | null
          class_level: string | null
          class_room: string | null
          class_start_time: string | null
          class_status: string | null
          end_at: string | null
          session_created_at: string | null
          session_id: string | null
          session_type: Database["public"]["Enums"]["session_type"] | null
          session_updated_at: string | null
          start_at: string | null
          subject_color: string | null
          subject_curriculum:
            | Database["public"]["Enums"]["subject_curriculum"]
            | null
          subject_discipline:
            | Database["public"]["Enums"]["subject_discipline"]
            | null
          subject_id: string | null
          subject_level: string | null
          subject_name: string | null
          subject_year_level: number | null
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
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vstudent_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_sessions_students: {
        Row: {
          class_id: string | null
          credited_at: string | null
          credited_by: string | null
          end_at: string | null
          is_credited: boolean | null
          is_rescheduled: boolean | null
          planned_absence: boolean | null
          planned_absence_logged_at: string | null
          rescheduled_at: string | null
          rescheduled_sessions_students_id: string | null
          session_id: string | null
          session_type: Database["public"]["Enums"]["session_type"] | null
          sessions_students_id: string | null
          start_at: string | null
          student_email: string | null
          student_first_name: string | null
          student_id: string | null
          student_last_name: string | null
          subject_id: string | null
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
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vstudent_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_class_detail"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "vtutor_classes"
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
            foreignKeyName: "sessions_students_credited_by_fkey"
            columns: ["credited_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "sessions_students_rescheduled_sessions_students_id_fkey"
            columns: ["rescheduled_sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vadmin_reconciliation_uninvoiced_sessions"
            referencedColumns: ["sessions_students_id"]
          },
          {
            foreignKeyName: "sessions_students_rescheduled_sessions_students_id_fkey"
            columns: ["rescheduled_sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "sessions_students_rescheduled_sessions_students_id_fkey"
            columns: ["rescheduled_sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "sessions_students_rescheduled_sessions_students_id_fkey"
            columns: ["rescheduled_sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_student_id"]
          },
          {
            foreignKeyName: "sessions_students_rescheduled_sessions_students_id_fkey"
            columns: ["rescheduled_sessions_students_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions_students"
            referencedColumns: ["sessions_students_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "sessions_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_students: {
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
          curriculum: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          school: string | null
          status: string | null
          updated_at: string | null
          year_level: number | null
        }
        Relationships: []
      }
      vtutor_subjects: {
        Row: {
          color: string | null
          created_at: string | null
          curriculum: Database["public"]["Enums"]["subject_curriculum"] | null
          discipline: Database["public"]["Enums"]["subject_discipline"] | null
          id: string | null
          level: string | null
          long_name: string | null
          name: string | null
          short_name: string | null
          updated_at: string | null
          year_level: number | null
        }
        Relationships: []
      }
      vtutor_topics: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          index: number | null
          name: string | null
          parent_id: string | null
          subject_id: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          index?: number | null
          name?: string | null
          parent_id?: string | null
          subject_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          index?: number | null
          name?: string | null
          parent_id?: string | null
          subject_id?: string | null
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
            foreignKeyName: "topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "vstudent_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "vtutor_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vstudent_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "vtutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_topics_files: {
        Row: {
          bucket: string | null
          code: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          file_id: string | null
          file_metadata: Json | null
          filename: string | null
          id: string | null
          index: number | null
          is_solutions: boolean | null
          is_solutions_of_id: string | null
          mimetype: string | null
          size_bytes: number | null
          storage_path: string | null
          storage_provider: string | null
          topic_id: string | null
          type: Database["public"]["Enums"]["resource_type"] | null
          updated_at: string | null
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
            foreignKeyName: "topics_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
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
            foreignKeyName: "topics_files_is_solutions_of_id_fkey"
            columns: ["is_solutions_of_id"]
            isOneToOne: false
            referencedRelation: "vstudent_topics_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_is_solutions_of_id_fkey"
            columns: ["is_solutions_of_id"]
            isOneToOne: false
            referencedRelation: "vtutor_topics_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "vstudent_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_files_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "vtutor_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_tutor_log: {
        Row: {
          created_by: string | null
          files: Json | null
          notes: Json | null
          session_id: string | null
          staff_attendance: Json | null
          student_attendance: Json | null
          topics: Json | null
          tutor_log_created_at: string | null
          tutor_log_id: string | null
          tutor_log_updated_at: string | null
        }
        Insert: {
          created_by?: string | null
          files?: never
          notes?: never
          session_id?: string | null
          staff_attendance?: never
          student_attendance?: never
          topics?: never
          tutor_log_created_at?: string | null
          tutor_log_id?: string | null
          tutor_log_updated_at?: string | null
        }
        Update: {
          created_by?: string | null
          files?: never
          notes?: never
          session_id?: string | null
          staff_attendance?: never
          student_attendance?: never
          topics?: never
          tutor_log_created_at?: string | null
          tutor_log_id?: string | null
          tutor_log_updated_at?: string | null
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
            foreignKeyName: "tutor_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "tutor_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      vtutor_ucat_mock_detail: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string | null
          instructions_text: Json | null
          is_private: boolean | null
          name: string | null
          sets: Json | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string | null
          instructions_text?: Json | null
          is_private?: boolean | null
          name?: string | null
          sets?: never
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string | null
          instructions_text?: Json | null
          is_private?: boolean | null
          name?: string | null
          sets?: never
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ucat_mocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_mocks: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string | null
          is_private: boolean | null
          name: string | null
          set_count: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string | null
          is_private?: boolean | null
          name?: string | null
          set_count?: never
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string | null
          is_private?: boolean | null
          name?: string | null
          set_count?: never
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ucat_mocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_mocks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_question_set_detail: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: Json | null
          id: string | null
          is_private: boolean | null
          is_student_generated: boolean | null
          name: Json | null
          stems: Json | null
          time_limit_seconds: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: Json | null
          id?: string | null
          is_private?: boolean | null
          is_student_generated?: boolean | null
          name?: Json | null
          stems?: never
          time_limit_seconds?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: Json | null
          id?: string | null
          is_private?: boolean | null
          is_student_generated?: boolean | null
          name?: Json | null
          stems?: never
          time_limit_seconds?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_question_sets: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_first_name: string | null
          created_by_last_name: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: Json | null
          id: string | null
          is_private: boolean | null
          is_student_generated: boolean | null
          name: Json | null
          question_count: number | null
          sections: Json | null
          speed: number | null
          stem_count: number | null
          time_limit_at_exam_speed_seconds: number | null
          time_limit_seconds: number | null
          ucat_mock_ids: Json | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_sets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_question_stem_categories: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: Json | null
          id: string | null
          name: string | null
          parent_question_stem_category_id: string | null
          question_stem_count: number | null
          ucat_section_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: Json | null
          id?: string | null
          name?: string | null
          parent_question_stem_category_id?: string | null
          question_stem_count?: never
          ucat_section_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: Json | null
          id?: string | null
          name?: string | null
          parent_question_stem_category_id?: string | null
          question_stem_count?: never
          ucat_section_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stem_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_parent_question_stem_category_id_fkey"
            columns: ["parent_question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_parent_question_stem_category_id_fkey"
            columns: ["parent_question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_parent_question_stem_category_id_fkey"
            columns: ["parent_question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_question_attempts"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_ucat_section_id_fkey"
            columns: ["ucat_section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_question_attempts_for_progress"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stem_categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stem_categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_question_stem_detail: {
        Row: {
          ai_generation_metadata: Json | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          category_name: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          display_columns: number | null
          id: string | null
          is_ai_generated: boolean | null
          is_private: boolean | null
          question_stem_category_id: string | null
          questions: Json | null
          section_id: string | null
          section_name: string | null
          section_number: number | null
          stem_text: Json | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stems_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_question_attempts"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_question_attempts_for_progress"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stems_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_question_stems: {
        Row: {
          ai_generation_metadata: Json | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          approved_by_first_name: string | null
          approved_by_last_name: string | null
          category_name: string | null
          created_at: string | null
          created_by: string | null
          created_by_first_name: string | null
          created_by_last_name: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string | null
          is_ai_generated: boolean | null
          is_private: boolean | null
          question_count: number | null
          question_stem_category_id: string | null
          section_display_columns: number | null
          section_id: string | null
          section_name: string | null
          section_number: number | null
          set_ids: Json | null
          set_names: Json | null
          stem_text: Json | null
          updated_at: string | null
          updated_by: string | null
          updated_by_first_name: string | null
          updated_by_last_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stems_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_question_attempts"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_question_attempts_for_progress"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stems_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_question_stems_approved: {
        Row: {
          ai_generation_metadata: Json | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          approved_by_first_name: string | null
          approved_by_last_name: string | null
          category_name: string | null
          created_at: string | null
          created_by: string | null
          created_by_first_name: string | null
          created_by_last_name: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string | null
          is_ai_generated: boolean | null
          is_private: boolean | null
          question_count: number | null
          question_stem_category_id: string | null
          section_display_columns: number | null
          section_id: string | null
          section_name: string | null
          section_number: number | null
          set_ids: Json | null
          set_names: Json | null
          stem_text: Json | null
          updated_at: string | null
          updated_by: string | null
          updated_by_first_name: string | null
          updated_by_last_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stems_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_question_attempts"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_question_attempts_for_progress"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stems_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_question_stems_generated: {
        Row: {
          ai_generation_metadata: Json | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          approved_by_first_name: string | null
          approved_by_last_name: string | null
          category_name: string | null
          created_at: string | null
          created_by: string | null
          created_by_first_name: string | null
          created_by_last_name: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string | null
          is_ai_generated: boolean | null
          is_private: boolean | null
          question_count: number | null
          question_stem_category_id: string | null
          section_display_columns: number | null
          section_id: string | null
          section_name: string | null
          section_number: number | null
          set_ids: Json | null
          set_names: Json | null
          stem_text: Json | null
          updated_at: string | null
          updated_by: string | null
          updated_by_first_name: string | null
          updated_by_last_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stems_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_question_attempts"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_question_attempts_for_progress"
            referencedColumns: ["ucat_section_id"]
          },
          {
            foreignKeyName: "question_stems_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_question_tags: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: Json | null
          id: string | null
          name: string | null
          parent_question_tag_id: string | null
          question_count: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: Json | null
          id?: string | null
          name?: string | null
          parent_question_tag_id?: string | null
          question_count?: never
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: Json | null
          id?: string | null
          name?: string | null
          parent_question_tag_id?: string | null
          question_count?: never
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_parent_question_tag_id_fkey"
            columns: ["parent_question_tag_id"]
            isOneToOne: false
            referencedRelation: "question_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_parent_question_tag_id_fkey"
            columns: ["parent_question_tag_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_sections: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_columns: number | null
          id: string | null
          instructions_text: Json | null
          instructions_time_limit_seconds: number | null
          name: string | null
          number_of_questions: number | null
          section_number: number | null
          time_limit_seconds: number | null
          time_per_question: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_columns?: number | null
          id?: string | null
          instructions_text?: Json | null
          instructions_time_limit_seconds?: number | null
          name?: string | null
          number_of_questions?: number | null
          section_number?: number | null
          time_limit_seconds?: number | null
          time_per_question?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_columns?: number | null
          id?: string | null
          instructions_text?: Json | null
          instructions_time_limit_seconds?: number | null
          name?: string | null
          number_of_questions?: number | null
          section_number?: number | null
          time_limit_seconds?: number | null
          time_per_question?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ucat_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sections_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_sessions_resources: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string | null
          index: number | null
          question_set_id: string | null
          question_stem_id: string | null
          session_id: string | null
          ucat_mock_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          index?: number | null
          question_set_id?: string | null
          question_stem_id?: string | null
          session_id?: string | null
          ucat_mock_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          index?: number | null
          question_set_id?: string | null
          question_stem_id?: string | null
          session_id?: string | null
          ucat_mock_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ucat_sessions_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vtutor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_approved"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_question_stem_id_fkey"
            columns: ["question_stem_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stems_generated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_base"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vstudent_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_session_detail"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vtutor_sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ucat_sessions_resources_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mocks"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_student_mock_attempt_detail: {
        Row: {
          attempted_at: string | null
          completed_at: string | null
          id: string | null
          mock_name: string | null
          set_attempts: Json | null
          student_id: string | null
          student_name: string | null
          ucat_mock_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mocks"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_student_mock_attempts: {
        Row: {
          attempted_at: string | null
          completed_at: string | null
          id: string | null
          mock_name: string | null
          student_id: string | null
          student_name: string | null
          ucat_mock_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_mocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mock_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ucat_mock_attempts_ucat_mock_id_fkey"
            columns: ["ucat_mock_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_mocks"
            referencedColumns: ["id"]
          },
        ]
      }
      vtutor_ucat_student_progress_summary: {
        Row: {
          avg_scaled_score: number | null
          avg_score_points: number | null
          last_attempted_at: string | null
          student_id: string | null
          student_name: string | null
          total_mocks_attempted: number | null
          total_sets_attempted: number | null
        }
        Insert: {
          avg_scaled_score?: never
          avg_score_points?: never
          last_attempted_at?: never
          student_id?: string | null
          student_name?: never
          total_mocks_attempted?: never
          total_sets_attempted?: never
        }
        Update: {
          avg_scaled_score?: never
          avg_score_points?: never
          last_attempted_at?: never
          student_id?: string | null
          student_name?: never
          total_mocks_attempted?: never
          total_sets_attempted?: never
        }
        Relationships: []
      }
      vtutor_ucat_student_question_attempts: {
        Row: {
          answer_snapshot: Json | null
          attempted_at: string | null
          id: string | null
          is_flagged: boolean | null
          is_submitted: boolean | null
          mode: string | null
          question_answer_option_id: string | null
          question_id: string | null
          score: number | null
          student_first_name: string | null
          student_id: string | null
          student_last_name: string | null
          student_question_set_attempt_id: string | null
          student_question_speed: number | null
          time_spent_seconds: number | null
          was_timed: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "student_question_attempts_question_answer_option_id_fkey"
            columns: ["question_answer_option_id"]
            isOneToOne: false
            referencedRelation: "question_answer_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ucat_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "student_question_set_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_set_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_set_attempt_detail"
            referencedColumns: ["attempt_id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_set_attempts"
            referencedColumns: ["attempt_id"]
          },
        ]
      }
      vtutor_ucat_student_question_attempts_for_progress: {
        Row: {
          answer_snapshot: Json | null
          attempted_at: string | null
          category_name: string | null
          id: string | null
          is_flagged: boolean | null
          is_submitted: boolean | null
          mode: string | null
          question_answer_option_id: string | null
          question_id: string | null
          question_stem_category_id: string | null
          question_type:
            | Database["public"]["Enums"]["ucat_question_type"]
            | null
          score: number | null
          section_name: string | null
          section_number: number | null
          student_first_name: string | null
          student_id: string | null
          student_last_name: string | null
          student_question_set_attempt_id: string | null
          student_question_speed: number | null
          time_spent_seconds: number | null
          ucat_section_id: string | null
          was_timed: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_stems_question_stem_category_id_fkey"
            columns: ["question_stem_category_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_stem_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_question_answer_option_id_fkey"
            columns: ["question_answer_option_id"]
            isOneToOne: false
            referencedRelation: "question_answer_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "ucat_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "student_question_set_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_set_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_set_attempt_detail"
            referencedColumns: ["attempt_id"]
          },
          {
            foreignKeyName: "student_question_attempts_student_question_set_attempt_id_fkey"
            columns: ["student_question_set_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_set_attempts"
            referencedColumns: ["attempt_id"]
          },
        ]
      }
      vtutor_ucat_student_set_attempt_detail: {
        Row: {
          attempt_id: string | null
          attempted_at: string | null
          completed_at: string | null
          question_set_id: string | null
          questions: Json | null
          scaled_score: number | null
          score_points: number | null
          set_description: Json | null
          set_speed: number | null
          set_time_limit_at_exam_speed_seconds: number | null
          set_time_limit_seconds: number | null
          student_exam_speed: number | null
          student_id: string | null
          student_name: string | null
          student_set_speed: number | null
          time_taken_seconds: number | null
          total_points: number | null
          was_timed: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["question_set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
        ]
      }
      vtutor_ucat_student_set_attempts: {
        Row: {
          attempt_id: string | null
          attempted_at: string | null
          completed_at: string | null
          scaled_score: number | null
          score_points: number | null
          set_id: string | null
          set_name: Json | null
          set_speed: number | null
          set_time_limit_at_exam_speed_seconds: number | null
          set_time_limit_seconds: number | null
          student_exam_speed: number | null
          student_id: string | null
          student_name: string | null
          student_set_speed: number | null
          student_ucat_mock_attempt_id: string | null
          time_taken_seconds: number | null
          total_points: number | null
          was_timed: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_set_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_question_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vstudent_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_progress_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_ucat_mock_attempt_id_fkey"
            columns: ["student_ucat_mock_attempt_id"]
            isOneToOne: false
            referencedRelation: "student_ucat_mock_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_ucat_mock_attempt_id_fkey"
            columns: ["student_ucat_mock_attempt_id"]
            isOneToOne: false
            referencedRelation: "vstudent_ucat_my_mock_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_ucat_mock_attempt_id_fkey"
            columns: ["student_ucat_mock_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_mock_attempt_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_question_set_attempts_student_ucat_mock_attempt_id_fkey"
            columns: ["student_ucat_mock_attempt_id"]
            isOneToOne: false
            referencedRelation: "vtutor_ucat_student_mock_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _format_date_ordinal: { Args: { ts: string }; Returns: string }
      assign_staff_to_booking: {
        Args: {
          p_available_staff_ids: string[]
          p_end_at: string
          p_session_type: Database["public"]["Enums"]["session_type"]
          p_start_at: string
          p_subject_id?: string
        }
        Returns: string
      }
      batch_update_topic_file_indices: {
        Args: { updates: Json }
        Returns: undefined
      }
      batch_update_topic_indices: {
        Args: { updates: Json }
        Returns: undefined
      }
      build_fuzzy_like: { Args: { p_text: string }; Returns: string }
      calculate_session_price: {
        Args: {
          p_billing_type: Database["public"]["Enums"]["billing_type"]
          p_end_at: string
          p_start_at: string
          p_subject_id: string
        }
        Returns: Json
      }
      calculate_topic_code: { Args: { p_topic_id: string }; Returns: string }
      calculate_topic_file_code: {
        Args: { p_topic_file_id: string }
        Returns: string
      }
      can_current_tutor_view_ucat_student: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      can_student_access_session_file: {
        Args: { session_id: string }
        Returns: boolean
      }
      can_student_access_ucat_image: {
        Args: { p_stem_id: string }
        Returns: boolean
      }
      can_student_access_ucat_mock: {
        Args: { p_ucat_mock_id: string }
        Returns: boolean
      }
      can_student_access_ucat_question_set: {
        Args: { p_question_set_id: string }
        Returns: boolean
      }
      can_student_access_ucat_question_stem: {
        Args: { p_question_stem_id: string }
        Returns: boolean
      }
      can_student_read_file: { Args: { file_path: string }; Returns: boolean }
      can_tutor_access_session_file: {
        Args: { session_id: string }
        Returns: boolean
      }
      can_tutor_access_subject: {
        Args: { subject_id: string }
        Returns: boolean
      }
      can_tutor_create_file: { Args: { file_path: string }; Returns: boolean }
      can_tutor_read_file: { Args: { file_path: string }; Returns: boolean }
      cleanup_expired_reservations: { Args: never; Returns: number }
      cleanup_session_files: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      complete_student_registration: {
        Args: {
          p_availability_friday?: boolean
          p_availability_monday?: boolean
          p_availability_saturday_am?: boolean
          p_availability_saturday_pm?: boolean
          p_availability_sunday_am?: boolean
          p_availability_sunday_pm?: boolean
          p_availability_thursday?: boolean
          p_availability_tuesday?: boolean
          p_availability_wednesday?: boolean
          p_curriculum?: string
          p_parents?: Json
          p_school?: string
          p_student_email: string
          p_student_first_name: string
          p_student_last_name: string
          p_student_phone: string
          p_subject_ids?: string[]
          p_token: string
          p_year_level?: number
        }
        Returns: Json
      }
      count_submitted_attempts_today: {
        Args: { p_student_id: string; p_timezone?: string }
        Returns: number
      }
      create_admin_trial_booking: {
        Args: {
          p_created_by: string
          p_curriculum?: string
          p_end_at: string
          p_parent_email?: string
          p_parent_first_name?: string
          p_parent_last_name?: string
          p_parent_phone?: string
          p_skip_parent_details?: boolean
          p_staff_id?: string
          p_start_at: string
          p_student_email?: string
          p_student_first_name: string
          p_student_last_name: string
          p_student_phone: string
          p_subject_ids?: string[]
          p_year_level?: number
        }
        Returns: Json
      }
      create_booking_session: {
        Args: {
          p_bypass_date_restrictions?: boolean
          p_created_by?: string
          p_end_at: string
          p_reservation_id?: string
          p_session_type: Database["public"]["Enums"]["session_type"]
          p_staff_id?: string
          p_start_at: string
          p_student_id: string
          p_subject_id?: string
        }
        Returns: string
      }
      create_public_trial_booking: {
        Args: {
          p_curriculum: string
          p_end_at: string
          p_parent_email?: string
          p_parent_first_name?: string
          p_parent_last_name?: string
          p_parent_phone?: string
          p_start_at: string
          p_student_email: string
          p_student_first_name: string
          p_student_last_name: string
          p_student_phone: string
          p_subject_ids?: string[]
          p_year_level?: number
        }
        Returns: Json
      }
      create_tutor_log: {
        Args: {
          p_created_by: string
          p_notes?: Json
          p_session_id: string
          p_staff_attendance?: Json
          p_student_attendance?: Json
          p_topic_files?: Json
          p_topics?: Json
        }
        Returns: Json
      }
      current_staff_id: { Args: never; Returns: string }
      current_student_id: { Args: never; Returns: string }
      current_tutor_id: { Args: never; Returns: string }
      discontinue_student: {
        Args: { p_discontinued_by: string; p_student_id: string }
        Returns: Json
      }
      enroll_student_in_class: {
        Args: {
          p_class_id: string
          p_enrolled_at: string
          p_enrolled_by: string
          p_student_id: string
        }
        Returns: string
      }
      extract_image_file_ids_from_doc: {
        Args: { p_doc: Json }
        Returns: string[]
      }
      extract_text_from_prosemirror_json: {
        Args: { json_content: Json }
        Returns: string
      }
      format_class_full_name:
        | {
            Args: {
              p_curriculum: Database["public"]["Enums"]["subject_curriculum"]
              p_day_of_week: number
              p_end_time: string
              p_name: string
              p_start_time: string
              p_year_level: number
            }
            Returns: string
          }
        | {
            Args: {
              p_curriculum: Database["public"]["Enums"]["subject_curriculum"]
              p_day_of_week: number
              p_end_time: string
              p_name: string
              p_start_time: string
              p_year_level: number
            }
            Returns: string
          }
      format_class_short_name:
        | {
            Args: {
              p_curriculum: Database["public"]["Enums"]["subject_curriculum"]
              p_day_of_week: number
              p_name: string
              p_start_time: string
              p_year_level: number
            }
            Returns: string
          }
        | {
            Args: {
              p_curriculum: Database["public"]["Enums"]["subject_curriculum"]
              p_day_of_week: number
              p_name: string
              p_start_time: string
              p_year_level: number
            }
            Returns: string
          }
      format_day_full_name: { Args: { p_day_of_week: number }; Returns: string }
      format_day_short_name: {
        Args: { p_day_of_week: number }
        Returns: string
      }
      format_subject_long_name: {
        Args: {
          p_curriculum: string
          p_level: string
          p_name: string
          p_year_level: number
        }
        Returns: string
      }
      format_subject_short_name: {
        Args: { p_curriculum: string; p_name: string; p_year_level: number }
        Returns: string
      }
      get_available_reschedule_sessions: {
        Args: {
          p_date_range_days?: number
          p_original_session_id: string
          p_student_id: string
        }
        Returns: Json
      }
      get_available_slots: {
        Args: {
          p_bypass_date_restrictions?: boolean
          p_duration_minutes?: number
          p_end_date: string
          p_session_type: Database["public"]["Enums"]["session_type"]
          p_start_date: string
          p_subject_id?: string
        }
        Returns: {
          available_staff_ids: string[]
          end_at: string
          is_available: boolean
          start_at: string
        }[]
      }
      get_billing_cron_secret: { Args: never; Returns: string }
      get_excluded_fields_for_table: {
        Args: { table_name: string }
        Returns: string[]
      }
      get_invoiced_sessions_students_ids: {
        Args: { p_sessions_students_ids: string[] }
        Returns: string[]
      }
      get_service_role_key: { Args: never; Returns: string }
      get_session_id_from_storage_path: {
        Args: { file_path: string }
        Returns: string
      }
      get_staff_id_from_storage_path: {
        Args: { file_path: string }
        Returns: string
      }
      get_student_subjects: {
        Args: { student_id: string }
        Returns: {
          color: string | null
          created_at: string | null
          curriculum: Database["public"]["Enums"]["subject_curriculum"] | null
          discipline: Database["public"]["Enums"]["subject_discipline"] | null
          id: string
          level: string | null
          long_name: string | null
          name: string
          short_name: string | null
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
          long_name: string | null
          name: string
          short_name: string | null
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
      get_supabase_url: { Args: never; Returns: string }
      get_ucat_stem_id_from_image_path: {
        Args: { file_path: string }
        Returns: string
      }
      has_student_selected_subjects: {
        Args: { student_id: string }
        Returns: boolean
      }
      is_adminstaff_active: { Args: never; Returns: boolean }
      is_student: { Args: never; Returns: boolean }
      is_tutor: { Args: never; Returns: boolean }
      is_ucat_in_person_student: { Args: never; Returns: boolean }
      is_ucat_online_student: { Args: never; Returns: boolean }
      is_ucat_student: { Args: never; Returns: boolean }
      is_ucat_tutor: { Args: never; Returns: boolean }
      log_activity_event: {
        Args: {
          p_changed_fields?: Json
          p_class_id?: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_metadata?: Json
          p_parent_id?: string
          p_session_id?: string
          p_staff_id?: string
          p_student_id?: string
          p_task_id?: string
        }
        Returns: string
      }
      log_staff_absences: {
        Args: { logged_by_staff_id: string; operations: Json }
        Returns: Json
      }
      log_student_absences: {
        Args: { logged_by_staff_id: string; operations: Json }
        Returns: Json
      }
      log_student_absences_self: {
        Args: { logged_by_student_id: string; operations: Json }
        Returns: Json
      }
      map_day_to_number: { Args: { day_string: string }; Returns: number }
      map_subject_to_id: { Args: { subject_code: string }; Returns: string }
      map_tutor_to_id: {
        Args: { first_name: string; last_name: string }
        Returns: string
      }
      migrate_text_to_tiptap_jsonb: { Args: { val: string }; Returns: Json }
      precreate_admin_shift_sessions: {
        Args: {
          end_date: string
          p_admin_shift_id?: string
          p_created_by?: string
          start_date: string
        }
        Returns: number
      }
      precreate_sessions: {
        Args: {
          end_date: string
          p_class_id?: string
          p_created_by?: string
          start_date: string
        }
        Returns: number
      }
      re_enroll_student: { Args: { p_student_id: string }; Returns: Json }
      recalculate_topic_code_and_descendants: {
        Args: { p_topic_id: string }
        Returns: undefined
      }
      recalculate_topic_file_codes_for_topic: {
        Args: { p_topic_id: string }
        Returns: undefined
      }
      recalculate_topic_file_codes_for_topic_and_descendants: {
        Args: { p_topic_id: string }
        Returns: undefined
      }
      recalculate_topic_file_indices_for_siblings: {
        Args: {
          p_is_solutions: boolean
          p_topic_id: string
          p_type: Database["public"]["Enums"]["resource_type"]
        }
        Returns: undefined
      }
      recalculate_topic_indices_for_siblings: {
        Args: { p_parent_id: string; p_subject_id: string }
        Returns: undefined
      }
      reschedule_drafting_session: {
        Args: {
          p_bypass_date_restrictions?: boolean
          p_created_by?: string
          p_end_at: string
          p_original_session_id: string
          p_reservation_id?: string
          p_staff_id?: string
          p_start_at: string
          p_student_id: string
          p_subject_id?: string
        }
        Returns: string
      }
      reschedule_session: {
        Args: {
          p_bypass_date_restrictions?: boolean
          p_created_by?: string
          p_end_at: string
          p_original_session_id: string
          p_reservation_id?: string
          p_session_type: Database["public"]["Enums"]["session_type"]
          p_staff_id?: string
          p_start_at: string
          p_student_id: string
          p_subject_id?: string
        }
        Returns: string
      }
      safe_text_to_jsonb: { Args: { text_content: string }; Returns: Json }
      search_classes_admin: {
        Args: {
          p_ascending?: boolean
          p_exclude_staff_search?: boolean
          p_exclude_student_search?: boolean
          p_include_relationships?: boolean
          p_limit?: number
          p_offset?: number
          p_order_by?: string
          p_search?: string
          p_staff_ids?: string[]
          p_statuses?: string[]
          p_student_ids?: string[]
          p_subject_ids?: string[]
        }
        Returns: Json
      }
      search_files_admin: {
        Args: {
          p_file_types?: string[]
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_subject_ids?: string[]
          p_topic_ids?: string[]
        }
        Returns: Json
      }
      search_invoices_admin: {
        Args: {
          p_ascending?: boolean
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_offset?: number
          p_order_by?: string
          p_statuses?: string[]
          p_student_ids?: string[]
        }
        Returns: Json
      }
      search_parents_admin: {
        Args: {
          p_ascending?: boolean
          p_include_relationships?: boolean
          p_limit?: number
          p_offset?: number
          p_order_by?: string
          p_search?: string
        }
        Returns: Json
      }
      search_sessions_admin: {
        Args: {
          p_admin_shift_id?: string
          p_ascending?: boolean
          p_class_id?: string
          p_include_relationships?: boolean
          p_limit?: number
          p_offset?: number
          p_order_by?: string
          p_range_end?: string
          p_range_start?: string
          p_search?: string
          p_staff_id?: string
          p_statuses?: string[]
          p_student_id?: string
          p_types?: string[]
        }
        Returns: Json
      }
      search_staff_admin: {
        Args: {
          p_ascending?: boolean
          p_exclude_class_search?: boolean
          p_include_relationships?: boolean
          p_limit?: number
          p_offset?: number
          p_order_by?: string
          p_search?: string
          p_statuses?: string[]
          p_subject_ids?: string[]
        }
        Returns: Json
      }
      search_students_admin: {
        Args: {
          p_ascending?: boolean
          p_exclude_class_search?: boolean
          p_in_person_filter?: string
          p_include_relationships?: boolean
          p_limit?: number
          p_offset?: number
          p_order_by?: string
          p_search?: string
          p_statuses?: string[]
          p_subject_ids?: string[]
          p_subscription_filter?: string
        }
        Returns: Json
      }
      search_subjects_admin: {
        Args: {
          p_ascending?: boolean
          p_curriculums?: string[]
          p_disciplines?: string[]
          p_levels?: string[]
          p_limit?: number
          p_offset?: number
          p_order_by?: string
          p_search?: string
          p_year_levels?: number[]
        }
        Returns: Json
      }
      search_subjects_public: {
        Args: {
          p_ascending?: boolean
          p_curriculums?: string[]
          p_disciplines?: string[]
          p_levels?: string[]
          p_limit?: number
          p_offset?: number
          p_order_by?: string
          p_search?: string
          p_year_levels?: number[]
        }
        Returns: Json
      }
      search_topics_admin: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_subject_ids?: string[]
        }
        Returns: Json
      }
      search_tutor_logs_admin: {
        Args: {
          p_ascending?: boolean
          p_limit?: number
          p_offset?: number
          p_order_by?: string
          p_range_end?: string
          p_range_start?: string
          p_search?: string
          p_staff_id?: string
        }
        Returns: Json
      }
      set_claim: {
        Args: { claim: string; uid: string; value: Json }
        Returns: undefined
      }
      staff_full_name_lower: {
        Args: { p_first_name: string; p_last_name: string }
        Returns: string
      }
      standardize_au_phone: { Args: { phone_input: string }; Returns: string }
      student_full_name_lower: {
        Args: { p_first_name: string; p_last_name: string }
        Returns: string
      }
      tutor_ucat_assign_mock_sessions: {
        Args: { p_mock_id: string; p_session_ids: Json }
        Returns: undefined
      }
      tutor_ucat_assign_set_sessions: {
        Args: { p_session_ids: Json; p_set_id: string }
        Returns: undefined
      }
      tutor_ucat_assign_stem_sessions: {
        Args: { p_session_ids: Json; p_stem_id: string }
        Returns: undefined
      }
      tutor_ucat_bulk_delete_mocks: {
        Args: { p_mock_ids: string[] }
        Returns: undefined
      }
      tutor_ucat_bulk_delete_question_sets: {
        Args: { p_set_ids: string[] }
        Returns: undefined
      }
      tutor_ucat_bulk_delete_question_stems: {
        Args: { p_stem_ids: string[] }
        Returns: undefined
      }
      tutor_ucat_bulk_update_question_stem_metadata: {
        Args: {
          p_is_private?: boolean
          p_question_stem_category_id?: string
          p_stem_ids: string[]
        }
        Returns: undefined
      }
      tutor_ucat_bulk_upsert_generated_question_stem_bundles: {
        Args: { p_section_id: string; p_stems: Json }
        Returns: string[]
      }
      tutor_ucat_bulk_upsert_question_stem_bundles: {
        Args: { p_section_id: string; p_stems: Json }
        Returns: string[]
      }
      tutor_ucat_delete_mock: {
        Args: { p_mock_id: string }
        Returns: undefined
      }
      tutor_ucat_delete_question_set: {
        Args: { p_set_id: string }
        Returns: undefined
      }
      tutor_ucat_delete_question_stem: {
        Args: { p_stem_id: string }
        Returns: undefined
      }
      tutor_ucat_replace_sessions_resources: {
        Args: { p_assignments: Json }
        Returns: undefined
      }
      tutor_ucat_restore_mock: {
        Args: { p_mock_id: string }
        Returns: undefined
      }
      tutor_ucat_restore_question_set: {
        Args: { p_set_id: string }
        Returns: undefined
      }
      tutor_ucat_restore_question_stem: {
        Args: { p_stem_id: string }
        Returns: undefined
      }
      tutor_ucat_set_question_stem_approval: {
        Args: {
          p_approval_status: string
          p_auto_publish_on_approval?: boolean
          p_stem_id: string
        }
        Returns: undefined
      }
      tutor_ucat_upsert_mock:
        | {
            Args: {
              p_is_private: boolean
              p_mock_id: string
              p_name: string
              p_set_ids: Json
            }
            Returns: string
          }
        | {
            Args: {
              p_instructions_text?: Json
              p_is_private: boolean
              p_mock_id: string
              p_name: string
              p_set_ids: Json
            }
            Returns: string
          }
      tutor_ucat_upsert_question_set: {
        Args: {
          p_description: Json
          p_is_private: boolean
          p_is_student_generated: boolean
          p_name: Json
          p_set_id: string
          p_stem_ids: Json
          p_time_limit_seconds: number
        }
        Returns: string
      }
      tutor_ucat_upsert_question_stem_bundle: {
        Args: {
          p_is_private: boolean
          p_question_stem_category_id: string
          p_questions: Json
          p_section_id: string
          p_stem_id: string
          p_stem_text: Json
        }
        Returns: string
      }
      ucat_recompute_question_set_timing: {
        Args: { p_question_set_id: string }
        Returns: undefined
      }
      undo_staff_absences: {
        Args: { logged_by_staff_id: string; operations: Json }
        Returns: Json
      }
      undo_student_absences: {
        Args: { logged_by_staff_id: string; operations: Json }
        Returns: Json
      }
      validate_all_topic_codes: {
        Args: never
        Returns: {
          calculated_code: string
          is_valid: boolean
          stored_code: string
          topic_id: string
        }[]
      }
      validate_all_topic_file_codes: {
        Args: never
        Returns: {
          calculated_code: string
          is_valid: boolean
          stored_code: string
          topic_file_id: string
        }[]
      }
      validate_phone_e164: { Args: { phone: string }; Returns: boolean }
      verify_email: { Args: { user_email: string }; Returns: undefined }
    }
    Enums: {
      billing_type: "CLASS" | "EXAM_COURSE" | "DRAFTING"
      invoice_billing_source: "session_runner" | "subscription"
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
      session_type:
        | "CLASS"
        | "DRAFTING"
        | "EXAM_COURSE"
        | "SUBSIDY_INTERVIEW"
        | "TRIAL_SESSION"
        | "STAFF_INTERVIEW"
        | "ADMIN_SHIFT"
      subject_curriculum: "SACE" | "IB" | "PRESACE" | "PRIMARY" | "MEDICINE"
      subject_discipline:
        | "MATHEMATICS"
        | "SCIENCE"
        | "HUMANITIES"
        | "ENGLISH"
        | "ART"
        | "LANGUAGE"
        | "MEDICINE"
      ucat_question_type: "multiple_choice" | "syllogism"
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
      billing_type: ["CLASS", "EXAM_COURSE", "DRAFTING"],
      invoice_billing_source: ["session_runner", "subscription"],
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
      session_type: [
        "CLASS",
        "DRAFTING",
        "EXAM_COURSE",
        "SUBSIDY_INTERVIEW",
        "TRIAL_SESSION",
        "STAFF_INTERVIEW",
        "ADMIN_SHIFT",
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
      ucat_question_type: ["multiple_choice", "syllogism"],
    },
  },
} as const
