"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  StudentDirectoryPage,
  StudentDirectoryRequest,
} from "../types/directory";

/** Presets change this query's parameters; every layout uses the same directory. */
export function useStudentDirectory(request: StudentDirectoryRequest) {
  return useQuery({
    queryKey: ["students", "directory", request],
    queryFn: async (): Promise<StudentDirectoryPage> => {
      const response = await fetch("/api/students/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error("Unable to load Students");
      return response.json();
    },
    placeholderData: keepPreviousData,
    refetchInterval: request.sortBy === 'time_since_last_check_in'
      || request.filters.reconciliation?.length || request.filters.subsidy?.length
      ? false : 30_000,
  });
}
