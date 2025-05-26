import { useRepository } from '@/shared/hooks/useRepository';
import { topicRepository } from '@/shared/lib/supabase/db/repositories';

export const useTopics = () => useRepository(topicRepository); 