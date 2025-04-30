# Table View and Edit Implementation Guide

This guide provides instructions for implementing consistent table view and edit functionality across different entities in the admin application. This implementation follows the pattern established in the subjects module.

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Implementation Steps](#implementation-steps)
4. [Key Components](#key-components)
5. [API Patterns](#api-patterns)
6. [Example Implementation](#example-implementation)

## Overview

Our admin app follows a consistent pattern for displaying, filtering, and editing data entities. Each entity (Subjects, Staff, Classes, etc.) has a table view that supports:

- Displaying data in a sortable, filterable table
- Clicking a row to view detailed information in a modal
- Editing entity details within the same modal
- Deleting entities with confirmation
- Quick navigation buttons to related entities

## File Structure

For each entity, create the following files in the `src/components/features/[entity-name]/` directory:

1. `[Entity]Table.tsx` - The main table component
2. `View[Entity]Modal.tsx` - Modal for viewing entity details and providing edit functionality
3. `Add[Entity]Modal.tsx` - Modal for creating new entities (optional)
4. `Edit[Entity]Modal.tsx` - Modal for editing entities (optional, can be combined with View modal)
5. `index.ts` - Barrel file to export all components

Looking at the subjects implementation, you'll see:

```
src/components/features/subjects/
├── SubjectsTable.tsx       # Main table component 
├── ViewSubjectModal.tsx    # View/edit/delete modal
├── AddSubjectModal.tsx     # Modal for adding new subjects
├── EditSubjectModal.tsx    # Edit-specific modal
└── index.ts                # Exports all components
```

Additionally, ensure you have:

- API methods in `src/lib/supabase/api/[entity-name].ts`
- Repository in `src/lib/supabase/db/repositories.ts`
- Entity types in `src/lib/supabase/db/types.ts`

## Implementation Steps

### 1. Table Component

Start by implementing the table component based on the `SubjectsTable.tsx` pattern:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Search, ArrowUpDown, Filter, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { [EntityName] } from '@/lib/supabase/db/types';
import { [entityName]Api } from '@/lib/supabase/api';
import { View[EntityName]Modal } from './View[EntityName]Modal';
import { cn } from '@/lib/utils/index';

export function [EntityName]Table({ onRefresh }: { onRefresh?: number }) {
  const router = useRouter();
  const [items, setItems] = useState<[EntityName][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filteredItems, setFilteredItems] = useState<[EntityName][]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof [EntityName]>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selected[EntityName]Id, setSelected[EntityName]Id] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Load data
  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await [entityName]Api.getAll[EntityName]s();
      setItems(data);
    } catch (err) {
      console.error('Failed to load [entityName]s:', err);
      setError('Failed to load [entityName]s. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize and refresh data
  useEffect(() => {
    loadItems();
  }, [onRefresh]);

  // Apply filters and sorting
  useEffect(() => {
    if (!items) return;
    
    let result = [...items];
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(item => 
        // Add specific fields to search here
        item.name.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      const valueA = a[sortField];
      const valueB = b[sortField];
      
      if (valueA === null || valueA === undefined) return sortDirection === 'asc' ? -1 : 1;
      if (valueB === null || valueB === undefined) return sortDirection === 'asc' ? 1 : -1;
      
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB) 
          : valueB.localeCompare(valueA);
      }
      
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortDirection === 'asc' 
          ? valueA - valueB 
          : valueB - valueA;
      }
      
      return 0;
    });
    
    setFilteredItems(result);
  }, [items, searchTerm, sortField, sortDirection]);

  // Handle sorting column clicks
  const handleSort = (field: keyof [EntityName]) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Handle row click
  const handleItemClick = (id: string) => {
    setSelected[EntityName]Id(id);
    setIsViewModalOpen(true);
  };

  // UI States
  if (loading) {
    return <div className="flex justify-center p-4">Loading [entityName]s...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search and filter controls */}
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search [entityName]s..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex space-x-2 items-center">
          <Button variant="outline" size="sm" onClick={loadItems} className="flex items-center">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          {/* Add more filters here as needed */}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {/* Add table headers with sorting */}
              <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                Name
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'name' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              {/* Add more header columns */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24">
                  {searchTerm 
                    ? "No [entityName]s match your filters" 
                    : "No [entityName]s found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow 
                  key={item.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleItemClick(item.id)}
                >
                  <TableCell className="font-medium">{item.name}</TableCell>
                  {/* Add more cell data */}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View/Edit Modal */}
      <View[EntityName]Modal 
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        [entityName]Id={selected[EntityName]Id}
        on[EntityName]Updated={loadItems}
      />
    </div>
  );
}
```

### 2. View Modal Component

Next, implement the view/edit modal based on the `ViewSubjectModal.tsx` pattern:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, Pencil, Trash2 } from 'lucide-react';
import { [entityName]Api } from '@/lib/supabase/api';
import { [EntityName] } from '@/lib/supabase/db/types';
import { useRouter } from 'next/navigation';
import { useToast } from "@/components/ui/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export interface View[EntityName]ModalProps {
  isOpen: boolean;
  onClose: () => void;
  [entityName]Id: string | null;
  on[EntityName]Updated?: () => void;
}

export function View[EntityName]Modal({ isOpen, onClose, [entityName]Id, on[EntityName]Updated }: View[EntityName]ModalProps) {
  const [item, setItem] = useState<[EntityName] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  
  // Form schema for validation
  const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    // Add more fields as needed
  });

  // Initialize the form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      // Set other field defaults
    },
  });

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && [entityName]Id) {
      loadItem([entityName]Id);
    } else {
      setItem(null);
      setError(null);
    }
  }, [isOpen, [entityName]Id]);

  // Update form values when item is loaded
  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        // Set other field values
      });
    }
  }, [item, form]);

  // Load item data
  const loadItem = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await [entityName]Api.get[EntityName](id);
      if (data) {
        setItem(data);
      } else {
        setError('[EntityName] not found.');
      }
    } catch (err) {
      console.error('Failed to load [entityName]:', err);
      setError('Failed to load [entityName] details.');
    } finally {
      setLoading(false);
    }
  };

  // Handle edit button click
  const handleEditClick = () => {
    setIsEditing(true);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    if (item) {
      form.reset({
        name: item.name,
        // Reset other fields
      });
    }
    setIsEditing(false);
  };

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!item) return;
    
    try {
      setLoading(true);
      const updatedData: Partial<[EntityName]> = {
        name: values.name,
        // Set other fields
      };
      
      await [entityName]Api.update[EntityName](item.id, updatedData);
      
      const updatedItem = {
        ...item,
        ...updatedData,
      };
      
      setItem(updatedItem);
      setIsEditing(false);
      
      toast({
        title: "[EntityName] updated",
        description: `${updatedItem.name} has been updated successfully.`,
      });
      
      if (on[EntityName]Updated) {
        on[EntityName]Updated();
      }
    } catch (err) {
      console.error('Failed to update [entityName]:', err);
      toast({
        title: "Update failed",
        description: "There was an error updating the [entityName]. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDeleteItem = async () => {
    if (!item) return;
    
    try {
      setIsDeleting(true);
      await [entityName]Api.delete[EntityName](item.id);
      
      toast({
        title: "[EntityName] deleted",
        description: `${item.name} has been deleted successfully.`,
      });
      
      onClose();
      
      if (on[EntityName]Updated) {
        on[EntityName]Updated();
      }
    } catch (err) {
      console.error('Failed to delete [entityName]:', err);
      toast({
        title: "Delete failed",
        description: "There was an error deleting the [entityName]. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Navigation helper
  const navigateTo = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(isOpen) => {
      if (!isOpen) onClose();
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {loading ? 'Loading [EntityName]...' : item?.name || '[EntityName] Details'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading [entityName] details...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold">Error Loading [EntityName]</h3>
            <p className="text-muted-foreground">{error}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => [entityName]Id && loadItem([entityName]Id)}
            >
              Try Again
            </Button>
          </div>
        ) : item ? (
          <div className="space-y-6">
            {isEditing ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>Edit [EntityName] Details</span>
                  </CardTitle>
                  <CardDescription>
                    Update [entityName] information below
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Add more form fields */}

                      <div className="flex justify-between items-center mt-6">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" type="button" className="flex items-center">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete [EntityName]
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the [entityName]
                                "{item.name}" and all associated data from the database.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={handleDeleteItem}
                                disabled={isDeleting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {isDeleting ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  'Delete'
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <div className="flex space-x-2">
                          <Button variant="outline" type="button" onClick={handleCancelEdit}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      <span>[EntityName] Details</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center" 
                        onClick={handleEditClick}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Key information about this [entityName]
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Name</h4>
                        <p className="text-base">{item.name}</p>
                      </div>
                      
                      {/* Add more detail fields */}
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Created At</h4>
                        <p className="text-base">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Related entity navigation buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* Add navigation buttons to related entities */}
                  <Button variant="outline" className="flex items-center" onClick={() => navigateTo('[path-to-related-entity]')}>
                    Related Entity
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
```

### 3. API Implementation

Create an API module for the entity based on the `subjects.ts` pattern:

```typescript
// src/lib/supabase/api/[entity-name].ts
import { [entityName]Repository } from '../db/repositories';
import { [EntityName] } from '../db/types';
import { adminRepository } from '../db/admin';

export const [entityName]Api = {
  /**
   * Get all [entityName]s
   */
  getAll[EntityName]s: async (): Promise<[EntityName][]> => {
    try {
      const items = await [entityName]Repository.getAll();
      return items;
    } catch (error) {
      console.error('Error getting [entityName]s:', error);
      throw error;
    }
  },
  
  /**
   * Get a [entityName] by ID
   */
  get[EntityName]: async (id: string): Promise<[EntityName] | undefined> => {
    return [entityName]Repository.getById(id);
  },
  
  /**
   * Create a new [entityName]
   */
  create[EntityName]: async (data: Partial<[EntityName]>): Promise<[EntityName]> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return [entityName]Repository.create(data);
  },
  
  /**
   * Update a [entityName]
   */
  update[EntityName]: async (id: string, data: Partial<[EntityName]>): Promise<[EntityName]> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return [entityName]Repository.update(id, data);
  },
  
  /**
   * Delete a [entityName]
   */
  delete[EntityName]: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return [entityName]Repository.delete(id);
  },

  // Add methods for related entities as needed
};
```

## Key Components

### Styling Enums with Badges

For enum values, create a badge helper like the one used in `SubjectsTable.tsx`:

```tsx
// Example from SubjectsTable.tsx
const getCurriculumBadge = (curriculum: SubjectCurriculum | null | undefined) => {
  if (!curriculum) return null;
  
  const colorMap: Record<SubjectCurriculum, string> = {
    [SubjectCurriculum.SACE]: 'bg-blue-100 text-blue-800',
    [SubjectCurriculum.IB]: 'bg-purple-100 text-purple-800',
    [SubjectCurriculum.PRESACE]: 'bg-green-100 text-green-800',
    [SubjectCurriculum.PRIMARY]: 'bg-yellow-100 text-yellow-800',
  };
  
  return (
    <Badge className={colorMap[curriculum]}>
      {curriculum}
    </Badge>
  );
};
```

### Delete Confirmation Dialog

The delete confirmation dialog in `ViewSubjectModal.tsx` uses the AlertDialog component:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" type="button" className="flex items-center">
      <Trash2 className="mr-2 h-4 w-4" />
      Delete [EntityName]
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete the [entityName]
        "{item.name}" and all associated data from the database.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction 
        onClick={handleDeleteItem}
        disabled={isDeleting}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {isDeleting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Deleting...
          </>
        ) : (
          'Delete'
        )}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## API Patterns

Follow these patterns for API design as shown in the `subjects.ts` API file:

1. **Repository-based operations**: Use the repository pattern for basic CRUD operations
2. **Admin checks**: Always include admin verification before mutating operations (see `adminRepository.ensureAdminUser()`)
3. **Error handling**: Use consistent error handling patterns with try/catch blocks
4. **Data formatting**: Return properly formatted data for the frontend

## Example Implementation

The subjects module provides a complete reference implementation:

- `src/components/features/subjects/SubjectsTable.tsx` - Table implementation showing filter, sort, and row click handling
- `src/components/features/subjects/ViewSubjectModal.tsx` - View/edit modal with form handling, validation, and delete functionality
- `src/components/features/subjects/EditSubjectModal.tsx` - Separate edit modal (you may prefer to combine this with the view modal)
- `src/components/features/subjects/AddSubjectModal.tsx` - Modal for adding new subjects
- `src/lib/supabase/api/subjects.ts` - API methods for CRUD operations and related data
- `src/lib/supabase/db/repositories.ts` - Repository implementation

To adapt this for other entities:

1. Start by copying the subjects implementation
2. Replace all instances of "subject" with your entity name
3. Update the form fields, table columns, and other entity-specific elements
4. Add custom logic specific to your entity

## Additional Tips

1. Use the form schema validation for proper error handling
2. Keep modals as focused and simple as possible
3. Use badges for status and type fields to improve visual clarity
4. Implement loading states for all async operations
5. Use consistent styling across all entity tables
6. Consider splitting create, read, update, delete functionality into separate components if they become complex

---

By following this guide, you'll create a consistent user experience across all entities in the admin application. 