---
name: 99-bulletproof-react-patterns
description: Bulletproof React architecture patterns and anti-patterns reference
---
# Bulletproof React Patterns & Anti-Patterns

Reference guide for Bulletproof React architecture patterns and common anti-patterns to avoid.

## Core Architecture Principles

### 1. Feature-First Organization

**✅ Correct Pattern:**
```
features/
  students/
    api/
      students.ts          # API client functions
      queryKeys.ts         # React Query keys
    components/
      StudentsTable.tsx   # Feature components
      StudentCard.tsx
    hooks/
      useStudentsQuery.ts  # React Query hooks
      useStudentMutations.ts
    types/
      index.ts             # TypeScript types
    utils/
      studentFormatters.ts # Feature utilities
    index.ts               # Public exports only
```

**❌ Anti-Pattern:**
```
features/
  students/
    StudentsTable.tsx      # Everything in root
    useStudents.ts         # Mixed organization
    types.ts
    api.ts
```

### 2. Feature Independence

**✅ Correct Pattern:**
- Features are self-contained
- Compose features at app level
- Shared code in `shared/` or `packages/shared/`

**❌ Anti-Pattern:**
```typescript
// ❌ Feature A importing from Feature B
// features/students/components/StudentsTable.tsx
import { ViewClassModal } from '@/features/classes/components/ViewClassModal';

// ✅ Should compose at app level or move to shared
// app/(admin)/students/page.tsx
import { StudentsTable } from '@/features/students';
import { ViewClassModal } from '@/features/classes';

// Or move shared component to shared/
// shared/components/ViewClassModal.tsx
```

### 3. Separation of Concerns

**✅ Component Pattern:**
```typescript
// ✅ Pure UI component
export function StudentsTable({ students, isLoading }: StudentsTableProps) {
  if (isLoading) return <SkeletonTable />;
  
  return (
    <Table>
      {students.map(student => (
        <TableRow key={student.id}>
          <TableCell>{student.name}</TableCell>
        </TableRow>
      ))}
    </Table>
  );
}
```

**❌ Anti-Pattern:**
```typescript
// ❌ Business logic in component
export function StudentsTable() {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // ❌ API call in component
    fetch('/api/students')
      .then(res => res.json())
      .then(data => {
        // ❌ Data transformation in component
        const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(sorted);
        setIsLoading(false);
      });
  }, []);
  
  // ❌ Complex calculation in render
  const totalRevenue = students.reduce((sum, s) => sum + s.revenue, 0);
  
  return <Table>...</Table>;
}
```

**✅ Correct Pattern:**
```typescript
// ✅ Hook for business logic
export function useStudentsTable() {
  const { data: students, isLoading } = useStudentsQuery();
  const sortedStudents = useMemo(
    () => students?.sort((a, b) => a.name.localeCompare(b.name)) ?? [],
    [students]
  );
  const totalRevenue = useMemo(
    () => sortedStudents.reduce((sum, s) => sum + s.revenue, 0),
    [sortedStudents]
  );
  
  return { students: sortedStudents, isLoading, totalRevenue };
}

// ✅ Pure component
export function StudentsTable() {
  const { students, isLoading, totalRevenue } = useStudentsTable();
  
  if (isLoading) return <SkeletonTable />;
  
  return (
    <div>
      <Table>...</Table>
      <div>Total: {totalRevenue}</div>
    </div>
  );
}
```

### 4. Data Fetching with React Query

**✅ Correct Pattern:**
```typescript
// ✅ API layer (pure data fetching)
// features/students/api/students.ts
export async function fetchStudents(): Promise<Student[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('students').select('*');
  if (error) throw error;
  return data;
}

// ✅ React Query hook
// features/students/hooks/useStudentsQuery.ts
export function useStudentsQuery() {
  return useQuery({
    queryKey: ['students'],
    queryFn: fetchStudents,
    staleTime: 5 * 60 * 1000,
  });
}

// ✅ Component uses hook
export function StudentsTable() {
  const { data: students, isLoading, error } = useStudentsQuery();
  // ...
}
```

**❌ Anti-Pattern:**
```typescript
// ❌ useEffect for data fetching
export function StudentsTable() {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetch('/api/students')
      .then(res => res.json())
      .then(data => {
        setStudents(data);
        setIsLoading(false);
      });
  }, []);
  
  // Missing: Error handling, caching, refetching, etc.
}
```

### 5. Component Size and Complexity

**✅ Correct Pattern:**
- Components < 200 lines ideally
- Single responsibility
- Composed from smaller components

**❌ Anti-Pattern:**
- Components > 300 lines
- Multiple responsibilities
- Monolithic components

**Refactoring Example:**
```typescript
// ❌ Large component (500+ lines)
export function StudentsTable() {
  // Filtering logic
  // Sorting logic
  // Pagination logic
  // Modal management
  // API calls
  // Rendering
}

// ✅ Split into smaller components
export function StudentsTable() {
  const { students, filters, pagination } = useStudentsTable();
  
  return (
    <div>
      <StudentsTableFilters {...filters} />
      <StudentsTableContent students={students} />
      <StudentsTablePagination {...pagination} />
    </div>
  );
}
```

### 6. Import Patterns

**✅ Correct Pattern (Direct Imports):**
```typescript
// ✅ Direct imports for better tree-shaking
import { fetchStudents } from '../api/students';
import { useStudentsQuery } from '../hooks/useStudentsQuery';
import type { Student } from '../types';
```

**❌ Anti-Pattern (Barrel Files for Internal):**
```typescript
// ❌ Barrel file imports (within feature)
import { fetchStudents, useStudentsQuery } from '../index';
// This prevents tree-shaking
```

**✅ Correct Usage (Public Exports):**
```typescript
// ✅ Barrel file for public API only
// features/students/index.ts
export { StudentsTable } from './components/StudentsTable';
export { useStudentsQuery } from './hooks/useStudentsQuery';
export type { Student } from './types';

// ✅ External code imports from barrel
import { StudentsTable, useStudentsQuery } from '@/features/students';
```

### 7. Type Safety

**✅ Correct Pattern:**
```typescript
// ✅ Proper types
interface StudentsTableProps {
  students: Student[];
  isLoading: boolean;
  onStudentSelect: (studentId: string) => void;
}

export function StudentsTable({ students, isLoading, onStudentSelect }: StudentsTableProps) {
  // ...
}
```

**❌ Anti-Pattern:**
```typescript
// ❌ Any types
export function StudentsTable(props: any) {
  // ❌ No type safety
}

// ❌ Missing types
export function StudentsTable({ students, isLoading }) {
  // ❌ Implicit any
}
```

### 8. State Management

**✅ Correct Pattern:**
- **Server State**: React Query (TanStack Query)
- **Global Client State**: Zustand (when needed)
- **Local UI State**: `useState`
- **Form State**: React Hook Form

**❌ Anti-Pattern:**
```typescript
// ❌ Server state in local state
const [students, setStudents] = useState([]);
useEffect(() => {
  fetchStudents().then(setStudents);
}, []);

// ❌ Global state for local concerns
const useStudentsStore = create((set) => ({
  students: [],
  setStudents: (students) => set({ students }),
}));
```

**✅ Correct Pattern:**
```typescript
// ✅ Server state with React Query
const { data: students } = useStudentsQuery();

// ✅ Local UI state
const [isModalOpen, setIsModalOpen] = useState(false);

// ✅ Global state only when needed across features
const useAuthStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
```

## Common Anti-Patterns Checklist

### Architecture
- [ ] Cross-feature imports
- [ ] Missing feature structure
- [ ] Files in wrong locations
- [ ] Mixed concerns in single file

### Components
- [ ] Components > 200 lines
- [ ] Business logic in components
- [ ] Data fetching in components
- [ ] Missing prop types
- [ ] Prop drilling (> 3 levels)

### Data Fetching
- [ ] `useEffect` for data fetching
- [ ] Missing React Query hooks
- [ ] API calls in components
- [ ] Missing loading/error states

### Types
- [ ] Using `any` types
- [ ] Missing interfaces
- [ ] Loose type definitions

### Imports
- [ ] Barrel file imports (internal)
- [ ] Circular dependencies
- [ ] Deep import paths

### State
- [ ] Server state in local state
- [ ] Global state for local concerns
- [ ] Missing React Query for server data

## Refactoring Guidelines

### When to Refactor

1. **Component > 300 lines** - Split into smaller components
2. **Business logic in component** - Extract to hook
3. **Cross-feature import** - Move to shared or compose at app level
4. **useEffect for fetching** - Create React Query hook
5. **Prop drilling > 3 levels** - Use Context or state management
6. **Any types** - Replace with proper types
7. **Missing error handling** - Add proper error boundaries/states

### Refactoring Process

1. **Add tests first** - Ensure behavior preservation
2. **Refactor incrementally** - One change at a time
3. **Verify after each step** - Run tests and manual checks
4. **Document decisions** - Why refactoring was done
5. **Measure impact** - Track improvements

### Refactoring Priorities

**P0 - Critical:**
- Cross-feature imports (tight coupling)
- Business logic bugs
- Performance issues

**P1 - High:**
- Large components (> 300 lines)
- Missing React Query hooks
- Type safety issues

**P2 - Medium:**
- Components 200-300 lines
- Import pattern improvements
- Code organization

**P3 - Low:**
- Documentation
- Minor improvements
- Code style

## References

- [Bulletproof React](https://github.com/alan2207/bulletproof-react)
- [Project Structure Docs](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)
- [Project Standards](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md)
