export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      absences: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          is_rescheduled: boolean
          missed_session_id: string | null
          reason: string | null
          rescheduled_session_id: string | null
          student_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          id: string
          is_rescheduled?: boolean
          missed_session_id?: string | null
          reason?: string | null
          rescheduled_session_id?: string | null
          student_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          is_rescheduled?: boolean
          missed_session_id?: string | null
          reason?: string | null
          rescheduled_session_id?: string | null
          student_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_missed_session_id_fkey"
            columns: ["missed_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_rescheduled_session_id_fkey"
            columns: ["rescheduled_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
          notes: string | null
          room: string | null
          start_time: string
          status: string
          subject: string
          subject_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          day_of_week: number
          end_time: string
          id: string
          notes?: string | null
          room?: string | null
          start_time: string
          status: string
          subject: string
          subject_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          notes?: string | null
          room?: string | null
          start_time?: string
          status?: string
          subject?: string
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
      classes_audit_logs: {
        Row: {
          action: string
          class_id: string
          created_at: string | null
          details: Json
          id: string
        }
        Insert: {
          action: string
          class_id: string
          created_at?: string | null
          details: Json
          id: string
        }
        Update: {
          action?: string
          class_id?: string
          created_at?: string | null
          details?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_audit_logs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
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
      resource_files: {
        Row: {
          answers: Database["public"]["Enums"]["resource_answers"]
          created_at: string | null
          file_url: string
          id: string
          number: number | null
          subtopic_id: string | null
          topic_id: string | null
          type: Database["public"]["Enums"]["resource_type"]
          updated_at: string | null
        }
        Insert: {
          answers?: Database["public"]["Enums"]["resource_answers"]
          created_at?: string | null
          file_url: string
          id?: string
          number?: number | null
          subtopic_id?: string | null
          topic_id?: string | null
          type: Database["public"]["Enums"]["resource_type"]
          updated_at?: string | null
        }
        Update: {
          answers?: Database["public"]["Enums"]["resource_answers"]
          created_at?: string | null
          file_url?: string
          id?: string
          number?: number | null
          subtopic_id?: string | null
          topic_id?: string | null
          type?: Database["public"]["Enums"]["resource_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_files_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_files_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      session_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json
          id: string
          session_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details: Json
          id?: string
          session_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_audit_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          class_id: string | null
          created_at: string | null
          date: string
          end_time: string | null
          id: string
          notes: string | null
          start_time: string | null
          subject: string
          subject_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          date: string
          end_time?: string | null
          id: string
          notes?: string | null
          start_time?: string | null
          subject: string
          subject_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          date?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          subject?: string
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
      sessions_resource_files: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          resource_file_id: string
          session_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          resource_file_id: string
          session_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          resource_file_id?: string
          session_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_resource_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_resource_files_resource_file_id_fkey"
            columns: ["resource_file_id"]
            isOneToOne: false
            referencedRelation: "resource_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_resource_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions_staff: {
        Row: {
          created_at: string | null
          id: string
          session_id: string
          staff_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          session_id: string
          staff_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          session_id?: string
          staff_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
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
        ]
      }
      sessions_students: {
        Row: {
          attended: boolean
          created_at: string | null
          id: string
          notes: string | null
          session_id: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          attended?: boolean
          created_at?: string | null
          id: string
          notes?: string | null
          session_id: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          attended?: boolean
          created_at?: string | null
          id?: string
          notes?: string | null
          session_id?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_attendances_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendances_student_id_fkey"
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
          email: string
          first_name: string
          has_parking_remote: string | null
          id: string
          last_name: string
          notes: string | null
          office_key_number: number | null
          phone_number: string | null
          role: string
          status: string
          updated_at: string | null
          user_id: string
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
          email: string
          first_name: string
          has_parking_remote?: string | null
          id: string
          last_name: string
          notes?: string | null
          office_key_number?: number | null
          phone_number?: string | null
          role: string
          status: string
          updated_at?: string | null
          user_id: string
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
          email?: string
          first_name?: string
          has_parking_remote?: string | null
          id?: string
          last_name?: string
          notes?: string | null
          office_key_number?: number | null
          phone_number?: string | null
          role?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      staff_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json
          id: string
          staff_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details: Json
          id: string
          staff_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json
          id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_audit_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
            foreignKeyName: "staff_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json
          id: string
          student_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details: Json
          id: string
          student_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_audit_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
          first_name: string
          id: string
          last_name: string
          notes: string | null
          parent_email: string | null
          parent_first_name: string | null
          parent_last_name: string | null
          parent_phone: string | null
          school: string | null
          status: string
          student_email: string | null
          student_phone: string | null
          updated_at: string | null
          user_id: string
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
          first_name: string
          id: string
          last_name: string
          notes?: string | null
          parent_email?: string | null
          parent_first_name?: string | null
          parent_last_name?: string | null
          parent_phone?: string | null
          school?: string | null
          status: string
          student_email?: string | null
          student_phone?: string | null
          updated_at?: string | null
          user_id: string
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
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          parent_email?: string | null
          parent_first_name?: string | null
          parent_last_name?: string | null
          parent_phone?: string | null
          school?: string | null
          status?: string
          student_email?: string | null
          student_phone?: string | null
          updated_at?: string | null
          user_id?: string
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
      subtopics: {
        Row: {
          created_at: string | null
          id: string
          name: string
          number: number
          topic_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          number: number
          topic_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          number?: number
          topic_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtopics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          area: string | null
          created_at: string | null
          id: string
          name: string
          number: number
          subject_id: string
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          created_at?: string | null
          id?: string
          name: string
          number: number
          subject_id: string
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          created_at?: string | null
          id?: string
          name?: string
          number?: number
          subject_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_enum_value: {
        Args: { enum_name: string; new_value: string }
        Returns: undefined
      }
      current_staff_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_adminstaff: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_staff: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_tutor: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
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

