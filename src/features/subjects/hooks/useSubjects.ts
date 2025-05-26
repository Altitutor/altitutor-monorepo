import { useRepository } from '@/shared/hooks/useRepository';
import { subjectRepository } from '@/shared/lib/supabase/db/repositories';

export const useSubjects = () => useRepository(subjectRepository); 