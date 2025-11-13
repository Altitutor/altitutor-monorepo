'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { SkeletonTable } from '@altitutor/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@altitutor/ui';
import {
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
import { useMessageTemplates, useDeleteTemplate, useCreateTemplate } from '../../api/templates';
import { formatRelativeDate, truncatePreview } from '../../utils/templateHelpers';
import { useToast } from '@altitutor/ui';
import { CreateEditTemplateDialog } from './CreateEditTemplateDialog';
import type { Tables } from '@altitutor/shared';
import { useDebounce } from '@/shared/hooks';
import { cn } from '@/shared/utils';

interface TemplatesTableProps {
  onRefresh?: number;
}

type SortField = 'name' | 'created_at';

export function TemplatesTable({ onRefresh }: TemplatesTableProps) {
  const { data: templates, isLoading, refetch } = useMessageTemplates();
  const deleteMutation = useDeleteTemplate();
  const createMutation = useCreateTemplate();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedTemplate, setSelectedTemplate] = useState<Tables<'message_templates'> | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deleteTemplateName, setDeleteTemplateName] = useState<string>('');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Filter and sort templates
  const filteredAndSortedTemplates = useMemo(() => {
    if (!templates) return [];

    let result = [...templates];

    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      result = result.filter(template =>
        template.name.toLowerCase().includes(searchLower) ||
        template.content.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      if (sortField === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (sortField === 'created_at') {
        const aDate = new Date(a.created_at || 0).getTime();
        const bDate = new Date(b.created_at || 0).getTime();
        comparison = aDate - bDate;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [templates, debouncedSearchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleEdit = (template: Tables<'message_templates'>) => {
    setSelectedTemplate(template);
    setIsEditDialogOpen(true);
  };

  const handleDuplicate = async (template: Tables<'message_templates'>) => {
    try {
      await createMutation.mutateAsync({
        name: `${template.name} (Copy)`,
        content: template.content,
      });
      toast({
        title: 'Success',
        description: 'Template duplicated successfully.',
      });
      refetch();
    } catch (error: any) {
      console.error('Error duplicating template:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to duplicate template.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteClick = (template: Tables<'message_templates'>) => {
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
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete template.',
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

  // Highlight variables in preview text
  const renderPreview = (text: string) => {
    const truncated = truncatePreview(text, 80);
    const parts = truncated.split(/(\{[^}]+\})/g);
    
    return (
      <span>
        {parts.map((part, index) => {
          if (part.match(/^\{[^}]+\}$/)) {
            return (
              <span key={index} className="text-muted-foreground font-mono text-xs">
                {part}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  };

  // Loading state
  if (isLoading && !templates) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              className="pl-8"
              value=""
              disabled
            />
          </div>
        </div>
        <SkeletonTable rows={8} columns={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={handleNewTemplate}>
          New Template
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer" 
                onClick={() => handleSort('name')}
              >
                Name
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'name' ? "opacity-100" : "opacity-40"
                )} />
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
                  <TableCell className="font-medium">
                    {template.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {renderPreview(template.content)}
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

      {/* Create/Edit Dialog */}
      <CreateEditTemplateDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
        onSuccess={handleDialogSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={(open) => {
        if (!open) {
          setDeleteTemplateId(null);
          setDeleteTemplateName('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTemplateName}&quot;. This action cannot be undone.
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


