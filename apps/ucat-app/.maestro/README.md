# Android browser handoff smoke

Use a disposable Android emulator with the UCAT development build connected to
this checkout's `pnpm dev:isolated --apps ucat-app` preview. Open the native app
signed out, finish Chrome's first-run setup with the required human agreement
approval, and keep the owned preview running. Bind the allocated web and API
ports only on that emulator with `adb -s <owned-device> reverse tcp:<port> tcp:<port>`
when their configured URLs use localhost. Do not use a personal device or remote
database for this fixture test.

Run Maestro with the exact owned device and the seeded local account:

```sh
maestro --device emulator-5582 test \
  -e TEST_STUDENT_EMAIL=alice.williams@student.test \
  -e TEST_STUDENT_PASSWORD=test-password \
  apps/ucat-app/.maestro/android-auth-return.yaml
```

The flow opens the browser from native Sign in, waits for an interactive form,
submits the disposable fixture credentials and verifies that Chrome closes and
native Practice navigation appears. It never accepts browser agreements or saves
passwords. It protects both editable login and same-session continuation: changing
between emulator and canonical browser hostnames must not strand the cookie on
the original host. Complete study, restart/foreground and logout checks separately
before shipping native changes.
