import { useRepository } from '@/lib/hooks/useRepository';
import { classRepository, classesStudentsRepository, classesStaffRepository } from '@/lib/supabase/db/repositories';

export const useClasses = () => useRepository(classRepository);
export const useClassesStudents = () => useRepository(classesStudentsRepository);
export const useClassesStaff = () => useRepository(classesStaffRepository); 