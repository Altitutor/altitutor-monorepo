'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@altitutor/ui';
import { StatCounter } from './StatCounter';
import { SafeImage } from './SafeImage';
import { ImageData, StatData } from '../types';
import { cn } from '@/shared/utils';

interface UCATCardProps {
  title: string;
  description: string;
  stats?: StatData[];
  learnMoreContent?: string;
  image?: ImageData;
  imagePosition?: 'right' | 'bottom';
  imageSize?: 'default' | 'small';
  fullWidth?: boolean;
}

export function UCATCard({
  title,
  description,
  stats,
  learnMoreContent,
  image,
  imagePosition = 'right',
  imageSize = 'default',
  fullWidth = false,
}: UCATCardProps) {
  const hasImageRight = image && imagePosition === 'right';
  
  return (
    <div className={cn(
      'rounded-lg p-6 md:p-8 bg-white/90 dark:bg-white/10 overflow-hidden',
      hasImageRight && 'flex flex-col md:flex-row gap-6 md:gap-8',
      fullWidth && 'w-full'
    )}>
      <div className={cn(
        fullWidth && hasImageRight ? 'w-full md:w-1/2 flex flex-col' : hasImageRight ? 'flex-1 flex flex-col' : 'flex-1'
      )}>
        <h3 className="text-2xl md:text-3xl font-semibold mb-4 text-landing-dark-grey dark:text-foreground">
          {title}
        </h3>
        <p className="text-landing-dark-grey dark:text-muted-foreground mb-6">
          {description}
        </p>
        
        {stats && (
          <div className={cn(
            'mb-6',
            stats.length === 2 && 'grid grid-cols-2 gap-4',
            stats.length === 1 && 'flex justify-center'
          )}>
            {stats.map((stat, index) => (
              <StatCounter key={index} {...stat} textColor="text-4xl md:text-5xl lg:text-6xl font-bold text-landing-dark-grey dark:text-foreground" />
            ))}
          </div>
        )}
        
        {learnMoreContent && (
          <div className="mt-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="learn-more" className="border-none">
                <AccordionTrigger className="py-2 hover:no-underline text-sm font-medium text-landing-dark-grey dark:text-foreground">
                  Learn more
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  <div className="text-sm text-landing-dark-grey dark:text-muted-foreground whitespace-pre-line">
                    {learnMoreContent}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </div>

      {image && imagePosition === 'right' && (
        <div className={cn(
          'flex-shrink-0 w-full md:w-auto -mb-32 md:-mb-48',
          fullWidth ? 'md:w-1/2' : imageSize === 'small' ? 'md:max-w-xs' : 'md:max-w-md'
        )}>
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

      {image && imagePosition === 'bottom' && (
        <div className={cn(
          "mt-6 rounded-lg overflow-hidden",
          imageSize === 'small' 
            ? "flex justify-center -mb-40 md:-mb-56" 
            : "-mx-6 md:-mx-8 -mb-32 md:-mb-48"
        )}>
          <div className={imageSize === 'small' ? "w-[70%]" : "w-full"}>
            <SafeImage
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              className="w-full h-auto rounded-lg"
              loading="lazy"
              sizes={imageSize === 'small' ? "(max-width: 768px) 70vw, 35vw" : "(max-width: 768px) 100vw, 50vw"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

