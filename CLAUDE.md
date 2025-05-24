# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Environment Switching:**
```bash
npm run switch:local    # Switch to local Supabase instance
npm run switch:remote   # Switch to remote Supabase instance
npm run dev:local       # Start dev server with local env
npm run dev:remote      # Start dev server with remote env
```

**Testing & Quality:**
```bash
npm run test           # Run Jest unit tests
npm run test:watch     # Watch mode for tests
npm run test:e2e       # Run Playwright E2E tests
npm run lint           # ESLint checking
npm run type-check     # TypeScript compilation check
npm run storybook      # Component documentation
```

**Database Operations:**
```bash
npm run seed:subjects   # Seed subjects to local DB
npm run check:subjects  # Verify subjects in local DB
npm run seed:remote     # Seed data to remote DB
npm run check:remote    # Verify remote DB data
```

## Architecture Overview

### Repository Pattern
This app uses a generic `Repository<T>` class that handles CRUD operations with automatic camelCase ↔ snake_case conversion. All database operations go through repositories defined in `src/lib/supabase/db/repositories.ts`.

**Key Repository Methods:**
- `findAll()` - List with pagination/filtering
- `findById()` - Single record retrieval
- `create()` - Insert with admin validation
- `update()` - Patch updates with admin validation
- `delete()` - Soft delete with admin validation

### Authentication & Authorization
- **Dual Auth System**: Zustand store (`AuthProvider`) + Supabase auth
- **Role-Based Access**: `ADMINSTAFF`, `TUTOR`, `STUDENT` via custom claims
- **Route Protection**: `AuthGuard` component wraps protected routes
- **RLS Security**: Database-level row security policies

### Component Patterns

**Feature Organization:**
```
src/components/features/[entity]/
├── [Entity]Table.tsx        # Data table with sorting/filtering
├── Add[Entity]Modal.tsx     # Creation modal
├── View[Entity]Modal.tsx    # Combined view/edit modal
└── index.ts                 # Exports
```

**Table Implementation:**
- TanStack React Table for data management
- Consistent controls: search, filters, refresh, add buttons
- Row click opens detailed modal
- Badge components for status/enum display

**Modal Patterns:**
- Full-height modals (`max-h-[100vh] h-full`)
- Combined view/edit in single component
- Card-based content organization
- Delete confirmation dialogs

### Form Handling
- React Hook Form + Zod validation schema
- Consistent field patterns with error states
- Toast notifications for user feedback
- Admin authorization checks before mutations

### Database Schema Patterns
- Migration-based changes in `supabase/migrations/`
- Comprehensive types in `src/lib/supabase/db/types.ts`
- Enum types with color mappings for UI badges
- Audit fields (created_at, updated_at) on all entities

### State Management
- **Global State**: Zustand for auth/user state
- **Server State**: React Query for API data
- **Form State**: React Hook Form for individual forms
- **UI State**: Component-level useState for local UI

## Implementation Guidelines

### Adding New Entity Tables
1. Create repository class extending `Repository<T>`
2. Define TypeScript types in `types.ts`
3. Add API methods with admin authorization
4. Build table component following existing patterns
5. Create modals (Add, View/Edit, Delete confirmation)
6. Implement consistent error handling and loading states

### Environment Configuration
The app uses `scripts/switch-env.js` to toggle between local and remote Supabase instances. Environment files are automatically backed up when switching.

### Custom Claims RLS
User roles are stored as custom claims in Supabase auth metadata, not in database tables. Helper functions in `src/lib/auth/roles.ts` handle role checking and assignment.

### Message Template System
Templates support dynamic variable substitution with student/staff context. Templates are stored in database with preview functionality before sending.

## Testing Strategy
- **Unit Tests**: Jest with SWC transformer for component logic
- **E2E Tests**: Playwright for full workflow testing
- **Component Docs**: Storybook for UI component documentation
- **Type Safety**: TypeScript strict mode with comprehensive type definitions