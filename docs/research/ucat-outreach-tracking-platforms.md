# UCAT outreach tracking: platform decision

Date: 10 September 2026

Scope: Tool suitability for admin staff finding relevant public discussions and tutors claiming work, answering helpfully, and managing interested conversations. Official vendor sources establish capabilities and limits, not marketing effectiveness. No accounts, app features, or integrations were created.

## Recommendation

Start a time-boxed pilot in the team's existing shared spreadsheet. Airtable is a reasonable alternative if no more than five people need edit access and its views improve daily use. Do not build a CRM in Admin Web and Tutor Web until the workflow produces worthwhile customers and its recurring coordination failures are observable.

The immediate problem is an outreach work queue, with a smaller relationship tracker for people who express interest. A public post is an opportunity to contribute, not automatically a sales lead. Keep public discussion tasks, interested contacts, and campaign-level outcomes distinct. One discussion can produce several signups; one student can encounter several campaigns.

## Current options

| Option | Verified free limits / price | Assessment for this workflow |
| --- | --- | --- |
| Google Sheets | Up to 100 people can work on a shared file simultaneously. | Adequate pilot: owner, status, next action, date, and filtered views. Use existing organizational accounts where available. |
| Excel for the web | Microsoft offers free web apps and real-time collaboration. | Equally reasonable if the team already uses Microsoft. Use a shared online workbook, not emailed copies. |
| Airtable | Free: 5 Editor/Creator collaborators, 1,000 records per base. Team: US$20 per collaborator/month billed annually, or US$24 monthly. | Good structured queue; editor pricing becomes relevant when many tutors participate. Free read-only seats cannot substitute for tutors who must update work. |
| HubSpot free CRM | Up to 2 users and 1,000 contacts; includes contact, deal, and task management. | Appropriate for a small sales team working identifiable contacts. Its free user cap is a poor match for several admins and tutors. |
| Loops | Free: 1,000 subscribed contacts, 4,000 combined marketing/transactional sends per rolling 30 days. No team-seat charge. Paid starts at US$49/month for 1,001–5,000 contacts. | Email campaigns and lifecycle messaging, not the tutor outreach work queue. Evaluate separately from CRM. |

Sources: [Google sharing documentation](https://support.google.com/a/users/answer/13309904?hl=en), [Microsoft free collaboration](https://support.microsoft.com/en-US/Office/collab-files/edit-in-real-time-with-friends-and-family), [Airtable plan limits](https://support.airtable.com/articles/2277136852-airtable-plans-overview), [HubSpot free CRM](https://www.hubspot.com/products/crm), [Loops pricing](https://loops.so/pricing).

The current [UCAT email operations guide](../ucat-email-operations.md) documents Admin Web Settings → UCAT email campaigns, Resend contact/topic sync and Broadcasts, and lifecycle offers/referrals. It also documents explicit enablement gates; live deployment and sending status were not verified here. Earlier [UCAT email research](ucat-email-retention-and-conversion.md) recommends retaining the Resend foundation and reevaluating Loops when non-engineer campaign management becomes a bottleneck. Adding an outreach tracker does not justify a Loops migration; first assess the documented existing email controls.

## Minimum tracking worth the effort

Airtable confirms that its plans are [billed in USD](https://support.airtable.com/articles/6347253266-airtable-billing-overview), including international customers.

- Outreach tasks: source URL, short context, owner, status, last activity, next action/date, and resulting conversation link where appropriate. Suggested statuses: available, claimed, replied, closed/skipped.
- Interested conversations: contact handle/channel, owner, interest/request, last activity, next action/date, and outcome. Do not force every person through repeated follow-ups.
- Campaign outcomes: distinct campaign/source links or QR codes, signups, meaningful first product use, purchases, and staff time. Product events should eventually supply these automatically; tutors should not manually chase every funnel transition.

Review meaningful outcomes against effort. A cheap subscription is often cheaper than maintaining permissions, deduplication, assignment conflicts, reporting, exports, and integrations in a custom tool. A spreadsheet becomes insufficient when assignment collisions, missed follow-ups, inappropriate access, or reconciliation consume material time; that establishes what the replacement must solve.

If custom development eventually wins, build a narrow operational queue around existing staff identity and product attribution. Continue using purpose-built email delivery tooling. Avoid treating a build-versus-buy decision for the queue as a decision to build an entire marketing platform.

## Discovery limitation

The Stripe Directory skill was consulted. Exact discovery query attempted: `stripe directory search "team CRM task assignment" --format json` (no filters). The CLI failed while attempting to change permissions on its configuration file outside the writable workspace. No Directory results were returned; comparison used the official vendor sources above. No installation or provisioning was attempted.
