import { useRepository } from '@/shared/hooks';
import { staffRepository } from '@/shared/lib/supabase/database/repositories';
 
export const useStaff = () => useRepository(staffRepository); 