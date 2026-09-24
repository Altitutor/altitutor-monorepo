"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

type ExitFlush = () => Promise<boolean>;

type ExamAttemptExitSyncContextValue = {
  registerExitFlush: (flush: ExitFlush) => () => void;
  flushBeforeExit: ExitFlush;
};

const ExamAttemptExitSyncContext =
  createContext<ExamAttemptExitSyncContextValue | null>(null);

export function ExamAttemptExitSyncProvider({
  children,
}: {
  children: ReactNode;
}) {
  const flushRef = useRef<ExitFlush | null>(null);

  const registerExitFlush = useCallback((flush: ExitFlush) => {
    flushRef.current = flush;
    return () => {
      if (flushRef.current === flush) flushRef.current = null;
    };
  }, []);

  const flushBeforeExit = useCallback(async () => {
    const flush = flushRef.current;
    return flush ? flush() : true;
  }, []);

  const value = useMemo(
    () => ({ registerExitFlush, flushBeforeExit }),
    [flushBeforeExit, registerExitFlush],
  );

  return (
    <ExamAttemptExitSyncContext.Provider value={value}>
      {children}
    </ExamAttemptExitSyncContext.Provider>
  );
}

export function useExamAttemptExitSync(): ExamAttemptExitSyncContextValue {
  const context = useContext(ExamAttemptExitSyncContext);
  if (!context) {
    return {
      registerExitFlush: () => () => undefined,
      flushBeforeExit: async () => true,
    };
  }
  return context;
}
