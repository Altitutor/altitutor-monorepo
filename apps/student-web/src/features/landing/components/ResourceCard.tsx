'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@altitutor/ui';
import { SafeImage } from './SafeImage';
import { ResourceCardData } from '../types';
import { cn } from '@/shared/utils';

interface ResourceCardProps extends ResourceCardData {
  className?: string;
  gradient?: boolean;
  imagePosition?: 'bottom' | 'right';
}

export function ResourceCard({
  icon,
  title,
  description,
  toggleContent,
  image,
  className,
  gradient = false,
  imagePosition = 'bottom',
}: ResourceCardProps) {
  const hasImageRight = image && imagePosition === 'right';
  
  return (
    <div
      className={cn(
        'rounded-lg p-6 md:p-8 overflow-hidden',
        gradient
          ? 'bg-gradient-to-br from-brand-lightBlue/10 to-brand-mediumBlue/10 dark:from-brand-lightBlue/5 dark:to-brand-mediumBlue/5'
          : 'bg-white dark:bg-card',
        hasImageRight && 'flex flex-col md:flex-row gap-6 md:gap-8',
        className
      )}
    >
      <div className={cn('flex items-start gap-4', hasImageRight && 'flex-1 flex-col')}>
        <div className={cn('flex items-start gap-4', hasImageRight && 'w-full')}>
          <div className={typeof icon === 'string' ? 'text-3xl md:text-4xl' : 'flex-shrink-0 text-brand-darkBlue dark:text-brand-lightBlue'}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className={cn(
              "text-xl md:text-2xl font-semibold mb-2",
              className?.includes('bg-white') ? 'text-landing-dark-grey' : 'text-landing-dark-grey dark:text-foreground'
            )}>{title}</h3>
            <p className={cn(
              className?.includes('bg-white') ? 'text-landing-dark-grey' : 'text-landing-dark-grey dark:text-muted-foreground'
            )}>{description}</p>
            
            {toggleContent && (
              <div className="mt-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="learn-more" className="border-none">
                    <AccordionTrigger className="py-2 hover:no-underline text-sm font-medium">
                      Learn more
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <div className={cn(
                        "text-sm whitespace-pre-line",
                        className?.includes('bg-white') ? 'text-landing-dark-grey' : 'text-landing-dark-grey dark:text-muted-foreground'
                      )}>{toggleContent}</div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </div>
        </div>
      </div>

      {image && imagePosition === 'bottom' && (
        <div className="mt-6 rounded-lg overflow-hidden -mb-32 md:-mb-48">
          <SafeImage
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            className="w-full h-auto"
            loading="lazy"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      )}

      {image && imagePosition === 'right' && (
        <div className="flex-shrink-0 w-full md:w-auto md:max-w-md -mb-32 md:-mb-48">
          <SafeImage
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            className="w-full h-auto rounded-lg"
            loading="lazy"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        </div>
      )}
    </div>
  );
}

