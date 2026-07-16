"use client";

import { useLeaveGuard as useSharedLeaveGuard } from "@/shared/hooks/use-leave-guard";

const DEFAULT_MESSAGE =
  "Leave this skill trainer? Your timed run will keep going in the background.";

/**
 * Browser leave confirmation for in-progress skill trainer attempts.
 */
export function useLeaveGuard(active: boolean, message = DEFAULT_MESSAGE) {
  return useSharedLeaveGuard(active, message);
}
