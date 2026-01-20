# RLS Testing Notes

## Important: RLS Policy Testing Limitations

**RLS policies are bypassed when running as `postgres` superuser.**

The helper function tests work because they test database queries directly, but RLS policy tests that verify access restrictions may not work correctly when running as `postgres` superuser.

### Current Status

✅ **Helper Function Tests**: All 18 tests passing
- These test the logic of helper functions (JWT claims, database queries)
- Work correctly because they test function behavior, not RLS enforcement

⚠️ **RLS Policy Tests**: Some tests may fail when running as postgres
- Tests that verify RLS blocks access may incorrectly pass (because RLS is bypassed)
- Tests that verify RLS allows access should work correctly

### Proper RLS Testing Approach

To properly test RLS policies, you need to:

1. **Run queries as an authenticated role** (not postgres superuser)
2. **Set JWT claims properly** using `test_set_user_context()`
3. **Use `SET ROLE authenticated`** before running queries that should be subject to RLS

### Example of Proper RLS Test

```sql
DO $$
BEGIN
  -- Create test user and data
  PERFORM test_create_admin_staff('user-uuid-here');
  
  -- Switch to authenticated role to enforce RLS
  SET ROLE authenticated;
  
  -- Set JWT claims
  PERFORM test_set_user_context('ADMINSTAFF', 'user-uuid-here');
  
  -- Now RLS will be enforced
  -- Test your query here
  
  -- Reset role
  RESET ROLE;
END $$;
```

### Alternative: Use Supabase API for Testing

For comprehensive RLS testing, consider:
- Using Supabase client libraries with actual JWT tokens
- Running integration tests that hit the API endpoints
- Using Supabase's testing utilities if available

### Current Test Results

- **Helper Functions**: ✅ 18/18 passing
- **Policy Tests**: ⚠️ Need to run with proper role context for accurate results

## Running Tests Locally

```bash
# 1. Ensure local Supabase is running
supabase status

# 2. Install test utilities
psql postgresql://postgres:postgres@127.0.0.1:55322/postgres \
  -f supabase/scripts/tests/rls-test-utils.sql

# 3. Run tests
psql postgresql://postgres:postgres@127.0.0.1:55322/postgres \
  -f supabase/scripts/tests/rls-helper-functions.test.sql
```

## Next Steps

1. ✅ Helper function tests are working and passing
2. ⚠️ Policy tests need role context adjustments for accurate RLS testing
3. Consider adding integration tests using Supabase client libraries
4. Document expected behavior vs actual behavior in test output
