'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';
import { Button, Popover, PopoverContent, PopoverTrigger, ScrollArea } from '@altitutor/ui';
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

  const handleSelect = (template: Tables<'message_templates'>) => {
    onSelect(template);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {expanded ? (
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
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <h4 className="font-semibold text-sm">Message Templates</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Select a template to insert into your message
          </p>
        </div>
        
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              No templates yet
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setOpen(false);
                router.push('/settings/templates');
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Create Template
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-1 pr-4 p-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  className="w-full text-left p-3 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="font-medium text-sm">{template.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {template.content}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}








