# Tutor Web Implementation Summary

## Overview
Built out the database schema (views) and API routes for the tutor-web application. Tutors and admin staff can now access their classes, sessions, tutor logs, resources, and manage their profile through properly scoped views and API routes.

## Security Architecture

### Core Principle
- **READ**: Through views only (`security_invoker = false` for elevated privileges)
- **WRITE**: Through API routes only (with service role client)
- **NO** direct RLS policies for tutors on base tables

This architecture provides:
1. Single source of truth for scoping logic (in views)
2. Easy auditing and maintenance
3. Prevents direct database access bypassing business logic
4. Centralized access control

## Database Migration

**File**: `supabase/migrations/20251107231330_tutor_views_and_rls.sql`

### Helper Functions

1. **`is_tutor()`** - Returns true if user is TUTOR or ADMINSTAFF with ACTIVE status
2. **`current_tutor_id()`** - Returns staff.id for current authenticated tutor

### Views Created (9 total)

All views use `security_invoker = false` and are prefixed with `vtutor_`

#### 1. `vtutor_classes`
- All ACTIVE classes linked to tutor via `classes_staff`
- Includes class details and subject information

#### 2. `vtutor_class_detail`
- Single class details with students and staff
- Students: scoped to name, status, school, curriculum, year_level, availability fields
- Staff: all fields (for class coordination)
- Only ACTIVE enrollments shown

#### 3. `vtutor_sessions`
- All sessions linked to tutor via `sessions_staff`
- Includes session, class, and subject details
- All time periods (past, present, future)

#### 4. `vtutor_session_detail`
- Single session with students and staff
- Students: scoped fields (same as class_detail)
- Staff: scoped to name, role, status, availability fields
- Full session details with attendance tracking

#### 5. `vtutor_tutor_log`
- Tutor logs where tutor is involved (created_by, staff_attendance, or session linked)
- Full tutor_log structure with:
  - Staff attendance (scoped fields)
  - Student attendance (scoped fields)
  - Topics covered with student linkages
  - Files used with student linkages
  - Notes

#### 6. `vtutor_profile`
- Own staff record (all fields)
- Used for profile management

#### 7. `vtutor_subjects`
- Subjects accessible via:
  - Direct: `staff_subjects`
  - Indirect: classes linked via `classes_staff`
- Full subject details

#### 8. `vtutor_topics`
- All topics for authorized subjects
- Hierarchical structure maintained
- Full topic details

#### 9. `vtutor_topics_files`
- All topics_files for authorized topics
- Includes file details (filename, mimetype, size, storage info)
- Excludes deleted files

## API Routes

All routes use service role client for writes after validating permissions.

### 1. Tutor Logs (`/api/tutor-logs`)

**POST** - Create tutor log
- Validates session access via `vtutor_sessions`
- Checks for existing log
- Creates full tutor log structure (staff/student attendance, topics, files, notes)
- Returns tutor log ID on success

### 2. Profile (`/api/profile`)

**PATCH** - Update own profile
- Whitelisted fields only: `phone_number`, all 9 `availability_*` fields
- Validates tutor status
- Updates via service role client

**GET** - Get own profile
- Returns data from `vtutor_profile` view

### 3. Topics (`/api/topics`)

**POST** - Create topic
- Validates `subject_id` in `vtutor_subjects`
- Validates `parent_id` (if provided) in `vtutor_topics` and same subject
- Calculates next index automatically
- Sets `created_by` to current tutor

**PATCH `/api/topics/[id]`** - Update topic
- Validates topic access via `vtutor_topics`
- If changing parent, validates new parent and recalculates index
- Allows updating: name, parent_id, index

**NO DELETE endpoint** - Tutors cannot delete topics

### 4. Topics Files (`/api/topics-files`)

**POST** - Create topics_file
- Validates `topic_id` in `vtutor_topics`
- Calculates next index automatically
- Links existing file to topic
- Sets `created_by` to current tutor

**PATCH `/api/topics-files/[id]`** - Update topics_file
- Validates access via `vtutor_topics_files`
- Allows updating: index, type, is_solutions, is_solutions_of_id

**NO DELETE endpoint** - Tutors cannot delete topics_files

## Helper Files Created

### Service Role Client
**File**: `apps/tutor-web/src/shared/lib/supabase/service-role.ts`
- Exports `getServiceRoleClient()` function
- Uses `SUPABASE_SERVICE_ROLE_KEY` environment variable
- Bypasses RLS for server-side operations
- Never exposed to client

## Types

TypeScript types regenerated from updated schema:
- All new views are typed
- RPC functions (`is_tutor`, `current_tutor_id`) are typed

## Testing Notes

### Manual Testing Checklist
1. **Views**:
   - Query each view as a tutor user
   - Verify data scoping (only see authorized data)
   - Verify trying to access base tables directly fails

2. **API Routes**:
   - Test POST /api/tutor-logs with valid session
   - Test POST /api/tutor-logs with unauthorized session (should fail)
   - Test PATCH /api/profile with whitelisted fields
   - Test PATCH /api/profile with non-whitelisted fields (should ignore)
   - Test POST /api/topics with authorized subject
   - Test POST /api/topics with unauthorized subject (should fail)
   - Test POST /api/topics with parent in different subject (should fail)
   - Test PATCH /api/topics/[id] for authorized topic
   - Test POST /api/topics-files with authorized topic
   - Test PATCH /api/topics-files/[id] for authorized file

### Required Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (for client)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for API routes)

## Frontend Integration

### Reading Data
Use regular Supabase client to query views:
```typescript
const { data } = await supabase
  .from('vtutor_classes')
  .select('*');
```

### Writing Data
Call API routes via fetch:
```typescript
const response = await fetch('/api/tutor-logs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(tutorLogData),
});
```

### Existing Components
The following features already have components scaffolded in tutor-web:
- Classes (`src/features/classes`)
- Sessions (`src/features/sessions`)
- Tutor Logs (`src/features/tutor-logs`)
- Topics (`src/features/topics`)

Update these to:
1. Query the new views instead of base tables
2. Call API routes for mutations instead of direct Supabase updates

## Migration Applied Successfully

The migration was tested locally and applied successfully with no errors. All views are created, permissions granted, and helper functions working.

## Next Steps

1. Update frontend components to use new views and API routes
2. Add proper error handling and loading states in UI
3. Implement file upload functionality for topics_files
4. Add pagination for large result sets
5. Consider adding caching for frequently accessed views
6. Set up monitoring/logging for API route usage

## Notes

- Admin staff (`role = 'ADMINSTAFF'`) have full access to all tutor views
- Views use `security_invoker = false` so they execute with elevated privileges
- API routes validate tutor status on every request for security
- Tutor logs can only be created for sessions the tutor has access to
- Topics can only be created/updated within authorized subjects
- No delete operations are exposed to tutors - admin-only via admin-web

