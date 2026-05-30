# Local credentials (not in git)

Place signing and cloud credentials here. Files in this directory are gitignored.

| File | Purpose |
|------|---------|
| `alti-apps-*.json` | Google Play service account JSON (download from GCP) |
| `ios/dist-cert.p12` | iOS distribution certificate |
| `ios/profile.mobileprovision` | iOS provisioning profile |
| `android/keystore.jks` | Android upload keystore |

Copy `../credentials.json.example` to `../credentials.json` and fill in paths/passwords.

**If a key was ever committed:** rotate it in GCP / Apple / Google Play and revoke the old key.
