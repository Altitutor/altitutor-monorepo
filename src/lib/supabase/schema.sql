

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."resource_answers" AS ENUM (
    'BLANK',
    'ANSWERS'
);


ALTER TYPE "public"."resource_answers" OWNER TO "postgres";


CREATE TYPE "public"."resource_type" AS ENUM (
    'NOTES',
    'TEST',
    'PRACTICE_QUESTIONS',
    'VIDEO',
    'EXAM',
    'FLASHCARDS',
    'REVISION_SHEET',
    'CHEAT_SHEET'
);


ALTER TYPE "public"."resource_type" OWNER TO "postgres";


CREATE TYPE "public"."subject_curriculum" AS ENUM (
    'SACE',
    'IB',
    'PRESACE',
    'PRIMARY'
);


ALTER TYPE "public"."subject_curriculum" OWNER TO "postgres";


CREATE TYPE "public"."subject_discipline" AS ENUM (
    'MATHEMATICS',
    'SCIENCE',
    'HUMANITIES',
    'ENGLISH',
    'ART',
    'LANGUAGE'
);


ALTER TYPE "public"."subject_discipline" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_admin_staff"("p_email" "text", "p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  INSERT INTO staff (
    id,
    first_name,
    last_name,
    email,
    role,
    status,
    user_id
  ) VALUES (
    gen_random_uuid(),
    'Admin',
    'User',
    p_email,
    'ADMIN',
    'ACTIVE',
    p_user_id
  ) RETURNING id INTO v_staff_id;
  
  RETURN v_staff_id;
END;
$$;


ALTER FUNCTION "public"."create_admin_staff"("p_email" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF new.raw_user_meta_data->>'user_role' IS NULL THEN
    RAISE EXCEPTION 'user_role is required';
  END IF;
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_claim"("uid" "uuid", "claim" "text", "value" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_data json;
BEGIN
  -- Get existing user metadata
  SELECT raw_user_meta_data FROM auth.users WHERE id = uid INTO user_data;
  
  -- Update user_metadata with new claim
  user_data := jsonb_set(
    coalesce(user_data::jsonb, '{}'::jsonb),
    string_to_array(claim, '.'),
    value
  );
  
  -- Update user metadata in auth.users table
  UPDATE auth.users SET raw_user_meta_data = user_data WHERE id = uid;
END;
$$;


ALTER FUNCTION "public"."set_claim"("uid" "uuid", "claim" "text", "value" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."absences" (
    "id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "date" "text" NOT NULL,
    "type" "text" NOT NULL,
    "reason" "text",
    "is_rescheduled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "missed_session_id" "uuid",
    "rescheduled_session_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "absences_type_check" CHECK (("type" = ANY (ARRAY['PLANNED'::"text", 'UNPLANNED'::"text"])))
);


ALTER TABLE "public"."absences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_session_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'present'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attendance_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_audit_logs" (
    "id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "details" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "class_audit_logs_action_check" CHECK (("action" = ANY (ARRAY['CREATED'::"text", 'UPDATED'::"text", 'DELETED'::"text", 'STATUS_CHANGED'::"text", 'OTHER'::"text"])))
);


ALTER TABLE "public"."class_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "session_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_session_times" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."class_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" "text" NOT NULL,
    "end_time" "text" NOT NULL,
    "status" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "subject_id" "uuid",
    "room" "text",
    "created_by" "uuid",
    CONSTRAINT "classes_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "classes_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'INACTIVE'::"text", 'FULL'::"text"])))
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes_staff" (
    "id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "start_date" "text" NOT NULL,
    "end_date" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "classes_staff_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'INACTIVE'::"text"])))
);


ALTER TABLE "public"."classes_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes_students" (
    "id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "start_date" "text" NOT NULL,
    "end_date" "text",
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "classes_students_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'INACTIVE'::"text", 'TRIAL'::"text"])))
);


ALTER TABLE "public"."classes_students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resource_files" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "topic_id" "uuid",
    "subtopic_id" "uuid",
    "type" "public"."resource_type" NOT NULL,
    "answers" "public"."resource_answers" DEFAULT 'BLANK'::"public"."resource_answers" NOT NULL,
    "number" integer,
    "file_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "resource_files_check" CHECK (((("topic_id" IS NOT NULL) AND ("subtopic_id" IS NULL)) OR (("topic_id" IS NULL) AND ("subtopic_id" IS NOT NULL))))
);


ALTER TABLE "public"."resource_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "details" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "session_audit_logs_action_check" CHECK (("action" = ANY (ARRAY['CREATED'::"text", 'UPDATED'::"text", 'DELETED'::"text", 'STATUS_CHANGED'::"text", 'OTHER'::"text"])))
);


ALTER TABLE "public"."session_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" NOT NULL,
    "date" "text" NOT NULL,
    "type" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "class_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "subject_id" "uuid",
    "start_time" "text",
    "end_time" "text",
    CONSTRAINT "sessions_type_check" CHECK (("type" = ANY (ARRAY['CLASS'::"text", 'DRAFTING'::"text", 'SUBSIDY_INTERVIEW'::"text", 'TRIAL_SESSION'::"text", 'STAFF_INTERVIEW'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions_resource_files" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "resource_file_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sessions_resource_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions_staff" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sessions_staff_type_check" CHECK (("type" = ANY (ARRAY['MAIN_TUTOR'::"text", 'SECONDARY_TUTOR'::"text", 'TRIAL_TUTOR'::"text"])))
);


ALTER TABLE "public"."sessions_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions_students" (
    "id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "attended" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sessions_students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone_number" "text",
    "role" "text" NOT NULL,
    "status" "text" NOT NULL,
    "notes" "text",
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "office_key_number" integer,
    "has_parking_remote" "text",
    "availability_monday" boolean DEFAULT false,
    "availability_tuesday" boolean DEFAULT false,
    "availability_wednesday" boolean DEFAULT false,
    "availability_thursday" boolean DEFAULT false,
    "availability_friday" boolean DEFAULT false,
    "availability_saturday_am" boolean DEFAULT false,
    "availability_saturday_pm" boolean DEFAULT false,
    "availability_sunday_am" boolean DEFAULT false,
    "availability_sunday_pm" boolean DEFAULT false,
    CONSTRAINT "staff_has_parking_remote_check" CHECK (("has_parking_remote" = ANY (ARRAY['VIRTUAL'::"text", 'PHYSICAL'::"text", 'NONE'::"text"]))),
    CONSTRAINT "staff_role_check" CHECK (("role" = ANY (ARRAY['ADMINSTAFF'::"text", 'TUTOR'::"text"]))),
    CONSTRAINT "staff_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'INACTIVE'::"text", 'TRIAL'::"text"])))
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


COMMENT ON COLUMN "public"."staff"."availability_monday" IS 'Staff availability on Monday';



COMMENT ON COLUMN "public"."staff"."availability_tuesday" IS 'Staff availability on Tuesday';



COMMENT ON COLUMN "public"."staff"."availability_wednesday" IS 'Staff availability on Wednesday';



COMMENT ON COLUMN "public"."staff"."availability_thursday" IS 'Staff availability on Thursday';



COMMENT ON COLUMN "public"."staff"."availability_friday" IS 'Staff availability on Friday';



COMMENT ON COLUMN "public"."staff"."availability_saturday_am" IS 'Staff availability on Saturday morning';



COMMENT ON COLUMN "public"."staff"."availability_saturday_pm" IS 'Staff availability on Saturday afternoon';



COMMENT ON COLUMN "public"."staff"."availability_sunday_am" IS 'Staff availability on Sunday morning';



COMMENT ON COLUMN "public"."staff"."availability_sunday_pm" IS 'Staff availability on Sunday afternoon';



CREATE TABLE IF NOT EXISTS "public"."staff_audit_logs" (
    "id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "details" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "staff_audit_logs_action_check" CHECK (("action" = ANY (ARRAY['CREATED'::"text", 'UPDATED'::"text", 'DELETED'::"text", 'STATUS_CHANGED'::"text", 'ASSIGNMENT_CHANGED'::"text", 'OTHER'::"text"])))
);


ALTER TABLE "public"."staff_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_subjects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."staff_subjects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_audit_logs" (
    "id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "details" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "student_audit_logs_action_check" CHECK (("action" = ANY (ARRAY['CREATED'::"text", 'UPDATED'::"text", 'DELETED'::"text", 'STATUS_CHANGED'::"text", 'ENROLLMENT_CHANGED'::"text", 'OTHER'::"text"])))
);


ALTER TABLE "public"."student_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "parent_email" "text",
    "parent_phone" "text",
    "status" "text" NOT NULL,
    "notes" "text",
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "school" "text",
    "curriculum" "text",
    "year_level" integer,
    "parent_first_name" "text",
    "parent_last_name" "text",
    "student_phone" "text",
    "student_email" "text",
    "availability_monday" boolean DEFAULT false,
    "availability_tuesday" boolean DEFAULT false,
    "availability_wednesday" boolean DEFAULT false,
    "availability_thursday" boolean DEFAULT false,
    "availability_friday" boolean DEFAULT false,
    "availability_saturday_am" boolean DEFAULT false,
    "availability_saturday_pm" boolean DEFAULT false,
    "availability_sunday_am" boolean DEFAULT false,
    "availability_sunday_pm" boolean DEFAULT false,
    "created_by" "uuid",
    CONSTRAINT "students_curriculum_check" CHECK (("curriculum" = ANY (ARRAY['SACE'::"text", 'IB'::"text", 'PRESACE'::"text", 'PRIMARY'::"text"]))),
    CONSTRAINT "students_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'INACTIVE'::"text", 'TRIAL'::"text", 'DISCONTINUED'::"text"])))
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students_subjects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."students_subjects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subjects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "year_level" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "curriculum" "public"."subject_curriculum",
    "discipline" "public"."subject_discipline",
    "level" "text",
    CONSTRAINT "valid_ib_level" CHECK ((("curriculum" <> 'IB'::"public"."subject_curriculum") OR (("curriculum" = 'IB'::"public"."subject_curriculum") AND (("level" = 'HL'::"text") OR ("level" = 'SL'::"text"))))),
    CONSTRAINT "valid_presace_level" CHECK ((("curriculum" <> 'PRESACE'::"public"."subject_curriculum") OR (("curriculum" = 'PRESACE'::"public"."subject_curriculum") AND (("level" = 'ADVANCED'::"text") OR ("level" = 'STANDARD'::"text")))))
);


ALTER TABLE "public"."subjects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."subjects"."curriculum" IS 'Subject curriculum type: SACE, IB, PRESACE, or PRIMARY';



COMMENT ON COLUMN "public"."subjects"."discipline" IS 'Subject discipline category: MATHEMATICS, SCIENCE, HUMANITIES, ENGLISH, ART, or LANGUAGE';



COMMENT ON COLUMN "public"."subjects"."level" IS 'Subject level - HL/SL for IB, ADVANCED/STANDARD for PRESACE, NULL for SACE/PRIMARY';



CREATE TABLE IF NOT EXISTS "public"."subtopics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "number" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subtopics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."topics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "number" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."topics" OWNER TO "postgres";


ALTER TABLE ONLY "public"."absences"
    ADD CONSTRAINT "absences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes_staff"
    ADD CONSTRAINT "class_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes_staff"
    ADD CONSTRAINT "class_assignments_staff_id_class_id_start_date_key" UNIQUE ("staff_id", "class_id", "start_date");



ALTER TABLE ONLY "public"."class_audit_logs"
    ADD CONSTRAINT "class_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes_students"
    ADD CONSTRAINT "class_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes_students"
    ADD CONSTRAINT "class_enrollments_student_id_class_id_start_date_key" UNIQUE ("student_id", "class_id", "start_date");



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resource_files"
    ADD CONSTRAINT "resource_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions_students"
    ADD CONSTRAINT "session_attendances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions_students"
    ADD CONSTRAINT "session_attendances_session_id_student_id_key" UNIQUE ("session_id", "student_id");



ALTER TABLE ONLY "public"."session_audit_logs"
    ADD CONSTRAINT "session_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions_resource_files"
    ADD CONSTRAINT "sessions_resource_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions_resource_files"
    ADD CONSTRAINT "sessions_resource_files_session_id_resource_file_id_key" UNIQUE ("session_id", "resource_file_id");



ALTER TABLE ONLY "public"."sessions_staff"
    ADD CONSTRAINT "sessions_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions_staff"
    ADD CONSTRAINT "sessions_staff_session_id_staff_id_key" UNIQUE ("session_id", "staff_id");



ALTER TABLE ONLY "public"."staff_audit_logs"
    ADD CONSTRAINT "staff_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_subjects"
    ADD CONSTRAINT "staff_subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_subjects"
    ADD CONSTRAINT "staff_subjects_staff_id_subject_id_key" UNIQUE ("staff_id", "subject_id");



ALTER TABLE ONLY "public"."student_audit_logs"
    ADD CONSTRAINT "student_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students_subjects"
    ADD CONSTRAINT "students_subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students_subjects"
    ADD CONSTRAINT "students_subjects_student_id_subject_id_key" UNIQUE ("student_id", "subject_id");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subtopics"
    ADD CONSTRAINT "subtopics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subtopics"
    ADD CONSTRAINT "subtopics_topic_id_number_key" UNIQUE ("topic_id", "number");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_subject_id_number_key" UNIQUE ("subject_id", "number");



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "unique_attendance_record" UNIQUE ("class_session_id", "student_id");



CREATE INDEX "idx_absences_date" ON "public"."absences" USING "btree" ("date");



CREATE INDEX "idx_absences_student_id" ON "public"."absences" USING "btree" ("student_id");



CREATE INDEX "idx_class_assignments_class_id" ON "public"."classes_staff" USING "btree" ("class_id");



CREATE INDEX "idx_class_assignments_staff_id" ON "public"."classes_staff" USING "btree" ("staff_id");



CREATE INDEX "idx_class_enrollments_class_id" ON "public"."classes_students" USING "btree" ("class_id");



CREATE INDEX "idx_class_enrollments_student_id" ON "public"."classes_students" USING "btree" ("student_id");



CREATE INDEX "idx_classes_status" ON "public"."classes" USING "btree" ("status");



CREATE INDEX "idx_classes_subject" ON "public"."classes" USING "btree" ("subject");



CREATE INDEX "idx_resource_files_subtopic_id" ON "public"."resource_files" USING "btree" ("subtopic_id");



CREATE INDEX "idx_resource_files_topic_id" ON "public"."resource_files" USING "btree" ("topic_id");



CREATE INDEX "idx_session_attendances_session_id" ON "public"."sessions_students" USING "btree" ("session_id");



CREATE INDEX "idx_session_attendances_student_id" ON "public"."sessions_students" USING "btree" ("student_id");



CREATE INDEX "idx_session_audit_logs_session_id" ON "public"."session_audit_logs" USING "btree" ("session_id");



CREATE INDEX "idx_sessions_class_id" ON "public"."sessions" USING "btree" ("class_id");



CREATE INDEX "idx_sessions_date" ON "public"."sessions" USING "btree" ("date");



CREATE INDEX "idx_sessions_resource_files_resource_file_id" ON "public"."sessions_resource_files" USING "btree" ("resource_file_id");



CREATE INDEX "idx_sessions_resource_files_session_id" ON "public"."sessions_resource_files" USING "btree" ("session_id");



CREATE INDEX "idx_sessions_staff_session_id" ON "public"."sessions_staff" USING "btree" ("session_id");



CREATE INDEX "idx_sessions_staff_staff_id" ON "public"."sessions_staff" USING "btree" ("staff_id");



CREATE INDEX "idx_staff_role" ON "public"."staff" USING "btree" ("role");



CREATE INDEX "idx_staff_status" ON "public"."staff" USING "btree" ("status");



CREATE INDEX "idx_staff_subjects_staff_id" ON "public"."staff_subjects" USING "btree" ("staff_id");



CREATE INDEX "idx_staff_subjects_subject_id" ON "public"."staff_subjects" USING "btree" ("subject_id");



CREATE INDEX "idx_students_status" ON "public"."students" USING "btree" ("status");



CREATE INDEX "idx_students_subjects_student_id" ON "public"."students_subjects" USING "btree" ("student_id");



CREATE INDEX "idx_students_subjects_subject_id" ON "public"."students_subjects" USING "btree" ("subject_id");



CREATE INDEX "idx_subjects_name" ON "public"."subjects" USING "btree" ("name");



CREATE INDEX "idx_subtopics_topic_id" ON "public"."subtopics" USING "btree" ("topic_id");



CREATE INDEX "idx_topics_subject_id" ON "public"."topics" USING "btree" ("subject_id");



CREATE OR REPLACE TRIGGER "set_attendance_records_updated_at" BEFORE UPDATE ON "public"."attendance_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_class_assignments_updated_at" BEFORE UPDATE ON "public"."classes_staff" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_class_enrollments_updated_at" BEFORE UPDATE ON "public"."classes_students" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_class_sessions_updated_at" BEFORE UPDATE ON "public"."class_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_classes_updated_at" BEFORE UPDATE ON "public"."classes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_staff_updated_at" BEFORE UPDATE ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_students_updated_at" BEFORE UPDATE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_absences" BEFORE UPDATE ON "public"."absences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_classes" BEFORE UPDATE ON "public"."classes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_classes_staff" BEFORE UPDATE ON "public"."classes_staff" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_classes_students" BEFORE UPDATE ON "public"."classes_students" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_resource_files" BEFORE UPDATE ON "public"."resource_files" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_sessions" BEFORE UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_sessions_resource_files" BEFORE UPDATE ON "public"."sessions_resource_files" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_sessions_staff" BEFORE UPDATE ON "public"."sessions_staff" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_sessions_students" BEFORE UPDATE ON "public"."sessions_students" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_staff" BEFORE UPDATE ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_staff_subjects" BEFORE UPDATE ON "public"."staff_subjects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_students" BEFORE UPDATE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_students_subjects" BEFORE UPDATE ON "public"."students_subjects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_subjects" BEFORE UPDATE ON "public"."subjects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_subtopics" BEFORE UPDATE ON "public"."subtopics" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_topics" BEFORE UPDATE ON "public"."topics" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."absences"
    ADD CONSTRAINT "absences_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."absences"
    ADD CONSTRAINT "absences_missed_session_id_fkey" FOREIGN KEY ("missed_session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."absences"
    ADD CONSTRAINT "absences_rescheduled_session_id_fkey" FOREIGN KEY ("rescheduled_session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."absences"
    ADD CONSTRAINT "absences_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "public"."class_sessions"("id");



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."classes_staff"
    ADD CONSTRAINT "class_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes_staff"
    ADD CONSTRAINT "class_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_audit_logs"
    ADD CONSTRAINT "class_audit_logs_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes_students"
    ADD CONSTRAINT "class_enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes_students"
    ADD CONSTRAINT "class_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "class_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id");



ALTER TABLE ONLY "public"."class_sessions"
    ADD CONSTRAINT "class_sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."classes_staff"
    ADD CONSTRAINT "classes_staff_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."classes_students"
    ADD CONSTRAINT "classes_students_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_files"
    ADD CONSTRAINT "resource_files_subtopic_id_fkey" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_files"
    ADD CONSTRAINT "resource_files_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions_students"
    ADD CONSTRAINT "session_attendances_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions_students"
    ADD CONSTRAINT "session_attendances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_audit_logs"
    ADD CONSTRAINT "session_audit_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions_resource_files"
    ADD CONSTRAINT "sessions_resource_files_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."sessions_resource_files"
    ADD CONSTRAINT "sessions_resource_files_resource_file_id_fkey" FOREIGN KEY ("resource_file_id") REFERENCES "public"."resource_files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions_resource_files"
    ADD CONSTRAINT "sessions_resource_files_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions_staff"
    ADD CONSTRAINT "sessions_staff_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions_staff"
    ADD CONSTRAINT "sessions_staff_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_audit_logs"
    ADD CONSTRAINT "staff_audit_logs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_subjects"
    ADD CONSTRAINT "staff_subjects_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_subjects"
    ADD CONSTRAINT "staff_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_audit_logs"
    ADD CONSTRAINT "student_audit_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."students_subjects"
    ADD CONSTRAINT "students_subjects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."students_subjects"
    ADD CONSTRAINT "students_subjects_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students_subjects"
    ADD CONSTRAINT "students_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subtopics"
    ADD CONSTRAINT "subtopics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



CREATE POLICY "Allow adminstaff to delete" ON "public"."students" FOR DELETE TO "authenticated" USING ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to delete sessions_resource_files" ON "public"."sessions_resource_files" FOR DELETE TO "authenticated" USING ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to delete staff" ON "public"."staff" FOR DELETE TO "authenticated" USING ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to delete staff_subjects" ON "public"."staff_subjects" FOR DELETE TO "authenticated" USING ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to insert" ON "public"."students" FOR INSERT TO "authenticated" WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to insert staff" ON "public"."staff" FOR INSERT TO "authenticated" WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to insert staff_subjects" ON "public"."staff_subjects" FOR INSERT TO "authenticated" WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to update" ON "public"."students" FOR UPDATE TO "authenticated" USING ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to update any staff" ON "public"."staff" FOR UPDATE TO "authenticated" USING ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to update staff_subjects" ON "public"."staff_subjects" FOR UPDATE TO "authenticated" USING ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write absences" ON "public"."absences" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write class_audit_logs" ON "public"."class_audit_logs" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write classes" ON "public"."classes" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write classes_staff" ON "public"."classes_staff" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write classes_students" ON "public"."classes_students" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write resource_files" ON "public"."resource_files" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write session_audit_logs" ON "public"."session_audit_logs" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write sessions" ON "public"."sessions" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write sessions_staff" ON "public"."sessions_staff" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write sessions_students" ON "public"."sessions_students" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write staff_audit_logs" ON "public"."staff_audit_logs" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write student_audit_logs" ON "public"."student_audit_logs" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write students_subjects" ON "public"."students_subjects" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write subjects" ON "public"."subjects" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write subtopics" ON "public"."subtopics" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow adminstaff to write topics" ON "public"."topics" TO "authenticated" USING ("auth"."is_adminstaff"()) WITH CHECK ("auth"."is_adminstaff"());



CREATE POLICY "Allow read access to all staff" ON "public"."students" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to insert sessions_resource_files" ON "public"."sessions_resource_files" FOR INSERT TO "authenticated" WITH CHECK ("auth"."is_staff"());



CREATE POLICY "Allow staff to read absences" ON "public"."absences" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read class_audit_logs" ON "public"."class_audit_logs" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read classes" ON "public"."classes" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read classes_staff" ON "public"."classes_staff" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read classes_students" ON "public"."classes_students" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read resource_files" ON "public"."resource_files" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read session_audit_logs" ON "public"."session_audit_logs" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read sessions" ON "public"."sessions" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read sessions_resource_files" ON "public"."sessions_resource_files" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read sessions_staff" ON "public"."sessions_staff" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read sessions_students" ON "public"."sessions_students" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read staff data" ON "public"."staff" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read staff_audit_logs" ON "public"."staff_audit_logs" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read staff_subjects" ON "public"."staff_subjects" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read student_audit_logs" ON "public"."student_audit_logs" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read students_subjects" ON "public"."students_subjects" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read subjects" ON "public"."subjects" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read subtopics" ON "public"."subtopics" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to read topics" ON "public"."topics" FOR SELECT TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow staff to update sessions_resource_files" ON "public"."sessions_resource_files" FOR UPDATE TO "authenticated" USING ("auth"."is_staff"());



CREATE POLICY "Allow students to read own data" ON "public"."students" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "auth"."is_student"()));



CREATE POLICY "Allow tutors to update own staff record" ON "public"."staff" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "auth"."is_tutor"()));



CREATE POLICY "Allow tutors to update their own staff_subjects" ON "public"."staff_subjects" FOR UPDATE TO "authenticated" USING ((("staff_id" = "auth"."current_staff_id"()) AND "auth"."is_tutor"()));



ALTER TABLE "public"."absences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."class_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classes_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classes_students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resource_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions_resource_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions_students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_subjects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."students_subjects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subjects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subtopics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topics" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."create_admin_staff"("p_email" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_admin_staff"("p_email" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_admin_staff"("p_email" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_claim"("uid" "uuid", "claim" "text", "value" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."set_claim"("uid" "uuid", "claim" "text", "value" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_claim"("uid" "uuid", "claim" "text", "value" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."absences" TO "anon";
GRANT ALL ON TABLE "public"."absences" TO "authenticated";
GRANT ALL ON TABLE "public"."absences" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_records" TO "anon";
GRANT ALL ON TABLE "public"."attendance_records" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_records" TO "service_role";



GRANT ALL ON TABLE "public"."class_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."class_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."class_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."class_sessions" TO "anon";
GRANT ALL ON TABLE "public"."class_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."class_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "public"."classes_staff" TO "anon";
GRANT ALL ON TABLE "public"."classes_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."classes_staff" TO "service_role";



GRANT ALL ON TABLE "public"."classes_students" TO "anon";
GRANT ALL ON TABLE "public"."classes_students" TO "authenticated";
GRANT ALL ON TABLE "public"."classes_students" TO "service_role";



GRANT ALL ON TABLE "public"."resource_files" TO "anon";
GRANT ALL ON TABLE "public"."resource_files" TO "authenticated";
GRANT ALL ON TABLE "public"."resource_files" TO "service_role";



GRANT ALL ON TABLE "public"."session_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."session_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."session_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."sessions_resource_files" TO "anon";
GRANT ALL ON TABLE "public"."sessions_resource_files" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions_resource_files" TO "service_role";



GRANT ALL ON TABLE "public"."sessions_staff" TO "anon";
GRANT ALL ON TABLE "public"."sessions_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions_staff" TO "service_role";



GRANT ALL ON TABLE "public"."sessions_students" TO "anon";
GRANT ALL ON TABLE "public"."sessions_students" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions_students" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT ALL ON TABLE "public"."staff_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."staff_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."staff_subjects" TO "anon";
GRANT ALL ON TABLE "public"."staff_subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_subjects" TO "service_role";



GRANT ALL ON TABLE "public"."student_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."student_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."student_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."students_subjects" TO "anon";
GRANT ALL ON TABLE "public"."students_subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."students_subjects" TO "service_role";



GRANT ALL ON TABLE "public"."subjects" TO "anon";
GRANT ALL ON TABLE "public"."subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."subjects" TO "service_role";



GRANT ALL ON TABLE "public"."subtopics" TO "anon";
GRANT ALL ON TABLE "public"."subtopics" TO "authenticated";
GRANT ALL ON TABLE "public"."subtopics" TO "service_role";



GRANT ALL ON TABLE "public"."topics" TO "anon";
GRANT ALL ON TABLE "public"."topics" TO "authenticated";
GRANT ALL ON TABLE "public"."topics" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
