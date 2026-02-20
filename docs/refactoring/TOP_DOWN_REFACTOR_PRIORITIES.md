# Top-Down Refactoring Priorities (admin-web)

Cross-cutting refactors that would have high impact across the codebase, even when they span multiple features.

---

## 1. **Standardize “current user” on shared** (High impact, low effort)

**Problem:** ~50+ files import `useCurrentStaff` from `@/features/staff/hooks/useStaffQuery` or `@/features/staff/hooks`. That creates a single feature (staff) as a dependency for “who is the current user” across the whole app.

**What to do:**
- Treat “current staff” as an app-wide concern.
- **Option A (minimal):** Replace every import of `useCurrentStaff` from staff with `@/shared/hooks`. Shared already re-exports staff hooks, so this is a find-and-replace of the import path. No behavior change, but one clear convention: “current user” is consumed from shared.
- **Option B (stronger):** Move the implementation of `useCurrentStaff` (and its query key + `staffApi.getCurrentStaff`) into `shared/hooks/useCurrentStaff.ts` and have staff feature use it. Then no feature needs to depend on staff for “current user”; only shared and staff’s API layer do.

**Impact:** Removes or reduces cross-feature coupling for the most repeated pattern in the app. ~50+ files for Option A; Option B requires moving one hook and updating staff’s use of it.

**Effort:** Option A: ~1 hour (mechanical). Option B: ~2–3 hours (move hook, ensure no circular deps, test).

---

## 2. **Stop using hooks inside API/mutation modules** (High impact, medium effort)

**Problem:** Three modules under `**/api/*.ts` call `useCurrentStaff()` inside hooks they export:
- `notes/api/dailyQueries.ts` – `useUpdateDailyNote`
- `tasks/api/mutations.ts` – `useCreateTask` (and possibly others)
- `automation/api/mutations.ts` – `useCreateAutomationRule` (and others)

That breaks “API layer = pure data; hooks = app/React” and makes testing and reuse harder.

**What to do:**
- Mutations should not call `useCurrentStaff`. They should accept a full payload that already includes `created_by` (or equivalent).
- Callers (components or feature-level hooks) should call `useCurrentStaff()`, then pass `created_by: currentStaff?.id ?? null` into the mutation payload.
- Refactor:
  1. In each of the three files, remove `useCurrentStaff` and any logic that sets `created_by` from it.
  2. Change the mutation’s `mutationFn` to accept the full insert type (including `created_by`).
  3. Find all call sites of these mutations and ensure they pass `created_by` (from `useCurrentStaff()` in the component or a thin wrapper hook in the same feature).

**Impact:** Clear separation: API/mutations stay pure; “current user” is handled at the call site. Better testability and consistency with the rest of the codebase.

**Effort:** ~2–4 hours (three modules + updating call sites).

---

## 3. **Type form props instead of `form as any`** (Medium impact, medium effort)

**Problem:** Multiple dialogs use `resolver: zodResolver(schema) as any`, `form as any` when passing form to children, or `handleSubmit(onSubmit as any)`. Concentrated in:
- issues: `EditIssueDialog`, `IssuePropertiesPanel`, `IssueTitleField`, `CreateIssueDialog`
- tasks: `EditTaskDialog`, `CreateTaskDialog`, `TaskContentPanel`
- notes: `NoteDetailPage`
- parents: `AddParentModal`
- staff: `AddStaffModal`
- students: `AddStudentModal`

**What to do:**
- Define a single form type per feature (e.g. `IssueFormValues`) inferred from the Zod schema.
- Type the parent as `UseFormReturn<IssueFormValues>` and pass that to children; type child props as `form: UseFormReturn<IssueFormValues>` (or a narrow slice) instead of `form as any`.
- Where child components are shared across features, use generics: `form: UseFormReturn<Record<string, unknown>>` or a small shared form-props type.

**Impact:** Removes a large chunk of `any` in high-traffic UI, improves refactor safety and autocomplete.

**Effort:** ~3–5 hours across issues, tasks, notes, and the listed modals.

---

## 4. **Centralize “open entity modal”** (Lower priority, high effort)

**Problem:** `ViewStudentModal`, `ViewStaffModal`, `ViewClassModal` (and similar) are imported and rendered in 20+ places across features (SessionModal, TaskContentPanel, command palette, reconciliation, tables, etc.). That’s a lot of cross-feature imports and duplicated “open this modal with this id” logic.

**What to do (optional, for a later pass):**
- Introduce an app-level mechanism to “open entity modal” (e.g. context + `openStudent(id)`, `openStaff(id)`, `openClass(id)`).
- One place (e.g. layout or provider) owns the state and renders the modals; the rest of the app only calls the opener. No need for each feature to import the others’ modals.

**Impact:** Removes many cross-feature imports and keeps “which modal is open” in one place. Improves consistency (e.g. URL or analytics) if you add it later.

**Effort:** High (state design, migrating many call sites, possibly URL state). Only do when you’re ready for a larger UX/architecture pass.

---

## 5. **Replace remaining useEffect-based fetch with React Query** (Ongoing)

**Problem:** The earlier analysis found ~45 `useEffect` sites that look like fetch/API (e.g. in parents, messages, enrollments, students, sessions, staff, billing, etc.). Some are already converted; others are still ad hoc (no cache, no shared loading/error pattern).

**What to do:**
- For any remaining “on mount or when X changes, fetch and setState” pattern, add a small `useXQuery` (or use an existing one) and use it in the component instead of `useEffect` + `useState`. Prefer existing feature hooks; add new ones in the feature that owns the data.

**Impact:** Consistent loading/error/cache behavior, fewer bugs from duplicate requests or stale state.

**Effort:** Case-by-case; tackle when touching the feature anyway. No single cross-cutting change.

---

## Recommended order

1. **Do first:** (1) Standardize `useCurrentStaff` on shared (Option A), then (2) Remove hooks from API/mutation modules and pass `created_by` at call sites.
2. **Do next:** (3) Type form props and remove `form as any` in issues/tasks/notes and the listed modals.
3. **Do when ready for a bigger change:** (4) Centralize “open entity modal”.
4. **Do continuously:** (5) Replace remaining useEffect fetch with React Query as you touch each area.
