import { useState, useEffect } from 'react';
import type { ClassWithExpandedSubject } from '@altitutor/shared';

interface UseChangeClassDataProps {
  isOpen: boolean;
  step: 1 | 2 | 3;
  onFetchClasses: () => Promise<ClassWithExpandedSubject[]>;
}

export function useChangeClassData({
  isOpen,
  step,
  onFetchClasses,
}: UseChangeClassDataProps) {
  const [classes, setClasses] = useState<ClassWithExpandedSubject[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (isOpen && step === 1) {
      setIsFetching(true);
      onFetchClasses()
        .then(setClasses)
        .finally(() => setIsFetching(false));
    }
  }, [isOpen, step, onFetchClasses]);

  return {
    classes,
    isFetching,
  };
}

