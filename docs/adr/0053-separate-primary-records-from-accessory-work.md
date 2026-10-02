# Separate primary records from accessory work in AdminWeb

Student, parent, staff, class, session, invoice, subject, topic and admin-shift records open as primary pages. Tasks, issues, projects, documents and messages open in persistent accessory tabs, allowing staff to retain supporting work while navigating primary records. Destinations depend on entity type rather than the current primary record so the same record opens consistently from every entry point; browser-local, account-scoped tab restoration avoids introducing database-backed workspace preferences.

Accessory navigation within one entity family replaces the current tab, with list filters restored when returning from a record. Links across families open another tab. Replacing a record goes through its unsaved-change guard; changing the primary page or collapsing the accessory panel retains its open editors.
