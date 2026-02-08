# Fix Lint Warnings

Systematically fix ESLint warnings across the codebase while maintaining code quality and following project standards.

## Context

This is the Altitutor monorepo with strict TypeScript and React best practices:

- **Stack**: React 18, TypeScript 5.8, TailwindCSS, TanStack Query 5.77, Zustand 4.5, Next.js App Router
- **Linting**: ESLint with TypeScript, React, and Next.js plugins
- **Type Safety**: Never use `any` - use `unknown` with type guards instead
- **Standards**: Follow Bulletproof React patterns and project rules in `.cursor/rules/`
- **Quality**: Fix warnings without changing functionality

## Common Warning Types

### 1. TypeScript `any` Type (`@typescript-eslint/no-explicit-any`)
- **Never use `any`** - violates strict type safety
- Replace with proper types, `unknown`, or generic types
- Use type guards to narrow `unknown` types

### 2. Unused Variables (`@typescript-eslint/no-unused-vars`)
- Remove unused imports, variables, and parameters
- Prefix intentionally unused parameters with `_` (e.g., `_messageBody`)
- Remove unused function parameters or use them

### 3. React Hooks Dependencies (`react-hooks/exhaustive-deps`)
- Add missing dependencies to `useEffect`, `useMemo`, `useCallback` dependency arrays
- Use `useCallback`/`useMemo` to stabilize function references
- Consider if dependencies should be included or if effect logic needs refactoring

### 4. Next.js Image (`@next/next/no-img-element`)
- Replace `<img>` tags with Next.js `<Image />` component
- Import from `next/image`
- Provide proper `width`, `height`, and `alt` attributes

## Workflow

### 1. Run Linter to Get Current Warnings

```bash
pnpm lint
```

**Note**: This runs linting for all workspaces. For app-specific linting:
```bash
cd apps/admin-web && pnpm lint
```

### 2. Analyze Warning Patterns

Review the lint output and categorize warnings:

- **TypeScript `any` types**: Count and identify files
- **Unused variables**: Count and identify files  
- **React hooks dependencies**: Count and identify files
- **Next.js image issues**: Count and identify files
- **Other warnings**: Note any other patterns

**Create a summary:**
```markdown
## Lint Warning Summary

- TypeScript `any`: {X} warnings in {Y} files
- Unused variables: {X} warnings in {Y} files
- React hooks deps: {X} warnings in {Y} files
- Next.js images: {X} warnings in {Y} files
- Other: {X} warnings in {Y} files

**Total**: {X} warnings across {Y} files
```

### 3. Fix Warnings by Category

Work through warnings systematically, one category at a time. Fix all warnings in a category before moving to the next.

#### 3.1 Fix TypeScript `any` Types

**For each file with `any` warnings:**

1. **Read the file** to understand context
2. **Identify the `any` usage** and what type it should be:
   - If it's a function parameter: Define proper interface/type
   - If it's a return type: Infer or define return type
   - If it's truly unknown: Use `unknown` and add type guard
   - If it's a generic: Use proper generic constraints

3. **Common patterns to fix:**

   **Function parameters:**
   ```typescript
   // ❌ Bad
   function processData(data: any) { }
   
   // ✅ Good - Define interface
   interface ProcessData {
     id: string;
     value: number;
   }
   function processData(data: ProcessData) { }
   
   // ✅ Good - Use unknown with type guard
   function processData(data: unknown) {
     if (typeof data === 'object' && data !== null && 'id' in data) {
       // TypeScript now knows it's an object with 'id'
     }
   }
   ```

   **Event handlers:**
   ```typescript
   // ❌ Bad
   const handleChange = (e: any) => { }
   
   // ✅ Good - Use proper event type
   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { }
   ```

   **API responses:**
   ```typescript
   // ❌ Bad
   const response: any = await fetchData();
   
   // ✅ Good - Define response type
   interface ApiResponse {
     data: User[];
     status: number;
   }
   const response: ApiResponse = await fetchData();
   
   // ✅ Good - Use unknown and validate
   const response: unknown = await fetchData();
   if (isApiResponse(response)) {
     // Use response safely
   }
   ```

   **Generic functions:**
   ```typescript
   // ❌ Bad
   function mapArray(arr: any[], fn: any) { }
   
   // ✅ Good - Use generics
   function mapArray<T, U>(arr: T[], fn: (item: T) => U): U[] {
     return arr.map(fn);
   }
   ```

4. **Check for existing types** in:
   - `packages/shared/src/supabase/generated.ts` (database types)
   - `packages/shared/src/types/` (shared types)
   - Feature-specific type files in `features/*/types/`

5. **Create types if needed**:
   - Place in appropriate location (shared vs feature-specific)
   - Export from index files
   - Use descriptive names

6. **Verify fix**: Re-run lint on that file
   ```bash
   pnpm lint --file path/to/file.tsx
   ```

#### 3.2 Fix Unused Variables

**For each unused variable warning:**

1. **Read the file** to understand context
2. **Determine if variable should be:**
   - **Removed**: If truly unused and not needed
   - **Used**: If it should be used somewhere
   - **Prefixed with `_`**: If intentionally unused (e.g., callback parameters)

3. **Common patterns:**

   **Unused imports:**
   ```typescript
   // ❌ Bad
   import { Button, Card, Badge } from '@altitutor/ui';
   // Badge is never used
   
   // ✅ Good - Remove unused import
   import { Button, Card } from '@altitutor/ui';
   ```

   **Unused function parameters:**
   ```typescript
   // ❌ Bad
   const handleSubmit = (messageBody: string, selectedSenderId: string) => {
     // Only using messageBody
   }
   
   // ✅ Good - Prefix unused with _
   const handleSubmit = (messageBody: string, _selectedSenderId: string) => {
     // Only using messageBody
   }
   
   // ✅ Good - Remove if truly not needed
   const handleSubmit = (messageBody: string) => {
     // Only using messageBody
   }
   ```

   **Unused variables:**
   ```typescript
   // ❌ Bad
   const student = getStudent();
   // student is never used
   
   // ✅ Good - Remove if not needed
   // (removed)
   
   // ✅ Good - Use if it should be used
   const student = getStudent();
   console.log('Student:', student.name);
   ```

4. **Be careful with destructuring:**
   ```typescript
   // ❌ Bad - Unused property
   const { name, email, phone } = user;
   // phone is never used
   
   // ✅ Good - Omit unused property
   const { name, email } = user;
   
   // ✅ Good - Prefix if might be used later
   const { name, email, phone: _phone } = user;
   ```

5. **Verify fix**: Re-run lint on that file

#### 3.3 Fix React Hooks Dependencies

**For each `react-hooks/exhaustive-deps` warning:**

1. **Read the file** to understand the hook usage
2. **Analyze the dependency array:**
   - What values are used inside the hook?
   - Are they stable references?
   - Should they trigger re-runs?

3. **Common patterns:**

   **Missing dependencies:**
   ```typescript
   // ❌ Bad
   useEffect(() => {
     fetchData(selectedRecipient);
   }, []); // Missing selectedRecipient
   
   // ✅ Good - Add missing dependency
   useEffect(() => {
     fetchData(selectedRecipient);
   }, [selectedRecipient]);
   ```

   **Stabilize function references:**
   ```typescript
   // ❌ Bad - Function recreated on every render
   useEffect(() => {
     const updateData = () => {
       setData(currentStaff.name);
     };
     updateData();
   }, []); // Missing currentStaff
   
   // ✅ Good - Use useCallback to stabilize
   const updateData = useCallback(() => {
     setData(currentStaff.name);
   }, [currentStaff]);
   
   useEffect(() => {
     updateData();
   }, [updateData]);
   ```

   **Wrap in useMemo if needed:**
   ```typescript
   // ❌ Bad - items changes on every render
   const items = data?.filter(...) || [];
   useEffect(() => {
     processItems(items);
   }, []); // Missing items
   
   // ✅ Good - Memoize items
   const items = useMemo(() => {
     return data?.filter(...) || [];
   }, [data]);
   
   useEffect(() => {
     processItems(items);
   }, [items]);
   ```

   **Intentional empty dependency array:**
   ```typescript
   // ✅ Good - If effect should only run once
   useEffect(() => {
     // Initialize something that doesn't depend on props/state
     initializeThirdPartyLibrary();
   }, []); // Empty array is intentional
   ```

4. **Consider refactoring** if dependencies are complex:
   - Extract logic to custom hook
   - Split effects into multiple focused effects
   - Use `useCallback`/`useMemo` to stabilize references

5. **Verify fix**: Re-run lint on that file

#### 3.4 Fix Next.js Image Issues

**For each `@next/next/no-img-element` warning:**

1. **Read the file** to find `<img>` tags
2. **Replace with Next.js Image component:**

   ```typescript
   // ❌ Bad
   <img src={imageUrl} alt="Description" />
   
   // ✅ Good
   import Image from 'next/image';
   
   <Image 
     src={imageUrl} 
     alt="Description"
     width={500}
     height={300}
   />
   ```

3. **Handle different scenarios:**

   **External images:**
   ```typescript
   // ✅ Good - Configure in next.config.js if needed
   <Image 
     src={externalUrl}
     alt="Description"
     width={500}
     height={300}
     unoptimized // If external domain not configured
   />
   ```

   **Dynamic dimensions:**
   ```typescript
   // ✅ Good - Use fill for responsive images
   <div className="relative w-full h-64">
     <Image 
       src={imageUrl}
       alt="Description"
       fill
       className="object-cover"
     />
   </div>
   ```

4. **Verify fix**: Re-run lint on that file

### 4. Verify All Fixes

After fixing warnings in a category, verify:

```bash
pnpm lint
```

**If new warnings appear:**
- These might be from fixing other warnings (e.g., fixing `any` might reveal unused imports)
- Fix them before moving to next category

### 5. Run Type Check

After fixing TypeScript-related warnings:

```bash
pnpm typecheck
```

**Fix any type errors** that appear:
- These might be revealed after removing `any` types
- Ensure all types are properly defined

### 6. Test Changes

**For each file modified:**

1. **Check if tests exist:**
   ```bash
   # Look for test files
   find . -name "*.test.tsx" -o -name "*.test.ts" | grep feature-name
   ```

2. **Run relevant tests:**
   ```bash
   pnpm test -- path/to/file.test.tsx
   ```

3. **Manual verification:**
   - If it's a component: Check it renders correctly
   - If it's a hook: Verify behavior unchanged
   - If it's a utility: Test functionality

### 7. Commit Fixes Incrementally

**Don't make one giant commit.** Group related fixes:

```bash
# Fix TypeScript any types in one feature
git add apps/admin-web/src/features/students/
git commit -m "fix: replace any types with proper types in students feature"

# Fix unused variables in another feature
git add apps/admin-web/src/features/messages/
git commit -m "fix: remove unused variables in messages feature"

# Fix React hooks dependencies
git add apps/admin-web/src/features/enrollments/
git commit -m "fix: add missing dependencies to React hooks"
```

**Commit message format:**
- Use `fix:` prefix for lint fixes
- Include scope (feature name or file type)
- Be descriptive about what was fixed

## Success Criteria

- ✅ All lint warnings resolved
- ✅ Type check passes (`pnpm typecheck`)
- ✅ No functionality changed (only type/formatting fixes)
- ✅ Tests still pass (if applicable)
- ✅ Code follows project standards (no `any`, proper types)
- ✅ Changes committed incrementally

## Error Handling

**If fixing a warning breaks functionality:**
- Revert the change
- Investigate why the warning exists
- May need to refactor code structure, not just fix types
- Ask user for guidance if unsure

**If type errors appear after removing `any`:**
- This is expected - the `any` was hiding type issues
- Fix the underlying type problems properly
- May need to update type definitions or refactor code

**If dependencies are complex:**
- Consider extracting logic to custom hooks
- Split effects into multiple focused effects
- Use `useCallback`/`useMemo` appropriately

**If external library types are missing:**
- Check if `@types/package-name` exists
- Create local type definitions if needed
- Use `unknown` with type guards as fallback

## Important Notes

- **Never use `any`**: Always use proper types or `unknown` with type guards
- **Don't change functionality**: Only fix lint warnings, not behavior
- **Follow Bulletproof React patterns**: Component structure, hooks usage, etc.
- **Maintain code quality**: Fix warnings properly, not with workarounds
- **Test after fixes**: Ensure nothing broke
- **Commit incrementally**: Group related fixes together

## Example Workflow

```bash
# 1. Check current warnings
pnpm lint > lint-output.txt

# 2. Fix TypeScript any types in one file
# Edit file, replace any with proper types
pnpm lint --file apps/admin-web/src/features/students/api/students.ts

# 3. Fix unused variables
# Remove or prefix with _
pnpm lint --file apps/admin-web/src/features/messages/components/Composer.tsx

# 4. Fix React hooks dependencies
# Add missing dependencies or use useCallback
pnpm lint --file apps/admin-web/src/features/enrollments/hooks/useEnrollmentConflicts.ts

# 5. Verify all fixes
pnpm lint
pnpm typecheck

# 6. Commit
git add apps/admin-web/src/features/students/
git commit -m "fix: replace any types with proper types in students API"
```
