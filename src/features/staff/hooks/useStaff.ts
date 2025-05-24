import { useRepository } from '@/lib/hooks/useRepository';
import { staffRepository } from '@/lib/supabase/db/repositories';

export const useStaff = () => useRepository(staffRepository); 