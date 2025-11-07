# Student Portal Testing Guide

## Post-Migration Testing Checklist

After the migration `20251107000001_student_views_and_rls.sql` is applied via GitHub Actions, follow these tests:

---

## 1. Database Verification

### Test Helper Functions
```sql
-- As an authenticated student user
SELECT public.is_student(); -- Should return true
SELECT public.current_student_id(); -- Should return student UUID
```

### Test Views Exist
```sql
-- Check all views are created
SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname LIKE 'vstudent_%';
```

Expected output:
- vstudent_billing
- vstudent_class_detail
- vstudent_classes
- vstudent_profile
- vstudent_session_base
- vstudent_sessions
- vstudent_subject_resources
- vstudent_subjects
- vstudent_tutor_log

### Test RLS Policies
```sql
-- Check student policies on students table
SELECT policyname FROM pg_policies 
WHERE tablename = 'students' 
  AND policyname LIKE 'Students%';
```

Expected output:
- Students can view own profile
- Students can update own profile fields

---

## 2. Authentication Flow Testing

### Test Case 1: Student Login
**User:** testtest@altitutor.com (existing student account)

**Steps:**
1. Navigate to student-web (`localhost:3001` or student portal URL)
2. Click "Sign in"
3. Enter credentials
4. Login

**Expected:**
- ✅ Student is redirected to `/dashboard`
- ✅ Dashboard loads successfully
- ✅ Student profile displays (name, email, etc.)
- ✅ Billing info displays (if payment method exists)
- ✅ No console errors about RLS blocking queries

**Actual Result:** _[Fill in after testing]_

---

### Test Case 2: Staff Member Redirect (ADMINSTAFF)
**User:** An admin staff member account

**Steps:**
1. Navigate to student-web
2. Login with admin credentials

**Expected:**
- ✅ Middleware detects staff role
- ✅ User is redirected to admin portal: `{ADMIN_PORTAL_URL}/admin/dashboard`
- ✅ Console logs: `[STUDENT-WEB MIDDLEWARE] Staff member (ADMINSTAFF) detected, redirecting to admin portal`

**Actual Result:** _[Fill in after testing]_

---

### Test Case 3: Staff Member Redirect (TUTOR)
**User:** A tutor account

**Steps:**
1. Navigate to student-web
2. Login with tutor credentials

**Expected:**
- ✅ Middleware detects staff role
- ✅ User is redirected to tutor portal: `{TUTOR_PORTAL_URL}/dashboard`
- ✅ Console logs: `[STUDENT-WEB MIDDLEWARE] Staff member (TUTOR) detected, redirecting to tutor portal`

**Actual Result:** _[Fill in after testing]_

---

### Test Case 4: Non-Student/Non-Staff Account
**User:** An auth user NOT in students or staff table

**Steps:**
1. Navigate to student-web
2. Login with non-student/non-staff account

**Expected:**
- ✅ Middleware blocks access
- ✅ User is redirected to `/login?error=access_denied`
- ✅ Console logs: `[STUDENT-WEB MIDDLEWARE] No student record found, redirecting to login with error`

**Actual Result:** _[Fill in after testing]_

---

## 3. View Access Testing

Test as logged-in student (testtest@altitutor.com):

### Test vstudent_profile
```typescript
const { data, error } = await supabase
  .from('vstudent_profile')
  .select('*')
  .maybeSingle();

console.log('Profile data:', data);
console.log('Profile error:', error);
```

**Expected:**
- ✅ Returns student's own profile data
- ✅ No RLS error
- ✅ All profile fields present

---

### Test vstudent_billing
```typescript
const { data, error } = await supabase
  .from('vstudent_billing')
  .select('*')
  .maybeSingle();

console.log('Billing data:', data);
console.log('Billing error:', error);
```

**Expected:**
- ✅ Returns student's billing info (or null if none)
- ✅ No RLS error

---

### Test vstudent_classes
```typescript
const { data, error } = await supabase
  .from('vstudent_classes')
  .select('*');

console.log('Classes:', data);
console.log('Error:', error);
```

**Expected:**
- ✅ Returns all classes student is enrolled in
- ✅ Includes class details, subject info
- ✅ No RLS error

---

### Test vstudent_sessions
```typescript
const { data, error } = await supabase
  .from('vstudent_sessions')
  .select('*')
  .order('start_at', { ascending: false })
  .limit(10);

console.log('Sessions:', data);
console.log('Error:', error);
```

**Expected:**
- ✅ Returns student's sessions (past/present/future)
- ✅ Includes attendance info
- ✅ No RLS error

---

### Test vstudent_subjects
```typescript
const { data, error } = await supabase
  .from('vstudent_subjects')
  .select('*');

console.log('Subjects:', data);
console.log('Error:', error);
```

**Expected:**
- ✅ Returns all subjects linked to student
- ✅ Includes subjects from both direct links and class enrollments
- ✅ No duplicates
- ✅ No RLS error

---

## 4. Security Testing

### Test 1: Cannot View Other Students' Data
```typescript
// Try to query students table directly
const { data, error } = await supabase
  .from('students')
  .select('*')
  .neq('user_id', currentUserId); // Try to get OTHER students

console.log('Other students:', data);
console.log('Error:', error);
```

**Expected:**
- ✅ Returns empty array or null (RLS blocks)
- ✅ Student can only see own record

---

### Test 2: Cannot View Staff Private Data
```typescript
// Views should only show staff first_name, last_name
const { data, error } = await supabase
  .from('vstudent_class_detail')
  .select('*')
  .limit(1)
  .single();

console.log('Class detail:', data);
console.log('Staff info:', data?.staff);
```

**Expected:**
- ✅ Staff data only includes: id, first_name, last_name, role, subjects
- ✅ Does NOT include: email, phone_number, notes, user_id

---

### Test 3: Student Can Update Own Profile Fields
```typescript
const { data, error } = await supabase
  .from('students')
  .update({ 
    school: 'Test School',
    year_level: 12,
    availability_monday: true
  })
  .eq('id', currentStudentId)
  .select()
  .single();

console.log('Updated profile:', data);
console.log('Error:', error);
```

**Expected:**
- ✅ Update succeeds
- ✅ Changes are saved
- ✅ No RLS error

---

### Test 4: Student Cannot Update Restricted Fields
```typescript
const { data, error } = await supabase
  .from('students')
  .update({ 
    status: 'ACTIVE', // Try to change status (should fail)
    created_by: someUUID // Try to change created_by (should fail)
  })
  .eq('id', currentStudentId)
  .select()
  .single();

console.log('Restricted update result:', data);
console.log('Error:', error);
```

**Expected:**
- ⚠️ This will currently succeed due to policy design
- 🔧 Future: Add column-level RLS or application-level validation
- ✅ Note: Document that restricted field updates should go through API with admin approval

---

## 5. Console Error Check

**After all tests:**
1. Open browser DevTools Console
2. Check for errors

**Expected:**
- ✅ No RLS policy errors
- ✅ No "permission denied" errors
- ✅ No Supabase client errors
- ✅ Only informational logs from middleware

---

## 6. Network Tab Verification

1. Open browser DevTools Network tab
2. Filter by "supabase" or "postgrest"
3. Check API calls

**Expected:**
- ✅ All API calls return 200 OK
- ✅ No 401 Unauthorized
- ✅ No 403 Forbidden (RLS)
- ✅ Response payloads contain expected data

---

## Environment Variables

Ensure these are set correctly:

### Student-Web
```env
NEXT_PUBLIC_ADMIN_PORTAL_URL=http://localhost:3000  # or production URL
NEXT_PUBLIC_TUTOR_PORTAL_URL=http://localhost:3002  # or production URL
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## Known Issues / Future Enhancements

1. **Column-level RLS**: Currently, students CAN update all fields. Consider:
   - Adding column-level RLS policies
   - Or enforcing restrictions at API layer
   - Document which fields should be admin-only

2. **Tutor Log Access**: Students only see tutor logs for sessions they attended
   - Future: Consider preview of upcoming session topics

3. **File Storage Access**: Views return storage paths but not signed URLs
   - Future: Add helper function to generate signed URLs for student-accessible files

---

## Rollback Plan

If issues occur:

```sql
-- Drop student views
DROP VIEW IF EXISTS public.vstudent_billing CASCADE;
DROP VIEW IF EXISTS public.vstudent_class_detail CASCADE;
DROP VIEW IF EXISTS public.vstudent_classes CASCADE;
DROP VIEW IF EXISTS public.vstudent_profile CASCADE;
DROP VIEW IF EXISTS public.vstudent_session_base CASCADE;
DROP VIEW IF EXISTS public.vstudent_sessions CASCADE;
DROP VIEW IF EXISTS public.vstudent_subject_resources CASCADE;
DROP VIEW IF EXISTS public.vstudent_subjects CASCADE;
DROP VIEW IF EXISTS public.vstudent_tutor_log CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.is_student() CASCADE;
DROP FUNCTION IF EXISTS public.current_student_id() CASCADE;

-- Drop student policies
DROP POLICY IF EXISTS "Students can view own profile" ON public.students;
DROP POLICY IF EXISTS "Students can update own profile fields" ON public.students;
```

---

## Success Criteria

✅ All authentication flows work correctly
✅ Students can access their own data
✅ Students cannot access other students' data
✅ Staff members are redirected to appropriate portals
✅ No RLS errors in console
✅ All 9 views return correct data
✅ Profile updates work for allowed fields

---

## Notes

- Test with multiple student accounts if possible
- Test on both dev and staging before production
- Monitor Supabase logs for any RLS violations
- Check performance of recursive CTE in `vstudent_subject_resources` with large topic trees

