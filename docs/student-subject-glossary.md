# Student subject glossary

Student subject intention, current online access, and subscription history are separate concepts.
Every consumer must use the view matching the product question it is answering.

## In-person study subjects

`vstudent_in_person_subjects` contains subjects the student has said they intend to study in person.
Its domain source is `students_subjects`, populated during registration and used later for class
placement.

Use it for:

- welcome and onboarding subject lists
- paid drafting-session subject selection
- displays of the subjects a student registered to study in person

It does not grant access to online resources.

## Current online subject access

`vstudent_online_subject_access` contains the current student's online entitlements and the reason
for each entitlement. A subject can have more than one row when more than one source grants access.

The supported access sources are:

- `class_enrollment`
- `subscription`
- `manual`

Use this view for authorization or whenever the UI needs to explain how access was granted.

`vstudent_online_subjects` contains one complete subject metadata row for every subject present in
`vstudent_online_subject_access`. Use it for Resources navigation, subject cards, names, curriculum,
and other online-content display needs.

## Subscription subject history

`vstudent_subscription_subjects` contains subject metadata for every subscription belonging to the
current student, including subscriptions that no longer grant online access. Billing must use this
view so ended, unpaid, or canceled subscriptions retain their subject labels.

## Deprecated compatibility names

- `vstudent_subjects` is a deprecated alias for `vstudent_in_person_subjects`.
- `vstudent_my_subject_access` is a deprecated alias for `vstudent_online_subject_access`.

They exist only to prevent older independently deployed clients from breaking. New code must use an
explicit view name.
