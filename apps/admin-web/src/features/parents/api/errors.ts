/** A specific contact-policy outcome; the original database event stays visible. */
export class ParentPhoneConflictError extends Error {
  constructor() {
    super('This phone number is already linked to a student. Use a different number for the parent, or check the student contact details.');
    this.name = 'ParentPhoneConflictError';
  }
}
