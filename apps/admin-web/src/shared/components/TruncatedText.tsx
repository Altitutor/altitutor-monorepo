import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';

interface TruncatedTextProps {
  text: string;
  className?: string;
}

/**
 * Component that displays truncated text with a tooltip showing the full text
 * Shows '-' if text is empty/null
 */
export function TruncatedText({ text, className = '' }: TruncatedTextProps) {
  const displayText = text || '-';
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`truncate ${className}`} title={displayText}>
            {displayText}
          </div>
        </TooltipTrigger>
        {displayText !== '-' && (
          <TooltipContent>
            <p>{displayText}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
