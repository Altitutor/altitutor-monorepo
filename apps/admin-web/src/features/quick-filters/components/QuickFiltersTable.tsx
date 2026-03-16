'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { QuickFilter } from '@altitutor/shared';
import { useCreateQuickFilter, useUpdateQuickFilter, useDeleteQuickFilter } from '../hooks/useQuickFilters';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { SUPPORTED_ENTITIES, FilterField } from '../config/entities';
import { cn } from '@/shared/utils';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';

interface QuickFiltersTableProps {
  filters: QuickFilter[];
  onUpdate: () => void;
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

export function QuickFiltersTable({ filters, onUpdate }: QuickFiltersTableProps) {
  const [editingFilter, setEditingFilter] = useState<QuickFilter | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState<Partial<QuickFilter>>({
    name: '',
    target_entity: 'tasks',
    user_id: null,
    config: {},
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!editingFilter && !isCreateDialogOpen) setExpanded(false);
  }, [editingFilter, isCreateDialogOpen]);

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
      <div className="flex justify-end mb-4">
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Quick Filter
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Config</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filters.map((filter) => (
              <TableRow key={filter.id}>
                <TableCell className="font-medium">{filter.name}</TableCell>
                <TableCell className="capitalize">{filter.target_entity.replace('_', ' ')}</TableCell>
                <TableCell className="max-w-[400px]">
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
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(filter)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(filter.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filters.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No quick filters configured
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!editingFilter || isCreateDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingFilter(null);
            setIsCreateDialogOpen(false);
            setFormData({ name: '', target_entity: 'tasks', user_id: null, config: {} });
          }
        }}
      >
        <DialogContent
          className={cn(
            'max-w-3xl max-h-[90vh] flex flex-col',
            EXPANDABLE_DIALOG_TRANSITION,
            expanded && EXPANDED_DIALOG_CONTENT_CLASS
          )}
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle>
              {editingFilter ? 'Edit Quick Filter' : 'Create Quick Filter'}
            </DialogTitle>
            <DialogDescription>
              Configure the quick filter settings. Multiple values for the same property are ORed, and different properties are ANDed.
            </DialogDescription>
              </div>
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
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
                <Select 
                  value={formData.target_entity} 
                  onValueChange={(val) => setFormData({ ...formData, target_entity: val, config: {} })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_ENTITIES.map(entity => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scope">Scope</Label>
                <Select 
                  value={formData.user_id ? 'personal' : 'global'} 
                  onValueChange={async (val) => {
                    if (val === 'global') {
                      setFormData({ ...formData, user_id: null });
                    } else {
                      const supabase = getSupabaseClient();
                      const { data: { user } } = await supabase.auth.getUser();
                      setFormData({ ...formData, user_id: user?.id || null });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (All Admins)</SelectItem>
                    <SelectItem value="personal">Personal (Just Me)</SelectItem>
                  </SelectContent>
                </Select>
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

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => {
              setEditingFilter(null);
              setIsCreateDialogOpen(false);
              setFormData({ name: '', target_entity: 'tasks', user_id: null, config: {} });
            }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.target_entity}>
              Save Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
