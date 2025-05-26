import { useRepository } from '@/shared/hooks/useRepository';
import { sessionRepository } from '@/shared/lib/supabase/db/repositories';
 
export const useSessions = () => useRepository(sessionRepository); 