nca## Admin-Web: Option A Migration Guide (for AI Agents)

Purpose: Replace the custom domain/repository/casing layer with direct Supabase types and queries. Use `@altitutor/shared` generated types as the single source of truth. Keep snake_case end-to-end.

### Source of truth
- Types: `packages/shared/src/supabase/generated.ts` via `@altitutor/shared`
- Import in app code: `import type { Database, Tables, TablesInsert, TablesUpdate, Enums } from '@altitutor/shared'`
- Client: `apps/admin-web/src/shared/lib/supabase/client/index.ts`

### Done so far
- Core de-repo work
  - Removed repository/register files and `useRepository` hook
  - Deleted: `shared/lib/supabase/database/repository.ts`, `shared/lib/supabase/database/repositories.ts`, `shared/hooks/useRepository.ts`
- Type source of truth wired
  - `shared/lib/supabase/database/admin.ts` imports `Database` from `@altitutor/shared`
  - `shared/types/index.ts` re-exports from `@altitutor/shared`
  - `apps/admin-web/tsconfig.json` includes path aliases for `@altitutor/shared`
- Direct Supabase APIs using `Tables`/`TablesInsert`/`TablesUpdate`
  - Sessions API updated: `features/sessions/api/sessions.ts` (CRUD, attendees, staff assignment; snake_case fields; joins typed)
  - Classes API updated: `features/classes/api/classes.ts` (details, lists, joins; removed anys via local join-row interfaces)
  - Students API updated: `features/students/api/students.ts` (CRUD, snake_case; id via `crypto.randomUUID()` on insert)
  - Subjects API updated: `features/subjects/api/subjects.ts` (CRUD with `Tables` types, snake_case)
  - Topics API updated: `features/topics/api/topics.ts` (CRUD for topics/subtopics; joins and snake_case)
- Hooks aligned to new APIs
  - Students: `features/students/hooks/useStudentsQuery.ts`
  - Subjects: `features/subjects/hooks/useSubjectsQuery.ts`
  - Topics: `features/topics/hooks/useTopicsQuery.ts`
  - Sessions: `features/sessions/hooks/useSessions.ts` aligned to new API
  - Removed old indices to repo hooks; index files now export new hooks
- UI/components migrated to snake_case + `Tables` types
  - Staff: `StaffTableHeader.tsx`, `StaffTableRow.tsx`, `StaffTable.tsx`, `components/modal/ViewStaffModal.tsx`, tabs updated; account updates use `user_id`
  - Students: `StudentsTable.tsx`, modals and tabs (`StudentAccountTab.tsx`, `StudentSubjectsTab.tsx`, `ClassesTab.tsx`, `DetailsTab.tsx`) now snake_case
  - Subjects: `SubjectsTable.tsx`, `ViewSubjectModal.tsx`, `AddSubjectModal.tsx` use string literal enums and snake_case
  - Topics: `TopicsTable.tsx`, `ViewTopicModal.tsx`, `AddTopicModal.tsx`, `AddSubtopicModal.tsx` snake_case and `Tables` types
- Enum utilities decoupled from domain enums
  - `components/ui/enum-badge.tsx`, `shared/utils/enum-colors.ts`

### Still to do (high priority)
Refactor remaining surface area to `Tables<'...'>` + direct Supabase. Ensure snake_case everywhere.

- Sessions
  - Components: `features/sessions/components/**/*.tsx` ensure snake_case and `Tables<'sessions'>` throughout
  - Verify hooks return types and cache keys align with new shapes

- Classes
  - Components: `features/classes/components/**/*` to use `Tables<'classes'>` and snake_case
  - Remove any residual repo-style props or transforms

- Cleanup legacy imports
  - Replace any remaining imports from `@/shared/lib/supabase/database/types` with `@altitutor/shared`
  - Remove any `transformToCamelCase` references

- Final type and lint pass
  - Run `npm run typecheck` and fix remaining errors
  - Resolve enum usages to string literals or `Enums<'...'>` consistently

### Final cleanup (delete these once unused)
- `apps/admin-web/src/shared/lib/supabase/database/utils.ts` (case utils)
- `apps/admin-web/src/shared/lib/supabase/database/types.ts` (temporary compatibility aliases)
- Remove any dead files left from repo/domain era

### Refactor recipe (apply everywhere)
1) Replace imports
```ts
// Before
import type { Student, Subject } from '@/shared/lib/supabase/database/types';

// After
import type { Tables } from '@altitutor/shared';
```

2) Replace repository usage with direct Supabase
```ts
// Before
const students = await studentRepository.getAll();

// After
const { data, error } = await supabase.from('students').select('*');
if (error) throw error;
const students = (data ?? []) as Tables<'students'>[];
```

3) Drop transforms and camelCase fields
```ts
// Before
const s = transformToCamelCase(row) as Student; s.firstName

// After
const s = row as Tables<'students'>; s.first_name
```

4) CRUD patterns
```ts
// Insert
const { data: created, error } = await supabase
  .from('staff')
  .insert({ id, first_name, last_name, email, role })
  .select()
  .single();

// Update
const { data: updated, error } = await supabase
  .from('staff')
  .update({ status })
  .eq('id', id)
  .select()
  .single();

// Delete
const { error } = await supabase.from('staff').delete().eq('id', id);
```

5) Joins: keep shapes simple
```ts
// Example join
const { data, error } = await supabase
  .from('classes_students')
  .select('student:students(*), class_id')
  .eq('class_id', classId);

// data is ad-hoc; cast minimally when needed
const students = (data ?? []).map((r: any) => r.student as Tables<'students'>);
```

### Validation checklist
- [x] No imports remain from `@/shared/lib/supabase/database/repositories`
- [x] Major APIs moved to direct Supabase with `Tables` types (sessions, classes, students, subjects, topics)
- [ ] No imports remain from `@/shared/lib/supabase/database/types`
- [ ] No `transformToCamelCase` or other case utilities used in feature code
- [ ] All features use `Tables<'...'>` with snake_case fields
- [ ] All CRUD/helpers return DB rows, not domain models
- [ ] Lint/typecheck passes (`npm run typecheck` in `apps/admin-web`)

### Useful queries during refactor
Search for old patterns:
- `@/shared/lib/supabase/database/types`
- `@/shared/lib/supabase/database/repositories`
- `transformToCamelCase(`

### Notes
- Inserts may require `id`; generate with `crypto.randomUUID()` where needed if DB defaults are not set.
- For UI enums/colors, prefer string literals or DB enums from `Enums<'...'>`.

### Reference plan
- See `/option.plan.md` for the original, high-level Option A plan.


