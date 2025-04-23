import { db } from '../db/db';
import { supabase } from './client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Utility to migrate data from local Dexie DB to Supabase
 */
export async function migrateToSupabase() {
  try {
    console.log('Starting migration to Supabase...');
    
    // Migrate students
    const students = await db.students.toArray();
    if (students.length > 0) {
      console.log(`Migrating ${students.length} students...`);
      
      const { error: studentsError } = await supabase.from('students').upsert(
        students.map(student => ({
          id: student.id,
          first_name: student.firstName,
          last_name: student.lastName,
          email: student.email,
          phone_number: student.phoneNumber,
          parent_name: student.parentName,
          parent_email: student.parentEmail,
          parent_phone: student.parentPhone,
          status: student.status,
          notes: student.notes,
          user_id: student.userId,
          created_at: student.createdAt,
          updated_at: student.updatedAt,
        }))
      );
      
      if (studentsError) {
        console.error('Error migrating students:', studentsError);
      } else {
        console.log('Students migrated successfully');
      }
    }
    
    // Migrate staff
    const staff = await db.staff.toArray();
    if (staff.length > 0) {
      console.log(`Migrating ${staff.length} staff members...`);
      
      const { error: staffError } = await supabase.from('staff').upsert(
        staff.map(s => ({
          id: s.id,
          first_name: s.firstName,
          last_name: s.lastName,
          email: s.email,
          phone_number: s.phoneNumber,
          role: s.role,
          status: s.status,
          notes: s.notes,
          user_id: s.userId,
          created_at: s.createdAt,
          updated_at: s.updatedAt,
        }))
      );
      
      if (staffError) {
        console.error('Error migrating staff:', staffError);
      } else {
        console.log('Staff migrated successfully');
      }
    }
    
    // Migrate classes
    const classes = await db.classes.toArray();
    if (classes.length > 0) {
      console.log(`Migrating ${classes.length} classes...`);
      
      const { error: classesError } = await supabase.from('classes').upsert(
        classes.map(c => ({
          id: c.id,
          subject: c.subject,
          day_of_week: c.dayOfWeek,
          start_time: c.startTime,
          end_time: c.endTime,
          max_capacity: c.maxCapacity,
          status: c.status,
          notes: c.notes,
          created_at: c.createdAt,
          updated_at: c.updatedAt,
        }))
      );
      
      if (classesError) {
        console.error('Error migrating classes:', classesError);
      } else {
        console.log('Classes migrated successfully');
      }
    }
    
    // Migrate class enrollments
    const enrollments = await db.classEnrollments.toArray();
    if (enrollments.length > 0) {
      console.log(`Migrating ${enrollments.length} class enrollments...`);
      
      const { error: enrollmentsError } = await supabase.from('class_enrollments').upsert(
        enrollments.map(e => ({
          id: e.id,
          student_id: e.studentId,
          class_id: e.classId,
          start_date: e.startDate,
          end_date: e.endDate,
          status: e.status,
          created_at: e.createdAt,
          updated_at: e.updatedAt,
        }))
      );
      
      if (enrollmentsError) {
        console.error('Error migrating class enrollments:', enrollmentsError);
      } else {
        console.log('Class enrollments migrated successfully');
      }
    }
    
    // Migrate class assignments
    const assignments = await db.classAssignments.toArray();
    if (assignments.length > 0) {
      console.log(`Migrating ${assignments.length} class assignments...`);
      
      const { error: assignmentsError } = await supabase.from('class_assignments').upsert(
        assignments.map(a => ({
          id: a.id,
          staff_id: a.staffId,
          class_id: a.classId,
          start_date: a.startDate,
          end_date: a.endDate,
          is_substitute: a.isSubstitute,
          created_at: a.createdAt,
          updated_at: a.updatedAt,
        }))
      );
      
      if (assignmentsError) {
        console.error('Error migrating class assignments:', assignmentsError);
      } else {
        console.log('Class assignments migrated successfully');
      }
    }
    
    // Migrate absences
    const absences = await db.absences.toArray();
    if (absences.length > 0) {
      console.log(`Migrating ${absences.length} absences...`);
      
      const { error: absencesError } = await supabase.from('absences').upsert(
        absences.map(a => ({
          id: a.id,
          student_id: a.studentId,
          date: a.date,
          type: a.type,
          reason: a.reason,
          is_rescheduled: a.isRescheduled,
          rescheduled_date: a.rescheduledDate,
          created_at: a.createdAt,
          updated_at: a.updatedAt,
        }))
      );
      
      if (absencesError) {
        console.error('Error migrating absences:', absencesError);
      } else {
        console.log('Absences migrated successfully');
      }
    }
    
    // Migrate meetings
    const meetings = await db.meetings.toArray();
    if (meetings.length > 0) {
      console.log(`Migrating ${meetings.length} meetings...`);
      
      const { error: meetingsError } = await supabase.from('meetings').upsert(
        meetings.map(m => ({
          id: m.id,
          student_id: m.studentId,
          date: m.date,
          type: m.type,
          notes: m.notes,
          outcome: m.outcome,
          created_at: m.createdAt,
          updated_at: m.updatedAt,
        }))
      );
      
      if (meetingsError) {
        console.error('Error migrating meetings:', meetingsError);
      } else {
        console.log('Meetings migrated successfully');
      }
    }
    
    // Migrate drafting sessions
    const draftingSessions = await db.draftingSessions.toArray();
    if (draftingSessions.length > 0) {
      console.log(`Migrating ${draftingSessions.length} drafting sessions...`);
      
      const { error: draftingSessionsError } = await supabase.from('drafting_sessions').upsert(
        draftingSessions.map(ds => ({
          id: ds.id,
          student_id: ds.studentId,
          date: ds.date,
          type: ds.type,
          notes: ds.notes,
          created_at: ds.createdAt,
          updated_at: ds.updatedAt,
        }))
      );
      
      if (draftingSessionsError) {
        console.error('Error migrating drafting sessions:', draftingSessionsError);
      } else {
        console.log('Drafting sessions migrated successfully');
      }
    }
    
    // Migrate sessions
    const sessions = await db.sessions.toArray();
    if (sessions.length > 0) {
      console.log(`Migrating ${sessions.length} sessions...`);
      
      const { error: sessionsError } = await supabase.from('sessions').upsert(
        sessions.map(s => ({
          id: s.id,
          date: s.date,
          type: s.type,
          subject: s.subject,
          class_id: s.classId,
          staff_id: s.staffId,
          teaching_content: s.teachingContent,
          notes: s.notes,
          created_at: s.createdAt,
          updated_at: s.updatedAt,
        }))
      );
      
      if (sessionsError) {
        console.error('Error migrating sessions:', sessionsError);
      } else {
        console.log('Sessions migrated successfully');
      }
    }
    
    // Migrate attendance
    const attendances = await db.sessionAttendances.toArray();
    if (attendances.length > 0) {
      console.log(`Migrating ${attendances.length} session attendances...`);
      
      const { error: attendancesError } = await supabase.from('session_attendances').upsert(
        attendances.map(a => ({
          id: a.id,
          session_id: a.sessionId,
          student_id: a.studentId,
          attended: a.attended,
          notes: a.notes,
          created_at: a.createdAt,
          updated_at: a.updatedAt,
        }))
      );
      
      if (attendancesError) {
        console.error('Error migrating session attendances:', attendancesError);
      } else {
        console.log('Session attendances migrated successfully');
      }
    }
    
    // Migrate messages
    const messages = await db.messages.toArray();
    if (messages.length > 0) {
      console.log(`Migrating ${messages.length} messages...`);
      
      const { error: messagesError } = await supabase.from('messages').upsert(
        messages.map(m => ({
          id: m.id,
          student_id: m.studentId,
          type: m.type,
          content: m.content,
          status: m.status,
          created_at: m.createdAt,
          updated_at: m.updatedAt,
        }))
      );
      
      if (messagesError) {
        console.error('Error migrating messages:', messagesError);
      } else {
        console.log('Messages migrated successfully');
      }
    }
    
    // Migrate files
    const files = await db.files.toArray();
    if (files.length > 0) {
      console.log(`Migrating ${files.length} files...`);
      
      const { error: filesError } = await supabase.from('files').upsert(
        files.map(f => ({
          id: f.id,
          student_id: f.studentId,
          filename: f.filename,
          path: f.path,
          type: f.type,
          created_at: f.createdAt,
          updated_at: f.updatedAt,
        }))
      );
      
      if (filesError) {
        console.error('Error migrating files:', filesError);
      } else {
        console.log('Files migrated successfully');
      }
    }
    
    console.log('Migration to Supabase completed!');
    return { success: true };
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error };
  }
} 