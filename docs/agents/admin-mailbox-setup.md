# Microsoft admin mailbox setup

DEV-250 follow-up, 30 October 2026. The mailbox is shared once per deployment,
not connected separately by every portal administrator. Active ADMINSTAFF users
use their normal portal login; the server authenticates with its environment's
single-tenant application. Outlook uses normal Microsoft mailbox access.

## Public configuration

Tenant: `f3f6e070-0a5f-4a0e-be23-fc1d716d687c` (Altitutor's existing tenant).

| Environment | Mailbox | Application (client) ID | Supabase project |
| --- | --- | --- | --- |
| Development / Vercel preview | `admin@development.altitutor.com` | `ac14c926-631b-4d14-b124-baf8e671c218` | `ysfslbdcacpbemodkwtl` |
| Production | `admin@altitutor.com` | `5eb2e080-9a4a-47b7-8313-844098cd79ec` | `mzgunxjfgvcyivcyqimn` |

App registration names are **Altitutor Admin Mail Development** and
**Altitutor Admin Mail Production**. Both are single-tenant, with no redirect URI.
No per-user OAuth connection is required.

Development is a separate shared mailbox, with primary address
`admin@development.altitutor.com` and alias `admin-development`. It requires no
additional license at its current shared-mailbox size. Production remains the
existing licensed `admin@altitutor.com` user mailbox; it was not converted.

The intended Exchange Application RBAC grants are `Application Mail.ReadWrite`
and `Application Mail.Send`, each scoped to only its environment's mailbox.
The matching Enterprise Application object IDs (different from app registration
object IDs) are development `a79fb915-1001-48e9-8141-70fa74d59a91` and production
`48314524-9e9a-4b67-a5ae-11fbdebb3a98`. Do not add broad Entra Graph mail grants;
those would be additive to the Exchange scopes. See the latest DEV-250 workpad
for the actual external provisioning/verification status.

## DNS

`development.altitutor.com` was added and verified in Microsoft 365. Cloudflare
contains these DNS-only mail records (TTL Auto):

| Type | Name under altitutor.com | Value | Priority |
| --- | --- | --- | --- |
| MX | `development` | `development-altitutor-com.mail.protection.outlook.com` | 0 |
| TXT | `development` | `v=spf1 include:spf.protection.outlook.com -all` | — |
| CNAME | `autodiscover.development` | `autodiscover.outlook.com` | — |

Existing web DNS and other email sender records are preserved. The following
DNS-only CNAMEs were published using this tenant's `Get-DkimSigningConfig` values:

| Name | Target |
| --- | --- |
| `selector1._domainkey.development` | `selector1-development-altitutor-com._domainkey.el1.n-v1.dkim.mail.microsoft` |
| `selector2._domainkey.development` | `selector2-development-altitutor-com._domainkey.el1.n-v1.dkim.mail.microsoft` |
| `selector1._domainkey` | `selector1-altitutor-com._domainkey.el1.q-v1.dkim.mail.microsoft` |
| `selector2._domainkey` | `selector2-altitutor-com._domainkey.el1.q-v1.dkim.mail.microsoft` |

Public DNS resolution verified all four targets. Microsoft still reported
`CnameMissing` when enabling DKIM, so signing activation remains pending; do not
claim DKIM is enabled until a successful readback. Existing parent DMARC is
`v=DMARC1;p=reject;pct=100;` and is preserved (including inherited subdomain policy).
Private DKIM keys remain within Microsoft.

## Provisioning checkpoint

Organization customization is enabled with Matthew's explicit approval
(`IsDehydrated=False`). Both Exchange service-principal pointers and exact mailbox
management scopes exist. Role assignment is still refused by Exchange with
“must be assigned a delegating role assignment … without a scope restriction,”
despite Organization Management's enabled `DelegatingOrgWide` role readback and
fresh authentication. This may be provisioning propagation; it is not verified
as such. No broad mail grants or additional admin roles were added as a workaround.

The development mailbox has Matthew's FullAccess and SendAs, plus both shared
Sent Items copy flags. The enabled/enforced rule **Altitutor development mailbox
internal only** matches this sender in header or envelope and rejects recipients
outside the organization. No production mail-flow rule was changed. Live mixed
recipient/Bcc behavior still requires controlled delivery QA.

Retry the existing scoped role assignments after Microsoft provisioning settles,
then verify positive/negative resources. These commands require a normal signed-in
Exchange administrator session, never an application's secret:

```powershell
$apps = @(
  @{Name='AltitutorAdminMailDevelopment'; ObjectId='a79fb915-1001-48e9-8141-70fa74d59a91'; Mailbox='admin@development.altitutor.com'},
  @{Name='AltitutorAdminMailProduction'; ObjectId='48314524-9e9a-4b67-a5ae-11fbdebb3a98'; Mailbox='admin@altitutor.com'}
)
foreach ($app in $apps) {
  foreach ($permission in @('Mail.ReadWrite','Mail.Send')) {
    $name = "$($app.Name)-$permission"
    if (-not (Get-ManagementRoleAssignment -Identity $name -ErrorAction SilentlyContinue)) {
      New-ManagementRoleAssignment -Name $name -Role "Application $permission" -App $app.ObjectId -CustomResourceScope $app.Name
    }
  }
  foreach ($resource in @('admin@development.altitutor.com','admin@altitutor.com','matt@altitutor.com')) {
    Test-ServicePrincipalAuthorization -Identity $app.ObjectId -Resource $resource |
      Select-Object RoleName,GrantedPermissions,InScope
  }
}
Set-DkimSigningConfig -Identity development.altitutor.com -Enabled $true
Set-DkimSigningConfig -Identity altitutor.com -Enabled $true
Get-DkimSigningConfig | Select-Object Name,Enabled,Status
```

The expected application test result is two in-scope roles only for the matching
mailbox, and out-of-scope for both other resources. A permission error is a blocker,
not grounds to grant unscoped Graph access. See DEV-250 for the latest readback.

## Human-only client secrets and deployment

No client secrets are included in this document or in the tracked example files.
Generate each secret yourself, while the agent is not observing the page:

1. In Microsoft Entra, open **App registrations → All applications** and select
   the matching application above. Verify its Application (client) ID.
2. Open **Certificates & secrets → Client secrets → New client secret**. Use a
   clear environment-specific description and your chosen expiry/rotation date.
3. Copy **Value**, not Secret ID, directly into `EMAIL_M365_CLIENT_SECRET` in the
   matching gitignored `secrets/.env.development` or `secrets/.env.production`.
   Do not paste it into chat, screenshots or tickets. Microsoft shows it once.
4. Copy the public tenant/client values from the corresponding tracked
   `.env.*.example`. Keep a separate secret for each application/environment.
5. Development also needs `EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS=matt@altitutor.com`
   initially. Add other individual internal staff addresses only when testing
   with them. `CRON_SECRET` must be populated in each selected environment file;
   preserve a suitable existing value or generate it privately.

From this branch's checkout, validate without printing values or changing services:

```sh
node secrets/scripts/deploy-mailbox.mjs --environment development --dry-run
node secrets/scripts/deploy-mailbox.mjs --environment production --dry-run
```

Do not deploy while the scoped application grants above are still blocked. Once
those grants are verified and this cutover is ready for reviewed CI/CD, run each
actual secret deployment yourself:

```sh
node secrets/scripts/deploy-mailbox.mjs --environment development
node secrets/scripts/deploy-mailbox.mjs --environment production
```

If the populated files are in a different checkout, append
`--secrets-dir /absolute/path/to/altitutor-monorepo/secrets` to each command.
The script reads only the selected environment's mail configuration. Deployment
authentication comes from shell `VERCEL_TOKEN` / `SUPABASE_ACCESS_TOKEN`, or the
existing gitignored `.env.shared`; Supabase CLI login is also supported.

This command updates only **altitutor-admin-web**'s matching Vercel target and the
matching Supabase project's mailbox secrets. It never prints secret values and
never deploys code, applies migrations or sends email. Redeploy admin-web after
changing its variables; Edge Functions use the matching project secrets. Deploy
code and the new migration through the normal reviewed CI/CD path. Avoid the old
bulk `deploy-all` command for this setup: it does not enforce these mailbox targets.

## Database cutover and controlled verification

The new migration binds a database immutably to one mailbox. Existing provider
state is treated as production-owned, and a mismatch preserves it and blocks
access. A read-only check during setup found zero unified provider messages,
folders, cursors, operational sends and onboarding emails in development. Recheck
if other integrations have since run; never delete cached mail to bypass binding.
Production did not yet have the unified mailbox tables at that check.

After reviewed code/schema deployment and human secret deployment:

1. Open preview admin-web as active ADMINSTAFF. Mail must display
   `admin@development.altitutor.com`; missing credentials or a binding mismatch
   must produce an error, not connect to production.
2. Use Refresh to import folders. Vercel preview does not run cron. Confirm a
   folder created in Outlook appears, and move/read changes reflect both ways.
3. Send a neutral test from the development mailbox only to allowlisted staff.
   Confirm one received copy and one Sent item, then reply from Outlook and the
   portal. Test To/Cc/Bcc rejection with an unapproved address before submission.
4. Verify assignment remains separate from shared read state, clears after a
   staff reply, and a subsequent incoming email is unassigned. Check contact
   navigation, attachment handling and direct Activity correspondence.
5. Verify each application's Exchange authorization is in scope for its own
   mailbox and out of scope for the opposite mailbox and `matt@altitutor.com`.
   Real Graph access still requires the privately generated secret and may need
   Microsoft's permission propagation window.
6. Production QA requires an explicitly controlled real `admin@altitutor.com`
   message after the development checks pass. Automated fixtures do not prove
   tenant credentials, Outlook propagation or successful email delivery.

Do not retry an uncertain send. Use delivery review and Sent reconciliation.
Microsoft's HTTP 202 means accepted submission, not confirmed delivery.
