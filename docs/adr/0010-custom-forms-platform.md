# Custom forms platform

Altitutor uses a small custom forms platform instead of SurveyJS, Form.io, or a JSON-schema form builder. Forms use immutable published versions, tokenized `/form/[token]` respondent routes, a shared renderer across student-web and tutor-web, and both raw JSON plus normalized answer rows for responses; this keeps licensing, workflow ownership, reporting, and future unenrolment/check-in integrations inside the Altitutor domain model.
