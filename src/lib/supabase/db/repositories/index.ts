// This module aggregates and re-exports all repositories for easy access
import { Repository } from '../repository';
import { Student, Staff, Subject, Topic, Subtopic, Class, 
         ClassEnrollment, ClassAssignment, StudentsSubjects,
         StaffSubjects, Session, SessionAttendance } from '../types';
         
// Create and export repository instances for each entity type
export const studentRepository = new Repository<Student>('students');
export const staffRepository = new Repository<Staff>('staff');
export const subjectRepository = new Repository<Subject>('subjects');
export const topicRepository = new Repository<Topic>('topics');
export const subtopicRepository = new Repository<Subtopic>('subtopics');
export const classRepository = new Repository<Class>('classes');
export const classEnrollmentRepository = new Repository<ClassEnrollment>('class_enrollments');
export const classAssignmentRepository = new Repository<ClassAssignment>('class_assignments');
export const studentsSubjectsRepository = new Repository<StudentsSubjects>('students_subjects');
export const staffSubjectsRepository = new Repository<StaffSubjects>('staff_subjects');
export const sessionRepository = new Repository<Session>('sessions');
export const sessionAttendanceRepository = new Repository<SessionAttendance>('session_attendances'); 