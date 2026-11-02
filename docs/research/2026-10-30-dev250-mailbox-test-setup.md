# DEV-250: Microsoft mailbox testing and connection setup

Researched 2026-10-30. Documentation and delivered source inspection only; no tenant, credentials, deployment settings, mailbox, or messages were changed or inspected.

## Recommendation

Use a dedicated **shared test mailbox**, for example `admin-test@altitutor.com`, in the existing Microsoft 365 tenant, with a separate development application registration. Keep its application access restricted to that mailbox. Use fictional correspondence and controlled recipients. Keep production `admin@` for a final bounded verification after staging passes. This recommendation separates real Exchange integration testing from customer correspondence without requiring another tenant.

A shared mailbox ordinarily needs no separate mailbox license up to 50 GB, but the tenant must include Exchange Online and Outlook delegates need their own licensed Exchange mailboxes. Advanced compliance/archive features can require licensing. Keep shared mailbox direct sign-in blocked; testers open it through their own Outlook accounts. [Microsoft shared mailbox requirements](https://learn.microsoft.com/en-us/microsoft-365/admin/email/about-shared-mailboxes)

An alias of `admin@` would share the same mailbox and is therefore unsuitable as an isolated test inbox (architectural inference). A new licensed user is unnecessary for ordinary shared-mailbox testing.

## Create the test mailbox and application

1. With an Exchange administrator, open Microsoft 365 admin center → Teams & groups → Shared mailboxes → Add a shared mailbox. Add only the testers as members. Give Outlook testers Full Access and Send As; these human permissions are separate from the application's permissions. [Create/delegate a shared mailbox](https://learn.microsoft.com/en-us/microsoft-365/admin/email/create-a-shared-mailbox)
2. In Microsoft Entra admin center, select the Altitutor tenant → Entra ID → App registrations → New registration. Name it `Altitutor Admin Mail Development`; select **single tenant**. Record Application (client) ID and Directory (tenant) ID from Overview. A server client-credentials integration does not need an interactive login redirect. [Register an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app), [client credentials flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow)
3. Certificates & secrets → Client secrets → New client secret. Save its **Value**, not its secret ID, in the environment's secret store; it is shown only once. A short-lived secret matches the code currently delivered. Microsoft recommends certificate/federated credentials for production, which requires an authentication implementation change before those can replace this secret. [Application credentials](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials)
4. Record the enterprise application's service-principal Object ID from **Enterprise applications**, not the app-registration Object ID. Configure the mailbox-scoped Exchange roles below.

## Grant mailbox-scoped application access

Use **Exchange Online Application RBAC**, which replaces legacy Application Access Policies. Its grants are additive with Entra grants: do not also grant unscoped Entra Graph `Mail.ReadWrite`/`Mail.Send`, which would defeat the restriction. Exchange administration requires suitable Exchange Administrator/Organization Management authority. Its authorization test excludes separate Entra grants, so also verify actual Graph access is denied to an out-of-scope mailbox. Allow permission propagation before testing. [Microsoft Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)

Illustrative Exchange Online PowerShell, to be reviewed and run by the tenant administrator; **not executed here**:

```powershell
Connect-ExchangeOnline
New-ServicePrincipal -AppId '<client-id>' -ObjectId '<enterprise-app-object-id>' -DisplayName 'Altitutor Admin Mail Development'
New-ManagementScope -Name 'AltitutorAdminMailDevelopment' -RecipientRestrictionFilter "EmailAddresses -eq 'smtp:admin-test@altitutor.com'"
New-ManagementRoleAssignment -Name 'AltitutorAdminMailDevelopmentReadWrite' -App '<enterprise-app-object-id>' -Role 'Application Mail.ReadWrite' -CustomResourceScope 'AltitutorAdminMailDevelopment'
New-ManagementRoleAssignment -Name 'AltitutorAdminMailDevelopmentSend' -App '<enterprise-app-object-id>' -Role 'Application Mail.Send' -CustomResourceScope 'AltitutorAdminMailDevelopment'
Test-ServicePrincipalAuthorization -Identity '<enterprise-app-object-id>' -Resource 'admin-test@altitutor.com'
Test-ServicePrincipalAuthorization -Identity '<enterprise-app-object-id>' -Resource 'admin@altitutor.com'
```

The scope should match only the test mailbox. `EmailAddresses` is a documented recipient-filter property. [Management scope syntax](https://learn.microsoft.com/en-us/powershell/module/exchangepowershell/new-managementscope), [filter properties](https://learn.microsoft.com/en-us/powershell/exchange/recipientfilter-properties), [Exchange connection](https://learn.microsoft.com/en-us/powershell/exchange/connect-to-exchange-online-powershell)

New setups should not use legacy Application Access Policies; Microsoft explicitly recommends Application RBAC instead. [Legacy policy notice](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-access-policies)

For Outlook delegated replies to appear in the shared mailbox's Sent Items, enable copies there. Otherwise Outlook commonly saves those messages in the delegate's own Sent Items, outside this integration's mailbox:

```powershell
Set-Mailbox admin-test@altitutor.com -MessageCopyForSentAsEnabled $true
# Also enable this if testers use Send on Behalf:
Set-Mailbox admin-test@altitutor.com -MessageCopyForSendOnBehalfEnabled $true
```

[Microsoft delegated Sent Items behavior](https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/manage-user-mailboxes/automatically-save-sent-items-in-delegator-s-mailbox)

## Delivered-code gaps before linking development

Inspected at delivered merge `5a34b445d7dc89bc77535c06c063d4e38b134ede`:

- `apps/admin-web/src/features/email/server/graph.ts` fixes the mailbox address to `admin@altitutor.com`; `packages/email/src/operational-mailbox.ts` also fixes provider sender/reply-to. **No mailbox-address environment setting exists. Setting new credentials alone does not select the test mailbox.**
- `apps/admin-web/src/features/email/server/connection.ts` reads `EMAIL_M365_TENANT_ID`, `EMAIL_M365_CLIENT_ID`, `EMAIL_M365_CLIENT_SECRET`, falling back individually to `ONBOARDING_M365_*`. It requests app-only tokens with Graph `/.default`.
- The parent code audit also found `admin@` comparisons in `supabase/migrations/20261029083739_unified_admin_mailbox.sql` governing participant exclusion, direction, onboarding projection, Sent reconciliation and assignment clearing. Environment-specific mailbox identity therefore needs a **new migration** as well as application changes; do not edit an already applied migration.
- `secrets/README.md` describes gitignored source files `secrets/.env.development` and `secrets/.env.production`. Development maps to Vercel Preview; production maps to Vercel Production. The admin project is `altitutor-admin-web`. These credentials must be server-only, never `NEXT_PUBLIC_*`, committed, or sent through chat.
- `secrets/scripts/deploy-vercel.sh` currently skips the new email keys and sends `CRON_SECRET` to UCAT/tutor rather than admin. `secrets/scripts/deploy-supabase.sh` also omits the email keys. **Writing the source env files alone therefore does not wire this integration.**
- Runtime values belong in the matching admin Vercel environment and matching development/production Supabase Edge secrets for the operational senders. The admin cron route also needs its runtime `CRON_SECRET`. GitHub-only secrets do not automatically become runtime values.

Before using the test mailbox, implement environment-specific mailbox address/From/reply-to consistently across web, portable operational transport and persisted mailbox identity; prevent accidental production credential fallback in development; update environment synchronization; and verify isolation with read/write/send checks. Do not swap the address against already imported mailbox data without handling existing state. These are necessary follow-up changes, **not functionality already shipped**.

## Acceptance sequence

1. Isolated development data, development-only app and test-mailbox permissions; confirm production inbox denial using read-only Graph calls.
2. Controlled messages in both directions. Compare read/unread, create/move folders, reply/reply-all/forward, shared drafts/conflicts, small attachments and Sent Items from Outlook and the portal.
3. Two portal admins: assignment notification; inbound before reply keeps assignment; staff reply in either client clears assignment; later inbound is unassigned. Check identity links and Activity, including duplicate/retry behavior.
4. Operational senders with fictional records and controlled recipients only; verify provider Sent reconciliation and no duplicate sends.
5. Review results before bounded production `admin@` verification. Use a separate production app and mailbox scope; do not reuse development credentials or broadly copy development secrets.

The test mailbox is real Exchange, not a send sandbox: scoped mailbox permission limits which mailbox the app can operate, not which external recipients it can email. Use only controlled recipients or add a tested development recipient restriction before exercising automation.
