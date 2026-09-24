import { Check, CloudOff, Loader2 } from 'lucide-react';

interface AutoSaveStatusProps {
  isPending: boolean;
  isError: boolean;
}

export function AutoSaveStatus({ isPending, isError }: AutoSaveStatusProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium pr-2 mr-2">
      {isPending ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </>
      ) : isError ? (
        <>
          <CloudOff className="h-3 w-3 text-destructive" />
          <span className="text-destructive">Changes not saved</span>
        </>
      ) : (
        <>
          <Check className="h-3 w-3 text-emerald-500" />
          <span>Saved</span>
        </>
      )}
    </div>
  );
}
