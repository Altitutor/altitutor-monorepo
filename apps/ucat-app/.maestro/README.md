# Android browser handoff smoke

Use a disposable Android emulator with the UCAT development build connected to
this checkout's `pnpm dev:isolated --apps ucat-app` preview. Open the connected native app signed out, finish
Chrome's first-run setup with the required human agreement approval, and keep the
owned preview running. Bind only that emulator's local API port with `adb reverse`
when the browser API URL uses localhost. Do not use a physical/personal device or
remote database for this fixture test.

Run Maestro with the exact owned device and a seeded local account email:

```sh
maestro --device emulator-5582 test \
  -e TEST_STUDENT_EMAIL=alice.williams@student.test \
  apps/ucat-app/.maestro/android-login-input.yaml
```

The flow stops after entering the email; it does not submit credentials or accept
Chrome terms. It protects the native-to-browser boundary: the browser login must
become interactive on Android's emulator hostname, rather than remain read-only
because Next's development assets were rejected. Complete login, study, session
restoration and logout checks separately before shipping native changes.
