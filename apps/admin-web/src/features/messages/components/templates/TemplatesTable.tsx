'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Settings2 } from 'lucide-react';
import { useMessageTemplates, useDeleteTemplate, useCreateTemplate } from '../../api/templates';
import { truncatePreview } from '../../utils/templateHelpers';
import { useToast } from '@altitutor/ui';
import { CreateEditTemplateDialog } from './CreateEditTemplateDialog';
import type { Tables } from '@altitutor/shared';
import { SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';
import { getErrorMessage } from '@/shared/utils';

interface TemplatesTableProps {
  onRefresh?: number;
  onCreateTrigger?: number;
}

export function TemplatesTable({ onRefresh: _onRefresh, onCreateTrigger }: TemplatesTableProps) {
  const { data: templates, isLoading, refetch } = useMessageTemplates();
  const deleteMutation = useDeleteTemplate();
  const createMutation = useCreateTemplate();
  const { toast } = useToast();
  
  const [selectedTemplate, setSelectedTemplate] = useState<Tables<'message_templates'> | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deleteTemplateName, setDeleteTemplateName] = useState<string>('');

  const tableData = useMemo(() => templates ?? [], [templates]);

  const handleEdit = (template: Tables<'message_templates'>) => {
    setSelectedTemplate(template);
    setIsEditDialogOpen(true);
  };

  const handleDuplicate = async (template: Tables<'message_templates'>) => {
    try {
      // Duplicating a system template creates a user template (no template_key)
      await createMutation.mutateAsync({
        name: `${template.name} (Copy)`,
        content: template.content,
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

  const isSystemTemplate = (t: Tables<'message_templates'>) => !!t.template_key;

  const handleDeleteClick = (template: Tables<'message_templates'>) => {
    if (isSystemTemplate(template)) return; // Don't allow deleting system templates
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

  // Trigger create dialog when onCreateTrigger changes
  useEffect(() => {
    if (onCreateTrigger && onCreateTrigger > 0) {
      setSelectedTemplate(null);
      setIsEditDialogOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCreateTrigger]);

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

  const columns: SettingsDataTableColumn<Tables<'message_templates'>>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (template) => (
        <button
          type="button"
          className="flex items-center gap-2 text-left font-medium hover:underline"
          onClick={() => handleEdit(template)}
        >
          <span>{template.name}</span>
          {isSystemTemplate(template) ? (
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              <Settings2 className="h-3 w-3" />
              System
            </span>
          ) : null}
        </button>
      ),
      sortValue: (template) => template.name || '',
      searchValue: (template) => template.name || '',
    },
    {
      key: 'preview',
      label: 'Preview',
      className: 'max-w-[560px] text-sm text-muted-foreground',
      render: (template) => renderPreview(template.content),
      sortable: false,
      searchValue: (template) => template.content || '',
    },
    {
      key: 'type',
      label: 'Type',
      render: (template) => (isSystemTemplate(template) ? 'System' : 'User'),
      sortValue: (template) => (isSystemTemplate(template) ? 'System' : 'User'),
      filterValue: (template) => (isSystemTemplate(template) ? 'system' : 'user'),
      searchValue: (template) => (isSystemTemplate(template) ? 'System template' : 'User template'),
      visibleByDefault: false,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (template) => template.created_at ? new Date(template.created_at).toLocaleDateString() : '-',
      sortValue: (template) => template.created_at ? new Date(template.created_at) : null,
      searchValue: (template) => template.created_at || '',
      visibleByDefault: false,
    },
  ];

  return (
    <>
      <SettingsDataTable
        data={tableData}
        columns={columns}
        getRowId={(template) => template.id}
        emptyMessage={isLoading ? 'Loading templates...' : 'No templates found.'}
        searchPlaceholder="Search templates..."
        filterKeys={['type']}
        filterDefinitions={[
          {
            key: 'type',
            label: 'Type',
            options: [
              { label: 'User', value: 'user' },
              { label: 'System', value: 'system' },
            ],
          },
        ]}
        sortOptions={[
          { key: 'name', label: 'Name' },
          { key: 'created_at', label: 'Created' },
          { key: 'type', label: 'Type' },
        ]}
        defaultSort={{ field: 'name', direction: 'asc' }}
        isLoading={isLoading}
        getActions={(template) => {
          const actions = [
            {
              id: 'edit',
              label: 'Edit',
              description: 'Update this message template',
              onSelect: () => handleEdit(template),
            },
            {
              id: 'duplicate',
              label: 'Duplicate',
              description: 'Create a user template copy',
              onSelect: () => handleDuplicate(template),
            },
          ];

          if (!isSystemTemplate(template)) {
            actions.push({
              id: 'delete',
              label: 'Delete',
              description: 'Permanently delete this template',
              onSelect: () => handleDeleteClick(template),
            });
          }

          return actions;
        }}
      />

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
    </>
  );
}
