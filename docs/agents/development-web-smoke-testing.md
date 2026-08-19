# Development web smoke testing

Use these checks after middleware, authentication, or portal-routing changes deploy to the development environment.

## Credentials

The local-only credential source is `.agents/.env.development-test-accounts`. It is ignored by git because all `.env.*` files are ignored.

- Source that file for browser or scripted smoke tests.
- Treat its values as secrets: keep them out of tracked files, logs, tool output, screenshots, and final reports.
- If the file is absent, ask the repository owner for the development student, tutor, and admin test accounts.

## Portal matrix

- Student: `https://student.development.altitutor.com`
- Tutor: `https://tutor.development.altitutor.com`
- Admin: `https://admin.development.altitutor.com`
- UCAT: `https://ucat.development.altitutor.com`

## Middleware smoke test

1. Open a protected page anonymously in each portal. Confirm a prompt redirect to login and preservation of the intended return path where supported.
2. Sign into student-web with the student account. Confirm the dashboard and at least one protected navigation load without a 500, 503, or 504.
3. Sign into tutor-web with the tutor account. Confirm the dashboard and at least one protected navigation load.
4. Sign into admin-web with the admin account. Confirm the dashboard and at least one protected navigation load.
5. Sign into UCAT with the student account. Confirm the expected access/onboarding route and a protected navigation load.
6. Open the wrong portal for each authenticated role. Confirm staff leave student-web for their staff portal and unauthorized roles fail closed.
7. Refresh protected pages and inspect browser/Vercel logs for `MIDDLEWARE_INVOCATION_TIMEOUT`, middleware dependency errors, and unexpected 503 responses.

Keep the run read-only unless the task explicitly authorizes remote data mutations.
