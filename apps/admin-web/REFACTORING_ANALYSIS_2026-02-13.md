# Refactoring Analysis Summary – admin-web

**Scope**: `apps/admin-web`  
**Date**: 2026-02-13 (updated)  
**Features analyzed**: 27 features  
**Files analyzed**: 350+ component files

---

## Feature Structure Analysis

### ✅ Well-Structured Features

- `activity/` – api/, components/, hooks/, types/, mappers/
- `auth/` – api/, components/, hooks/, providers/, types/, utils/
- `automation/` – api/, components/, types/
- `billing/` – api/, components/, hooks/, types/, utils/
- `enrollments/`, `messages/`, `sessions/`, `students/`, `topics/`, `tutor-logs/` – full structure

### ⚠️ Minor Gaps

- `notepad/` – has `state/` instead of hooks for store (acceptable for client-only state)
- `contacts/` – minimal structure (7 files)

---

## Findings Summary

### P0 - Critical (Fix First)

| # | Finding | Files | Impact |
|---|---------|-------|--------|
| 1 | **Cross-feature imports** | 27+ distinct import sites | Tight coupling, hard to test, risk of circular deps |
| 2 | **useEffect for data fetching** | 10+ components | No caching, duplicate requests, missing loading/error states |
| 3 | **Server state in local state** | 4+ components | Stale data, no cache, manual sync |

**Cross-feature import hotspots:**
- `ViewClassModal` imported by: admin-shifts, classes, reconciliation, sessions, staff, students, tutor-logs
- `ViewStudentModal` imported by: classes, reconciliation, staff
- `ViewStaffModal` imported by: admin-shifts, classes, staff
- `ViewSubjectModal` imported by: staff, students, subjects
- `useSubjects` imported by: classes, reconciliation, staff, students
- `useInvoicesList`, `ViewInvoiceModal` (billing) imported by: reconciliation, students
- Enrollments modals imported by: classes, reconciliation, staff, students
- Messages components imported by: students (SendStudentInviteDialog)
- `useCurrentStaff` (staff) imported by: 30+ features

**Remaining useEffect data fetching (should use React Query):**
| File | What it fetches |
|------|-----------------|
| `SendRegistrationInviteDialog.tsx` | Student + parents via supabase |
| `SendInviteDialog.tsx` (staff) | Token, recipients |
| `SendBookingConfirmationDialog.tsx` | Student + parents |
| `LogAbsenceDialog.tsx` | Missing session, initial student |
| `LogStaffAbsenceDialog.tsx` | Missing session, initial staff |
| `Staff modal ClassesTab.tsx` | Initial subjects |
| `Step0StaffSelector.tsx` (tutor-logs) | Staff list |
| `Step9Confirmation.tsx` (tutor-logs) | Session/class data |
| `AdminTrialContactForm.tsx` | Subjects |
| `UnenrollStep3MessageScreen.tsx` | Parents |
| `Step4MessageScreen.tsx`, `ChangeClassStep4MessageScreen.tsx` | Parents |

**useEffect + realtime (acceptable – keep):**
- `MessageThread.tsx`, `ConversationList.tsx`, `useMessageSubscription.ts` – Supabase realtime
- `useNotificationsRealtime.ts` – realtime
- `AuthProvider.tsx` – session init
- `Step7FileStudents.tsx` – effect for side-effect, not fetch

---

### P1 - High (Fix Soon)

| # | Finding | Count | Impact |
|---|---------|-------|--------|
| 4 | **Large components (> 300 lines)** | 35+ components | Hard to understand, test, modify |
| 5 | **Type safety (`any` types)** | 90+ instances across 35 files | Runtime errors, poor DX |
| 6 | **Barrel imports (internal)** | 3 files | Slightly worse tree-shaking |

**Largest components (> 500 lines) – current line counts:**
| Component | Lines |
|-----------|-------|
| `CreateEditActionDialog.tsx` | 1074 |
| `StudentSelector.tsx` (messages/bulk) | 1004 |
| `StaffDetailsTab.tsx` | 984 |
| `StudentsTable.tsx` | 979 |
| `DetailsTab.tsx` (students) | 895 |
| `CustomerBalanceSection.tsx` | 873 |
| `MessageThread.tsx` | 855 |
| `SendStudentInviteDialog.tsx` | 828 |
| `AddStudentModal.tsx` | 826 |
| `ClassesTab.tsx` (students) | 767 |
| `SubjectsTable.tsx` | 762 |
| `SendInviteDialog.tsx` (staff), `AddStaffModal.tsx` | ~734 |
| `ViewTopicModal.tsx` | 728 |
| `SessionsTable.tsx` | 720 |
| `ViewSubjectModal.tsx`, `EnrollmentWeekCalendar.tsx` | ~714 |

**`any` types – highest density:**
- `parents/api/parents.ts` – RPC mapping
- `messages/api/bulk.ts` – session sorting
- `messages/hooks/useAnnouncements.ts` – parent/student mapping
- `StudentSessionsCalendarView.tsx` – session grouping
- `StaffSessionsCalendarView.tsx` – duplicated calendar logic
- `AddStudentModal.tsx`, `AddParentModal.tsx`, `AddStaffModal.tsx` – form data
- `billing/api/billing.ts` – view types
- `topics/api/topics.ts`, `topics-files.ts` – RPC data
- `tutor-logs/api/tutor-logs.ts` – RPC data

---

### P2 - Medium (Fix When Convenient)

| # | Finding | Count | Impact |
|---|---------|-------|--------|
| 7 | **Components 200–300 lines** | 60+ components | Borderline size |
| 8 | **Barrel imports (internal)** | 3 files | billing/ViewInvoiceModal, tutor-logs hooks |
| 9 | **DRY: Duplicated calendar logic** | 2 files | StudentSessionsCalendarView ≈ StaffSessionsCalendarView |

---

### P3 - Low

| # | Finding | Impact |
|---|---------|--------|
| 11 | Missing tests | Many components without `*.test.tsx` |
| 12 | Documentation | JSDoc on public APIs |

---

## Prioritized Refactoring Plan (Bulletproof React Order)

### P0 - Critical (Est. 16–24 hours)

#### 1. useEffect → React Query (data fetching)
**Files:** BillingPreferencesSection, MessagePreview, SendStudentInviteDialog, Staff SendInviteDialog, CreateEditTemplateDialog, MessageComposer, StudentSubsidiesTable

**Steps:**
- Create `useBillingPreferences(studentId)` hook
- Create `useMessagePreviewData(students, sendToParents)` hook
- Extract SendStudentInviteDialog data loading to `useSendStudentInviteData`
- Extract Staff SendInviteDialog to `useStaffInviteData`
- Create `useTemplatePreviewData` for CreateEditTemplateDialog
- Create `useStudentClassesForComposer` for MessageComposer
- Create `useDefaultPricing` for StudentSubsidiesTable

**Estimated:** 6–8 hours

#### 2. Cross-feature imports – shared view modals
**Hotspot:** ViewStudentModal, ViewClassModal, ViewStaffModal, ViewParentModal composed in many features

**Options:**
- A) Move to `shared/components/modals/` (or app-level layout)
- B) Keep in features, compose at app/layout level via context or slot props

**Recommended:** Start with B – add a shared “modal registry” or layout that composes these. Full extraction to shared is a larger refactor.

**Estimated:** 8–12 hours for layout-based composition

#### 3. Server state in local state
Overlaps with #1. Fix by migrating to React Query.

---

### P1 - High (Est. 20–30 hours)

#### 4. Split largest components (> 500 lines)
**Priority order:**
1. `CreateEditActionDialog.tsx` (1074) → extract action form, conditions builder, message config
2. `StudentSelector.tsx` (1004) → extract StudentSelectorTable, StudentFilters, useStudentSelector
3. `StaffDetailsTab.tsx` (984) → extract sections to sub-components
4. `StudentsTable.tsx` (979) → already has hooks; extract Filters, Pagination, RowActions
5. `SendStudentInviteDialog.tsx` (966) → extract RecipientSelector, ComposerSection, useSendStudentInvite

**Estimated:** 4–6 hours per component

#### 5. Replace `any` types
**Priority files:**
- parents/api/parents.ts – add proper RPC types
- messages/api/bulk.ts – type session sort/filter
- AddStudentModal, AddParentModal, AddStaffModal – typed form payloads
- StudentSessionsCalendarView / StaffSessionsCalendarView – session types

**Estimated:** 1–2 hours per file

---

### P2 - Medium (Est. 10–15 hours)

#### 6. Remaining useEffect → React Query
Create hooks for: `useRegistrationInviteData`, `useBookingConfirmationData`, `useMissingSession`, `useParentsForStudent`, `useStaffForSelector`, etc.

#### 7. DRY: Shared calendar components
Extract shared logic from StudentSessionsCalendarView and StaffSessionsCalendarView into `useSessionsCalendarGroups` and shared `SessionsDayCard`.

#### 8. Replace internal barrel imports with direct imports
- `billing/components/ViewInvoiceModal.tsx` → `from '../api/...'` etc.
- `tutor-logs/hooks/useLogSessionFlow.ts` → direct imports

---

## Total Estimated Effort

| Priority | Items | Est. Hours |
|----------|-------|------------|
| P0 | 3 | 16–24 |
| P1 | 2 | 20–30 |
| P2 | 3 | 12–18 |
| **Total** | **8** | **48–72** |

---

## Recommendations

1. **Start with P0 #1 (useEffect → React Query)** – Highest impact, lowest risk.
2. **Do P0 #2 (cross-feature) incrementally** – One modal/slot at a time.
3. **Split one large component per sprint** – Begin with StudentsTable or CreateEditActionDialog.
4. **Fix `any` types alongside refactors** – When touching a file, improve types.

---

## Refactoring Progress (2026-02-13)

### Completed – P0 #1 (useEffect → React Query)

| Component | Refactor | Commit |
|-----------|----------|--------|
| BillingPreferencesSection | useBillingPreferences hook | 51d00e5 |
| MessagePreview | useMessagePreviewData hook | 473894e |
| StudentSubsidiesTable | useBillingPricing hook | 0ed6be8 |
| CreateEditTemplateDialog | useSampleStudents, useStudentClassesForTemplate | a939ab9 |
| MessageComposer | useStudentClassesForTemplate | (latest) |

### Completed – P0 #1 (continued)

| Component | Refactor | Commit |
|-----------|----------|--------|
| SendStudentInviteDialog | useStudentInviteData, useContactIdForRelated, useStudentClassesForTemplate | 4276519 |
| Staff SendInviteDialog | useStaffInviteToken, useContactIdForRelated | 4276519 |

### Completed – P0 #1 (useEffect → React Query) – 2026-02-13 batch

| Component | Refactor |
|-----------|----------|
| SendRegistrationInviteDialog | useRegistrationInviteData |
| SendBookingConfirmationDialog | useBookingConfirmationData |
| LogAbsenceDialog | useMissingStudentSession, useInitialStudentForAbsence |
| LogStaffAbsenceDialog | useMissingStaffSession, useInitialStaffForAbsence |
| Staff ClassesTab | useSubjectsList |
| Step0StaffSelector | useStaffListInfinite |

### Completed – P0 #1 (useEffect → React Query) – final batch

| Component | Refactor |
|-----------|----------|
| Step9Confirmation | useStep9ConfirmationData |
| AdminTrialContactForm | useSubjectsList (curriculums, yearLevels) + useDebounce |
| UnenrollStep3MessageScreen | useParentsForStudent |
| Step4MessageScreen | useParentsForStudent |
| ChangeClassStep4MessageScreen | useParentsForStudent |

**P0 #1 (useEffect → React Query) is now complete.**

### Remaining – P0 #2 (Cross-feature imports)

- 27+ cross-feature import sites (ViewClassModal, ViewStudentModal, useSubjects, etc.)
- Estimated 8–12 hours for layout-based composition

### Next Steps

1. Review this analysis.
2. Decide which P0/P1 items to tackle next.
3. Reply with: **"Proceed with refactoring"** and specify scope (e.g., "P0 remaining useEffect", "P0 #2 cross-feature", "P1 #4 split StudentsTable").
4. I will execute refactors one item at a time, run typecheck/lint after each, and commit incrementally.
