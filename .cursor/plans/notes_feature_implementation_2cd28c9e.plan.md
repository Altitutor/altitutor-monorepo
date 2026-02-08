---
name: Notes Feature Implementation
overview: Implement a Notion-like notes feature for admin-web with markdown editing, folders (including subfolders), and a hierarchical tree view showing folders and notes. The feature will follow the existing feature-first architecture pattern and use document-based storage.
todos:
  - id: db-migration
    content: "Create database migration: notes_folders and notes_documents tables with RLS policies, indexes, and triggers"
    status: pending
  - id: generate-types
    content: Run pnpm db:types to generate TypeScript types for new tables
    status: pending
  - id: api-layer
    content: "Create API clients: notes.ts and folders.ts with CRUD operations"
    status: pending
  - id: react-query-hooks
    content: "Create React Query hooks: queries.ts, mutations.ts, queryKeys.ts"
    status: pending
  - id: types
    content: Create TypeScript types in features/notes/types/index.ts
    status: pending
  - id: note-editor
    content: Create NoteEditor component with Tiptap and Markdown extension
    status: pending
  - id: note-viewer
    content: Create NoteViewer component with react-markdown for rendering
    status: pending
  - id: notes-tree
    content: Create NotesTree component showing root folders with expandable notes and subfolders
    status: pending
  - id: note-detail-page
    content: Create NoteDetailPage component with edit/view toggle
    status: pending
  - id: notes-list-page
    content: Create /notes page.tsx with NotesTree component and Add Note/Add Folder buttons
    status: pending
  - id: note-detail-route
    content: Create /notes/[id]/page.tsx for individual note view
    status: pending
  - id: navigation
    content: Add Notes to sidebar navigation and command palette
    status: pending
  - id: dependencies
    content: Add Tiptap and react-markdown dependencies to package.json
    status: pending
  - id: auto-save
    content: Implement auto-save functionality with debouncing for note content
    status: pending
isProject: false
---

# Notes Feature Implementation Plan

## Overview

Implement a Notion-like notes system for `admin-web` with:

- Markdown editing with Tiptap editor
- Edit/View mode toggle
- Folders with subfolder support
- Hierarchical tree view showing root folders, expandable to show notes and subfolders
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
│   ├── NotesTree.tsx              # Hierarchical tree view showing folders and notes
│   ├── NoteEditor.tsx            # Tiptap markdown editor component
│   ├── NoteViewer.tsx            # Markdown renderer (view mode)
│   ├── NoteDetailPage.tsx        # Full note detail page component
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
  - Notes tree view page
  - Shows `NotesTree` component displaying root folders
  - "Add Note" and "Add Folder" buttons at the top
  - Root folders expandable to show notes and subfolders
  - Recursive expansion of subfolders
2. `**apps/admin-web/src/app/(admin)/notes/[id]/page.tsx**`
  - Individual note detail page
  - Shows `NoteDetailPage` component
  - Edit/View toggle in header
  - Back to list button

### Components

#### NotesTree Component

- Displays root folders (folders with `parent_id IS NULL`) at the top level
- Each folder can be expanded to show:
  - Notes in that folder (clickable → navigate to `/notes/[id]`)
  - Subfolders (recursively expandable)
- Expand/collapse functionality for folders
- Visual hierarchy with indentation
- Folder icons and note icons to distinguish items
- Similar to file explorer UI (VS Code sidebar style)
- Empty state when no folders exist
- Click folder name → expand/collapse
- Click note → navigate to note detail page
- Context menu for folders (rename, delete, create subfolder)
- Context menu for notes (rename, delete, move)

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
  getRootFolders: async () => Promise<Folder[]> // Folders with parent_id IS NULL
  get: async (id: string) => Promise<Folder | null>
  create: async (data: FolderInsert) => Promise<Folder>
  update: async (id: string, data: FolderUpdate) => Promise<Folder>
  delete: async (id: string) => Promise<void>
  getChildren: async (folderId: string) => Promise<{ folders: Folder[]; notes: Note[] }> // Get subfolders and notes for a folder
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

export type FolderWithChildren = Folder & {
  children: FolderWithChildren[]
  notes: Note[]
}

export type NotesTreeItem = 
  | { type: 'folder'; folder: Folder; children: NotesTreeItem[] }
  | { type: 'note'; note: Note }
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
  - `NotesTree` component with recursive folder/note display
4. **Pages**
  - Notes tree view page (`/notes`) with Add Note/Add Folder buttons
  - Note detail page (`/notes/[id]`)
5. **Navigation**
  - Add to sidebar
  - Add to command palette
6. **Polish**
  - Auto-save functionality
  - Loading states
  - Error handling
  - Empty states

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

#### NotesTree Implementation

**Structure:**

- Fetch root folders (where `parent_id IS NULL`)
- For each expanded folder, fetch:
  - Subfolders (where `parent_id = folder.id`)
  - Notes (where `folder_id = folder.id`)
- Build tree structure recursively in TypeScript
- Track expanded state per folder using React state
- Lazy load children when folder is expanded (recommended) or fetch all upfront

**UI Layout:**

```
[Add Note] [Add Folder] buttons at top

📁 Folder 1                    [expand/collapse icon]
  📄 Note 1                    [click → navigate to /notes/[id]]
  📄 Note 2
  📁 Subfolder 1.1
    📄 Note 3
    📁 Subfolder 1.1.1
      📄 Note 4
📁 Folder 2
  📄 Note 5
```

**Features:**

- Expand/collapse folders (chevron icon)
- Click folder name → toggle expand/collapse
- Click note → navigate to `/notes/[id]`
- Visual indentation for hierarchy
- Icons: Folder icon for folders, FileText icon for notes
- Empty state message when no root folders exist
- Empty folder message when folder has no children
- Context menu (right-click) for rename/delete/move operations (optional)

### Files to Create/Modify

**New Files:**

- `supabase/migrations/[timestamp]_create_notes_system.sql`
- `apps/admin-web/src/features/notes/**/*` (entire feature directory)
- `apps/admin-web/src/app/(admin)/notes/page.tsx` (tree view with Add Note/Add Folder buttons)
- `apps/admin-web/src/app/(admin)/notes/[id]/page.tsx`

**Modified Files:**

- `apps/admin-web/src/app/(admin)/layout.tsx` (add navigation item)
- `apps/admin-web/src/features/command-palette/components/CommandPalette.tsx` (add nav item)
- `apps/admin-web/package.json` (add dependencies)
- `packages/shared/src/supabase/generated.ts` (after running `pnpm db:types`)

### Testing Considerations

- Test folder creation/deletion
- Test subfolder nesting and recursive expansion
- Test note CRUD operations
- Test markdown rendering
- Test edit/view toggle
- Test auto-save
- Test RLS policies
- Test tree view expansion/collapse
- Test empty states (no folders, empty folders)
- Test navigation from tree items to note detail page

### Future Enhancements (Out of Scope)

- Properties panel (like tasks)
- Version history
- Real-time collaboration (Yjs integration)
- Block references
- Attachments
- Tags
- Full-text search UI

