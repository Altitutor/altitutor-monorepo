import { useRepository } from '@/shared/hooks';
import { staffRepository } from '@/shared/lib/supabase/db/repositories';
 
export const useStaff = () => useRepository(staffRepository); 