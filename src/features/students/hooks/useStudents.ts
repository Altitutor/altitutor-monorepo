import { useRepository } from '@/shared/hooks';
import { studentRepository } from '@/shared/lib/supabase/db/repositories';

export const useStudents = () => useRepository(studentRepository); 