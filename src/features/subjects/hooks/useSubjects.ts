import { useRepository } from '@/lib/hooks/useRepository';
import { subjectRepository } from '@/lib/supabase/db/repositories';

export const useSubjects = () => useRepository(subjectRepository); 