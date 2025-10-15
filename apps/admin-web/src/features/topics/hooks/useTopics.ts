import { useRepository } from '@/shared/hooks/useRepository';
import { topicRepository } from '@/shared/lib/supabase/database/repositories';

export const useTopics = () => useRepository(topicRepository); 