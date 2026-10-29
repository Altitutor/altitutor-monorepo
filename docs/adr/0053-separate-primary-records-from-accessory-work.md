# Separate primary records from accessory work in AdminWeb

Student, parent, staff, class, session, invoice, subject, topic and admin-shift records open as primary pages. Tasks, issues, projects, documents and messages open in persistent accessory tabs, allowing staff to retain supporting work while navigating primary records. Destinations depend on entity type rather than the current primary record so the same record opens consistently from every entry point; browser-local, account-scoped tab restoration avoids introducing database-backed workspace preferences.

Accessory navigation within one entity family replaces the current tab, with list filters restored when returning from a record. Links across families open another tab. Replacing a record goes through its unsaved-change guard; changing the primary page or collapsing the accessory panel retains its open editors.

## Collection navigation amendment (DEV-234, 2026-10-29)

Tasks, issues and projects now have primary collection pages in the Operations navigation, while their individual records continue to open in persistent accessory tabs. This gives staff full-width lists and boards without losing the current collection when opening an editor. Collection links, including accessory breadcrumbs, navigate to the primary page; record links retain the existing editor guards and tab lifecycle. Documents and messages retain accessory collection views. The header calendar navigates to the selected day’s primary Dashboard; the separate Today accessory view is removed.
