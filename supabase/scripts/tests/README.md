# RLS Policy Testing

This directory contains SQL test files for testing Row Level Security (RLS) policies in Supabase.

## Test Files

### Infrastructure
- **`rls-test-utils.sql`** - Test utilities and helper functions for setting up test contexts and assertions

### Test Suites
- **`rls-helper-functions.test.sql`** - Tests for RLS helper functions (`is_adminstaff()`, `is_tutor()`, `is_student()`, etc.)
- **`rls-students-policies.test.sql`** - Tests for students table RLS policies (ADMINSTAFF, TUTOR, STUDENT access)
- **`rls-invoices-policies.test.sql`** - Tests for invoices table RLS policies (ADMINSTAFF access, STUDENT via views)
- **`rls-sessions-policies.test.sql`** - Tests for sessions table RLS policies (ADMINSTAFF, TUTOR access, STUDENT via views)
- **`rls-bookings-policies.test.sql`** - Tests for bookings (slot_reservations) RLS policies (ADMINSTAFF, authenticated users)
- **`rls-view-access.test.sql`** - Tests for view access patterns (vtutor_*, vstudent_* views filtering)

## Running Tests

### Prerequisites

1. **Test Database**: Tests should be run against a test database instance (not production!)
2. **Test Utilities**: Run `rls-test-utils.sql` first to install test helper functions
3. **Supabase MCP Tools**: Use Supabase MCP tools to execute tests against remote dev database

### Running Individual Test Files

```bash
# Using Supabase MCP (recommended)
# Execute SQL via Supabase MCP tools in your IDE

# Or using psql directly (if you have access)
psql $DATABASE_URL -f supabase/scripts/tests/rls-test-utils.sql
psql $DATABASE_URL -f supabase/scripts/tests/rls-helper-functions.test.sql
psql $DATABASE_URL -f supabase/scripts/tests/rls-students-policies.test.sql
psql $DATABASE_URL -f supabase/scripts/tests/rls-invoices-policies.test.sql
```

### Running All Tests

```bash
# Run in order:
# 1. Setup utilities
# 2. Helper function tests
# 3. Policy tests
cat supabase/scripts/tests/rls-test-utils.sql \
    supabase/scripts/tests/rls-helper-functions.test.sql \
    supabase/scripts/tests/rls-students-policies.test.sql \
    supabase/scripts/tests/rls-invoices-policies.test.sql \
  | psql $DATABASE_URL
```

## Test Structure

Each test file follows this pattern:

```sql
-- Test description
DO $$
DECLARE
  -- Test variables
BEGIN
  -- Setup: Create test users/data
  -- Execute: Test the RLS policy
  -- Assert: Verify expected behavior
  -- Cleanup: Remove test data
END $$;
```

## Test Utilities

### Setting User Context

```sql
-- Set role only
SELECT test_set_role('ADMINSTAFF');

-- Set user ID only
SELECT test_set_user_id('uuid-here');

-- Set both role and user ID
SELECT test_set_user_context('ADMINSTAFF', 'uuid-here');

-- Reset context
SELECT test_reset_context();
```

### Creating Test Users

```sql
-- Create admin staff
SELECT test_create_admin_staff(user_id, email);

-- Create tutor
SELECT test_create_tutor(user_id, email);

-- Create student
SELECT test_create_student(user_id, email);
```

## What Gets Tested

### Helper Functions
- `user_role()` - Returns current user role from JWT claims
- `is_adminstaff()` - Checks if user is ADMINSTAFF
- `is_tutor()` - Checks if user is TUTOR
- `is_student()` - Checks if user is STUDENT
- `is_staff()` - Checks if user is ADMINSTAFF or TUTOR
- `current_staff_id()` - Returns staff ID for current user
- `current_student_id()` - Returns student ID for current user

### RLS Policies

#### Students Table
- ✅ ADMINSTAFF: Full CRUD access
- ✅ TUTOR: Read-only access
- ✅ STUDENT: Read own record only

#### Invoices Table
- ✅ ADMINSTAFF: Full CRUD access (requires ACTIVE status)
- ✅ TUTOR: No direct access
- ✅ STUDENT: Read own invoices via `vstudent_invoices` view only

#### Sessions Table
- ✅ ADMINSTAFF: Full CRUD access
- ✅ TUTOR: Read-only access
- ✅ STUDENT: Read own sessions via `vstudent_sessions` view only

#### Bookings (slot_reservations) Table
- ✅ ADMINSTAFF: Full CRUD access (requires ACTIVE status)
- ✅ Authenticated Users: Read/create/delete own reservations only

#### View Access Patterns
- ✅ `vtutor_sessions`: Tutors see only sessions they're assigned to
- ✅ `vstudent_sessions`: Students see only their own sessions
- ✅ `vtutor_students`: Tutors see only students in their classes/sessions
- ✅ `vstudent_profile`: Students see only their own profile
- ✅ `vstudent_invoices`: Students see only their own invoices

## Important Notes

1. **Test Isolation**: Each test creates and cleans up its own test data
2. **Transactions**: Tests use `DO $$` blocks (implicit transactions) for isolation
3. **Security**: Tests verify both allowed AND denied access patterns
4. **Views**: Student access is tested through views (`vstudent_*`), not direct table access
5. **Status Checks**: Some policies check both role AND status (e.g., `is_adminstaff_active()`)

## Adding New Tests

When adding tests for new tables:

1. Create a new test file: `rls-{table-name}-policies.test.sql`
2. Follow the existing test structure
3. Test all roles (ADMINSTAFF, TUTOR, STUDENT) where applicable
4. Test both allowed and denied scenarios
5. Update this README with the new test file

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Run RLS Tests
  run: |
    psql ${{ secrets.TEST_DATABASE_URL }} -f supabase/scripts/tests/rls-test-utils.sql
    psql ${{ secrets.TEST_DATABASE_URL }} -f supabase/scripts/tests/rls-helper-functions.test.sql
    psql ${{ secrets.TEST_DATABASE_URL }} -f supabase/scripts/tests/rls-students-policies.test.sql
    psql ${{ secrets.TEST_DATABASE_URL }} -f supabase/scripts/tests/rls-invoices-policies.test.sql
```

## Troubleshooting

### Tests Fail with "Permission Denied"
- Ensure RLS is enabled on the table: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- Check that policies exist: `SELECT * FROM pg_policies WHERE tablename = 'table_name';`
- Verify helper functions exist: `SELECT proname FROM pg_proc WHERE proname LIKE 'is_%';`

### Tests Fail with "Function Not Found"
- Run `rls-test-utils.sql` first to install test utilities
- Check that helper functions are in the `public` schema

### Tests Pass But Should Fail
- Verify RLS policies are actually enabled
- Check that policies use the correct helper functions
- Ensure test context is set correctly (`test_set_user_context`)
