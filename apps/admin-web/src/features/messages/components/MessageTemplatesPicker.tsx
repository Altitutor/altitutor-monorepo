'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';
import { Button, SearchableSelect } from '@altitutor/ui';
import { useMessageTemplates } from '../api/templates';
import type { Tables } from '@altitutor/shared';

interface MessageTemplatesPickerProps {
  onSelect: (template: Tables<'message_templates'>) => void;
  disabled?: boolean;
  expanded?: boolean;
}

export function MessageTemplatesPicker({ onSelect, disabled, expanded = false }: MessageTemplatesPickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: allTemplates = [], isLoading } = useMessageTemplates();
  const templates = allTemplates.filter((t) => !t.template_key);

  return (
    <SearchableSelect<Tables<'message_templates'>>
      items={templates}
      value={null}
      onValueChange={(template) => {
        if (template) {
          onSelect(template);
        }
      }}
      getItemLabel={(t) => t.name}
      getItemId={(t) => t.id}
      searchPlaceholder="Search templates..."
      emptyMessage="No templates yet"
      loading={isLoading}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
      contentWidth="320px"
      renderItem={(template) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-sm">{template.name}</span>
          <span className="text-xs text-muted-foreground line-clamp-2">{template.content}</span>
        </div>
      )}
      trigger={
        expanded ? (
          <Button
            variant="outline"
            size="sm"
            className="flex-shrink-0 h-10"
            disabled={disabled}
            type="button"
          >
            <FileText className="h-4 w-4 mr-2" />
            Template
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            className="flex-shrink-0"
            disabled={disabled}
            type="button"
          >
            <FileText className="h-4 w-4" />
          </Button>
        )
      }
      footer={
        templates.length === 0 && !isLoading ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setOpen(false);
              router.push('/settings/templates');
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Create Template
          </Button>
        ) : undefined
      }
    />
  );
}
