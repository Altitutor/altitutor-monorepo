# Altitutor UCAT brand and customer experience

Status: Approved direction, first implementation pass complete
Scope: Public and customer-facing UCAT surfaces across `marketing-web`, `ucat-web`, email, and in-app notifications
Audience: Product, design, engineering, marketing, tutoring, and support

## 1. Brand foundation

### Product name

The product name is **Altitutor UCAT**.

Use **UCAT preparation from Altitutor** as a descriptive line where the audience needs additional context. “UCAT prep” remains acceptable in natural prose and SEO copy, but is not part of the formal product name.

Use:

- Altitutor UCAT
- UCAT preparation from Altitutor
- Altitutor UCAT Free
- Altitutor UCAT Unlimited
- A not-for-profit initiative by Altitutor.

Avoid:

- Alti UCAT
- Alti UCAT Prep
- Altitutor UCAT System
- UCAT Pro

“Alti” can remain an informal nickname used by existing students and staff, but public product communication should establish the full Altitutor name first.

### Internal brand idea

> **Direction with a conscience.**

This is the organising idea for product and marketing decisions. It does not need to appear verbatim on every customer-facing surface.

### Customer promise

> **Know where you stand. Know what to do next.**

Altitutor UCAT should turn a student’s practice evidence into a clearer understanding of their current position and the most useful thing to do next.

### Access promise

> **Start free. Keep practising free.**

Supporting proof:

> Free forever, with practice allowances that reset. It is not a trial you eventually use up.

Do not claim “Australia’s only free UCAT platform” without a current, documented competitor review. Distinguish ongoing platform access from one-off free questions and official UCAT preparation materials.

#### Competitive claim guardrail — reviewed July 2026

“Free forever” is a strong lead message, but it is not defensibly unique across the entire market:

- [MedEntry](https://www.medentry.edu.au/start-free-trial) offers a no-time-limit trial with a fixed, limited set of questions and one diagnostic mock.
- [Medify](https://medify.co/anz/pricing) lists a Free plan, but currently reserves practice questions, mocks, estimated scores, and performance analytics for paid plans.
- [Fraser's](https://www.frasersmedical.com/ucat/sign-up) advertises a free UCAT Academy with a question bank and diagnostic mock.
- [UCAT.Ninja](https://ukcat.ninja/) advertises a forever-free tier with limited tutorials and practice questions.
- The [official UCAT ANZ site](https://www.ucat.edu.au/prepare/) provides free practice materials.

The defensible distinction is therefore the combination of **ongoing resetting practice access, personalised direction, and a not-for-profit mission**. Use “Start free. Keep practising free.” and explain exactly how allowances reset. Do not use “the only free UCAT platform” or imply that no alternative free questions exist.

### Mission statement

> **Better UCAT preparation should not depend on what your family can afford.**

Supporting statement:

> Altitutor is a not-for-profit education initiative. Revenue from paid plans helps us provide free and subsidised educational support to students who otherwise could not afford it.

Continued product improvement is a valid secondary use of revenue, but equitable access is the primary mission story.

### Organisational proof

Altitutor has been helping students since 2017 and was formally established as a company in 2019. Its first cohort of Year 12 students has now completed university and includes qualified doctors, dentists, and other working professionals.

Obtain permission from any former students named or pictured.

## 2. Positioning and message hierarchy

Customer-facing communication should establish these messages in this order:

1. **Direction:** understand your current level and your next useful step.
2. **Access:** continue preparing for free without exhausting a one-off trial.
3. **Capability:** questions, timed sets, mocks, review, skill trainers, learning, tracking, and planning.
4. **Mission:** paid access helps support students facing financial barriers.
5. **Human support:** built by experienced tutors, with optional online tutor support coming later.

### Positioning statement

For students preparing for UCAT ANZ who are unsure how to turn practice into progress, Altitutor UCAT is an online preparation platform that uses their results, target, and available time to show where they stand and what to do next. Unlike a resource-capped trial, its Free plan provides ongoing practice allowances that reset. Altitutor is a not-for-profit, and revenue from paid plans helps make educational support accessible to students facing financial barriers.

### Commercial principle

Free must be genuinely useful. Unlimited must be meaningfully more convenient and powerful.

- **Free** provides the complete learning loop at a sustainable pace: practise, review, track, and receive direction, subject to resetting limits.
- **Unlimited** removes waiting and volume limits for students who want to prepare faster or more intensively.
- Do not deliberately make Free confusing or ineffective to force conversion.
- Do not give Unlimited so little additional value that paying feels like a donation disguised as a subscription.
- Explain that paid plans both increase the student’s access and help Altitutor support other students.

The conversion message is:

> **Keep preparing free, or go Unlimited when you want to move faster.**

## 3. Product and offer architecture

### Online platform

The primary pricing structure has two plans:

1. **Altitutor UCAT Free**
2. **Altitutor UCAT Unlimited**

Free should show live, area-specific allowances and reset periods. Unlimited should communicate unrestricted access across practice, sets, mocks, skill trainers, learning, and the complete online experience.

There are no production customers on the former Pro concept. Remove Pro cleanly from customer-facing and internal product logic rather than retaining a legacy public or compatibility tier. Use a forward migration where required to keep migration history and deployed environments coherent, but do not preserve Pro as an available state.

### Online tutoring

Online tutoring is a future **add-on**, not a third software tier.

Working label:

> **Online UCAT tutoring — coming soon**

Proposition:

> Work one-to-one with an Altitutor UCAT tutor by video. Your tutor can see your progress and attempts, then use that evidence to make personalised recommendations.

Until the service and pricing are ready:

- Show a waitlist, not a purchasable plan.
- Ask for test year, location/time zone, preferred support, and optional availability.
- State clearly that joining the waitlist is not a booking or guarantee.
- Measure interest and follow-up permission separately from general marketing consent.

When launched, decide whether an active tutoring add-on includes Unlimited platform access. Bundling it is likely to create the clearest customer experience.

### Adelaide in-person tutoring

In-person tutoring remains a separate Altitutor pathway for students who can attend in Adelaide. It should not dominate the national online product’s pricing section.

Use a secondary contextual link:

> **In Adelaide? Explore in-person UCAT classes.**

The primary sales journey remains on the main Altitutor site. In-person students may continue to receive unrestricted Altitutor UCAT access as part of their classes.

### Subsidised access

The current UCAT subsidy offer provides free or subsidised **Unlimited platform access**.

Application journey:

1. Student completes an application form.
2. Altitutor reviews the application and conducts an online interview.
3. Free or subsidised Unlimited access is granted according to need and circumstances.

Tutor support is not currently included in the UCAT subsidy promise. It may be added later, but must not be implied now.

Suggested CTA:

> **Apply for supported access**

Suggested explanation:

> If cost is preventing you from accessing the preparation you need, you can apply for free or subsidised Altitutor UCAT Unlimited access. Applications include a short form and online conversation so we can understand your circumstances.

Create a written eligibility, privacy, decision, duration, renewal, and appeals policy before launching the public application flow.

## 4. Voice and language

Altitutor UCAT should sound like a calm, observant, excellent tutor beside the student.

### Voice attributes

- **Clear:** make the next action easy to understand.
- **Specific:** describe the evidence or feature rather than using broad claims.
- **Human:** speak as an experienced person helping another person.
- **Honest:** separate current functionality from future plans.
- **Encouraging:** support progress without hype, guilt, or false urgency.
- **Equitable:** communicate access with dignity, not charity language.

### Preferred patterns

- “Here is what your recent practice suggests.”
- “This is the most useful area to work on next.”
- “Your target is within your current plausible range.”
- “You can keep preparing on Free.”
- “Go Unlimited when you want to practise without limits.”
- “You do not need to catch up all at once.”

### Avoid

- Unfair advantage
- Precision preparation
- Adaptive telemetry
- Proprietary engines
- Elite preparation
- Dominate, hack, crush, or guarantee
- Vague “AI-powered” claims
- Shame about inactivity or low scores
- Attacks on competitors
- Language that treats subsidy recipients as marketing props

### AI and automation

AI is a capability, not the main brand story. Lead with the student outcome.

Current score estimation, progress tracking, recommendations, and study planning may be described as adaptive when that helps explain their behaviour. Do not advertise a conversational AI tutor until it is available and production-ready.

## 5. Visual system

Retain the existing core palette:

- Navy `#0A2941`
- Soft blue `#92B9C6`
- Warm cream `#F2F0E9`
- Charcoal `#1A1A1A`

Use the palette to feel calm, editorial, credible, and human rather than clinical or futuristic.

### Visual priorities

1. Real product screens
2. Real Altitutor students and tutors
3. Founder photography and video
4. Authentic score trajectories, next-step cards, and progress data
5. The Study Orb as a selective, recognisable product character

Remove or avoid:

- Generic stock photography
- Laboratory and “science” imagery
- Fictional product mockups
- UI that implies unavailable functionality
- Excessive gradients, glow, glass effects, or decorative dashboards

### Product visuals on marketing pages

Every product visual must be captured from, or use the same components and data model as, the real application. Use stable seeded demonstration data that tells a coherent student story across sections.

### Student stories

Obtain explicit written consent for:

- Name and image
- Quotation
- UCAT score and year
- Medical-school outcome where relevant
- Subsidy status, if mentioned

Subsidy status must never be inferred or disclosed merely because it makes a stronger marketing story.

## 6. Landing-page copy deck

### Navigation

- How it works
- Free forever
- Our mission
- Pricing
- Sign in
- **Start free**

### Hero

**Eyebrow**

> UCAT preparation from Altitutor

**Headline**

> **Know where you stand.  
> Know what to do next.**

**Body**

> Altitutor UCAT turns your practice results into a clearer score estimate and a plan built around your target—so you can spend less time guessing and more time improving.

**Proof**

> Free forever, with practice allowances that reset.  
> A not-for-profit initiative by Altitutor.

**Actions**

- **Start preparing free**
- See how it works

**Visual**

Use an authentic dashboard state showing score range or estimate, target status, priority area, and today’s recommended activity. The visual must not be a marketing-only recreation.

### Proof strip

> 10,000+ questions. 30+ full mocks. One clear direction for what to do next.

Replace or supplement this with verified product and organisational figures when available.

### Problem

**Headline**

> **More questions are not the same as a better plan.**

**Body**

> UCAT preparation can quickly become a cycle of completing questions, checking a score, and wondering what to do next. Altitutor UCAT uses your results to show where you are improving, where you are losing marks, and what deserves your attention now.

### How it works

**1. Set your direction**

> Tell us your target, test date, and weekly availability. We use them to make your preparation realistic.

**2. Build useful evidence**

> Complete questions, timed sets, skill trainers, and mocks designed around the UCAT experience.

**3. Follow your next best step**

> Get clear recommendations based on your goals and results. Add an adaptive study plan if you want a complete schedule through to your test.

**4. Watch your trajectory change**

> Track your estimated score, section performance, and progress towards your target as you practise.

The distinction between rolling next-step guidance and the optional scheduled Study plan must remain accurate.

### Free forever

**Headline**

> **Start free. Stay free for as long as you need.**

**Body**

> This is not a short trial or a handful of questions that disappear once you have used them. Your free practice allowances reset, giving you an ongoing way to learn, practise, and measure your progress.

**Action**

> Start with Free

### Toolkit

**Headline**

> **Everything you need to practise. Direction on how to use it.**

Show:

- Question practice
- Timed sets and mocks
- Detailed review
- Skill trainers
- Learning modules
- Score estimation
- Progress tracking
- Adaptive study planning

The first group establishes completeness. The final group explains the distinctive value.

### Mission

**Headline**

> **Your preparation can help another student access theirs.**

**Body**

> Altitutor has been helping students since 2017 and was formally established as a company in 2019. Revenue from paid plans helps provide free and subsidised educational support to students facing financial barriers, alongside continued improvement of Altitutor UCAT.

**Supporting line**

> Better educational support should be available because a student needs it—not only because their family can afford it.

**Actions**

- Apply for supported access
- Read the Altitutor story

### Organisational proof story

**Headline**

> **From our first Year 12 class to a new generation of doctors.**

**Body**

> Students from Altitutor’s first Year 12 cohort have now completed university and become doctors, dentists, and other working professionals. We are proud of how far they have come—and committed to making those opportunities more accessible to the students following them.

Support this with verified names, images, and outcomes only where permission has been granted.

### Founder

**Headline**

> **Built by people who have travelled the path.**

Working draft:

> Hi, I’m Matt—a doctor working across hospitals in South Australia and the founder of Altitutor. I started Altitutor with friends while I was in medical school because we believed excellent education should be available to students who could not otherwise afford it.
>
> I remember how overwhelming UCAT preparation felt when I did not know where to start. I would have loved a tool that could show me my weak points and what to practise next. Altitutor UCAT is the tool I wish I had: clear, evidence-based direction with a Free plan students can keep using.
>
> Since we began helping students in 2017, Altitutor has provided free or subsidised education to hundreds of students. Members of our first Year 12 cohort are now qualified doctors, dentists, and other working professionals. When a student chooses UCAT Unlimited or tutoring, that revenue helps us support more students facing financial barriers.
>
> Matt

Replace this draft after a founder interview so it reflects Matthew’s actual experience and natural voice. Consider a 45–90 second video with captions and a written transcript.

### Pricing

**Introduction**

> **Prepare at the pace that works for you.**

> Keep preparing free, or go Unlimited when you want to move faster.

**Free**

> Ongoing access across Altitutor UCAT, with practice allowances that reset.

**Unlimited**

> Practise without waiting or area limits. Get unrestricted access across questions, sets, mocks, skill trainers, learning, and progress tools.

Explain accountability discounts plainly and show the undiscounted price with equal prominence. Do not make students calculate the likely bill themselves.

### Tutoring waitlist

**Headline**

> **Want a tutor to work from the same evidence?**

**Body**

> We are developing one-to-one online UCAT tutoring by video. Your tutor will be able to see your progress and attempts, then help you decide what to work on next.

**Action**

> Join the online tutoring waitlist

**Secondary local link**

> In Adelaide? Explore in-person UCAT classes.

### Final call to action

**Headline**

> **Start building your UCAT baseline now.**

**Body**

> See where you stand, get a clearer next step, and keep practising for free.

**Action**

> Start preparing free

## 7. Referral strategy

Friend referral has historically been an important source of Altitutor’s growth. It should be a first-class product loop, but the request should appear after the student has experienced value.

### Proposition

> **Give a friend a free start. Earn more time to prepare.**

The exact reward description must reflect the current referral terms: a recipient can accept gifted Unlimited access, while the referrer earns the relevant Free reset or paid-plan billing reward.

### Best moments to ask

- After completing and reviewing a first mock
- After a meaningful score or section improvement
- In a useful weekly progress email
- After a consistency milestone
- On the plan page, where rewards can be understood fully

Do not interrupt active practice, show the referral prompt immediately after signup, or frame friendship as a sales obligation.

### Channels

- Persistent referral area in account/plan settings
- Contextual in-app prompt after value moments
- Native share sheet on supported devices
- Copy link
- Prewritten SMS or messaging copy
- Occasional opted-in email campaign

### Suggested sharing copy

> I’ve been using Altitutor UCAT to practise and track what to work on next. This link gives you free Unlimited access to get started: [link]

### Measurement

Track the complete loop:

1. Referral prompt viewed
2. Share started
3. Link copied or channel selected
4. Referral landing viewed
5. Signup completed
6. Recipient activated through meaningful practice
7. Gift accepted or Free continued
8. Recipient converted to paid, if applicable

Optimise for activated students and successful preparation, not raw link sharing.

## 8. Email and in-app communication

### Sender identities

- **Matt at Altitutor**: welcome, founder, and educational messages
- **Altitutor UCAT**: progress and study guidance
- **Altitutor**: account security, billing, and formal service messages

Use `matt@altitutor.com` for personal founder communication. Use `admin@altitutor.com` for formal account, billing, security, and subsidy communication. Create `ucat@altitutor.com` as the monitored product support and tutoring-waitlist address, preferably as an alias routed to the appropriate Altitutor team members. Do not introduce a separate `ucat.altitutor.com` email domain.

### First-week sequence

The sequence is event-aware, not a rigid daily drip.

| Earliest timing | Purpose | Suggested subject | Primary action | Suppression or adaptation |
| --- | --- | --- | --- | --- |
| Signup | Welcome and orient | You’re in. Let’s find your starting point. | Complete setup | Change CTA if setup is complete |
| Day 1 | Build first evidence | Your first useful UCAT score signal | Start first practice | Skip if sufficient evidence exists |
| Day 3 | Introduce direction | Turn your practice into a plan | View next steps or create Study plan | Distinguish rolling guidance from a scheduled plan |
| Day 5 | Explain tracking | What your score range is telling you | View progress | Delay until the estimate is meaningful |
| Day 7 | Reinforce access | You don’t need to pay to keep going | Continue on Free | Show the next reset accurately |

### Weekly progress

This should become the signature lifecycle message once enough evidence exists.

Example subject:

> Your UCAT week: 84 questions and one clear next step

Include:

- Work completed
- Current trajectory or score-estimate status
- Area showing the most progress
- Highest-priority weakness
- One recommended next activity
- Relevant allowance availability or reset

Primary action:

> **Continue with your next step**

Do not invent precision or send a hollow report when the student has too little evidence.

### Seven-day inactivity

Example subject:

> Your plan is still here, [First name]

Direction:

> You do not need to restart or catch up all at once. Based on your recent work, the most useful place to continue is [activity].

Suppress when the student’s test has passed, the account is inactive for an expected reason, or no useful recommendation can be generated.

### Free resets

- Use in-app communication for routine resets.
- Explain reset timing when a student reaches a limit.
- Mention available access in the weekly progress email.
- Reserve standalone email for unusual grants, promotional boosts, or significant allowance changes.

### Referral communication

1. A recipient receiving a gift is a transactional message with an in-app counterpart.
2. A referrer earning a reward is a transactional message with an in-app counterpart.
3. A general request to invite friends is optional marketing and should follow a positive value moment.

### Content releases

Prefer in-app notifications and an optional weekly digest over one email for every new lesson, mock, or set.

### Preferences and consent

Offer separate preferences for:

- Weekly progress and study guidance
- UCAT lessons and preparation tips
- Product news
- Offers and referral campaigns

Account security, billing, requested access, and earned-reward messages remain transactional.

The signup marketing checkbox must start unchecked. Store the consent date, source, and version of the consent language. Marketing email must identify Altitutor, include current contact details, and provide a direct unsubscribe that does not require login.

## 9. Email visual system

Create one responsive shared shell for authentication, billing, lifecycle, referral, and campaign email.

- Warm cream page background
- White primary content surface
- Navy headings
- Soft-blue highlights
- 560–600px, single-column content
- One primary CTA
- Minimum 44px touch target
- Accessible text contrast
- Useful alt text and no image-only meaning
- Plain-text alternative
- Consistent mission, contact, preference, and unsubscribe footer

Use product-derived modules when helpful:

- Today’s next step
- Score range or target status
- Weekly activity summary
- Allowance/reset status
- Referral gift or reward status

Do not place sensitive performance details in subject lines or preheaders.

## 10. 2027 audience

“2027 cohort” means students **sitting UCAT ANZ in 2027**.

Use explicit language in public communication:

> Preparing to sit UCAT ANZ in 2027?

Do not make a fixed preparation duration part of the brand. Advice should reflect baseline, target, available time, and test date. Seasonal communication may encourage students to start early and establish a baseline without implying that every student needs 12–18 months.

## 11. Measurement principles

The brand should support sustainable revenue and student access. Measure both.

Primary funnel:

- Landing visit to signup
- Signup to first meaningful practice
- First practice to useful score signal
- First score signal to return session
- Free limit reached to Unlimited consideration
- Unlimited consideration to trial or subscription
- Subscription retention and practice-discount engagement

Mission and access:

- Active Free students
- Free students completing meaningful weekly practice
- Subsidy applications, approvals, activation, and retention
- Paid revenue contributing to supported access
- Referral activation and referred-student retention

Do not optimise conversion at the expense of Free students receiving a coherent preparation experience.

## 12. Implementation scope and sequence

### In scope

- Marketing `/ucat`
- UCAT signup, login, and onboarding
- Pricing, checkout, subscription, referral, and subsidy surfaces
- Shared product navigation and brand chrome
- Customer-facing product terminology and high-impact copy
- Authentication and billing emails
- Lifecycle campaigns
- In-app notification language
- Email preferences and consent
- Authentic product UI used in marketing visuals

Core question, mock, analytics, and Study plan workflows are not ground-up redesigns unless a separate usability problem is identified. They receive brand, terminology, and copy alignment.

### Phase 1: foundation and content

- Approve this guide
- Complete terminology inventory
- Confirm legal not-for-profit wording and founding year
- Define subsidy policy
- Collect founder, tutor, and student assets and permissions
- Create a coherent seeded product-demo student

### Phase 2: public journey

- Redesign and rewrite `/ucat`
- Align signup, login, onboarding, pricing, and checkout
- Add tutoring waitlist and secondary Adelaide pathway
- Add subsidy entry point
- Verify responsive, accessible, and faithful product visuals

### Phase 3: transactional communication

- Build shared email shell and primitives
- Rewrite authentication and account emails
- Rewrite billing and trial emails
- Align quota, content-release, referral, and billing notifications
- Add visual and copy regression coverage

### Phase 4: lifecycle system

- Make marketing consent explicit
- Add communication preferences
- Implement event-aware onboarding
- Implement useful weekly progress
- Implement seven-day inactivity communication
- Add referral prompts at value moments
- Add waitlist follow-up

### Phase 5: production validation and launch

- Test email rendering and plain-text fallbacks
- Test suppression, unsubscribe, and preference behaviour
- Verify analytics and referral attribution
- Verify all public claims against live functionality
- Soft launch to a controlled group
- Review activation, retention, conversion, support load, and student feedback

Database changes must be prepared as migrations and applied through CI/CD. Do not modify remote databases directly.

## 13. Remaining content prerequisites

The strategic direction is sufficiently resolved. Implementation still needs the following inputs:

- Founder interview to refine the supplied biography into Matt’s natural spoken voice
- Founder/team photographs and optional founder video
- Product-specific student stories, scores, years, outcomes, quotations, and signed permissions
- Formal written version of the UCAT subsidy policy, including privacy, access duration, review, and appeals
- Expected response process and service level for Matt’s online tutoring waitlist follow-up
- Creation and routing of `ucat@altitutor.com`
- Exact number of students who have received free or subsidised education, if “hundreds” is to become a more specific proof point

### Production-launch prerequisites after this implementation pass

- Replace the Matt initial treatment with an approved founder photograph and, when ready, the short captioned founder video.
- Replace student initials with approved photographs and add platform-specific quotations as they are collected.
- Replace the tutoring-waitlist email link with a structured form and separate follow-up consent before promoting it as a campaign destination.
- Publish a UCAT-specific supported-access application and written policy. The current landing CTA routes to Altitutor's existing general subsidy pathway.
- Create and monitor `ucat@altitutor.com`; until then, product and progress replies use `admin@altitutor.com` and founder-led onboarding replies use `matt@altitutor.com`.
- Review and refresh the older imported privacy and legal pages before collecting financial information in a new subsidy form.
- Deploy schema and application changes together through CI/CD, configure lifecycle secrets, review a dry-run candidate report, and only then set `UCAT_LIFECYCLE_EMAILS_ENABLED=true`.
- Soft-launch to a small student group before paid acquisition or broad forum outreach.

### Testimonial selection

The currently supplied Garv and Melshuel quotations describe Altitutor’s interview course and tutor quality. They are valid organisational proof, but must not be presented as reviews of the Altitutor UCAT online platform.

Build the first landing-page story set around three distinct forms of proof:

1. **Current product outcome:** a 2024 or 2025 student who used Altitutor UCAT in class or online, with a verified score or percentile and a quotation about the platform, its practice, or its direction.
2. **Access and support:** a student who is comfortable discussing how free or subsidised support affected their preparation, with explicit consent to disclose that context.
3. **Long-term trust:** a student from an earlier Altitutor cohort who is now a doctor, dentist, or other professional and can reflect on Altitutor’s longer-term role.

Brian Ju (2610, 2025, dentistry offer) and Josh Lee (2430, 2025, medicine offer) are promising current outcome stories once their exact institution/course wording and product-specific quotations are supplied. Garv and Melshuel George may appear in a clearly labelled Altitutor teaching-history section or on the main Altitutor site. Rosa Hessabi and Ed Nitschke require quotations and complete verified details before use.

Prefer verified percentile alongside raw UCAT score where available, because the test format and score scale can change between years. Use a full name when the student explicitly approves it; otherwise use first name and surname initial consistently.
