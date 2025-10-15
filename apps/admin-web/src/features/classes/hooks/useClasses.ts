import { useRepository } from '@/shared/hooks/useRepository';
import { classRepository, classesStudentsRepository, classesStaffRepository } from '@/shared/lib/supabase/database/repositories';

export const useClasses = () => useRepository(classRepository);
export const useClassesStudents = () => useRepository(classesStudentsRepository);
export const useClassesStaff = () => useRepository(classesStaffRepository); 