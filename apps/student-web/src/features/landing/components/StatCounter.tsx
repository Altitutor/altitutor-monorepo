'use client';

import { useEffect, useRef, useState } from 'react';
import { StatData } from '../types';
import { cn } from '@/shared/utils';

interface StatCounterProps extends StatData {
  className?: string;
  textColor?: string; // Optional custom text color for the stat number
}

export function StatCounter({ value, suffix, description, duration = 2000, className, textColor }: StatCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasAnimated) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            animateCounter();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [hasAnimated]);

  const animateCounter = () => {
    const startTime = Date.now();
    const startValue = 0;
    const endValue = value;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(startValue + (endValue - startValue) * easeOutQuart);

      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
      }
    };

    requestAnimationFrame(animate);
  };

  return (
    <div ref={ref} className={className}>
      <div className="text-center">
        <div className={cn(
          "text-4xl md:text-5xl lg:text-6xl font-bold mb-4",
          textColor || "text-brand-darkBlue dark:text-brand-lightBlue"
        )}>
          <span>{displayValue.toLocaleString()}</span>
          <span>{suffix}</span>
        </div>
        <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
          {description}
        </p>
      </div>
    </div>
  );
}

