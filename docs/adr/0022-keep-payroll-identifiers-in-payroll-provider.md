# Keep payroll identifiers in the payroll provider

Tutor onboarding stores teaching setup and Altitutor-specific employment evidence, but address, TFN, bank account and superannuation details are collected through QuickBooks Employee Self Setup and are not duplicated in Supabase. This avoids creating a second high-sensitivity payroll datastore while keeping payroll data in the system that validates and uses it.
