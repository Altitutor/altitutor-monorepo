# Table View and Edit Implementation Guide

This guide provides instructions for implementing consistent table view and edit functionality across different entities in the admin application. This implementation follows the patterns established in the subjects, topics, and staff modules.

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Implementation Steps](#implementation-steps)
4. [Key Components](#key-components)
5. [API Patterns](#api-patterns)
6. [Example Implementation](#example-implementation)
7. [Modal Design Principles](#modal-design-principles)
8. [Common UI Patterns](#common-ui-patterns)

## Overview

Our admin app follows a consistent pattern for displaying, filtering, and editing data entities. Each entity (Subjects, Staff, Topics, etc.) has a table view that supports:

- Displaying data in a sortable, filterable table
- Clicking a row to view detailed information in a modal
- Combined view/edit functionality in a single modal
- Deleting entities with confirmation
- Quick navigation buttons to related entities
- Consistent UI patterns for dropdowns, badges, and filters

The admin UI follows these key principles:
1. Consistency in modal behavior and animation
2. Combined view/edit functionality in one component
3. Full-height modals when appropriate
4. Standardized table layouts and filter controls
5. Clear visual hierarchy with cards and sections

## File Structure

For each entity, create the following files in the `src/components/features/[entity-name]/` directory:

1. `[Entity]Table.tsx` - The main table component
2. `View[Entity]Modal.tsx` - Modal for viewing entity details and providing edit functionality
3. `Add[Entity]Modal.tsx` - Modal for creating new entities
4. `index.ts` - Barrel file to export all components

The current pattern combines view and edit functionality in a single modal component rather than using separate components, which provides a more streamlined user experience.

```
src/components/features/subjects/
├── SubjectsTable.tsx       # Main table component 
├── ViewSubjectModal.tsx    # Combined view/edit/delete modal
├── AddSubjectModal.tsx     # Modal for adding new subjects
└── index.ts                # Exports all components
```

Additionally, ensure you have:

- API methods in `src/lib/supabase/api/[entity-name].ts`
- Repository in `src/lib/supabase/db/repositories.ts`
- Entity types in `src/lib/supabase/db/types.ts`

This structure has been implemented consistently across the Subjects, Staff, and Topics modules.

## Implementation Steps

### 1. Table Component

Start by implementing the table component based on the patterns in `SubjectsTable.tsx` and `StaffTable.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Search, ArrowUpDown, Filter, RefreshCw, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { [EntityName] } from '@/lib/supabase/db/types';
import { [entityName]Api } from '@/lib/supabase/api';
import { View[EntityName]Modal } from './View[EntityName]Modal';
import { Add[EntityName]Modal } from './Add[EntityName]Modal';
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

  // Handle item updated (reloads the data)
  const handleItemUpdated = () => {
    loadItems();
  };

  // Handle add button click
  const handleAddItemClick = () => {
    setIsAddModalOpen(true);
  };

  // UI States
  if (loading && items.length === 0) {
    return <div className="flex justify-center p-4">Loading [entityName]s...</div>;
  }

  if (error && items.length === 0) {
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
          {/* Add dropdown filters as needed */}
          <Button variant="outline" size="sm" onClick={loadItems} className="flex items-center">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button size="sm" onClick={handleAddItemClick} className="flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Add [EntityName]
          </Button>
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
      
      <div className="text-sm text-muted-foreground">
        {filteredItems.length} items displayed
      </div>

      {/* View/Edit Modal */}
      <View[EntityName]Modal 
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        [entityName]Id={selected[EntityName]Id}
        on[EntityName]Updated={handleItemUpdated}
      />
      
      {/* Add Modal */}
      <Add[EntityName]Modal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        on[EntityName]Added={handleItemUpdated}
      />
    </div>
  );
}
```

### 2. View/Edit Modal Component

Next, implement the combined view/edit modal based on the patterns in `ViewSubjectModal.tsx` and `ViewStaffModal.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      setIsEditing(false);
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

  return (
    <Dialog open={isOpen} onOpenChange={(isOpen) => {
      if (!isOpen) onClose();
    }}>
      <DialogContent className="max-w-4xl max-h-[100vh] h-full overflow-auto">
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

                {/* Related entity navigation buttons or additional sections */}
                {/* Add these based on entity relationships */}
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
```

## Key Components

### Styling Enums with Badges

For enum values, create a badge helper like those used in the implemented tables:

```tsx
// Example from StaffTable.tsx
const getRoleBadgeColor = (role: StaffRole) => {
  switch (role) {
    case StaffRole.ADMIN:
      return 'bg-purple-100 text-purple-800';
    case StaffRole.TUTOR:
      return 'bg-blue-100 text-blue-800';
    case StaffRole.ADMINSTAFF:
      return 'bg-indigo-100 text-indigo-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// Then use it in your table cells:
<TableCell>
  <Badge className={getRoleBadgeColor(staff.role)}>
    {staff.role}
  </Badge>
</TableCell>
```

### Delete Confirmation Dialog

Implement consistent delete confirmation using the AlertDialog component:

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

### Dropdown Filters

Use dropdown menus for filters in your tables:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button 
      variant={filterValue !== 'ALL' ? "secondary" : "outline"} 
      size="sm"
      className="flex items-center"
    >
      <Filter className="h-4 w-4 mr-2" />
      {filterValue === 'ALL' ? 'Filter Name' : filterValue}
      <ChevronDown className="h-4 w-4 ml-1" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => setFilterValue('ALL')}>
      All Values
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setFilterValue('OPTION_1')}>
      Option 1
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setFilterValue('OPTION_2')}>
      Option 2
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Modal Design Principles

Following the implemented patterns, we have established these consistent modal design principles:

### 1. Animation and Background

- Modals should have a consistent animation speed (250ms)
- The background should be darkened but not blurred
- Use `max-h-[100vh]` and `h-full` for modals that need full height
- Standard modal width should be 425px or wider (max-w-3xl or max-w-4xl) depending on content

```tsx
// DialogContent common settings for consistency
<DialogContent className="max-w-4xl max-h-[100vh] h-full overflow-auto">
  {/* Modal content */}
</DialogContent>
```

### 2. Combined View/Edit Approach

All entity modals should use a combined view/edit approach rather than separate modal components:

1. Default view shows read-only content with an Edit button
2. When Edit is clicked, the same modal switches to a form interface
3. After saving, the view reverts to read-only mode with updated data
4. Delete functionality is available in both view and edit modes

This approach improves user experience by:
- Reducing the number of different components
- Providing seamless transitions between viewing and editing
- Maintaining context when editing
- Creating a consistent pattern across the application

### 3. Loading States

Implement consistent loading states for all async operations:

```tsx
{loading ? (
  <div className="flex justify-center items-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="ml-2">Loading {entityName} details...</span>
  </div>
) : error ? (
  <div className="flex flex-col items-center py-8 text-center">
    <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
    <h3 className="text-lg font-semibold">Error Loading {EntityName}</h3>
    <p className="text-muted-foreground">{error}</p>
    <Button 
      variant="outline" 
      className="mt-4"
      onClick={() => entityNameId && loadItem(entityNameId)}
    >
      Try Again
    </Button>
  </div>
) : item ? (
  // Main content
) : null}
```

### 4. Card-Based Content Structure

Organize modal content using Card components for visual hierarchy:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex justify-between items-center">
      <span>Section Title</span>
      <Button 
        variant="outline" 
        size="sm" 
        className="flex items-center" 
        onClick={handleActionClick}
      >
        <Icon className="mr-2 h-4 w-4" />
        Action
      </Button>
    </CardTitle>
    <CardDescription>
      Section description text
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Section content */}
  </CardContent>
</Card>
```

## API Patterns

Follow these patterns for API design as shown in the implemented API files:

### 1. Repository-Based Operations

Use the repository pattern for basic CRUD operations. The base Repository class handles standard database operations and field conversions.

```typescript
// Example API method structure
export const entityNameApi = {
  getAllEntityNames: async (): Promise<EntityName[]> => {
    try {
      const items = await entityNameRepository.getAll();
      return items;
    } catch (error) {
      console.error('Error getting entity names:', error);
      throw error;
    }
  },
  
  getEntityName: async (id: string): Promise<EntityName | undefined> => {
    return entityNameRepository.getById(id);
  }
};
```

### 2. Admin Authorization Checks

Always include admin verification before mutating operations:

```typescript
createEntityName: async (data: Partial<EntityName>): Promise<EntityName> => {
  // Ensure the user is an admin first
  await adminRepository.ensureAdminUser();
  return entityNameRepository.create(data);
}
```

### 3. Consistent Error Handling

Implement consistent error handling in API methods:

```typescript
try {
  // Operation code
} catch (error) {
  console.error('Descriptive error message:', error);
  throw error;  // Re-throw to allow UI to handle it
} finally {
  // Cleanup code if needed
}
```

### 4. Related Entity Methods

Include methods for fetching related entities in the appropriate API file:

```typescript
// Example from subjects API
getSubjectTopics: async (subjectId: string): Promise<Topic[]> => {
  try {
    const topics = await topicRepository.getBy('subject_id', subjectId);
    return topics.sort((a, b) => a.number - b.number);
  } catch (error) {
    console.error('Error getting subject topics:', error);
    throw error;
  }
}
```

### 5. Type Handling

Ensure proper TypeScript typing throughout the API implementation:

```typescript
// Example with explicit typing
updateEntityName: async (id: string, data: Partial<EntityName>): Promise<EntityName> => {
  await adminRepository.ensureAdminUser();
  return entityNameRepository.update(id, data);
}
```

## Common UI Patterns

### 1. Table Structure

Follow this consistent table structure for all entity tables:

1. Top controls section with search, filters, and action buttons
2. Main table section with sortable columns
3. Empty state handling for when no items exist or match filters
4. Item count display at the bottom
5. Row click handler to view item details

```tsx
<div className="space-y-4">
  {/* Controls section */}
  <div className="flex justify-between items-center">
    {/* Search input */}
    {/* Filter and action buttons */}
  </div>

  {/* Table */}
  <div className="rounded-md border">
    <Table>
      <TableHeader>
        {/* Sortable column headers */}
      </TableHeader>
      <TableBody>
        {/* Conditional rendering for empty state */}
        {/* Row mapping with click handlers */}
      </TableBody>
    </Table>
  </div>
  
  {/* Item count */}
  <div className="text-sm text-muted-foreground">
    {filteredItems.length} items displayed
  </div>
</div>
```

### 2. Consistent Controls

Use these consistent UI controls across tables:

1. **Search input** with icon in the left section
2. **Filter dropdowns** in the right section
3. **Refresh button** with the RefreshCw icon
4. **Add button** with the Plus icon

```tsx
{/* Search with icon */}
<div className="relative w-64">
  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Search items..."
    className="pl-8"
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
  />
</div>

{/* Filter dropdown */}
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm">
      <Filter className="h-4 w-4 mr-2" />
      Filter: {currentFilter}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {/* Filter options */}
  </DropdownMenuContent>
</DropdownMenu>

{/* Refresh button */}
<Button variant="outline" size="sm" onClick={loadItems} className="flex items-center">
  <RefreshCw className="h-4 w-4 mr-2" />
  Refresh
</Button>

{/* Add button */}
<Button size="sm" onClick={handleAddItemClick} className="flex items-center">
  <Plus className="h-4 w-4 mr-2" />
  Add Item
</Button>
```

### 3. Form Fields

Use consistent form field components with comprehensive validation:

```tsx
<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Field Label</FormLabel>
      <FormControl>
        <Input placeholder="Enter value" {...field} />
      </FormControl>
      <FormDescription>
        Optional helper text for this field
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 4. Toast Notifications

Use toast notifications for action feedback:

```tsx
toast({
  title: "Action completed",
  description: "The operation was successful.",
  // Optional variant for different styles: default, destructive, etc.
});

// For errors
toast({
  title: "Action failed",
  description: "There was an error. Please try again.",
  variant: "destructive",
});
```

## Example Implementation

The admin application provides several reference implementations that demonstrate these patterns:

### Staff Module

`src/components/features/staff/` contains a complete implementation:

- `StaffTable.tsx` - Table with filtering by role and status
- `ViewStaffModal.tsx` - Combined view/edit modal with form validation
- `AddStaffModal.tsx` - Form for adding new staff members
- `index.ts` - Barrel file that exports all components

Key features:
- Role and status badges with color coding
- Form validation for staff fields
- Combined view/edit approach
- Responsive grid layout for staff details

### Subjects Module

`src/components/features/subjects/` provides another implementation:

- `SubjectsTable.tsx` - Table with curriculum and discipline filters
- `ViewSubjectModal.tsx` - Combined view/edit modal
- `AddSubjectModal.tsx` - Form for creating new subjects
- `index.ts` - Barrel file for exports

Key features:
- Advanced filters for curriculum and discipline
- Color-coded badges for curriculum types
- Consistent modal behavior
- Year level and other subject-specific fields

### Topics and Subtopics Module

`src/components/features/topics/` demonstrates a more complex nested data structure:

- `TopicsTable.tsx` - Expandable table showing topics and related subtopics
- `ViewTopicModal.tsx` - View/edit for topics with related subtopics
- `ViewSubtopicModal.tsx` - View/edit for subtopics
- `AddTopicModal.tsx` and `AddSubtopicModal.tsx` - Forms for creation
- `index.ts` - Exports all components

Key features:
- Expandable rows to show subtopics under their parent topics
- Complex relationship handling between topics and subtopics
- Full-height modal design
- Subject relationship management

## Adaptation Steps

To implement this pattern for a new entity:

1. **Create the basic file structure** in `src/components/features/[entity-name]/`
2. **Start with the table component** by adapting one of the reference implementations
3. **Implement the view/edit modal** with the combined approach
4. **Add the creation modal** for adding new items
5. **Update the API and repositories** to support the new entity
6. **Export all components** through the barrel file

Example adaptation process:

1. Choose the closest existing implementation (e.g., Staff for people-based entities, Subjects for course-related entities)
2. Copy the components to your new entity folder
3. Replace all references to the old entity with your new entity name
4. Update the form fields, table columns, and API calls for your specific entity
5. Add entity-specific features and filters
6. Ensure consistent styling and behavior with other entity modules

## Best Practices for New Implementations

When implementing new entity tables:

1. **Maintain consistency** with existing implementations for UI and UX
2. **Use combined view/edit modals** rather than separate components
3. **Apply full-height modals** for complex content or when appropriate
4. **Use responsive grid layouts** in modals for better information organization
5. **Implement badge patterns** for status and type fields
6. **Include detailed form validation** using Zod schemas
7. **Create helper methods** for repetitive tasks like status badge coloring
8. **Add comprehensive loading states** and error handling
9. **Include empty state handling** in tables
10. **Implement a refresh pattern** to update data after changes

---

By following this guide and the established patterns, you'll create a consistent and maintainable admin interface across all entities in the application. The standardized approach ensures that users have a familiar experience regardless of which section of the admin app they're using, while developers can quickly implement new features by following these reusable patterns.
