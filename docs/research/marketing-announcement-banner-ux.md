# Marketing announcement banner: UX evidence and recommendation

Date: 6 October 2026.  
Scope: promoting Altitutor UCAT and open medicine interview course sign-ups on `marketing-web`.  
Method: W3C accessibility standards and implementation guidance, official design systems, and original NN/G usability observations. Recommendations below are applied product judgement, not demonstrated conversion improvements for Altitutor.

## Recommendation

Use one compact announcement strip, visible immediately, with a stable, prioritised message and one clear destination. Lead with **“Medicine interview course — sign-ups open now”** because it communicates an actionable current event; keep UCAT accessible through ordinary navigation and relevant page content. This priority is a judgement based on the supplied campaign goals, not a researched claim about enrolment deadlines.

If showcasing both messages in the strip remains important, use **manual cycling with visible arrows and a small “1 of 2” indicator**, plus a short transition. This retains the requested design without changing a message while someone reads it and without needing an autoplay pause button. Start with medicine interviews. Do not rely on visitors discovering the second item; both courses need permanent links elsewhere.

Keeping the strip sticky is an acceptable product choice if ongoing course visibility is worth the screen space. It is not a universal UX best practice. Make it dismissible and keep the combined strip/navigation footprint small, especially on phones. Preserve the user's latest preference to display it immediately; research does not establish that waiting until the hero scrolls away would perform better.

## Evidence and limits

### Autoplay trades visibility for distraction and hidden content

NN/G's original Siemens usability example reports a visitor missing an offer while an automatically changing panel was present; the authors recommend user-initiated changes. It demonstrates a failure mode, not a general numerical conversion penalty. Their mobile carousel guidance describes discoverability and sequential-access problems. A thin text announcement is not identical to the image carousels studied, so applying these findings here is an inference. [NN/G auto-forwarding observation](https://www.nngroup.com/articles/auto-forwarding/), [NN/G mobile carousels](https://www.nngroup.com/articles/mobile-carousels/)

### Automatic updates require user control

WCAG 2.2 SC 2.2.2 (Level A) requires a way to pause, stop, hide, or control the frequency of automatically updating information alongside other content. The five-second threshold belongs to the separate moving/blinking/scrolling clause; it does **not** exempt a message changing every seven seconds. Temporarily pausing only while focus remains is explicitly insufficient. A reduced-motion preference alone does not supply an on-page control for everyone. [W3C explanation of SC 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)

The WAI-ARIA carousel pattern recommends a rotation control for autoplay, stopping when keyboard focus enters, and resuming only when the user explicitly requests it. Hover pause is additional support. Previous/next buttons should preserve focus. Automatic changes should not repeatedly announce themselves through a live region; the pattern suggests `aria-live="off"` during automatic rotation and `polite` when rotation is stopped. This is implementation guidance, distinct from the normative WCAG requirement. [W3C carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)

The current implementation in `announcement-carousel.tsx` cycles every seven seconds, pauses on hover/focus, then resumes on leave/blur. It has arrows but no persistent stop or hide mechanism. That combination does not provide the required control under SC 2.2.2. Removing autoplay is the cleanest recommendation given the preference to remove pause controls. Adding a working hide control is another way to meet the criterion, but would need to control both the banner and synchronised hero pill's automatic updates.

### Sticky is a trade-off, not the default in every design system

NN/G advises keeping persistent headers small, readable, minimally animated and justified by user needs; excessive sticky UI consumes content space, particularly on mobile. Its article primarily concerns navigation, so applying it to promotional content is a design inference. [NN/G sticky headers](https://www.nngroup.com/articles/sticky-headers/)

IBM Carbon recommends one banner at a time, placed near its relevant content, without covering other content; its notification pattern explicitly says banners should scroll rather than remain sticky. Carbon also describes dismissal and persistence across sessions. Its domain is product/system notifications, not marketing promotions, and it acknowledges further research is needed. GOV.UK similarly recommends avoiding multiple notification banners and combining messages, but places them before the page heading; GOV.UK identifies dismissal as an open research question. Neither establishes a universal marketing conversion winner. [Carbon notifications](https://www.carbondesignsystem.com/building-blocks/core/patterns/notifications), [GOV.UK notification banner](https://design-system.service.gov.uk/components/notification-banner/)

Sticky headers must not completely obscure a keyboard-focused element under WCAG 2.2 SC 2.4.11 (AA). Reserve layout space and account for the full sticky stack when scrolling to headings/focused controls; test both directions of keyboard navigation. [W3C sticky-header failure technique](https://www.w3.org/WAI/WCAG22/Techniques/failures/F110)

The Scottish Government design system explicitly recommends a close control, remembered dismissal keyed by a unique banner ID, and a top-of-page banner that pushes content down rather than overlays it. It discourages sticky/fixed notification banners. This strengthens the case for user control and a nonoverlapping layout, while remaining public-service guidance rather than a controlled comparison of marketing strips. Its statement about higher exit rates cites other organisations' research without exposing the underlying study here, so it is not treated as an original quantitative finding. [Scottish Government notification banner](https://designsystem.gov.scot/components/notification-banner)

## Proposed design details — applied judgement

- **Content:** one brief sentence and a descriptive link, such as “Medicine interview course — sign-ups open now” with “View course”, or a linked whole message with that meaning. Remove redundant “Open now” badge text if it repeats the sentence. Avoid invented scarcity.
- **Visual weight:** an opaque, restrained brand tint and strong text contrast. Keep the text smaller than the hero headline but comfortably readable. Do not use warning/error styling for a course promotion.
- **Placement:** show above navigation immediately. If sticky, manage it and navigation as one stack. Avoid unexpected height changes after loading.
- **Mobile:** let text wrap when needed rather than force every viewport into a fixed 44px height. Keep the CTA and arrows visible; shorten secondary copy before shrinking text. Edge arrows can remain at the strip's left/right, with inset padding and separated hit areas so they do not collide with screen edges, the message or close control.
- **Controls:** visible previous/next buttons, clear accessible names and focus rings, plus “1 of 2” to make the hidden second message discoverable. Prefer 44 × 44 CSS-pixel hit areas. WCAG AA's actual minimum is 24 × 24 with exceptions; 44 × 44 is a stronger usability target, also recommended by the WAI carousel tutorial. Swipe can supplement arrows, not replace them. [W3C target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [WAI carousel styling](https://www.w3.org/WAI/tutorials/carousels/styling/)
- **Motion:** a roughly 150–200ms fade or very small directional slide only after manual cycling, with no height movement. Disable the transition for reduced-motion preferences. The duration is a design starting point, not a standard requirement or proven optimal value.
- **Dismissal:** offer an accessible close button for a nonessential sticky promotion. Remember dismissal across navigation and, provisionally, for the current browser session; associate it with a campaign/version so a materially new campaign can appear later. Session versus multi-day persistence should be decided with real visitor feedback; the cited research does not establish an ideal duration.
- **Hero pill:** avoid two simultaneous moving copies of the same message. Prefer a stable complementary pill, such as UCAT while the strip leads with interview enrolment. If synchronisation remains desired, share the selected item for manual cycling, preserve focus in either location and do not announce the same update twice. A banner-only dismissal must not leave an uncontrolled autoplay pill behind.

## Verification and measurement

Check narrow phone widths, 200% text enlargement, reflow at 320 CSS pixels, keyboard focus, screen-reader updates, contrast and reduced motion. Never truncate the course identity or actionable link. Reflow without loss of content/functionality is an AA requirement, not an optional polish item. [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

Before interpreting performance, distinguish banner impressions, first versus second message exposure, CTA clicks, dismissals and completed enquiries/sign-ups. Compare a prioritised static strip with the manual two-item version if sufficient traffic supports a meaningful experiment. Measure qualified outcomes and main navigation/task completion, not only banner clicks. No Altitutor analytics or user sessions were analysed; no conversion lift is claimed.
