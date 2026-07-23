# UCAT Google and Apple sign-in launch

This runbook launches Google and Apple as additional sign-in methods for the existing UCAT Student account. Every new student still confirms their details, chooses their email-and-password address, and sets a password during signup onboarding.

Provider-verified email behaviour:

- A student who keeps the email supplied by Google or Apple does not repeat the initial email verification step.
- A student who changes that email during onboarding receives Supabase's secure email-change confirmation. The provider sign-in remains attached while that change is pending.
- Connecting Google or Apple in My profile does not replace the Student account, primary email, subscription, or learning history.

## Configuration ownership

Hosted Supabase Auth configuration must be deployed by `.github/workflows/supabase-deploy.yml`; do not edit the remote project directly. The workflow calls `supabase/scripts/deploy-config.sh`, which enables manual identity linking and fails closed if an enabled provider is missing credentials.

Provider visibility is independently controlled by server-side `ucat-web` environment flags:

| Setting | Supabase GitHub Environment | `ucat-web` deployment environment |
| --- | --- | --- |
| Google visible/enabled | Variable `AUTH_GOOGLE_ENABLED` | `AUTH_GOOGLE_ENABLED` |
| Apple visible/enabled | Variable `AUTH_APPLE_ENABLED` | `AUTH_APPLE_ENABLED` |

Keep the application flag `false` until the corresponding Supabase provider has been deployed and tested. In particular, leave `AUTH_APPLE_ENABLED=false` until all Apple steps below are complete.

## Google setup

1. In Google Auth Platform, configure the audience/consent screen and create an OAuth client with application type **Web application**.
2. Add the UCAT origins used by the target environment, for example `https://ucat.development.altitutor.com` and `https://ucat.altitutor.com`, under **Authorized JavaScript origins**.
3. Add the target Supabase Auth callback under **Authorized redirect URIs**:

   ```text
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   This is the Supabase callback, not `https://ucat.altitutor.com/auth/callback`.

4. Add these secrets to each appropriate GitHub Environment:

   - `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
   - `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`

5. Set the GitHub Environment variable `AUTH_GOOGLE_ENABLED=true`, merge through the normal branch flow, and let Supabase Deploy apply the hosted Auth configuration.
6. Set `AUTH_GOOGLE_ENABLED=true` in the matching `ucat-web` deployment environment and redeploy the application.
7. Complete the test matrix below in development before repeating the enablement in production.

For local Supabase testing, fill the disabled `[auth.external.google]` block in `supabase/config.toml`, export `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`, add `http://127.0.0.1:55321/auth/v1/callback` to the Google client, and enable the block only in the local working copy. Do not commit provider credentials.

## Apple setup

Apple's web OAuth configuration requires an active Apple Developer membership.

1. Record the Apple Developer **Team ID**.
2. Create or select an **App ID**, enable the **Sign in with Apple** capability, and leave the server-to-server notification endpoint blank. Supabase Auth does not currently support that endpoint.
3. Create a **Services ID** for the web application and associate it with the App ID. This Services ID is the Supabase Apple client ID.
4. Configure the Services ID website settings using the target Supabase project:

   ```text
   Domain: <project-ref>.supabase.co
   Return URL: https://<project-ref>.supabase.co/auth/v1/callback
   ```

5. Create a Sign in with Apple key, record its **Key ID**, download the `.p8` file once, and store it securely. Do not add it to this repository.
6. Generate the Apple client secret from the Team ID, Services ID, Key ID, and `.p8` signing key with `secrets/scripts/generate-apple-client-secret.mjs`. Apple web OAuth secrets expire after at most six months, so create an operational reminder to rotate the secret before expiry and retain the `.p8` file for rotation.
7. Register Altitutor's production sending domain/address as a Sign in with Apple email communication source. This is required for mail sent through Supabase/Resend to reach students who choose Apple's private relay address.
8. Add these secrets to each appropriate GitHub Environment:

   - `SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID` — the Services ID
   - `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` — the generated client secret

9. Set the GitHub Environment variable `AUTH_APPLE_ENABLED=true`, merge through the normal branch flow, and let Supabase Deploy configure the provider.
10. Set `AUTH_APPLE_ENABLED=true` in the matching `ucat-web` deployment environment and redeploy the application. Until this final step, the Apple button remains hidden.

Apple's web OAuth response does not supply the person's full name. The UCAT details step intentionally collects the required first and last name instead.

For local Supabase testing, fill the disabled `[auth.external.apple]` block in `supabase/config.toml`, export `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`, and enable the block only in the local working copy. Apple's configured domain and callback restrictions make testing against the hosted development project more representative than a localhost-only setup.

## Release test matrix

Run each provider through these paths in development, then smoke-test them in production:

- New signup with the provider email unchanged: lands at details, skips initial email OTP, must set a password, and completes the sampler/plan sequence.
- New signup with a different email: sends secure email-change confirmation, still requires a password, and synchronizes the confirmed email into the Student profile after the callback.
- Signup from a paid-plan URL: preserves the selected plan and reaches the intended checkout.
- Signup with a referral and newsletter consent: preserves the referral and subscribes the chosen email.
- First provider sign-in started from the login page: an incomplete account resumes signup onboarding; a completed account reaches its requested destination.
- Existing verified email/password user signing in with the same provider email: Supabase automatically attaches the identity to the existing user rather than creating a second Student account.
- My profile **Connect**: returns to the same account and displays the connected provider.
- My profile **Remove**: works only when Supabase reports at least two identities. Password authentication remains available, but Supabase's supported unlink API still requires two linked identities.
- Different-email provider linking: only occurs through the authenticated My profile **Connect** action; do not implement an automatic cross-email merge.
- Cancelled/denied provider consent and invalid callbacks: return an actionable error to login, signup, or My profile without losing the existing session.
- Apple private relay: confirmation, recovery, and other Auth emails reach the relay address.
- Provider flag off: its button is absent from login, signup, and My profile.

## Rollback

1. Set the affected `ucat-web` deployment flag to `false` and redeploy so no new flows can start.
2. Set the matching GitHub Environment variable to `false` and let the Supabase Deploy workflow disable the provider.
3. Do not delete users or identities. Existing email-and-password access and Student data remain intact.

## References

- [Supabase: Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase: Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Supabase: Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase Management API: update Auth configuration](https://supabase.com/docs/reference/api/management)
