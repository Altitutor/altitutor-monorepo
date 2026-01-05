# Storage RLS Policies Setup Guide

## Overview

The migration `20260105133554_storage_rls_policies_resources.sql` creates helper functions for fine-grained access control on the `resources` storage bucket. However, **storage policies must be created manually via the Supabase Dashboard** due to ownership restrictions.

## Migration Status

✅ **Completed**: Helper functions created successfully
- `can_tutor_access_subject(subject_id UUID)` - Checks if tutor has access to a subject
- `can_tutor_create_file(file_path TEXT)` - Checks if tutor can create a file
- `can_tutor_read_file(file_path TEXT)` - Checks if tutor can read a file
- `can_student_read_file(file_path TEXT)` - Checks if student can read a file

⏳ **Pending**: Storage policies need to be created via Dashboard

## Creating Storage Policies via Dashboard

### Step 1: Navigate to Storage Policies

1. Go to your Supabase project Dashboard
2. Navigate to **Storage** → **Policies**
3. Select the **resources** bucket

### Step 2: Create Policies

Create the following 4 policies in order:

#### Policy 1: ADMINSTAFF All Access

- **Policy name**: `ADMINSTAFF all access to resources`
- **Allowed operations**: SELECT, INSERT, UPDATE, DELETE
- **Target roles**: authenticated
- **Policy definition**:
  ```sql
  bucket_id = 'resources' AND (SELECT public.is_adminstaff_active())
  ```

#### Policy 2: TUTOR Create Files

- **Policy name**: `TUTOR create files for their subjects`
- **Allowed operations**: INSERT
- **Target roles**: authenticated
- **Policy definition**:
  ```sql
  bucket_id = 'resources' AND (SELECT public.can_tutor_create_file(name))
  ```

#### Policy 3: TUTOR Read Files

- **Policy name**: `TUTOR read files for their subjects`
- **Allowed operations**: SELECT
- **Target roles**: authenticated
- **Policy definition**:
  ```sql
  bucket_id = 'resources' AND (SELECT public.can_tutor_read_file(name))
  ```

#### Policy 4: STUDENT Read Files

- **Policy name**: `STUDENT read authorized files`
- **Allowed operations**: SELECT
- **Target roles**: authenticated
- **Policy definition**:
  ```sql
  bucket_id = 'resources' AND (SELECT public.can_student_read_file(name))
  ```

## Access Rules Summary

### ADMINSTAFF
- ✅ **CREATE**: Yes (all files)
- ✅ **READ**: Yes (all files)
- ✅ **UPDATE**: Yes (all files)
- ✅ **DELETE**: Yes (all files)

### TUTOR
- ✅ **CREATE**: Yes (for subjects they're linked to via `staff_subjects` OR `classes_staff` → `classes` → `subjects`)
- ✅ **READ**: Yes (for subjects they're linked to)
- ❌ **UPDATE**: No
- ❌ **DELETE**: No

### STUDENT
- ❌ **CREATE**: No
- ✅ **READ**: Yes (if):
  - Enrolled in class with subject matching `file.topic.subject` OR
  - Has `tutor_logs_topics_files_students` record linking them to that file OR
  - Has `tutor_logs_topics_students` record linking them to that file's topic
- ❌ **UPDATE**: No
- ❌ **DELETE**: No

## Testing

After creating the policies, test them:

1. **Test as ADMINSTAFF**: Should be able to upload/download/update/delete any file
2. **Test as TUTOR**: Should only be able to upload/download files for their subjects
3. **Test as STUDENT**: Should only be able to download files they're authorized for

## Troubleshooting

If policies don't work as expected:

1. Verify helper functions exist:
   ```sql
   SELECT proname FROM pg_proc WHERE proname LIKE 'can_%';
   ```

2. Check function permissions:
   ```sql
   SELECT proname, proacl FROM pg_proc WHERE proname LIKE 'can_%';
   ```

3. Test functions directly (as authenticated user):
   ```sql
   SELECT public.can_tutor_access_subject('subject-id-here'::UUID);
   ```

4. Verify indexes exist for performance:
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename IN ('files', 'topics_files', 'students_subjects', 'classes_students', 'staff_subjects', 'classes_staff');
   ```

