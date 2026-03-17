'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  SkeletonTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@altitutor/ui';
import { Search, ArrowUpDown, MoreVertical, Edit, Copy, Trash2 } from 'lucide-react';
import {
  useRichTextTemplates,
  useDeleteRichTextTemplate,
  useCreateRichTextTemplate,
} from '../api/templates';
import { extractTextFromNoteContent } from '@/shared/utils/noteContentUtils';
import { useToast } from '@altitutor/ui';
import { CreateEditRichTextTemplateDialog } from './CreateEditRichTextTemplateDialog';
import type { Tables } from '@altitutor/shared';
import { useDebounce } from '@/shared/hooks';
import { cn, getErrorMessage } from '@/shared/utils';
import type { Json } from '@altitutor/shared';
import type { JSONContent } from '@tiptap/core';

interface RichTextTemplatesTableProps {
  onCreateTrigger?: number;
}

type SortField = 'name' | 'updated_at';

function truncatePreview(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}

export function RichTextTemplatesTable({ onCreateTrigger }: RichTextTemplatesTableProps) {
  const { data: templates, isLoading, refetch } = useRichTextTemplates();
  const deleteMutation = useDeleteRichTextTemplate();
  const createMutation = useCreateRichTextTemplate();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedTemplate, setSelectedTemplate] = useState<Tables<'rich_text_templates'> | null>(
    null
  );
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deleteTemplateName, setDeleteTemplateName] = useState<string>('');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredAndSortedTemplates = useMemo(() => {
    if (!templates) return [];

    let result = [...templates];

    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      result = result.filter((template) => {
        const nameMatch = template.name.toLowerCase().includes(searchLower);
        const previewText = extractTextFromNoteContent(template.content as Json);
        const contentMatch = previewText.toLowerCase().includes(searchLower);
        return nameMatch || contentMatch;
      });
    }

    result.sort((a, b) => {
      let comparison = 0;

      if (sortField === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (sortField === 'updated_at') {
        const aDate = new Date(a.updated_at || 0).getTime();
        const bDate = new Date(b.updated_at || 0).getTime();
        comparison = aDate - bDate;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [templates, debouncedSearchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleEdit = (template: Tables<'rich_text_templates'>) => {
    setSelectedTemplate(template);
    setIsEditDialogOpen(true);
  };

  const handleDuplicate = async (template: Tables<'rich_text_templates'>) => {
    try {
      await createMutation.mutateAsync({
        name: `${template.name} (Copy)`,
        content: template.content as JSONContent,
      });
      toast({
        title: 'Success',
        description: 'Template duplicated successfully.',
      });
      refetch();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('Error duplicating template:', error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to duplicate template.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteClick = (template: Tables<'rich_text_templates'>) => {
    setDeleteTemplateId(template.id);
    setDeleteTemplateName(template.name);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTemplateId) return;

    try {
      await deleteMutation.mutateAsync(deleteTemplateId);
      toast({
        title: 'Success',
        description: 'Template deleted successfully.',
      });
      setDeleteTemplateId(null);
      setDeleteTemplateName('');
      refetch();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to delete template.',
        variant: 'destructive',
      });
    }
  };

  const handleDialogSuccess = () => {
    refetch();
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setIsEditDialogOpen(true);
  };

  useEffect(() => {
    if (onCreateTrigger && onCreateTrigger > 0) {
      setSelectedTemplate(null);
      setIsEditDialogOpen(true);
    }
  }, [onCreateTrigger]);

  if (isLoading && !templates) {
    return (
      <div className="space-y-4">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search templates..." className="pl-8" value="" disabled />
        </div>
        <SkeletonTable rows={8} columns={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative w-64">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                Name
                <ArrowUpDown
                  className={cn(
                    'ml-2 h-4 w-4 inline',
                    sortField === 'name' ? 'opacity-100' : 'opacity-40'
                  )}
                />
              </TableHead>
              <TableHead>Preview</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24">
                  {isLoading ? (
                    'Loading templates...'
                  ) : searchTerm ? (
                    'No templates match your search'
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-muted-foreground">No templates found.</p>
                      <Button onClick={handleNewTemplate} variant="outline" size="sm">
                        Create your first template
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedTemplates.map((template) => (
                <TableRow
                  key={template.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleEdit(template)}
                >
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                    {truncatePreview(
                      extractTextFromNoteContent(template.content as Json),
                      80
                    ) || '(empty)'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(template)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(template)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateEditRichTextTemplateDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
        onSuccess={handleDialogSuccess}
      />

      <AlertDialog
        open={!!deleteTemplateId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTemplateId(null);
            setDeleteTemplateName('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTemplateName}&quot;. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
