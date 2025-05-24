import { classRepository, classesStudentsRepository, classesStaffRepository, studentRepository, staffRepository, subjectRepository } from '../db/repositories';
import { Class, ClassStatus, Student, Staff, Subject, ClassEnrollment, ClassAssignment, EnrollmentStatus } from '../db/types';
import { adminRepository } from '../db/admin';
import { getSupabaseClient } from '../client';
import { transformToCamelCase } from '../db/utils';

/**
 * Classes API client for working with class data
 */
export const classesApi = {
  /**
   * Get all classes
   */
  getAllClasses: async (): Promise<Class[]> => {
    return classRepository.getAll();
  },
  
  /**
   * Get all classes with their associated subject, students, and staff in optimized single queries
   * This solves the N+1 query problem for the classes table
   */
  getAllClassesWithDetails: async (): Promise<{ 
    classes: Class[]; 
    classSubjects: Record<string, Subject>;
    classStudents: Record<string, Student[]>; 
    classStaff: Record<string, Staff[]>;
  }> => {
    const supabase = getSupabaseClient();
    
    try {
      // Get all classes with their subjects
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          *,
          subject:subjects(*)
        `);
      
      if (classesError) throw classesError;
      
      // Get all class enrollments with student data
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('classes_students')
        .select(`
          class_id,
          student:students(*)
        `)
        .eq('status', 'ACTIVE');
      
      if (enrollmentsError) throw enrollmentsError;
      
      // Get all class assignments with staff data
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('classes_staff')
        .select(`
          class_id,
          staff:staff!class_assignments_staff_id_fkey(*)
        `)
        .eq('status', 'ACTIVE');
      
      if (assignmentsError) throw assignmentsError;
      
      // Transform and organize the data
      const classes: Class[] = [];
      const classSubjects: Record<string, Subject> = {};
      const classStudents: Record<string, Student[]> = {};
      const classStaff: Record<string, Staff[]> = {};
      
      // Process classes
      classesData?.forEach((row: any) => {
        const cls = transformToCamelCase(row) as Class;
        classes.push(cls);
        
        // Add subject if available
        if (row.subject) {
          classSubjects[cls.id] = transformToCamelCase(row.subject) as Subject;
        }
        
        // Initialize arrays
        classStudents[cls.id] = [];
        classStaff[cls.id] = [];
      });
      
      // Process enrollments
      enrollmentsData?.forEach((row: any) => {
        if (row.student && row.class_id) {
          const student = transformToCamelCase(row.student) as Student;
          if (!classStudents[row.class_id]) {
            classStudents[row.class_id] = [];
          }
          classStudents[row.class_id].push(student);
        }
      });
      
      // Process assignments
      assignmentsData?.forEach((row: any) => {
        if (row.staff && row.class_id) {
          const staff = transformToCamelCase(row.staff) as Staff;
          if (!classStaff[row.class_id]) {
            classStaff[row.class_id] = [];
          }
          classStaff[row.class_id].push(staff);
        }
      });
      
      return {
        classes,
        classSubjects,
        classStudents,
        classStaff
      };
      
    } catch (error) {
      console.error('Error getting classes with details:', error);
      throw error;
    }
  },
  
  /**
   * Get a single class with its details
   */
  getClassWithDetails: async (classId: string): Promise<{
    class: Class | null;
    subject: Subject | null;
    students: Student[];
    staff: Staff[];
  }> => {
    const supabase = getSupabaseClient();
    
    try {
      // Get class with subject
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select(`
          *,
          subject:subjects(*)
        `)
        .eq('id', classId)
        .single();
      
      if (classError) {
        if (classError.code === 'PGRST116') {
          return { class: null, subject: null, students: [], staff: [] };
        }
        throw classError;
      }
      
      // Get students for this class
      const { data: studentsData, error: studentsError } = await supabase
        .from('classes_students')
        .select(`
          student:students(*)
        `)
        .eq('class_id', classId)
        .eq('status', 'ACTIVE');
      
      if (studentsError) throw studentsError;
      
      // Get staff for this class
      const { data: staffData, error: staffError } = await supabase
        .from('classes_staff')
        .select(`
          staff:staff!class_assignments_staff_id_fkey(*)
        `)
        .eq('class_id', classId)
        .eq('status', 'ACTIVE');
      
      if (staffError) throw staffError;
      
      // Transform the data
      const cls = transformToCamelCase(classData) as Class;
      const subject = classData.subject ? transformToCamelCase(classData.subject) as Subject : null;
      const students = studentsData?.map((row: any) => transformToCamelCase(row.student) as Student).filter(Boolean) || [];
      const staff = staffData?.map((row: any) => transformToCamelCase(row.staff) as Staff).filter(Boolean) || [];
      
      return { class: cls, subject, students, staff };
      
    } catch (error) {
      console.error('Error getting class with details:', error);
      throw error;
    }
  },
  
  /**
   * Get a class by ID
   */
  getClass: async (id: string): Promise<Class | undefined> => {
    return classRepository.getById(id);
  },
  
  /**
   * Create a new class
   */
  createClass: async (data: Partial<Class>): Promise<Class> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    
    // Set default status if not provided
    const classData: Partial<Class> = {
      ...data,
      status: data.status || ClassStatus.ACTIVE,
    };
    
    return classRepository.create(classData);
  },
  
  /**
   * Update a class
   */
  updateClass: async (id: string, data: Partial<Class>): Promise<Class> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return classRepository.update(id, data);
  },
  
  /**
   * Delete a class
   */
  deleteClass: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return classRepository.delete(id);
  },
  
  /**
   * Get all students enrolled in a class
   */
  getClassStudents: async (classId: string): Promise<Student[]> => {
    try {
      // Get all class enrollments for this class
      const enrollments = await classesStudentsRepository.getBy('class_id', classId);
      
      // Filter for active enrollments
      const activeEnrollments = enrollments.filter(enrollment => enrollment.status === 'ACTIVE');
      
      if (!activeEnrollments.length) {
        return [];
      }
      
      // Get student details for each enrollment
      const studentPromises = activeEnrollments.map(async (enrollment) => {
        return studentRepository.getById(enrollment.studentId);
      });
      
      const studentResults = await Promise.all(studentPromises);
      // Filter out undefined results
      return studentResults.filter(student => student !== undefined) as Student[];
    } catch (error) {
      console.error('Error getting class students:', error);
      throw error;
    }
  },
  
  /**
   * Get all staff assigned to a class
   */
  getClassStaff: async (classId: string): Promise<Staff[]> => {
    try {
      // Get all class assignments for this class
      const assignments = await classesStaffRepository.getBy('class_id', classId);
      
      // Filter for active assignments
      const activeAssignments = assignments.filter(assignment => assignment.status === 'ACTIVE');
      
      if (!activeAssignments.length) {
        return [];
      }
      
      // Get staff details for each assignment
      const staffPromises = activeAssignments.map(async (assignment) => {
        return staffRepository.getById(assignment.staffId);
      });
      
      const staffResults = await Promise.all(staffPromises);
      // Filter out undefined results
      return staffResults.filter(staff => staff !== undefined) as Staff[];
    } catch (error) {
      console.error('Error getting class staff:', error);
      throw error;
    }
  },
  
  /**
   * Enroll a student in a class
   */
  enrollStudent: async (classId: string, studentId: string): Promise<ClassEnrollment> => {
    try {
      // Ensure the user is an admin first
      await adminRepository.ensureAdminUser();
      
      // Check if the enrollment already exists
      const existing = await classesStudentsRepository.getBy('class_id', classId);
      const existingEnrollment = existing.find(record => record.studentId === studentId && record.status === 'ACTIVE');
      
      if (existingEnrollment) {
        return existingEnrollment; // Already enrolled
      }
      
      // Create the enrollment
      const enrollment: Partial<ClassEnrollment> = {
        classId,
        studentId,
        startDate: new Date().toISOString().split('T')[0], // Today's date
        status: EnrollmentStatus.ACTIVE,
      };
      
      return classesStudentsRepository.create(enrollment);
    } catch (error) {
      console.error('Error enrolling student:', error);
      throw error;
    }
  },
  
  /**
   * Remove a student from a class
   */
  unenrollStudent: async (classId: string, studentId: string): Promise<void> => {
    try {
      // Ensure the user is an admin first
      await adminRepository.ensureAdminUser();
      
      // Get all enrollments for this class and student
      const enrollments = await classesStudentsRepository.getBy('class_id', classId);
      
      // Find the active enrollment for this student
      const enrollment = enrollments.find(record => record.studentId === studentId && record.status === 'ACTIVE');
      
      if (enrollment) {
        // Update status to inactive instead of discontinued (matches database constraint)
        await classesStudentsRepository.update(enrollment.id, {
          status: EnrollmentStatus.INACTIVE,
          endDate: new Date().toISOString().split('T')[0],
        });
      }
    } catch (error) {
      console.error('Error unenrolling student:', error);
      throw error;
    }
  },
  
  /**
   * Assign a staff member to a class
   */
  assignStaff: async (classId: string, staffId: string): Promise<ClassAssignment> => {
    try {
      // Ensure the user is an admin first
      await adminRepository.ensureAdminUser();
      
      // Check if the assignment already exists
      const existing = await classesStaffRepository.getBy('class_id', classId);
      const existingAssignment = existing.find(record => record.staffId === staffId && record.status === 'ACTIVE');
      
      if (existingAssignment) {
        return existingAssignment; // Already assigned
      }
      
      // Create the assignment
      const assignment: Partial<ClassAssignment> = {
        classId,
        staffId,
        startDate: new Date().toISOString().split('T')[0], // Today's date
        status: 'ACTIVE',
        isSubstitute: false,
      };
      
      return classesStaffRepository.create(assignment);
    } catch (error) {
      console.error('Error assigning staff:', error);
      throw error;
    }
  },
  
  /**
   * Remove a staff member from a class
   */
  unassignStaff: async (classId: string, staffId: string): Promise<void> => {
    try {
      // Ensure the user is an admin first
      await adminRepository.ensureAdminUser();
      
      // Get all assignments for this class and staff member
      const assignments = await classesStaffRepository.getBy('class_id', classId);
      
      // Find the active assignment for this staff member
      const assignment = assignments.find(record => record.staffId === staffId && record.status === 'ACTIVE');
      
      if (assignment) {
        // Update status to inactive instead of deleting
        await classesStaffRepository.update(assignment.id, {
          status: 'INACTIVE',
          endDate: new Date().toISOString().split('T')[0],
        });
      }
    } catch (error) {
      console.error('Error unassigning staff:', error);
      throw error;
    }
  },
  
  /**
   * Get classes by day of week
   */
  getClassesByDay: async (dayOfWeek: number): Promise<Class[]> => {
    try {
      return classRepository.findByModelField('dayOfWeek', dayOfWeek);
    } catch (error) {
      console.error('Error getting classes by day:', error);
      throw error;
    }
  },
  
  /**
   * Get classes by status
   */
  getClassesByStatus: async (status: ClassStatus): Promise<Class[]> => {
    try {
      return classRepository.findByModelField('status', status);
    } catch (error) {
      console.error('Error getting classes by status:', error);
      throw error;
    }
  },
}; 