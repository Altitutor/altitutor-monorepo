import { useRepository } from '@/lib/hooks/useRepository';
import { topicRepository } from '@/lib/supabase/db/repositories';

export const useTopics = () => useRepository(topicRepository); 