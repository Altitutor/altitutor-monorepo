'use client';

import { useState, useEffect } from 'react';
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

interface QuickFiltersTableProps {
  filters: QuickFilter[];
  onUpdate: () => void;
}

export function QuickFiltersTable({ filters, onUpdate }: QuickFiltersTableProps) {
  const [editingFilter, setEditingFilter] = useState<QuickFilter | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<QuickFilter>>({
    name: '',
    target_entity: 'tasks',
    user_id: null,
    config: {},
  });

  const createFilter = useCreateQuickFilter();
  const updateFilter = useUpdateQuickFilter();
  const deleteFilter = useDeleteQuickFilter();

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    fetchUser();
  }, []);

  const handleEdit = (filter: QuickFilter) => {
    setEditingFilter(filter);
    setFormData(filter);
  };

  const handleSave = async () => {
    try {
      if (editingFilter) {
        await updateFilter.mutateAsync({ 
          id: editingFilter.id, 
          updates: {
            ...formData,
            user_id: formData.user_id === 'CURRENT' ? currentUserId : formData.user_id
          } 
        });
        setEditingFilter(null);
      } else {
        await createFilter.mutateAsync({
          name: formData.name!,
          target_entity: formData.target_entity!,
          config: formData.config!,
          user_id: formData.user_id === 'CURRENT' ? currentUserId : formData.user_id
        } as any);
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
              <TableHead>Scope</TableHead>
              <TableHead>Config</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filters.map((filter) => (
              <TableRow key={filter.id}>
                <TableCell className="font-medium">{filter.name}</TableCell>
                <TableCell className="capitalize">{filter.target_entity}</TableCell>
                <TableCell>
                  {filter.user_id ? 'Personal' : 'Global'}
                </TableCell>
                <TableCell className="max-w-[300px] truncate font-mono text-xs">
                  {JSON.stringify(filter.config)}
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
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingFilter ? 'Edit Quick Filter' : 'Create Quick Filter'}
            </DialogTitle>
            <DialogDescription>
              Configure the quick filter settings. Use placeholders like $ME$, $TODAY$, etc. in the JSON config.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="filter-name" className="text-right">Name</Label>
              <Input
                id="filter-name"
                className="col-span-3"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Active assigned to me"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="target-entity" className="text-right">Target Entity</Label>
              <div className="col-span-3">
                <Select 
                  value={formData.target_entity} 
                  onValueChange={(val) => setFormData({ ...formData, target_entity: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tasks">Tasks</SelectItem>
                    <SelectItem value="students">Students</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="scope" className="text-right">Scope</Label>
              <div className="col-span-3">
                <Select 
                  value={formData.user_id ? 'personal' : 'global'} 
                  onValueChange={(val) => setFormData({ ...formData, user_id: val === 'global' ? null : 'CURRENT' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (All Users)</SelectItem>
                    <SelectItem value="personal">Personal (Just Me)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="config">Config (JSON)</Label>
              <textarea
                id="config"
                className="w-full h-48 p-2 border rounded-md font-mono text-sm bg-muted/50"
                value={JSON.stringify(formData.config, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setFormData({ ...formData, config: parsed });
                  } catch (e) {
                    // Just update the raw value if possible or ignore
                  }
                }}
                spellCheck={false}
              />
              <p className="text-[10px] text-muted-foreground">
                Example: {"{ \"status\": [\"todo\", \"in_progress\"], \"assignee\": [\"$ME$\"] }"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingFilter(null);
              setIsCreateDialogOpen(false);
              setFormData({ name: '', target_entity: 'tasks', user_id: null, config: {} });
            }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.target_entity}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
