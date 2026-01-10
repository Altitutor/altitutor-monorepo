import { ReactNode } from 'react';
import { cn } from '@/shared/utils';

interface SectionWrapperProps {
  children: ReactNode;
  id?: string;
  className?: string;
  shapeDividerTop?: boolean;
  shapeDividerBottom?: boolean;
  background?: 'default' | 'gradient';
}

export function SectionWrapper({
  children,
  id,
  className,
  shapeDividerTop = false,
  shapeDividerBottom = false,
  background = 'default',
}: SectionWrapperProps) {
  return (
    <section
      id={id}
      className={cn(
        'relative py-16 md:py-24 min-h-screen',
        background === 'gradient' && 'bg-gradient-to-br from-brand-lightBlue/10 to-brand-mediumBlue/10',
        className
      )}
    >
      {shapeDividerTop && (
        <div className="absolute top-0 left-0 right-0 h-24 overflow-hidden pointer-events-none">
          <svg
            className="absolute top-0 left-0 w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
          >
            <path
              className={cn(
                className?.includes('bg-brand-darkBlue') && 'fill-brand-darkBlue',
                className?.includes('bg-brand-lightBlue') && 'fill-brand-lightBlue',
                className?.includes('bg-landing-light-grey') && 'fill-landing-light-grey dark:fill-background',
                !className?.includes('bg-') && 'fill-background dark:fill-brand-dark-bg'
              )}
              d="M0,6V0h1000v100L0,6z"
            />
          </svg>
        </div>
      )}
      <div className={cn(
        'container mx-auto px-4',
        shapeDividerTop && 'pt-12',
        shapeDividerBottom && 'pb-12',
        className?.includes('flex items-center') && 'flex flex-col justify-center min-h-[calc(100vh-var(--navbar-height))]'
      )}>
        {children}
      </div>
      {shapeDividerBottom && (
        <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden pointer-events-none">
          <svg
            className="absolute bottom-0 left-0 w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
          >
            <path
              className={cn(
                className?.includes('bg-brand-darkBlue') && 'fill-brand-darkBlue',
                className?.includes('bg-brand-lightBlue') && 'fill-brand-lightBlue',
                className?.includes('bg-landing-light-grey') && 'fill-landing-light-grey dark:fill-background',
                !className?.includes('bg-') && 'fill-background dark:fill-brand-dark-bg'
              )}
              d="M0,6V0h1000v100L0,6z"
            />
          </svg>
        </div>
      )}
    </section>
  );
}

