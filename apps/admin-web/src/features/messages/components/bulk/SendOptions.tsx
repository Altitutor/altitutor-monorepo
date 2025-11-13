'use client';

import { Button, Checkbox, Label } from '@altitutor/ui';
import { AlertCircle } from 'lucide-react';

interface SendOptionsProps {
  sendToParents: boolean;
  onSendToParentsChange: (value: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

export function SendOptions({
  sendToParents,
  onSendToParentsChange,
  onNext,
  onBack,
}: SendOptionsProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold">Send Options</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure who should receive this message
        </p>
      </div>

      <div className="flex-1 p-6">
        <div className="max-w-2xl space-y-6">
          <div className="border rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="send-to-parents"
                checked={sendToParents}
                onCheckedChange={(checked) => onSendToParentsChange(checked === true)}
              />
              <div className="flex-1">
                <Label
                  htmlFor="send-to-parents"
                  className="text-sm font-medium cursor-pointer"
                >
                  Send to parents as well
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  If enabled, each parent will receive a separate message with their student's information
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Important Information
                </h4>
                <ul className="mt-2 text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Each recipient will receive an individual SMS message</li>
                  <li>• Messages will appear in your communications inbox</li>
                  <li>• Recipients without phone numbers will be skipped</li>
                  <li>• You'll see a preview before sending</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 border-t flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}








