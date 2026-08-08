'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Check, Loader2, Upload, X } from 'lucide-react';

export function ImportFlashcardsDialog({
  open,
  isImporting,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  isImporting: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (csv: string) => Promise<{ inserted: number; rejected: Array<{ row: number; reason: string }> }>;
}) {
  const [csv, setCsv] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCsv('');
      setMessage(null);
    }
  }, [open]);

  const handleImport = async () => {
    const result = await onImport(csv);
    setMessage(
      `Imported ${result.inserted} cards` +
        (result.rejected.length ? `; rejected ${result.rejected.length} rows` : ''),
    );
    if (result.inserted > 0) setCsv('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full md:max-w-3xl p-0 gap-0 [&>button]:hidden">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
            <div>
              <DialogTitle>Import Flashcards</DialogTitle>
              <DialogDescription>Paste text-cloze CSV/TSV rows, including Anki text-cloze exports. Image occlusion is authored manually.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-3 px-6 py-5">
          <textarea
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            placeholder={'#separator:tab\n#html:true\n"{{c1::DNA}} stores genetic information"\t"Extra notes"\n\nOr paste CSV with headers:\ntext,order,extra'}
            className="min-h-[320px] w-full rounded-md border bg-background px-3 py-2 font-mono text-sm leading-6 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Close
          </Button>
          <Button onClick={handleImport} disabled={!csv.trim() || isImporting} className="gap-1.5">
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import CSV/TSV
          </Button>
          {message ? (
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="gap-1.5">
              <Check className="h-4 w-4" />
              Done
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
