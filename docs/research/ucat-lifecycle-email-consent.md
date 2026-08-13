# UCAT lifecycle email consent research

Date: 11 August 2026  
Scope: Whether Altitutor UCAT must collect an explicit unticked marketing opt-in at signup before sending lifecycle emails (onboarding tips, weekly progress, product news, upgrade offers, referral invites), or may email all signups by default with unsubscribe only.  
Method: Primary legislation and regulator guidance for Australia (Spam Act / ACMA), UK (PECR / ICO), US (CAN-SPAM / FTC), with a brief EU ePrivacy note. Cross-checked against current Altitutor UCAT signup and lifecycle gating in this repo.  
Not legal advice — see section 7.

## 1. Bottom-line recommendation for Altitutor

Australia is a **prior-consent** regime for commercial electronic messages (**express or inferred**), not US-style “email anyone until they opt out” ([Spam Act 2003](https://www.legislation.gov.au/C2004A01214/latest/text); [ACMA — Avoid sending spam](https://www.acma.gov.au/avoid-sending-spam)). A checkbox is one way to get express consent; it is **not** itself mandatory if another valid consent theory applies.

### Product decision (August 2026)

**Chosen path: drop the signup marketing checkbox and rely on inferred consent for active UCAT account holders**, with the existing preference centre + token unsubscribe (no login) + `List-Unsubscribe` kept in every commercial lifecycle email.

Rationale:

- An **unticked** checkbox followed by still sending is worse than no checkbox (looks like declined consent).
- ACMA’s inferred-consent example includes people who have an account/subscription/membership where marketing is **directly related** to that relationship ([ACMA](https://www.acma.gov.au/avoid-sending-spam)).
- A signup notice is **not required** for AU inferred consent (the relationship can carry it); optional insurance only. UK soft opt-in *does* want an opt-out chance at collection if you rely on that path for UK users ([ICO](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/)).

Guardrails for this path:

1. Only send while the student relationship is current (active account / product use context).
2. Keep copy tightly related to Altitutor UCAT (progress, tips, product news about this product).
3. Treat `offers_and_referrals` as the riskiest topic under inferred consent; consider keeping it stricter or lighter-touch.
4. Never mix promo into pure transactional mail without unsubscribe/consent rules applying.
5. Keep functional no-login unsubscribe honoured within 5 AU business days.

**Safest alternative (if risk appetite drops):** restore unticked express opt-in and only initialise marketing topics when ticked.

What you can still send without marketing consent: **required transactional / account / billing messages that are not commercial**. If one purpose is promotional, ACMA treats the message as commercial ([Statement of Expectations](https://www.acma.gov.au/publications/2024-07/guide/consumer-consent-expectations-businesses-conducting-telemarketing-and-e-marketing); [common issues](https://www.acma.gov.au/telemarketing-and-e-marketing-common-issues-and-mistakes)).

**NFP status alone does not exempt** commercial product emails.

## 2. Australia deep dive (Spam Act 2003 / ACMA)

### 2.1 Core rule: commercial messages need consent (or a designated exemption)

Under s 16, a person must not send a commercial electronic message that has an Australian link and is not a *designated* commercial electronic message, unless the relevant account-holder **consented** ([Spam Act 2003 s 16](https://www.legislation.gov.au/C2004A01214/latest/text)). The sender bears an evidential burden on consent.

ACMA summarises the compliance stack as: **get consent → identify the sender → make unsubscribe easy** ([Avoid sending spam](https://www.acma.gov.au/avoid-sending-spam)).

Commercial messages must also:

- accurately identify the authorising individual/organisation and include contact details likely valid for 30 days ([s 17](https://www.legislation.gov.au/C2004A01214/latest/text); [ACMA](https://www.acma.gov.au/avoid-sending-spam));
- include a clear functional unsubscribe facility (unless designated), with withdrawal taking effect within **5 business days** under Schedule 2, and ACMA guidance that unsubscribe must not require login/extra personal information and must remain usable for at least 30 days ([s 18](https://www.legislation.gov.au/C2004A01214/latest/text); Schedule 2 cl 6; [ACMA](https://www.acma.gov.au/avoid-sending-spam)).

This is **not** the US CAN-SPAM “no prior consent required” model.

### 2.2 What counts as a “commercial electronic message”

Section 6 defines a commercial electronic message by content, presentation, **and** linked destinations: if it would be concluded that a purpose (or one of the purposes) is to offer, advertise or promote goods/services (or a supplier), land, or a business/investment opportunity, the message is commercial ([s 6](https://www.legislation.gov.au/C2004A01214/latest/text)).

ACMA’s Statement of Expectations stresses the multi-purpose point: if one purpose is to sell or promote, the message is commercial and must comply. Links to commercial web pages can pull a message into the commercial category ([Statement of Expectations — Use of consent in telemarketing and e-marketing](https://www.acma.gov.au/publications/2024-07/guide/consumer-consent-expectations-businesses-conducting-telemarketing-and-e-marketing) / [DOCX](https://www.acma.gov.au/sites/default/files/2024-06/ACMA%20-%20Statement%20of%20Expectations%20-%20Use%20of%20consent%20in%20telemarketing%20~%20marketing%20FINAL_0.DOCX)).

Practical implication for UCAT:

- Pure auth/billing/access notices with no promotional purpose → generally outside the commercial definition (still privacy/contract duties may apply).
- Progress/tips/news that include upgrade CTAs, referral asks, or “go Unlimited” framing → commercial.
- “Welcome journeys” are **not** exempt; ACMA specifically flags automated welcome SMS/email that lack adequate consent/unsubscribe ([common issues and mistakes](https://www.acma.gov.au/telemarketing-and-e-marketing-common-issues-and-mistakes)).
- Mixing ads into service mail (e.g. shipping confirmation + product ads) is a known complaint pattern; claiming “service message” does not cure missing unsubscribe/consent ([common issues](https://www.acma.gov.au/telemarketing-and-e-marketing-common-issues-and-mistakes)).

### 2.3 Express vs inferred consent

Schedule 2 defines consent as:

1. **express consent**; or  
2. consent that can **reasonably be inferred** from the person’s **conduct** and **business and other relationships** ([Schedule 2 cl 2](https://www.legislation.gov.au/C2004A01214/latest/text)).

ACMA guidance ([Avoid sending spam](https://www.acma.gov.au/avoid-sending-spam)):

| Type | ACMA description | Notes |
| --- | --- | --- |
| **Express** | Person knows and accepts they will receive marketing emails/messages | Best practice. Examples: form, ticking a website box, phone, face-to-face. Keep records of who/when/how. You cannot send an electronic message *to ask for consent* (that ask is itself marketing). Sender must be able to prove consent. |
| **Inferred** | Recipient knowingly and directly gave their address **and** it is reasonable to believe they would expect marketing from the business | Usually needs a **provable ongoing relationship**, and marketing **directly related** to that relationship. Example: savings-bank customer told about another savings account. **Not** the bank selling them insurance. **Does not cover** messages after someone has **just bought something**. Less reliable than express consent. |

ACMA’s Statement of Expectations adds consumer-friendly expectations that go beyond bare minimum:

- Prefer express consent with clear terms (what, who, how long, how to withdraw) accessible at the point of consent — not buried in fine print.
- Consider double opt-in / preference management.
- Use inferred consent only where there is a **clear, current or ongoing relationship** and goods/services marketed are **directly related**.
- Do **not** use pre-checked tick boxes.
- Do **not** use bundled consent that removes choice about each purpose.
- Do **not** use refer-a-friend as a way to obtain consent for the friend (consent must come from the person it applies to).
- Always provide a universal unsubscribe path even if topic-level options exist ([Statement of Expectations](https://www.acma.gov.au/publications/2024-07/guide/consumer-consent-expectations-businesses-conducting-telemarketing-and-e-marketing)).

ACMA also warns that **automatically adding addresses to marketing lists after a one-off purchase or a mere email enquiry** may breach consent requirements ([common issues — Inferred consent](https://www.acma.gov.au/telemarketing-and-e-marketing-common-issues-and-mistakes)).

### 2.4 Does creating a product account create inferred consent?

**Possibly for some product-related messages; not as a blanket licence for all lifecycle/promo email.**

ACMA’s own example of inferred consent includes someone who “has subscribed to a service, has an account or is a member,” where marketing is “directly relevant to the relationship” ([Avoid sending spam](https://www.acma.gov.au/avoid-sending-spam)). A free or paid UCAT product account is closer to that ongoing-relationship fact pattern than a one-off retail checkout.

But:

1. The statute still requires that inference be **reasonable** from conduct + relationship ([Schedule 2 cl 2](https://www.legislation.gov.au/C2004A01214/latest/text)).
2. ACMA expressly says inferred consent is **less reliable** than express, and recommends express ([Avoid sending spam](https://www.acma.gov.au/avoid-sending-spam); [Statement of Expectations](https://www.acma.gov.au/publications/2024-07/guide/consumer-consent-expectations-businesses-conducting-telemarketing-and-e-marketing)).
3. Auto-enrolment of every signup into marketing is exactly the pattern ACMA criticises when the relationship is thin (enquiry / one-off purchase) ([common issues](https://www.acma.gov.au/telemarketing-and-e-marketing-common-issues-and-mistakes)).
4. The sender must **prove** consent if challenged ([Avoid sending spam](https://www.acma.gov.au/avoid-sending-spam); s 16 evidential burden).

So: account creation can support an inferred-consent *argument* for closely related product emails (e.g. study-progress guidance about the product they signed up for), but it is a compliance risk to treat signup alone as permission for all offers, referrals, and cross-sell. Clear notice at signup that such emails will be sent — still without a positive act — is weaker than an unticked checkbox the user actively ticks.

### 2.5 Designated messages / factual information / transactional framing

Schedule 1 creates “designated commercial electronic messages” that are exempt from the s 16 consent ban and the s 18 unsubscribe facility (they still need accurate sender ID under s 17) ([Schedule 1 notes](https://www.legislation.gov.au/C2004A01214/latest/text)).

Relevant designated categories:

1. **Factual information** (with or without directly related comment), plus limited identity/contact extras — but only if, stripping those extras, the message would **not** have been commercial ([Schedule 1 cl 2](https://www.legislation.gov.au/C2004A01214/latest/text)). A “progress report” that is really a pitch fails this test.
2. **Government bodies, registered political parties, registered charities** sending about goods/services *they* supply ([Schedule 1 cl 3](https://www.legislation.gov.au/C2004A01214/latest/text)).
3. **Educational institutions** to (former) students / household members about goods/services the institution supplies ([Schedule 1 cl 4](https://www.legislation.gov.au/C2004A01214/latest/text)).

“Transactional framing” alone does not create a Spam Act category. Either the message is **non-commercial** under s 6, or it is commercial and needs consent/designation, identification, and (usually) unsubscribe.

### 2.6 Not-for-profit / charity status

- The Act’s charity pathway is **registered charity** (ACNC registration as the charity type), not “we operate as a not-for-profit” in ordinary language ([definitions + Schedule 1 cl 3](https://www.legislation.gov.au/C2004A01214/latest/text)).
- Even for a registered charity, the designated exemption applies only where the message relates to goods/services and the body is the supplier/prospective supplier ([Schedule 1 cl 3](https://www.legislation.gov.au/C2004A01214/latest/text)). It does not broadly authorise unrelated third-party marketing.
- ACMA’s expectations document still frames responsible consent practice as applying to businesses conducting e-marketing under the Rules ([Statement of Expectations](https://www.acma.gov.au/publications/2024-07/guide/consumer-consent-expectations-businesses-conducting-telemarketing-and-e-marketing)).
- Separately, APP 7 (Privacy Act direct marketing) does not apply to the extent the Spam Act applies ([OAIC APP Guidelines Ch 7](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-7-app-7-direct-marketing)). That interaction matters for channels outside Spam Act coverage; it does not erase Spam Act consent for commercial email.

**Conclusion:** NFP branding does not, by itself, justify default marketing to all signups.

### 2.7 Privacy Act overlay (brief)

Where Spam Act covers the email, APP 7 is displaced to that extent ([APP 7.8](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-7-app-7-direct-marketing)). OAIC still describes consent (for Privacy Act purposes) as needing to be informed, voluntary, current/specific, and given with capacity; express consent is explicit; implied consent must be reasonably inferred and not assumed merely because something seems advantageous ([OAIC Chapter B — Key concepts](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-b-key-concepts)). ACMA’s Statement of Expectations points businesses at those OAIC consent elements as a consumer-friendly framework even though they are not copied word-for-word into the Spam Act ([Statement of Expectations](https://www.acma.gov.au/publications/2024-07/guide/consumer-consent-expectations-businesses-conducting-telemarketing-and-e-marketing)).

### 2.8 Why “many SaaS products don’t show a checkbox” is not an AU legal answer

Observed industry patterns usually rest on one of:

1. **US CAN-SPAM opt-out model** (no prior consent required for commercial email) — see section 4.
2. **UK soft opt-in** after sale/negotiation for *similar* products, with opt-out at collection — see section 3.
3. **AU inferred consent** for existing customers on closely related products — lawful in some cases, but narrow, must be provable, and ACMA-preferred practice is express.
4. **Transactional-only** sends (password reset, invoices) misdescribed as “lifecycle.”
5. **Non-compliance** or overseas-centric legal design that never stress-tested ACMA rules.

ACMA’s complaint themes (welcome journeys, paperless receipts that quietly enrol marketing, inferred consent after one-off purchase, retention emails to cancelled subscribers) show the regulator does not treat “everyone does it” as a defence ([common issues](https://www.acma.gov.au/telemarketing-and-e-marketing-common-issues-and-mistakes)).

## 3. UK / EU brief

### 3.1 UK PECR — default opt-in; limited soft opt-in

PECR regulation 22: you must not send unsolicited electronic mail for direct marketing to individual subscribers unless the recipient has previously notified consent — **except** the soft opt-in in reg. 22(3) ([PECR reg. 22](https://www.legislation.gov.uk/uksi/2003/2426/regulation/22)).

Soft opt-in conditions (all required):

1. contact details obtained in the course of the **sale or negotiations for the sale** of a product or service to that recipient;
2. marketing is only for the sender’s **similar products and services**;
3. simple means of refusing was offered **when details were first collected**, and again in every subsequent message if they did not refuse initially ([PECR reg. 22(3)](https://www.legislation.gov.uk/uksi/2003/2426/regulation/22)).

ICO restates the same rule and adds: soft opt-in does **not** cover prospective customers/new contacts from bought-in lists; it also does **not** apply to non-commercial promotions such as charity fundraising or political campaigning in the ICO’s electronic-mail marketing summary ([ICO — Electronic mail marketing](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/)). (PECR separately added a charity soft-opt-in in reg. 22(3A) for messages whose sole purpose is furthering charitable purposes, with interest/support collection and opt-out at collection — different from commercial SaaS upgrade mail ([PECR reg. 22(3A)](https://www.legislation.gov.uk/uksi/2003/2426/regulation/22)).)

**For Altitutor UCAT UK users:**

- Unticked checkbox that users tick = classic specific consent (ICO example) ([ICO](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/)).
- Default-on marketing to free signups **without** a clear opt-out opportunity at collection fails soft opt-in condition (c).
- Soft opt-in is stronger after **paid** purchase/negotiation for Unlimited than after a free account alone; “negotiations for the sale” may help if signup is clearly part of choosing/buying a plan, but free-only onboarding is a weaker fit than ICO’s “bought (or negotiated to buy)” framing ([ICO](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/)).
- UK GDPR still applies to personal data processing for marketing; PECR is the stricter channel rule for electronic mail ([ICO](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/)).

GOV.UK’s consumer-facing summary also says you must get permission to send other offers/promotions when collecting details, and make opt-out easy ([GOV.UK — Direct marketing](https://www.gov.uk/marketing-advertising-law/direct-marketing)).

### 3.2 EU ePrivacy (vs UK)

EU ePrivacy Directive 2002/58/EC Article 13 requires prior consent for electronic mail direct marketing, with a similar soft opt-in for a person’s own similar products/services where details were obtained in the context of a sale and the customer can object at collection and in each message ([Article 13 as published on legislation.gov.uk](https://www.legislation.gov.uk/eudr/2002/58/article/13)). Member States implement the Directive in national law; detail can vary.

The European Commission still describes the **ePrivacy Directive** (alongside GDPR) as a main strand of the EU digital privacy framework; the long-proposed ePrivacy Regulation is not treated here as in-force replacement text ([European Commission — Digital privacy](https://digital-strategy.ec.europa.eu/en/policies/eprivacy-regulation)).

**Practical difference from UK for Altitutor:** same structural idea (opt-in default + soft opt-in), but UK PECR/ICO guidance is the operational text for UK users; EU member-state implementations may differ at the edges. Do not assume a US-style opt-out model for EU individuals.

## 4. US contrast (CAN-SPAM)

The FTC’s CAN-SPAM compliance guide is explicit that commercial email is regulated with **requirements and an opt-out right**, not an Australian/UK-style prior-consent mandate:

- Covers commercial messages whose primary purpose is commercial advertisement or promotion of a commercial product or service ([FTC CAN-SPAM guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)).
- Main duties include accurate headers, non-deceptive subjects, identification as an ad, physical postal address, and a functioning opt-out honored within **10 business days**, usable for at least 30 days ([FTC](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)).
- FTC states that for subscription/membership senders, **you don’t need to get members’ consent** to send them marketing emails, but members can still opt out; messages without unsubscribe must fit a statutory “transactional or relationship” primary purpose ([FTC](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)).

**Why US SaaS often has no checkbox:** CAN-SPAM is largely an **opt-out** statute for commercial email. That practice is **not** a safe transplant to Australia or the UK for Altitutor’s optional lifecycle/marketing programme.

## 5. Mapping to Altitutor’s four topics

Current product wiring (repo):

- Signup shows a short notice (`UCAT_SIGNUP_CONSENT_WORDING`) with no marketing checkbox; new accounts are default-opted into all four topics.
- Preferences live at `/settings/communications` for the four topics.
- Tokenised `/api/newsletter/unsubscribe` supports functional unsubscribe / List-Unsubscribe.
- Lifecycle sender requires `consent_verified_at`, no global unsubscribe, and topic flags (`supabase/functions/ucat-lifecycle-emails/logic.ts`; ops map in `docs/ucat-email-operations.md`).

| Topic | Typical content | AU Spam Act likely treatment | Consent posture |
| --- | --- | --- | --- |
| `weekly_progress_and_guidance` | Weekly summary, first score estimate, gentle restart | Often **commercial** if it promotes continued use of Altitutor as supplier / deep-links into paid surfaces; purely factual account activity with no promo purpose is a harder (narrower) non-commercial or factual-designated argument | Express opt-in (current) is safest. Inferred consent for account holders is the only serious alternative, and only while content stays **directly related** to the prep product relationship ([ACMA inferred example](https://www.acma.gov.au/avoid-sending-spam)). |
| `lessons_and_tips` | Onboarding lessons, technique/timing advice | Same: educational packaging does not auto-exempt; welcome-style sequences with commercial content must comply ([ACMA welcome journeys](https://www.acma.gov.au/telemarketing-and-e-marketing-common-issues-and-mistakes)) | Keep express opt-in. |
| `product_news` | Feature launches / improvements | Usually commercial (promotes supplier/services) under s 6 | Keep express opt-in. Bundling into a single signup tick is common; ACMA prefers unbundled purpose clarity ([Statement of Expectations](https://www.acma.gov.au/publications/2024-07/guide/consumer-consent-expectations-businesses-conducting-telemarketing-and-e-marketing)) — topic prefs after signup help. |
| `offers_and_referrals` | Free→Unlimited quota/consistency pushes; referral invites | Clearly commercial. Referral mechanics also conflict with ACMA’s “do not use refer-a-friend arrangements” expectation for *obtaining consent of the friend* ([Statement of Expectations](https://www.acma.gov.au/publications/2024-07/guide/consumer-consent-expectations-businesses-conducting-telemarketing-and-e-marketing)) — invitees need their own relationship/consent path | **Strictest.** Do not rely on inferred consent from free signup alone. Keep explicit opt-in. Referral *gift/reward transactional* emails already separated as required in ops docs are different from marketing invitations. |

Required transactional messages listed in `docs/ucat-email-operations.md` (auth, billing, access state, referral *rewards*) should stay outside marketing topics — and stay free of promotional bolt-ons.

## 6. Practical options

### Option A — Keep unticked express opt-in (recommended; current)

- Leave checkbox default **off**.
- Keep consent event + wording version records.
- Gate lifecycle sends on topic consent + unsubscribe.
- Keep preferences page + one-click/token unsubscribe (no login required) to match ACMA unsubscribe expectations ([ACMA](https://www.acma.gov.au/avoid-sending-spam)).

**Pros:** Best fit for AU + UK; matches ACMA “best practice”; already implemented.  
**Cons:** Lower raw reach than default-on.

### Option B — UK-style soft opt-in / notice-at-collection (not recommended as AU primary basis)

- At signup, clearly state similar product emails will be sent unless they opt out; provide an unticked opt-out or equally clear refusal control; repeat unsubscribe in every message ([PECR 22(3)](https://www.legislation.gov.uk/uksi/2003/2426/regulation/22)).

**Pros:** Can increase reach for UK users after sale/negotiation.  
**Cons:** Soft opt-in is a UK/EU construct, not Australia’s main pathway; AU still needs express or inferred consent. Free-signup “sale/negotiation” fit is imperfect. Does not rescue referral/non-similar content.

### Option C — Inferred consent for account holders (**chosen**, Aug 2026)

- Drop signup checkbox (do not leave a declined opt-in on the page).
- Initialise lifecycle topics on for new account holders under inferred consent.
- Signup notice optional for AU (relationship carries inference); optional insurance / useful if soft-opt-in for UK matters later.
- Keep preference centre + token unsubscribe + List-Unsubscribe.
- Scope emails to the UCAT product relationship; be more conservative on `offers_and_referrals`.

**Pros:** Matches how many account-based products behave; avoids the “unticked then still emailed” trap; leans on ACMA’s account/member example ([ACMA](https://www.acma.gov.au/avoid-sending-spam)).  
**Cons:** ACMA calls inferred less reliable than express; upgrade/referral is the weakest fit; UK soft opt-in not fully met without an opt-out control at collection.

### Option D — Hybrid

1. Inferred / default-on for `weekly_progress_and_guidance` and `lessons_and_tips`.
2. Express opt-in (or later in-product ask) for `offers_and_referrals` (and optionally `product_news`).
3. Never silently enrol from enquiry-only or lead forms.

Useful fallback if offer/referral volume grows and inferred consent feels thin there.

## 7. What this is not

This note is **research for internal product/compliance discussion**, not legal advice. It does not determine Altitutor’s ACNC registration status, APP entity status, or which users have an “Australian link.” Enforcement turns on message content, links, records, and facts. Before changing consent UX or defaulting lifecycle email on for all signups, obtain advice from Australian counsel familiar with the Spam Act and, for UK recipients, PECR/UK GDPR.

## Source index (primary)

| Jurisdiction | Source |
| --- | --- |
| AU statute | [Spam Act 2003 (Cth) — Federal Register of Legislation](https://www.legislation.gov.au/C2004A01214/latest/text) (ss 6, 16–18; Schedules 1–2) |
| AU regulator | [ACMA — Avoid sending spam](https://www.acma.gov.au/avoid-sending-spam) |
| AU regulator | [ACMA — Consumer consent: expectations for businesses conducting telemarketing and e-marketing](https://www.acma.gov.au/publications/2024-07/guide/consumer-consent-expectations-businesses-conducting-telemarketing-and-e-marketing) ([Statement of Expectations DOCX](https://www.acma.gov.au/sites/default/files/2024-06/ACMA%20-%20Statement%20of%20Expectations%20-%20Use%20of%20consent%20in%20telemarketing%20~%20marketing%20FINAL_0.DOCX)) |
| AU regulator | [ACMA — Telemarketing and e-marketing: common issues and mistakes](https://www.acma.gov.au/telemarketing-and-e-marketing-common-issues-and-mistakes) |
| AU privacy | [OAIC — APP Guidelines Chapter 7 (APP 7 Direct marketing)](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-7-app-7-direct-marketing) |
| AU privacy | [OAIC — APP Guidelines Chapter B (Key concepts — consent)](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-b-key-concepts) |
| UK statute | [Privacy and Electronic Communications Regulations 2003, reg. 22](https://www.legislation.gov.uk/uksi/2003/2426/regulation/22) |
| UK regulator | [ICO — Electronic mail marketing (PECR guide)](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/) |
| UK gov | [GOV.UK — Direct marketing](https://www.gov.uk/marketing-advertising-law/direct-marketing) |
| EU | [ePrivacy Directive 2002/58/EC Article 13](https://www.legislation.gov.uk/eudr/2002/58/article/13); [European Commission — Digital privacy / ePrivacy](https://digital-strategy.ec.europa.eu/en/policies/eprivacy-regulation) |
| US | [FTC — CAN-SPAM Act: A Compliance Guide for Business](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) |
