'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Input,
  Button,
  Label,
  SearchableSelect,
} from '@altitutor/ui';
import { QuickFilter } from '@altitutor/shared';
import { useCreateQuickFilter, useUpdateQuickFilter, useDeleteQuickFilter } from '../hooks/useQuickFilters';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { SUPPORTED_ENTITIES, FilterField, type EntityConfig } from '../config/entities';
import { AdminDialogShell, SettingsDataTable, type SettingsDataTableColumn } from '@/shared/components';

const SCOPE_OPTIONS: { id: string; label: string }[] = [
  { id: 'global', label: 'Global (All Admins)' },
  { id: 'personal', label: 'Personal (Just Me)' },
];
import { cn } from '@/shared/utils';

interface QuickFiltersTableProps {
  filters: QuickFilter[];
  onUpdate: () => void;
  onCreateTrigger?: number;
}

const PLACEHOLDERS = [
  { value: '$ME$', label: 'Current User' },
  { value: '$TODAY$', label: 'Today' },
  { value: '$TOMORROW$', label: 'Tomorrow' },
  { value: '$YESTERDAY$', label: 'Yesterday' },
  { value: '$MONDAY_THIS_WEEK$', label: 'Monday This Week' },
  { value: '$SUNDAY_THIS_WEEK$', label: 'Sunday This Week' },
  { value: '$FUTURE$', label: 'Future' },
  { value: '$PAST$', label: 'Past' },
  { value: '$THIS_WEEK$', label: 'This Week' },
];

export function QuickFiltersTable({ filters, onUpdate, onCreateTrigger }: QuickFiltersTableProps) {
  const [editingFilter, setEditingFilter] = useState<QuickFilter | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState<Partial<QuickFilter>>({
    name: '',
    target_entity: 'tasks',
    user_id: null,
    config: {},
  });
  useEffect(() => {
    if (onCreateTrigger && onCreateTrigger > 0) {
      setIsCreateDialogOpen(true);
    }
  }, [onCreateTrigger]);

  const createFilter = useCreateQuickFilter();
  const updateFilter = useUpdateQuickFilter();
  const deleteFilter = useDeleteQuickFilter();

  const selectedEntity = useMemo(() => 
    SUPPORTED_ENTITIES.find(e => e.id === formData.target_entity),
    [formData.target_entity]
  );

  const handleEdit = (filter: QuickFilter) => {
    setEditingFilter(filter);
    setFormData(filter);
  };

  const handleSave = async () => {
    try {
      if (editingFilter) {
        await updateFilter.mutateAsync({ 
          id: editingFilter.id, 
          updates: formData
        });
        setEditingFilter(null);
      } else {
        await createFilter.mutateAsync(formData as Omit<QuickFilter, 'id' | 'created_at' | 'updated_at'>);
        setIsCreateDialogOpen(false);
      }
      onUpdate();
      setFormData({ name: '', target_entity: 'tasks', user_id: null, config: {} });
    } catch (e) {
      alert('Failed to save: ' + (e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this quick filter?')) {
      try {
        await deleteFilter.mutateAsync(id);
        onUpdate();
      } catch (e) {
        alert('Failed to delete: ' + (e as Error).message);
      }
    }
  };

  const closeDialog = () => {
    setEditingFilter(null);
    setIsCreateDialogOpen(false);
    setFormData({ name: '', target_entity: 'tasks', user_id: null, config: {} });
  };

  const getEntityLabel = (entityId: string) =>
    SUPPORTED_ENTITIES.find((entity) => entity.id === entityId)?.label ?? entityId.replace('_', ' ');

  const renderConfig = (filter: QuickFilter) => (
    <div className="flex flex-wrap gap-1">
      {Object.entries(filter.config).map(([key, values]) => {
        const entityConfig = SUPPORTED_ENTITIES.find(e => e.id === filter.target_entity);
        const field = entityConfig?.fields.find(f => f.key === key);
        const label = field?.label || key;

        return (
          <div key={key} className="bg-muted px-1.5 py-0.5 rounded text-[10px] border border-muted-foreground/20">
            <span className="font-semibold text-muted-foreground uppercase mr-1">{label}:</span>
            <span>
              {values.map(v => {
                if (typeof v === 'string') {
                  const placeholder = PLACEHOLDERS.find(p => p.value === v);
                  if (placeholder) return placeholder.label;
                }
                const opt = field?.options?.find(o => String(o.value) === String(v));
                return opt?.label || String(v);
              }).join(', ')}
            </span>
          </div>
        );
      })}
    </div>
  );

  const columns: SettingsDataTableColumn<QuickFilter>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (filter) => <span className="font-medium">{filter.name}</span>,
      sortValue: (filter) => filter.name,
      searchValue: (filter) => filter.name,
    },
    {
      key: 'entity',
      label: 'Entity',
      render: (filter) => <span className="capitalize">{getEntityLabel(filter.target_entity)}</span>,
      sortValue: (filter) => getEntityLabel(filter.target_entity),
      filterValue: (filter) => filter.target_entity,
      searchValue: (filter) => getEntityLabel(filter.target_entity),
    },
    {
      key: 'config',
      label: 'Config',
      className: 'max-w-[420px]',
      render: renderConfig,
      sortValue: (filter) => Object.keys(filter.config).length,
      searchValue: (filter) => JSON.stringify(filter.config),
    },
  ];

  const toggleFilterValue = (field: FilterField, value: string | number) => {
    const fieldKey = field.key;
    const currentConfig = { ...(formData.config || {}) };
    const currentValues = currentConfig[fieldKey] || [];
    
    let nextValues;
    if (field.type === 'date') {
      nextValues = currentValues.includes(value) ? [] : [value];
    } else {
      if (currentValues.includes(value)) {
        nextValues = currentValues.filter(v => v !== value);
      } else {
        nextValues = [...currentValues, value];
      }
    }

    if (nextValues.length === 0) {
      delete currentConfig[fieldKey];
    } else {
      currentConfig[fieldKey] = nextValues;
    }

    setFormData({ ...formData, config: currentConfig });
  };

  return (
    <>
      <SettingsDataTable
        data={filters}
        columns={columns}
        getRowId={(filter) => filter.id}
        emptyMessage="No quick filters configured"
        searchPlaceholder="Search quick filters..."
        filterKeys={['entity']}
        filterDefinitions={[
          {
            key: 'entity',
            label: 'Entity',
            options: SUPPORTED_ENTITIES.map((entity) => ({ label: entity.label, value: entity.id })),
          },
        ]}
        defaultSort={{ field: 'entity', direction: 'asc' }}
        getActions={(filter) => [
          {
            id: 'edit',
            label: 'Edit',
            onSelect: () => handleEdit(filter),
          },
          {
            id: 'delete',
            label: 'Delete',
            onSelect: () => handleDelete(filter.id),
          },
        ]}
      />

      <AdminDialogShell
        open={!!editingFilter || isCreateDialogOpen}
        onClose={closeDialog}
        title={editingFilter ? 'Edit Quick Filter' : 'Create Quick Filter'}
        subtitle="Configure the quick filter settings. Multiple values for the same property are ORed, and different properties are ANDed."
        contentClassName="md:max-w-3xl"
        footer={(
          <>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.target_entity}>
              Save Filter
            </Button>
          </>
        )}
      >
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filter-name">Filter Name</Label>
                <Input
                  id="filter-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Active My Tasks"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-entity">Target Entity</Label>
                <SearchableSelect<EntityConfig>
                  items={SUPPORTED_ENTITIES}
                  value={selectedEntity ?? null}
                  onValueChange={(v) => v && setFormData({ ...formData, target_entity: v.id, config: {} })}
                  getItemId={(item) => item.id}
                  getItemLabel={(item) => item.label}
                  placeholder="Select entity"
                  trigger={
                    <Button variant="outline" className="w-full justify-start font-normal">
                      {selectedEntity?.label ?? 'Select entity'}
                    </Button>
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scope">Scope</Label>
                <SearchableSelect<{ id: string; label: string }>
                  items={SCOPE_OPTIONS}
                  value={SCOPE_OPTIONS.find((s) => s.id === (formData.user_id ? 'personal' : 'global')) ?? null}
                  onValueChange={async (v) => {
                    if (!v) return;
                    if (v.id === 'global') {
                      setFormData({ ...formData, user_id: null });
                    } else {
                      const supabase = getSupabaseClient();
                      const { data: { user } } = await supabase.auth.getUser();
                      setFormData({ ...formData, user_id: user?.id || null });
                    }
                  }}
                  getItemId={(item) => item.id}
                  getItemLabel={(item) => item.label}
                  placeholder="Select scope"
                  trigger={
                    <Button variant="outline" className="w-full justify-start font-normal">
                      {SCOPE_OPTIONS.find((s) => s.id === (formData.user_id ? 'personal' : 'global'))?.label ?? 'Select scope'}
                    </Button>
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base">Filter Configuration</Label>
              <div className="space-y-6 border rounded-lg p-4 bg-muted/30">
                {selectedEntity?.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{field.label}</span>
                      {formData.config?.[field.key] && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[10px]"
                          onClick={() => {
                            const newConfig = { ...formData.config };
                            delete newConfig[field.key];
                            setFormData({ ...formData, config: newConfig });
                          }}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {/* Standard Options */}
                      {field.options?.map((opt) => (
                        <div
                          key={String(opt.value)}
                          onClick={() => toggleFilterValue(field, opt.value)}
                          className={cn(
                            "cursor-pointer px-2 py-1 rounded-md border text-xs transition-colors",
                            formData.config?.[field.key]?.includes(opt.value)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted"
                          )}
                        >
                          {opt.label}
                        </div>
                      ))}

                      {/* Placeholders */}
                      {field.supportPlaceholders && (
                        <>
                          {field.type === 'select' && (
                            <div
                              onClick={() => toggleFilterValue(field, '$ME$')}
                              className={cn(
                                "cursor-pointer px-2 py-1 rounded-md border text-xs border-dashed transition-colors",
                                formData.config?.[field.key]?.includes('$ME$')
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-200"
                              )}
                            >
                              $ME$ (Current User)
                            </div>
                          )}
                          {field.type === 'date' && (
                            PLACEHOLDERS.slice(1).map(p => (
                              <div
                                key={p.value}
                                onClick={() => toggleFilterValue(field, p.value)}
                                className={cn(
                                  "cursor-pointer px-2 py-1 rounded-md border text-xs border-dashed transition-colors",
                                  formData.config?.[field.key]?.includes(p.value)
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-200"
                                )}
                              >
                                {p.value} ({p.label})
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
      </AdminDialogShell>
    </>
  );
}
