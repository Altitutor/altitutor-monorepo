"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  StudentDirectoryPage,
  StudentDirectoryRequest,
} from "../types/directory";

/** Presets change this query's parameters; every layout uses the same directory. */
export function useStudentDirectory(request: StudentDirectoryRequest, allPages = false) {
  return useQuery({
    queryKey: ["students", "directory", request, allPages],
    queryFn: async ({ signal }): Promise<StudentDirectoryPage> => {
      const loadPage = async (page: number): Promise<StudentDirectoryPage> => {
        const response = await fetch('/api/students/directory', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({ ...request, page, pageSize: allPages ? 200 : request.pageSize, allPages }),
        });
        if (!response.ok) throw new Error('Unable to load Students');
        return response.json();
      };
      return loadPage(allPages ? 1 : request.page);
    },
    placeholderData: keepPreviousData,
    refetchInterval: request.sortBy === 'time_since_last_check_in'
      || request.filters.reconciliation?.length || request.filters.subsidy?.length
      ? false : 30_000,
  });
}
