'use client';

import { useState, useMemo } from 'react';
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  Input,
  ScrollArea,
} from '@altitutor/ui';
import { FileText, Search } from 'lucide-react';
import { useRichTextTemplates } from '../api/templates';
import type { Tables } from '@altitutor/shared';
import { extractTextFromNoteContent } from '@/shared/utils/noteContentUtils';
import type { Json } from '@altitutor/shared';

interface RichTextTemplateInsertSubmenuProps {
  onSelect: (template: Tables<'rich_text_templates'>) => void;
  disabled?: boolean;
}

export function RichTextTemplateInsertSubmenu({
  onSelect,
  disabled,
}: RichTextTemplateInsertSubmenuProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: templates = [], isLoading } = useRichTextTemplates();

  const filteredTemplates = useMemo(() => {
    if (!searchTerm.trim()) return templates;

    const searchLower = searchTerm.toLowerCase();
    return templates.filter((template) => {
      const nameMatch = template.name.toLowerCase().includes(searchLower);
      const previewText = extractTextFromNoteContent(template.content as Json);
      const contentMatch = previewText.toLowerCase().includes(searchLower);
      return nameMatch || contentMatch;
    });
  }, [templates, searchTerm]);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled}>
        <FileText className="h-4 w-4 mr-2" />
        Insert template
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-80 p-0">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              className="pl-8 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading templates...
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {searchTerm ? 'No templates match your search' : 'No templates yet'}
          </div>
        ) : (
          <ScrollArea className="h-[240px]">
            <div className="p-2 space-y-0.5">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onSelect(template)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
                >
                  <div className="font-medium truncate">{template.name}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {extractTextFromNoteContent(template.content as Json) || '(empty)'}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
