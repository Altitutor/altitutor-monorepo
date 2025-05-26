import { useRepository } from '@/shared/hooks';
import { studentRepository } from '@/shared/lib/supabase/database/repositories';

export const useStudents = () => useRepository(studentRepository); 