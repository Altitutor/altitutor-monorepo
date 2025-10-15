import { useRepository } from '@/shared/hooks/useRepository';
import { sessionRepository } from '@/shared/lib/supabase/database/repositories';
 
export const useSessions = () => useRepository(sessionRepository); 