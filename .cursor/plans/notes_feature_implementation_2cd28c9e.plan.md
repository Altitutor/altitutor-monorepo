---
name: Notes Feature Implementation
overview: Implement a Notion-like notes feature for admin-web with markdown editing, folders (including subfolders), and a folder tree view showing folders and notes hierarchically. The feature will follow the existing feature-first architecture pattern and use document-based storage.
todos:
  - id: db-migration
    content: "Create database migration: notes_folders and notes_documents tables with RLS policies, indexes, and triggers"
    status: completed
  - id: generate-types
    content: Run pnpm db:types to generate TypeScript types for new tables
    status: completed
  - id: api-layer
    content: "Create API clients: notes.ts and folders.ts with CRUD operations"
    status: completed
  - id: react-query-hooks
    content: "Create React Query hooks: queries.ts, mutations.ts, queryKeys.ts"
    status: completed
  - id: types
    content: Create TypeScript types in features/notes/types/index.ts
    status: completed
  - id: note-editor
    content: Create NoteEditor component with Tiptap and Markdown extension
    status: completed
  - id: note-viewer
    content: Create NoteViewer component with react-markdown for rendering
    status: completed
  - id: folder-tree
    content: Create FolderTree component as main view showing root folders with expandable notes and subfolders
    status: completed
  - id: folder-tree-node
    content: Create FolderTreeNode recursive component for rendering nested folder/note structure
    status: completed
  - id: notes-table
    content: Create NotesTable component for list view with filtering (optional, not used on main page)
    status: cancelled
  - id: note-detail-page
    content: Create NoteDetailPage component with edit/view toggle
    status: completed
  - id: notes-list-page
    content: Create /notes page.tsx with folder tree view showing root folders, notes, and subfolders recursively
    status: completed
  - id: note-detail-route
    content: Create /notes/[id]/page.tsx for individual note view
    status: completed
  - id: navigation
    content: Add Notes to sidebar navigation and command palette
    status: completed
  - id: dependencies
    content: Add Tiptap and react-markdown dependencies to package.json
    status: completed
  - id: auto-save
    content: Implement auto-save functionality with debouncing for note content
    status: completed
isProject: false
---

# Notes Feature Implementation Plan

## Overview

Implement a Notion-like notes system for `admin-web` with:

- Markdown editing with Tiptap editor
- Edit/View mode toggle
- Folders with subfolder support
- Folder tree view showing root folders, notes, and subfolders recursively
- Individual note detail page
- Document-based storage (markdown in database)

## Architecture

### Database Schema

**Migration: `supabase/migrations/[timestamp]_create_notes_system.sql**`

1. `**notes_folders` table:**
  - `id` UUID PRIMARY KEY
  - `name` TEXT NOT NULL
  - `parent_id` UUID REFERENCES `notes_folders(id)` ON DELETE CASCADE (for subfolders)
  - `created_by` UUID REFERENCES `staff(id)`
  - `created_at` TIMESTAMPTZ DEFAULT NOW()
  - `updated_at` TIMESTAMPTZ DEFAULT NOW()
  - Indexes: `idx_notes_folders_parent_id`, `idx_notes_folders_created_by`
2. `**notes_documents` table:**
  - `id` UUID PRIMARY KEY
  - `title` TEXT NOT NULL
  - `content` TEXT NOT NULL (markdown)
  - `folder_id` UUID REFERENCES `notes_folders(id)` ON DELETE SET NULL
  - `created_by` UUID REFERENCES `staff(id)`
  - `updated_by` UUID REFERENCES `staff(id)`
  - `created_at` TIMESTAMPTZ DEFAULT NOW()
  - `updated_at` TIMESTAMPTZ DEFAULT NOW()
  - Indexes: `idx_notes_documents_folder_id`, `idx_notes_documents_created_by`, `idx_notes_documents_created_at DESC`
  - Full-text search: `tsvector` column with GIN index for search
3. **RLS Policies:**
  - Enable RLS on both tables
  - Single policy: `"ADMINSTAFF full access to notes_folders"` and `"ADMINSTAFF full access to notes_documents"` using `is_adminstaff_active()`
4. **Triggers:**
  - `set_updated_at` trigger for both tables

### Feature Structure

Following feature-first architecture pattern:

```
apps/admin-web/src/features/notes/
├── api/
│   ├── notes.ts          # Notes documents API client
│   ├── folders.ts        # Folders API client
│   ├── queries.ts        # React Query hooks for fetching
│   ├── mutations.ts      # React Query hooks for mutations
│   ├── queryKeys.ts      # Query key factory
│   └── index.ts
├── components/
│   ├── NotesTable.tsx           # Table/list view component (optional, not used on main page)
│   ├── NoteEditor.tsx            # Tiptap markdown editor component
│   ├── NoteViewer.tsx            # Markdown renderer (view mode)
│   ├── NoteDetailPage.tsx        # Full note detail page component
│   ├── FolderTree.tsx             # Main folder tree view component (shows folders + notes)
│   ├── FolderTreeNode.tsx         # Recursive folder/note tree node component
│   ├── CreateNoteDialog.tsx      # Create new note dialog
│   ├── CreateFolderDialog.tsx    # Create folder dialog
│   └── index.ts
├── hooks/
│   ├── useNoteEditor.ts          # Tiptap editor hook
│   ├── useNoteViewMode.ts        # Edit/view toggle logic
│   └── index.ts
├── types/
│   └── index.ts                  # Note, Folder types
└── index.ts
```

### Pages & Routes

1. `**apps/admin-web/src/app/(admin)/notes/page.tsx**`
  - Notes folder tree page
  - Shows `FolderTree` component as main view
  - Header with "Add Note" and "Add Folder" buttons at the top
  - Displays root folders (folders with `parent_id IS NULL`)
  - Each folder can be expanded to show:
    - Notes in that folder
    - Subfolders (recursively expandable)
  - Click note → navigate to `/notes/[id]`
  - Click folder → expand/collapse to show contents
2. `**apps/admin-web/src/app/(admin)/notes/[id]/page.tsx**`
  - Individual note detail page
  - Shows `NoteDetailPage` component
  - Edit/View toggle in header
  - Back to list button

### Components

#### NotesTable Component (Optional)

- Similar to `TasksTable.tsx` pattern
- Columns: Title, Folder, Created By, Updated At
- Row click → navigate to `/notes/[id]`
- Filter by folder
- Search functionality
- **Note:** Not used on main page, kept for potential future use

#### NoteEditor Component

- Uses Tiptap with Markdown extension
- Wraps `@tiptap/react` `useEditor` hook
- Auto-save on content change (debounced)
- Markdown syntax highlighting
- Similar to `TaskDescriptionField` but with full markdown support

#### NoteViewer Component

- Uses `react-markdown` to render markdown
- Custom styling to match Notion-like appearance
- Syntax highlighting for code blocks (optional)

#### NoteDetailPage Component

- Header with:
  - Title (editable in edit mode)
  - Edit/View toggle button
  - Folder selector
  - Save/Cancel buttons (in edit mode)
- Content area:
  - `NoteEditor` in edit mode
  - `NoteViewer` in view mode
- Sidebar (optional): Properties panel (future)

#### FolderTree Component (Main View)

- **Main component for notes list page**
- Shows root folders (folders with `parent_id IS NULL`)
- Each folder displays:
  - Folder name with expand/collapse icon
  - When expanded:
    - Notes in that folder (clickable → navigate to `/notes/[id]`)
    - Subfolders (recursively rendered using `FolderTreeNode`)
- Expand/collapse state managed per folder
- Similar to file explorer/tree view UI
- Empty state when no folders exist

#### FolderTreeNode Component

- Recursive component for rendering folder hierarchy
- Takes a folder and renders:
  - Folder name with expand/collapse
  - Notes in folder (when expanded)
  - Child folders (when expanded) - recursively renders itself
- Handles nested folder structure to any depth
- Click note → navigate to note detail page
- Click folder → toggle expand/collapse

### API Layer

#### `features/notes/api/notes.ts`

```typescript
export const notesApi = {
  list: async (filters?: { folderId?: string; search?: string }) => Promise<Note[]>
  get: async (id: string) => Promise<Note | null>
  create: async (data: NoteInsert) => Promise<Note>
  update: async (id: string, data: NoteUpdate) => Promise<Note>
  delete: async (id: string) => Promise<void>
}
```

#### `features/notes/api/folders.ts`

```typescript
export const foldersApi = {
  list: async () => Promise<Folder[]>
  listRoot: async () => Promise<Folder[]> // Folders with parent_id IS NULL
  listByParent: async (parentId: string) => Promise<Folder[]> // Child folders
  get: async (id: string) => Promise<Folder | null>
  create: async (data: FolderInsert) => Promise<Folder>
  update: async (id: string, data: FolderUpdate) => Promise<Folder>
  delete: async (id: string) => Promise<void>
  getTree: async () => Promise<FolderTree[]> // Hierarchical structure with notes
}
```

#### `features/notes/api/notes.ts` (Updated)

```typescript
export const notesApi = {
  list: async (filters?: { folderId?: string; search?: string }) => Promise<Note[]>
  listByFolder: async (folderId: string) => Promise<Note[]> // Notes in a folder
  get: async (id: string) => Promise<Note | null>
  create: async (data: NoteInsert) => Promise<Note>
  update: async (id: string, data: NoteUpdate) => Promise<Note>
  delete: async (id: string) => Promise<void>
}
```

### Types

#### `features/notes/types/index.ts`

```typescript
export type Note = Tables<'notes_documents'>
export type NoteInsert = TablesInsert<'notes_documents'>
export type NoteUpdate = TablesUpdate<'notes_documents'>

export type Folder = Tables<'notes_folders'>
export type FolderInsert = TablesInsert<'notes_folders'>
export type FolderUpdate = TablesUpdate<'notes_folders'>

export type FolderTree = Folder & {
  notes: Note[]
  children: FolderTree[]
}

export type FolderWithContent = Folder & {
  notes: Note[]
  children: FolderWithContent[]
}
```

### Navigation Updates

**File: `apps/admin-web/src/app/(admin)/layout.tsx**`

Add to `navItems` array:

```typescript
{
  type: 'heading',
  title: 'DOCUMENTATION',
},
{
  title: 'Notes',
  href: '/notes',
  icon: FileText, // or StickyNote from lucide-react
},
```

**File: `apps/admin-web/src/features/command-palette/components/CommandPalette.tsx**`

Add to `navItems` array:

```typescript
{ title: 'Notes', href: '/notes', icon: FileText }
```

### Dependencies

Add to `apps/admin-web/package.json`:

- `@tiptap/react`: `^2.x` (React wrapper for Tiptap)
- `@tiptap/starter-kit`: `^2.x` (Essential extensions)
- `@tiptap/markdown`: `^2.x` (Markdown support)
- `react-markdown`: `^9.x` (Markdown rendering)
- `remark-gfm`: `^4.x` (GitHub Flavored Markdown support)

### Implementation Steps

1. **Database Migration**
  - Create migration file
  - Add tables, indexes, RLS policies, triggers
  - Test migration locally
2. **Types & API Layer**
  - Generate types: `pnpm db:types`
  - Create API clients (`notes.ts`, `folders.ts`)
  - Create React Query hooks (`queries.ts`, `mutations.ts`)
3. **Core Components**
  - `NoteEditor` with Tiptap
  - `NoteViewer` with react-markdown
  - `FolderTree` component
  - `NotesTable` component
4. **Pages**
  - Notes list page (`/notes`)
  - Note detail page (`/notes/[id]`)
5. **Navigation**
  - Add to sidebar
  - Add to command palette
6. **Polish**
  - Auto-save functionality
  - Loading states
  - Error handling
  - Empty states

### UI Structure for Notes List Page

The `/notes` page will have this structure:

```
┌─────────────────────────────────────────┐
│  Notes                          [Add Note] [Add Folder] │
├─────────────────────────────────────────┤
│                                         │
│  📁 Folder 1                    [▼]    │
│    📄 Note 1                            │
│    📄 Note 2                            │
│    📁 Subfolder 1                [▶]    │
│                                         │
│  📁 Folder 2                    [▶]     │
│                                         │
│  📁 Folder 3                    [▼]     │
│    📄 Note 3                            │
│    📁 Subfolder 2                [▼]    │
│      📄 Note 4                          │
│      📁 Sub-subfolder            [▶]    │
│                                         │
└─────────────────────────────────────────┘
```

- Header with title and action buttons ("Add Note", "Add Folder")
- Main content area showing root folders
- Each folder can be expanded to show notes and subfolders
- Recursive expansion for nested folders
- Click note → navigate to detail page
- Click folder → toggle expand/collapse

### Key Implementation Details

#### Tiptap Editor Setup

```typescript
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'

const editor = useEditor({
  extensions: [StarterKit, Markdown],
  content: markdownContent,
  contentType: 'markdown',
  onUpdate: ({ editor }) => {
    const markdown = editor.getMarkdown()
    // Auto-save logic
  }
})
```

#### Edit/View Toggle

- State: `const [isEditing, setIsEditing] = useState(false)`
- Toggle button in header
- Show `NoteEditor` when editing, `NoteViewer` when viewing
- Auto-save on edit mode exit

#### Folder Hierarchy & Tree View

- Fetch all folders and notes, build tree structure in TypeScript
- Root folders: `WHERE parent_id IS NULL`
- For each folder, fetch:
  - Notes: `WHERE folder_id = folder.id`
  - Child folders: `WHERE parent_id = folder.id`
- Build recursive tree structure:
  ```typescript
  type FolderWithContent = Folder & {
    notes: Note[]
    children: FolderWithContent[]
  }
  ```
- Display as expandable tree view:
  - Root folders at top level
  - Expand folder → show notes and subfolders
  - Subfolders recursively expandable
  - Notes clickable → navigate to detail page
- Expand/collapse state managed in component state

### Files to Create/Modify

**New Files:**

- `supabase/migrations/[timestamp]_create_notes_system.sql`
- `apps/admin-web/src/features/notes/**/*` (entire feature directory)
  - `components/FolderTree.tsx` (main tree view)
  - `components/FolderTreeNode.tsx` (recursive node component)
- `apps/admin-web/src/app/(admin)/notes/page.tsx` (folder tree view page)
- `apps/admin-web/src/app/(admin)/notes/[id]/page.tsx`

**Modified Files:**

- `apps/admin-web/src/app/(admin)/layout.tsx` (add navigation item)
- `apps/admin-web/src/features/command-palette/components/CommandPalette.tsx` (add nav item)
- `apps/admin-web/package.json` (add dependencies)
- `packages/shared/src/supabase/generated.ts` (after running `pnpm db:types`)

### Testing Considerations

- Test folder creation/deletion
- Test subfolder nesting (multiple levels)
- Test note CRUD operations
- Test folder tree expansion/collapse
- Test recursive folder rendering
- Test notes display within folders
- Test markdown rendering
- Test edit/view toggle
- Test auto-save
- Test RLS policies
- Test empty states (no folders, no notes in folder)

### Future Enhancements (Out of Scope)

- Properties panel (like tasks)
- Version history
- Real-time collaboration (Yjs integration)
- Block references
- Attachments
- Tags
- Full-text search UI

