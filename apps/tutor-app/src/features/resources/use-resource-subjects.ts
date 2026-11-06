import { useQuery } from '@tanstack/react-query';

import { getResourceSubjects } from './resources-api';

export function useResourceSubjects(enabled = true) {
  return useQuery({
    queryKey: ['tutor-resource-subjects'],
    queryFn: getResourceSubjects,
    enabled,
    staleTime: 30 * 60_000,
  });
}
