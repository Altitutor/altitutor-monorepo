# Student Portal Implementation Summary

## Overview

Successfully implemented student-scoped database views, RLS policies, and authentication middleware for the Student Portal. Students can now securely access their own data without seeing other students' information.

---

## Files Created/Modified

### ✅ Created Files

1. **`supabase/migrations/20251107000001_student_views_and_rls.sql`**
   - 9 student-scoped database views (prefixed with `vstudent_`)
   - 2 helper functions for student authentication
   - RLS policies for student access to `students` table

2. **`apps/student-web/src/middleware.ts`**
   - Next.js middleware for route protection
   - Staff member detection and redirection
   - Student-only access enforcement

3. **`docs/student-portal-testing.md`**
   - Comprehensive testing guide
   - Test cases for all authentication flows
   - Security validation tests

4. **`docs/student-portal-implementation-summary.md`** (this file)

### ✅ Modified Files

1. **`apps/student-web/src/features/auth/components/AuthGuard.tsx`**
   - Simplified to work with middleware
   - Removed role-checking logic (now in middleware)
   - Reduced from ~130 lines to ~50 lines

2. **`apps/student-web/src/app/dashboard/page.tsx`**
   - Updated to query `vstudent_profile` view instead of `students` table
   - Updated to query `vstudent_billing` view instead of `students_billing` table

---

## Database Schema

### Helper Functions

```sql
public.is_student()           -- Returns TRUE if current user is a student
public.current_student_id()   -- Returns student UUID for current user
```

### RLS Policies Added

**On `students` table:**
- `Students can view own profile` - SELECT access to own record
- `Students can update own profile fields` - UPDATE access to own record

### Views Created

All views use `security_invoker = on` to enforce RLS based on the calling user.

| View Name | Purpose | Key Features |
|-----------|---------|--------------|
| `vstudent_profile` | Student's own profile | All student fields |
| `vstudent_billing` | Billing information | Payment method details (read-only) |
| `vstudent_classes` | Enrolled classes | Past, present, future enrollments |
| `vstudent_class_detail` | Individual class | Students & staff in class (limited info) |
| `vstudent_sessions` | All sessions | Linked sessions with attendance status |
| `vstudent_session_base` | Session detail | Full session info with participants |
| `vstudent_tutor_log` | Attendance records | Student-scoped topics & files only |
| `vstudent_subjects` | Student's subjects | Direct links + class-based subjects |
| `vstudent_subject_resources` | Topic hierarchy | Recursive tree with files |

---

## Authentication Flow

### Student Access
```
1. Student visits student-web
2. Middleware checks: Is user in students table?
3. ✅ Yes → Allow access to student portal
4. Student queries views → RLS ensures only own data
```

### Staff Redirection
```
1. Staff member visits student-web
2. Middleware checks: Is user in staff table?
3. ✅ Yes, ADMINSTAFF → Redirect to admin-web/admin/dashboard
4. ✅ Yes, TUTOR → Redirect to tutor-web/dashboard
```

### Non-Student/Non-Staff
```
1. Other user visits student-web
2. Middleware checks: Not in students or staff table
3. ❌ Redirect to /login?error=access_denied
```

---

## Security Model

### What Students CAN Access

✅ **Own Data:**
- Profile information
- Billing details
- Enrolled classes
- Session history
- Attendance records
- Topics covered (for attended sessions only)
- Files used (for attended sessions only)
- Subjects they're taking

✅ **Limited Info About Others:**
- Classmates: first_name, last_name, year_level only
- Staff: first_name, last_name, subjects they teach
- No emails, phone numbers, or personal details

### What Students CANNOT Access

❌ Other students' full profiles
❌ Other students' attendance (except in same class/session)
❌ Topics not assigned to them
❌ Files not assigned to them
❌ Staff personal information (email, phone, etc.)
❌ Admin-only tables

### Write Permissions

**Direct Write (via views):**
- ✅ Students table: Can update profile fields
  - Allowed: `first_name`, `last_name`, `school`, `curriculum`, `year_level`, `availability_*`
  - Note: Currently all fields updatable - enforce restrictions at API layer

**API-Only Write (future):**
- ❌ Absence requests → API → Admin approval
- ❌ Reschedule requests → API → Admin approval
- ❌ Profile changes → API → Admin approval (optional)

---

## Data Access Patterns

### Profile & Billing
```typescript
// Get student profile
const { data } = await supabase
  .from('vstudent_profile')
  .select('*')
  .single();

// Get billing info
const { data } = await supabase
  .from('vstudent_billing')
  .select('*')
  .single();
```

### Classes & Sessions
```typescript
// Get all classes
const { data } = await supabase
  .from('vstudent_classes')
  .select('*');

// Get single class with participants
const { data } = await supabase
  .from('vstudent_class_detail')
  .select('*')
  .eq('class_id', classId)
  .single();

// Get all sessions
const { data } = await supabase
  .from('vstudent_sessions')
  .select('*')
  .order('start_at', { ascending: false });

// Get session detail with tutor log
const { data: session } = await supabase
  .from('vstudent_session_base')
  .select('*')
  .eq('session_id', sessionId)
  .single();

const { data: tutorLog } = await supabase
  .from('vstudent_tutor_log')
  .select('*')
  .eq('session_id', sessionId)
  .single();
```

### Subjects & Resources
```typescript
// Get all subjects
const { data } = await supabase
  .from('vstudent_subjects')
  .select('*');

// Get topic tree with files for a subject
const { data } = await supabase
  .from('vstudent_subject_resources')
  .select('*')
  .eq('subject_id', subjectId)
  .order('path');
```

---

## Environment Variables Required

```env
# Student-Web (.env.local)
NEXT_PUBLIC_ADMIN_PORTAL_URL=http://localhost:3000
NEXT_PUBLIC_TUTOR_PORTAL_URL=http://localhost:3002
NEXT_PUBLIC_SUPABASE_URL=your_dev_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_dev_anon_key
```

---

## Next Steps

### 1. Push to GitHub & Deploy Migration
```bash
git add .
git commit -m "feat: Add student portal views and RLS policies"
git push origin develop
```

The GitHub Actions workflow will apply the migration to your dev database.

### 2. Test Authentication Flow

Follow the testing guide in `docs/student-portal-testing.md`:
- Test student login (testtest@altitutor.com)
- Test staff redirection
- Test view access
- Test security boundaries

### 3. Implement Student Portal Routes

Now that the database layer is ready, implement the frontend routes:

**`/dashboard`** (Already updated ✅)
- Shows profile and billing info

**`/sessions`** (To implement)
```typescript
// Get sessions
const { data } = await supabase
  .from('vstudent_sessions')
  .select('*')
  .order('start_at', { ascending: false });
```

**`/resources`** (To implement)
```typescript
// Get subjects
const { data: subjects } = await supabase
  .from('vstudent_subjects')
  .select('*');

// Get resources for a subject
const { data: resources } = await supabase
  .from('vstudent_subject_resources')
  .select('*')
  .eq('subject_id', subjectId);
```

**`/billing`** (To implement)
```typescript
// Get billing info
const { data } = await supabase
  .from('vstudent_billing')
  .select('*')
  .single();

// Update payment method via API
```

**`/my-profile`** (To implement)
```typescript
// Get profile
const { data } = await supabase
  .from('vstudent_profile')
  .select('*')
  .single();

// Update profile
const { data } = await supabase
  .from('students')
  .update({ school, year_level, availability_monday, ... })
  .eq('id', currentStudentId)
  .select()
  .single();
```

### 4. Generate TypeScript Types

After migration is applied, regenerate types:

```bash
npx supabase gen types typescript --project-id ysfslbdcacpbemodkwtl > packages/shared/src/supabase/types.ts
```

This will include the new views in your TypeScript definitions.

### 5. Future Enhancements

**Column-Level RLS:**
```sql
-- Future: Restrict which fields students can update
CREATE POLICY "Students can update allowed fields" ON public.students
  FOR UPDATE TO authenticated
  USING (id = public.current_student_id())
  WITH CHECK (
    id = public.current_student_id()
    AND (OLD.status IS NOT DISTINCT FROM NEW.status)  -- Cannot change status
    AND (OLD.created_by IS NOT DISTINCT FROM NEW.created_by)  -- Cannot change creator
    -- Add more field restrictions...
  );
```

**API Layer for Approved Changes:**
```typescript
// Future: API endpoint for absence requests
POST /api/students/absences
Body: { session_id, reason }
Flow: Student → API → Admin approval → Update session
```

**File Access Helper:**
```sql
-- Future: Function to generate signed URLs for student-accessible files
CREATE FUNCTION public.get_student_file_url(file_id UUID)
RETURNS TEXT
```

---

## Architecture Benefits

1. **Security by Default**: RLS ensures data isolation at database level
2. **Performance**: Views can be indexed and optimized
3. **Maintainability**: Single source of truth for student access patterns
4. **Consistency**: All three portals use same middleware pattern
5. **Scalability**: Views can be materialized for large datasets
6. **Auditability**: Clear separation between student and staff access

---

## Performance Considerations

- **Recursive CTE** in `vstudent_subject_resources`: Monitor performance with deep topic hierarchies
- **JSON aggregations**: Consider pagination for classes/sessions with many participants
- **Future**: Add indexes on frequently queried columns in base tables
- **Future**: Consider materialized views for expensive aggregations

---

## Support & Troubleshooting

### Common Issues

**Issue:** Student sees "Redirecting to admin portal"
- **Cause:** Student record not in database or RLS blocking query
- **Fix:** Check student exists with correct `user_id`

**Issue:** Views return empty results
- **Cause:** `current_student_id()` not finding student record
- **Fix:** Verify student has `user_id` matching `auth.uid()`

**Issue:** Staff member not redirected
- **Cause:** Middleware not detecting staff role
- **Fix:** Check staff record has correct `user_id` and `role`

**Issue:** RLS policy errors in console
- **Cause:** Missing permissions or policy not covering use case
- **Fix:** Check grants and policy conditions

### Debug Queries

```sql
-- Check if user is recognized as student
SELECT public.is_student();
SELECT public.current_student_id();

-- Check student record
SELECT * FROM students WHERE user_id = auth.uid();

-- Check staff record
SELECT * FROM staff WHERE user_id = auth.uid();

-- Test view access
SELECT * FROM vstudent_profile;
```

---

## Summary

✅ **Migration Created**: `20251107000001_student_views_and_rls.sql`
✅ **Middleware Implemented**: Staff detection and redirection
✅ **AuthGuard Simplified**: Works with middleware
✅ **Dashboard Updated**: Uses new views
✅ **Testing Guide Created**: Comprehensive test cases
✅ **Security Model Defined**: Student-scoped data access

**Status**: Ready for deployment to dev environment via GitHub Actions

**Next**: Push to GitHub, test in dev, iterate based on results

