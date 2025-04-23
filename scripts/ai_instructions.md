# Admin System - AI Development Guidelines

## Technology Stack
- **Next.js** (v14+)
  - App Router
  - Server Components
  - Server Actions
  - Route Handlers
- **Tauri** (v2+)
  - Native Shell Integration
  - IPC Bridge
  - System Tray API
  - Native Notifications
  - File System Access
  - Auto-updates
- **TypeScript** (v5.0+)
- **UI & Styling**
  - Tailwind CSS
  - Shadcn/ui
  - Radix UI
  - Lucide Icons
- **State Management**
  - React Query (TanStack Query)
  - Zustand
  - SQLite (Desktop)
  - IndexedDB (Web)
- **Forms & Validation**
  - React Hook Form
  - Zod
- **Testing**
  - Vitest
  - React Testing Library
  - Playwright
- **Build Tools**
  - Turborepo
  - ESLint
  - Prettier

## Architecture Overview
- **Project Structure**
  - `/app` - Next.js app router pages
  - `/components` - React components
    - `/ui` - Reusable UI components
    - `/forms` - Form components
    - `/layouts` - Layout components
  - `/lib` - Shared utilities
    - `/api` - API client and types
    - `/hooks` - Custom React hooks
    - `/utils` - Utility functions
    - `/validations` - Zod schemas
  - `/styles` - Global styles and Tailwind config
  - `/public` - Static assets
  - `/tests` - Test files

- **Data Flow**
  - Server Components for data fetching
  - Client Components for interactivity
  - Server Actions for mutations
  - React Query for client-side state

## Best Practices

### Next.js Best Practices
- Use Server Components by default
- Implement proper error boundaries
- Use proper loading states
- Implement proper metadata
- Use proper image optimization
- Implement proper caching
- Use proper dynamic imports

### React Best Practices
- Follow component composition
- Implement proper error handling
- Use proper state management
- Implement proper memoization
- Use proper event handling
- Implement proper refs
- Use proper context

### TypeScript Best Practices
- Define proper component types
- Use proper type inference
- Implement proper generics
- Use proper utility types
- Document complex types
- Use proper type guards
- Implement proper interfaces

### Testing Best Practices
- Write proper unit tests
- Implement integration tests
- Use proper test utilities
- Test error scenarios
- Test edge cases
- Implement proper mocking
- Use proper assertions

## Development Workflow
1. **Setup**
   ```bash
   pnpm install
   pnpm dev
   ```

2. **Development**
   ```bash
   pnpm lint
   pnpm format
   pnpm test:watch
   ```

3. **Testing**
   ```bash
   pnpm test
   pnpm test:e2e
   ```

4. **Build**
   ```bash
   pnpm build
   pnpm start
   ```

## Common Patterns

### Component Pattern
```tsx
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  className?: string
}

export function DataTable<T>({
  data,
  columns,
  onRowClick,
  className
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null)
  
  return (
    <div className={cn('relative overflow-x-auto', className)}>
      <table className="w-full text-sm text-left">
        {/* Table implementation */}
      </table>
    </div>
  )
}
```

### API Service Pattern
```typescript
import { createApi } from '@/lib/api'

export const usersApi = createApi({
  getUsers: async () => {
    const response = await fetch('/api/users')
    if (!response.ok) throw new Error('Failed to fetch users')
    return response.json()
  },
  
  createUser: async (data: CreateUserData) => {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to create user')
    return response.json()
  }
})
```

### Form Pattern
```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['admin', 'user'])
})

type UserFormData = z.infer<typeof userSchema>

export function UserForm() {
  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema)
  })
  
  const onSubmit = async (data: UserFormData) => {
    try {
      await usersApi.createUser(data)
    } catch (error) {
      console.error(error)
    }
  }
  
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  )
}
```

### State Management Pattern
```typescript
import { create } from 'zustand'

interface AuthStore {
  user: User | null
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null })
}))
```

## Integration Guidelines

### API Integration
- Use proper error handling
- Implement proper loading states
- Use proper type definitions
- Implement proper caching
- Use proper authentication

### Component Integration
- Follow proper composition
- Use proper prop drilling
- Implement proper context
- Use proper event handling
- Implement proper refs

### State Management
1. Use Server Components for static data
2. Use React Query for server state
3. Use Zustand for client state
4. Implement proper caching
5. Use proper optimistic updates

### Performance Guidelines
1. Implement proper code splitting
2. Use proper image optimization
3. Implement proper caching
4. Use proper bundling
5. Monitor performance metrics 