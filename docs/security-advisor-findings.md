# Supabase Security Advisor Findings

**Date:** December 29, 2024  
**Project:** altitutor-backend-dev  
**Status:** Review and Action Required

## Summary

The Supabase Security Advisor identified **4 categories** of security issues:
- **25 ERROR-level** issues: SECURITY DEFINER views
- **50+ WARN-level** issues: Functions with mutable search_path
- **2 WARN-level** issues: Auth configuration (leaked password protection, MFA)

## 1. SECURITY DEFINER Views (ERROR Level) - 25 Issues

### Description
All `vtutor_*`, `vstudent_*`, and `vadmin_*` views are flagged as using `SECURITY DEFINER` (via `WITH (security_invoker = false)`).

### Views Affected
- **Tutor views (9):** `vtutor_classes`, `vtutor_class_detail`, `vtutor_subjects`, `vtutor_topics`, `vtutor_topics_files`, `vtutor_sessions`, `vtutor_session_detail`, `vtutor_tutor_log`, `vtutor_profile`, `vtutor_students`, `vtutor_sessions_students`
- **Student views (10):** `vstudent_profile`, `vstudent_sessions`, `vstudent_billing`, `vstudent_classes`, `vstudent_class_detail`, `vstudent_session_detail`, `vstudent_session_base`, `vstudent_tutor_log`, `vstudent_subjects`, `vstudent_subject_resources`, `vstudent_payment_attempts`
- **Admin views (4):** `vadmin_stuck_payment_attempts`, `vadmin_billing_with_payment_methods`, `vadmin_missing_payment_obligations`, `vadmin_failed_payment_attempts`

### Analysis
**This appears to be INTENTIONAL** based on the architecture:
- Views use `WITH (security_invoker = false)` to run with elevated privileges
- This allows TUTOR and STUDENT roles to query views without direct table access
- Views enforce data scoping through WHERE clauses (e.g., `WHERE s.id = public.current_student_id()`)
- This follows the documented pattern: "READ through views only, WRITE through API routes only"

### Recommendation
**Status:** ✅ **ACCEPTABLE** - This is intentional architecture

The security advisor flags this because SECURITY DEFINER views run with the creator's permissions, not the querying user's. However, in this case:
1. Views are properly scoped with WHERE clauses
2. Users can only READ through views (no direct writes)
3. All writes go through API routes with proper authorization
4. This is a documented security pattern for role-based access

**Action:** No changes needed. The architecture is correct for the use case.

**Reference:** 
- [Supabase Security Advisor Documentation](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- Architecture documented in `docs/tutor-web-implementation-summary.md`

---

## 2. Function Search Path Mutable (WARN Level) - 50+ Issues

### Description
Functions without a fixed `search_path` are vulnerable to schema injection attacks. An attacker could create a malicious schema and trick functions into using objects from that schema instead of the intended `public` schema.

### Functions Affected
All functions that don't have `SET search_path = public` (or `SET search_path = ''`) in their definition.

### Fix Applied
✅ **Migration Created:** `supabase/migrations/20251229000000_fix_function_search_path_security.sql`

This migration adds `SET search_path = public` to all affected functions using `ALTER FUNCTION ... SET search_path = public`.

### Functions Fixed (Sample)
- Helper functions: `is_tutor()`, `current_tutor_id()`, `is_student()`, `current_student_id()`, etc.
- Utility functions: `build_fuzzy_like()`, `standardize_au_phone()`, `validate_phone_e164()`, etc.
- Sync functions: `sync_staff_sessions_on_assignment()`, `sync_student_sessions_on_enrollment()`, etc.
- Formatting functions: `format_class_short_name()`, `format_class_full_name()`, etc.
- And 40+ more...

### Recommendation
**Status:** ✅ **FIXED** - Migration ready to apply

**Action:** Apply the migration to the development database:
```bash
# The migration will be applied automatically through CI/CD
# Or apply manually via Supabase CLI:
supabase db push
```

**Reference:** 
- [Supabase Security Advisor Documentation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)

---

## 3. Leaked Password Protection Disabled (WARN Level)

### Description
Supabase Auth's leaked password protection is currently disabled. This feature checks passwords against HaveIBeenPwned.org to prevent users from using compromised passwords.

### Recommendation
**Status:** ⚠️ **ACTION REQUIRED** - Manual configuration needed

**Action:** Enable leaked password protection in Supabase Dashboard:
1. Go to **Authentication** → **Policies**
2. Enable **"Leaked Password Protection"**
3. This will check passwords against HaveIBeenPwned.org database

**Reference:** 
- [Supabase Password Security Documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

---

## 4. Insufficient MFA Options (WARN Level)

### Description
The project has too few multi-factor authentication (MFA) options enabled, which may weaken account security.

### Recommendation
**Status:** ⚠️ **ACTION REQUIRED** - Manual configuration needed

**Action:** Enable additional MFA options in Supabase Dashboard:
1. Go to **Authentication** → **Providers**
2. Enable **TOTP (Time-based One-Time Password)** for MFA
3. Consider enabling **SMS MFA** if phone numbers are available
4. Configure MFA enforcement policies as needed

**Reference:** 
- [Supabase MFA Documentation](https://supabase.com/docs/guides/auth/auth-mfa)

---

## Action Items

### Immediate (Database Migration)
- [x] ✅ Create migration to fix function search_path issues
- [ ] ⏳ Apply migration to development database
- [ ] ⏳ Test migration in development
- [ ] ⏳ Apply migration to production (via CI/CD)

### Manual Configuration (Supabase Dashboard)
- [ ] ⏳ Enable leaked password protection
- [ ] ⏳ Enable MFA options (TOTP, SMS)
- [ ] ⏳ Configure MFA enforcement policies

### Documentation
- [x] ✅ Document SECURITY DEFINER views analysis
- [x] ✅ Document function search_path fixes
- [x] ✅ Document Auth configuration recommendations

---

## Testing Checklist

After applying the migration, verify:
- [ ] All functions still work correctly
- [ ] No performance degradation
- [ ] Security advisor shows reduced warnings
- [ ] Application functionality unchanged

---

## Notes

- The SECURITY DEFINER views are **intentional** and follow the documented architecture pattern
- Function search_path fixes are **non-breaking** - they only add security hardening
- Auth configuration changes require **manual dashboard configuration** (cannot be done via migrations)

