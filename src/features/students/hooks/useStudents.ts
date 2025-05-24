import { useRepository } from '@/lib/hooks/useRepository';
import { studentRepository } from '@/lib/supabase/db/repositories';

export const useStudents = () => useRepository(studentRepository); 