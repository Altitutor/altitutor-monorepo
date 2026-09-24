-- Reporting views deliberately expose approved columns to active-admin tooling.
-- Owner privileges provide broad business reads; the LOGIN role cannot read base tables.
do $$ begin
  if not exists (select from pg_roles where rolname='admin_reporting_reader') then
    create role admin_reporting_reader login noinherit nosuperuser nocreatedb nocreaterole noreplication;
  end if;
end $$;
create schema if not exists admin_reporting;
revoke all on schema admin_reporting from public, anon, authenticated;
grant usage on schema admin_reporting to admin_reporting_reader;
alter role admin_reporting_reader set default_transaction_read_only = on;
alter role admin_reporting_reader set statement_timeout = '10s';
alter role admin_reporting_reader set search_path = pg_catalog, admin_reporting;
create view admin_reporting.student_product_acquisition_attributions with (security_barrier=true) as select "id", "student_id", "product", "first_utm_source", "first_utm_medium", "first_utm_campaign", "first_utm_content", "first_utm_term", "first_referrer_domain", "first_landing_path", "first_touch_captured_at", "self_reported_sources", "self_reported_other", "self_reported_at", "created_at", "updated_at" from public.student_product_acquisition_attributions;
revoke all on admin_reporting.student_product_acquisition_attributions from public, anon, authenticated;
grant select on admin_reporting.student_product_acquisition_attributions to admin_reporting_reader;
create view admin_reporting.ucat_public_interest_submissions with (security_barrier=true) as select "id", "kind", "name", "email", "phone", "reason", "contact_consent", "source", "status", "created_at", "updated_at" from public.ucat_public_interest_submissions;
revoke all on admin_reporting.ucat_public_interest_submissions from public, anon, authenticated;
grant select on admin_reporting.ucat_public_interest_submissions to admin_reporting_reader;
create view admin_reporting.ucat_referrals with (security_barrier=true) as select "id", "referral_code_id", "referrer_student_id", "referred_student_id", "free_qualified_at", "paid_qualified_at", "rejected_at", "rejection_reason", "referred_checkout_session_id", "referred_subscription_id", "created_at", "updated_at", "referrer_tier_at_offer", "referrer_billing_interval_at_offer", "gift_duration_interval", "gift_status", "gift_expires_at", "gift_accepted_at" from public.ucat_referrals;
revoke all on admin_reporting.ucat_referrals from public, anon, authenticated;
grant select on admin_reporting.ucat_referrals to admin_reporting_reader;
create view admin_reporting.ucat_referral_bill_rewards with (security_barrier=true) as select "id", "referral_id", "student_id", "status", "stripe_subscription_id", "stripe_invoice_id", "applied_at", "redeemed_at", "revoked_at", "created_at", "updated_at", "reward_type", "amount_off_cents" from public.ucat_referral_bill_rewards;
revoke all on admin_reporting.ucat_referral_bill_rewards from public, anon, authenticated;
grant select on admin_reporting.ucat_referral_bill_rewards to admin_reporting_reader;
create view admin_reporting.ucat_referral_access_gifts with (security_barrier=true) as select "id", "referral_id", "student_id", "duration_interval", "status", "stripe_checkout_session_id", "stripe_subscription_id", "used_at", "revoked_at", "created_at", "updated_at" from public.ucat_referral_access_gifts;
revoke all on admin_reporting.ucat_referral_access_gifts from public, anon, authenticated;
grant select on admin_reporting.ucat_referral_access_gifts to admin_reporting_reader;
create view admin_reporting.newsletter_subscribers with (security_barrier=true) as select "id", "email", "source", "student_id", "subscribed_at", "unsubscribed_at", "resend_audience_synced_at", "created_at", "updated_at", "auth_user_id", "consent_version", "consent_wording", "consent_verified_at" from public.newsletter_subscribers;
revoke all on admin_reporting.newsletter_subscribers from public, anon, authenticated;
grant select on admin_reporting.newsletter_subscribers to admin_reporting_reader;
create view admin_reporting.students with (security_barrier=true) as select "id", "first_name", "last_name", "status", "user_id", "created_at", "updated_at", "school", "curriculum", "year_level", "phone", "email", "availability_monday", "availability_tuesday", "availability_wednesday", "availability_thursday", "availability_friday", "availability_saturday_am", "availability_saturday_pm", "availability_sunday_am", "availability_sunday_pm", "created_by", "registered_at", "active_at", "discontinued_at", "timezone", "onboarding_progress", "ucat_online_tier_override", "ucat_onboarding_completed_at", "ucat_unlimited_trial_consumed_at", "ucat_signup_step", "ucat_signup_completed_at", "discontinued_by", "ucat_initial_familiarity", "account_class" from public.students;
revoke all on admin_reporting.students from public, anon, authenticated;
grant select on admin_reporting.students to admin_reporting_reader;
create view admin_reporting.parents with (security_barrier=true) as select "id", "first_name", "last_name", "email", "phone", "user_id", "created_by", "created_at", "updated_at" from public.parents;
revoke all on admin_reporting.parents from public, anon, authenticated;
grant select on admin_reporting.parents to admin_reporting_reader;
create view admin_reporting.parents_students with (security_barrier=true) as select "id", "parent_id", "student_id", "created_at", "updated_at" from public.parents_students;
revoke all on admin_reporting.parents_students from public, anon, authenticated;
grant select on admin_reporting.parents_students to admin_reporting_reader;
create view admin_reporting.student_online_product_relationships with (security_barrier=true) as select "id", "student_id", "product", "started_at", "closed_at", "created_at", "updated_at" from public.student_online_product_relationships;
revoke all on admin_reporting.student_online_product_relationships from public, anon, authenticated;
grant select on admin_reporting.student_online_product_relationships to admin_reporting_reader;
create view admin_reporting.students_subjects with (security_barrier=true) as select "id", "student_id", "subject_id", "created_by", "created_at", "updated_at" from public.students_subjects;
revoke all on admin_reporting.students_subjects from public, anon, authenticated;
grant select on admin_reporting.students_subjects to admin_reporting_reader;
create view admin_reporting.domain_events with (security_barrier=true) as select "id", "event_name", "event_version", "subject_type", "subject_id", "actor_staff_id", "recorded_at", "effective_at", "source", "is_backfilled" from public.domain_events;
revoke all on admin_reporting.domain_events from public, anon, authenticated;
grant select on admin_reporting.domain_events to admin_reporting_reader;
create view admin_reporting.domain_event_entities with (security_barrier=true) as select "domain_event_id", "entity_type", "entity_id", "role", "display_name" from public.domain_event_entities;
revoke all on admin_reporting.domain_event_entities from public, anon, authenticated;
grant select on admin_reporting.domain_event_entities to admin_reporting_reader;
create view admin_reporting.student_exit_requests with (security_barrier=true) as select "id", "status", "student_id", "form_id", "form_version_id", "requested_by", "form_response_id", "expires_at", "completed_at", "revoked_at", "revoked_by", "revoke_reason", "created_at" from public.student_exit_requests;
revoke all on admin_reporting.student_exit_requests from public, anon, authenticated;
grant select on admin_reporting.student_exit_requests to admin_reporting_reader;
create view admin_reporting.student_exit_request_enrolments with (security_barrier=true) as select "id", "student_exit_request_id", "classes_students_id", "final_session_at", "unenrolled_at" from public.student_exit_request_enrolments;
revoke all on admin_reporting.student_exit_request_enrolments from public, anon, authenticated;
grant select on admin_reporting.student_exit_request_enrolments to admin_reporting_reader;
create view admin_reporting.classes_students with (security_barrier=true) as select "id", "student_id", "class_id", "created_at", "updated_at", "created_by", "enrolled_at", "enrolled_by", "unenrolled_at", "unenrolled_by" from public.classes_students;
revoke all on admin_reporting.classes_students from public, anon, authenticated;
grant select on admin_reporting.classes_students to admin_reporting_reader;
create view admin_reporting.staff with (security_barrier=true) as select "id", "first_name", "last_name", "email", "phone_number", "role", "status", "notes", "user_id", "created_at", "updated_at", "has_parking_remote", "availability_monday", "availability_tuesday", "availability_wednesday", "availability_thursday", "availability_friday", "availability_saturday_am", "availability_saturday_pm", "availability_sunday_am", "availability_sunday_pm", "drafting_availability", "trial_session_availability", "subsidy_interview_availability", "current_tier_number", "employment_started_at", "metric_overrides", "profile_bio", "profile_image_file_id", "onboarding_completed_at", "child_safe_policy_agreed_at" from public.staff;
revoke all on admin_reporting.staff from public, anon, authenticated;
grant select on admin_reporting.staff to admin_reporting_reader;
create view admin_reporting.subjects with (security_barrier=true) as select "id", "name", "year_level", "created_at", "updated_at", "curriculum", "discipline", "level", "color", "short_name", "long_name" from public.subjects;
revoke all on admin_reporting.subjects from public, anon, authenticated;
grant select on admin_reporting.subjects to admin_reporting_reader;
create view admin_reporting.topics with (security_barrier=true) as select "id", "subject_id", "name", "created_at", "updated_at", "parent_id", "index", "created_by", "code" from public.topics;
revoke all on admin_reporting.topics from public, anon, authenticated;
grant select on admin_reporting.topics to admin_reporting_reader;
create view admin_reporting.topics_files with (security_barrier=true) as select "id", "topic_id", "type", "index", "file_id", "is_solutions", "is_solutions_of_id", "created_at", "updated_at", "created_by", "code" from public.topics_files;
revoke all on admin_reporting.topics_files from public, anon, authenticated;
grant select on admin_reporting.topics_files to admin_reporting_reader;
create view admin_reporting.classes with (security_barrier=true) as select "id", "day_of_week", "start_time", "end_time", "status", "created_at", "updated_at", "subject_id", "room", "created_by", "level", "session_start_date", "session_end_date", "short_name", "long_name", "cohort_label", "schedule_timezone", "schedule_summary_short", "schedule_summary_long", "schedule_weekdays", "schedule_rows", "schedule_frequency_weeks", "schedule_anchor_date", "next_session_start_at", "billing_type", "billing_type_effective_from", "session_type" from public.classes;
revoke all on admin_reporting.classes from public, anon, authenticated;
grant select on admin_reporting.classes to admin_reporting_reader;
create view admin_reporting.classes_staff with (security_barrier=true) as select "id", "staff_id", "class_id", "created_at", "updated_at", "created_by", "assigned_at", "assigned_by", "unassigned_at", "unassigned_by" from public.classes_staff;
revoke all on admin_reporting.classes_staff from public, anon, authenticated;
grant select on admin_reporting.classes_staff to admin_reporting_reader;
create view admin_reporting.class_schedule_slots with (security_barrier=true) as select "id", "schedule_revision_id", "day_of_week", "start_time", "end_time", "room", "position", "created_at" from public.class_schedule_slots;
revoke all on admin_reporting.class_schedule_slots from public, anon, authenticated;
grant select on admin_reporting.class_schedule_slots to admin_reporting_reader;
create view admin_reporting.sessions with (security_barrier=true) as select "id", "type", "class_id", "created_at", "updated_at", "subject_id", "start_at", "end_at", "status", "billing_type", "admin_shift_id", "short_name", "long_name", "schedule_revision_id", "schedule_slot_id", "schedule_origin", "is_schedule_exception", "original_start_at", "original_end_at", "room", "calendar_tombstone_until" from public.sessions;
revoke all on admin_reporting.sessions from public, anon, authenticated;
grant select on admin_reporting.sessions to admin_reporting_reader;
create view admin_reporting.sessions_students with (security_barrier=true) as select "id", "session_id", "student_id", "planned_absence", "planned_absence_logged_at", "planned_absence_logged_by", "is_rescheduled", "rescheduled_sessions_students_id", "rescheduled_at", "is_credited", "credited_by", "credited_at", "created_at", "updated_at", "created_by", "was_trial" from public.sessions_students;
revoke all on admin_reporting.sessions_students from public, anon, authenticated;
grant select on admin_reporting.sessions_students to admin_reporting_reader;
create view admin_reporting.sessions_staff with (security_barrier=true) as select "id", "session_id", "staff_id", "type", "planned_absence", "planned_absence_logged_at", "planned_absence_logged_by", "is_swapped", "swapped_sessions_staff_id", "swapped_at", "created_at", "updated_at", "created_by", "was_trial" from public.sessions_staff;
revoke all on admin_reporting.sessions_staff from public, anon, authenticated;
grant select on admin_reporting.sessions_staff to admin_reporting_reader;
create view admin_reporting.sessions_parents with (security_barrier=true) as select "id", "session_id", "parent_id", "created_at", "created_by" from public.sessions_parents;
revoke all on admin_reporting.sessions_parents from public, anon, authenticated;
grant select on admin_reporting.sessions_parents to admin_reporting_reader;
create view admin_reporting.booking_staff_unavailability with (security_barrier=true) as select "id", "staff_id", "start_at", "end_at", "reason", "created_at", "created_by" from public.booking_staff_unavailability;
revoke all on admin_reporting.booking_staff_unavailability from public, anon, authenticated;
grant select on admin_reporting.booking_staff_unavailability to admin_reporting_reader;
create view admin_reporting.opening_hours with (security_barrier=true) as select "id", "day_of_week", "start_time", "end_time", "is_active", "created_at", "updated_at" from public.opening_hours;
revoke all on admin_reporting.opening_hours from public, anon, authenticated;
grant select on admin_reporting.opening_hours to admin_reporting_reader;
create view admin_reporting.students_billing with (security_barrier=true) as select "student_id", "stripe_customer_id", "created_at", "updated_at", "auto_bill_enabled", "invoice_email_to_student", "invoice_email_to_parents" from public.students_billing;
revoke all on admin_reporting.students_billing from public, anon, authenticated;
grant select on admin_reporting.students_billing to admin_reporting_reader;
create view admin_reporting.student_billing_customer_history with (security_barrier=true) as select "stripe_customer_id", "student_id" from public.student_billing_customer_history;
revoke all on admin_reporting.student_billing_customer_history from public, anon, authenticated;
grant select on admin_reporting.student_billing_customer_history to admin_reporting_reader;
create view admin_reporting.invoices with (security_barrier=true) as select "id", "student_id", "stripe_invoice_id", "stripe_invoice_number", "invoice_date", "amount_due_cents", "amount_paid_cents", "currency", "status", "collection_method", "auto_advance", "fee_cents", "net_cents", "stripe_charge_id", "stripe_payment_intent_id", "finalized_at", "dispute_id", "dispute_status", "dispute_reason", "dispute_amount_cents", "dispute_currency", "dispute_created_at", "dispute_updated_at", "dispute_resolved_at", "created_at", "updated_at", "paid_at", "subtotal_cents", "total_cents", "amount_paid_from_balance_cents", "is_refunded", "refunded_at", "voided_at", "has_credit_notes", "refunded_via_cn_at", "credited_at", "billing_source", "student_subscription_id", "deleted_at" from public.invoices;
revoke all on admin_reporting.invoices from public, anon, authenticated;
grant select on admin_reporting.invoices to admin_reporting_reader;
create view admin_reporting.invoice_items with (security_barrier=true) as select "id", "invoice_id", "sessions_students_id", "stripe_invoice_item_id", "amount_cents", "description", "is_subsidy", "session_id", "student_id", "created_at", "is_fee", "deleted_at", "line_kind", "restores_credit_note_id", "billing_adjustment_id" from public.invoice_items;
revoke all on admin_reporting.invoice_items from public, anon, authenticated;
grant select on admin_reporting.invoice_items to admin_reporting_reader;
create view admin_reporting.credit_notes with (security_barrier=true) as select "id", "invoice_id", "stripe_credit_note_id", "amount_cents", "currency", "reason", "status", "created_at", "updated_at", "voided_at", "refund_amount_cents", "credit_amount_cents", "out_of_band_amount_cents", "source_invoice_item_id", "billing_adjustment_id" from public.credit_notes;
revoke all on admin_reporting.credit_notes from public, anon, authenticated;
grant select on admin_reporting.credit_notes to admin_reporting_reader;
create view admin_reporting.credit_balance_transactions with (security_barrier=true) as select "id", "stripe_credit_balance_transaction_id", "stripe_customer_id", "stripe_credit_grant_id", "stripe_invoice_id", "stripe_invoice_line_item_id", "invoice_id", "credit_note_id", "type", "amount_cents", "currency", "debit_type", "credit_type", "description", "effective_at", "created_at", "updated_at" from public.credit_balance_transactions;
revoke all on admin_reporting.credit_balance_transactions from public, anon, authenticated;
grant select on admin_reporting.credit_balance_transactions to admin_reporting_reader;
create view admin_reporting.session_billing_adjustments with (security_barrier=true) as select "id", "sessions_students_id", "kind", "status", "source_invoice_item_id", "source_credit_note_id", "depends_on_adjustment_id", "amount_cents", "currency", "reason_category", "reason_note", "attempt_count", "max_attempts", "next_attempt_at", "last_error", "created_by", "created_at", "updated_at", "completed_at" from public.session_billing_adjustments;
revoke all on admin_reporting.session_billing_adjustments from public, anon, authenticated;
grant select on admin_reporting.session_billing_adjustments to admin_reporting_reader;
create view admin_reporting.student_subscriptions with (security_barrier=true) as select "id", "student_id", "subject_id", "stripe_subscription_id", "stripe_price_id", "stripe_product_id", "status", "current_period_start", "current_period_end", "created_at", "updated_at", "cancel_at_period_end", "cancel_at", "plan_tier", "billing_interval", "billing_recovery_invoice_id", "billing_recovery_started_at", "billing_recovery_next_attempt_at", "billing_recovery_failure_code", "billing_recovery_requires_action" from public.student_subscriptions;
revoke all on admin_reporting.student_subscriptions from public, anon, authenticated;
grant select on admin_reporting.student_subscriptions to admin_reporting_reader;
create view admin_reporting.student_subsidies with (security_barrier=true) as select "id", "student_id", "subject_id", "billing_type", "price_cents", "currency", "effective_from", "effective_until", "created_at", "updated_at", "created_by" from public.student_subsidies;
revoke all on admin_reporting.student_subsidies from public, anon, authenticated;
grant select on admin_reporting.student_subsidies to admin_reporting_reader;
create view admin_reporting.billing_pricing with (security_barrier=true) as select "billing_type", "hourly_rate_cents", "currency", "created_at", "updated_at" from public.billing_pricing;
revoke all on admin_reporting.billing_pricing from public, anon, authenticated;
grant select on admin_reporting.billing_pricing to admin_reporting_reader;
create view admin_reporting.billing_pricing_overrides with (security_barrier=true) as select "id", "subject_id", "billing_type", "hourly_rate_cents", "currency", "effective_from", "effective_until", "created_at", "updated_at" from public.billing_pricing_overrides;
revoke all on admin_reporting.billing_pricing_overrides from public, anon, authenticated;
grant select on admin_reporting.billing_pricing_overrides to admin_reporting_reader;
create view admin_reporting.staff_pay_tiers with (security_barrier=true) as select "tier_number", "name", "base_pay_rate_cents", "currency", "created_at", "updated_at" from public.staff_pay_tiers;
revoke all on admin_reporting.staff_pay_tiers from public, anon, authenticated;
grant select on admin_reporting.staff_pay_tiers to admin_reporting_reader;
create view admin_reporting.tutor_logs with (security_barrier=true) as select "id", "session_id", "created_at", "updated_at", "created_by", "session_type" from public.tutor_logs;
revoke all on admin_reporting.tutor_logs from public, anon, authenticated;
grant select on admin_reporting.tutor_logs to admin_reporting_reader;
create view admin_reporting.tutor_logs_student_attendance with (security_barrier=true) as select "id", "tutor_log_id", "student_id", "attended", "created_at", "updated_at", "created_by", "was_trial" from public.tutor_logs_student_attendance;
revoke all on admin_reporting.tutor_logs_student_attendance from public, anon, authenticated;
grant select on admin_reporting.tutor_logs_student_attendance to admin_reporting_reader;
create view admin_reporting.tutor_logs_staff_attendance with (security_barrier=true) as select "id", "tutor_log_id", "staff_id", "attended", "type", "created_at", "updated_at", "was_trial" from public.tutor_logs_staff_attendance;
revoke all on admin_reporting.tutor_logs_staff_attendance from public, anon, authenticated;
grant select on admin_reporting.tutor_logs_staff_attendance to admin_reporting_reader;
create view admin_reporting.admin_shifts with (security_barrier=true) as select "id", "day_of_week", "start_time", "end_time", "status", "session_start_date", "session_end_date", "created_at", "updated_at", "created_by" from public.admin_shifts;
revoke all on admin_reporting.admin_shifts from public, anon, authenticated;
grant select on admin_reporting.admin_shifts to admin_reporting_reader;
create view admin_reporting.admin_shifts_staff with (security_barrier=true) as select "id", "admin_shift_id", "staff_id", "assigned_at", "unassigned_at", "created_by", "created_at", "updated_at" from public.admin_shifts_staff;
revoke all on admin_reporting.admin_shifts_staff from public, anon, authenticated;
grant select on admin_reporting.admin_shifts_staff to admin_reporting_reader;
create view admin_reporting.ucat_plan_prices with (security_barrier=true) as select "id", "plan_tier", "billing_interval", "base_price_cents", "stripe_price_id", "created_at", "updated_at", "checkout_enabled" from public.ucat_plan_prices;
revoke all on admin_reporting.ucat_plan_prices from public, anon, authenticated;
grant select on admin_reporting.ucat_plan_prices to admin_reporting_reader;
create view admin_reporting.contacts with (security_barrier=true) as select "id", "contact_type", "phone_e164", "student_id", "parent_id", "staff_id", "is_opted_out", "opted_out_at", "created_at", "updated_at", "email" from public.contacts;
revoke all on admin_reporting.contacts from public, anon, authenticated;
grant select on admin_reporting.contacts to admin_reporting_reader;
create view admin_reporting.conversations with (security_barrier=true) as select "id", "contact_id", "owned_number_id", "status", "assigned_staff_id", "last_message_id", "last_message_at", "is_pinned", "created_by_staff_id", "created_at", "updated_at", "is_group_chat", "group_chat_id", "group_chat_name", "needs_follow_up", "last_message_direction" from public.conversations;
revoke all on admin_reporting.conversations from public, anon, authenticated;
grant select on admin_reporting.conversations to admin_reporting_reader;
create view admin_reporting.messages with (security_barrier=true) as select "id", "conversation_id", "direction", "body", "from_number_e164", "to_number_e164", "status", "status_updated_at", "message_sid", "messaging_service_sid", "error_code", "error_message", "sent_at", "delivered_at", "received_at", "created_by_staff_id", "created_at", "updated_at", "is_announcement", "imessage_guid", "is_reaction", "reaction_type", "associated_message_guid", "imessage_temp_guid", "read_at", "provider_error_at", "provider_error_code", "is_historical_import", "apple_service", "resent_from_message_id" from public.messages;
revoke all on admin_reporting.messages from public, anon, authenticated;
grant select on admin_reporting.messages to admin_reporting_reader;
create view admin_reporting.message_attachments with (security_barrier=true) as select "id", "message_id", "filename", "mime_type", "size_bytes", "created_at" from public.message_attachments;
revoke all on admin_reporting.message_attachments from public, anon, authenticated;
grant select on admin_reporting.message_attachments to admin_reporting_reader;
create view admin_reporting.message_templates with (security_barrier=true) as select "id", "name", "content", "created_by", "created_at", "updated_at", "is_active", "variables", "template_key" from public.message_templates;
revoke all on admin_reporting.message_templates from public, anon, authenticated;
grant select on admin_reporting.message_templates to admin_reporting_reader;
create view admin_reporting.forms with (security_barrier=true) as select "id", "name", "purpose", "status", "access_type", "submission_limit", "draft_blocks", "draft_thank_you_message", "latest_published_version_id", "created_by", "updated_by", "created_at", "updated_at", "archived_at", "workflow_request_expiry_days" from public.forms;
revoke all on admin_reporting.forms from public, anon, authenticated;
grant select on admin_reporting.forms to admin_reporting_reader;
create view admin_reporting.form_versions with (security_barrier=true) as select "id", "form_id", "version_number", "blocks", "thank_you_message", "published_by", "published_at" from public.form_versions;
revoke all on admin_reporting.form_versions from public, anon, authenticated;
grant select on admin_reporting.form_versions to admin_reporting_reader;
create view admin_reporting.form_responses with (security_barrier=true) as select "id", "form_id", "form_version_id", "respondent_type", "respondent_student_id", "respondent_staff_id", "respondent_parent_id", "subject_type", "subject_student_id", "subject_staff_id", "subject_parent_id", "submitted_by_user_id", "response_json", "submitted_at", "deleted_at", "deleted_by", "delete_reason", "session_id", "recorded_by_staff_id" from public.form_responses;
revoke all on admin_reporting.form_responses from public, anon, authenticated;
grant select on admin_reporting.form_responses to admin_reporting_reader;
create view admin_reporting.form_response_answers with (security_barrier=true) as select "id", "form_response_id", "form_id", "form_version_id", "question_id", "question_label_snapshot", "question_type", "choice_value", "choice_label_snapshot", "choice_values", "text_value", "number_value", "created_at" from public.form_response_answers;
revoke all on admin_reporting.form_response_answers from public, anon, authenticated;
grant select on admin_reporting.form_response_answers to admin_reporting_reader;
create view admin_reporting.ucat_communication_preferences with (security_barrier=true) as select "student_id", "weekly_progress_and_guidance", "lessons_and_tips", "product_news", "offers_and_referrals", "created_at", "updated_at" from public.ucat_communication_preferences;
revoke all on admin_reporting.ucat_communication_preferences from public, anon, authenticated;
grant select on admin_reporting.ucat_communication_preferences to admin_reporting_reader;
create view admin_reporting.ucat_communication_consent_events with (security_barrier=true) as select "id", "auth_user_id", "student_id", "email", "topic", "action", "source", "wording_version", "wording", "occurred_at" from public.ucat_communication_consent_events;
revoke all on admin_reporting.ucat_communication_consent_events from public, anon, authenticated;
grant select on admin_reporting.ucat_communication_consent_events to admin_reporting_reader;
create view admin_reporting.ucat_email_delivery_ledger with (security_barrier=true) as select "id", "student_id", "recipient_email", "campaign_key", "topic", "status", "attempt_count", "provider_message_id", "last_error", "sent_at", "created_at", "updated_at", "delivery_status", "delivered_at", "last_provider_event_at" from public.ucat_email_delivery_ledger;
revoke all on admin_reporting.ucat_email_delivery_ledger from public, anon, authenticated;
grant select on admin_reporting.ucat_email_delivery_ledger to admin_reporting_reader;
create view admin_reporting.ucat_email_delivery_events with (security_barrier=true) as select "provider_event_id", "provider_message_id", "event_type", "occurred_at", "received_at", "recipient_email_hash", "ledger_id", "campaign_key" from public.ucat_email_delivery_events;
revoke all on admin_reporting.ucat_email_delivery_events from public, anon, authenticated;
grant select on admin_reporting.ucat_email_delivery_events to admin_reporting_reader;
create view admin_reporting.ucat_email_program_assignments with (security_barrier=true) as select "student_id", "cohort", "bucket", "posthog_synced_at", "assigned_at" from public.ucat_email_program_assignments;
revoke all on admin_reporting.ucat_email_program_assignments from public, anon, authenticated;
grant select on admin_reporting.ucat_email_program_assignments to admin_reporting_reader;
create view admin_reporting.student_practice_sessions with (security_barrier=true) as select "id", "student_id", "ucat_section_id", "section_key", "filters_snapshot", "stems_snapshot", "score_points", "total_points", "question_count", "started_at", "completed_at", "unlimited", "engine_snapshot", "current_segment_ends_at", "prefetched_stem_snapshot", "last_activity_at", "discarded_at", "expired_at", "was_timed", "stem_delivery_revision" from public.student_practice_sessions;
revoke all on admin_reporting.student_practice_sessions from public, anon, authenticated;
grant select on admin_reporting.student_practice_sessions to admin_reporting_reader;
create view admin_reporting.student_question_attempts with (security_barrier=true) as select "id", "student_id", "student_question_set_attempt_id", "question_id", "answer_snapshot", "score", "is_flagged", "is_submitted", "attempted_at", "time_spent_seconds", "student_question_speed", "was_timed", "mode", "student_practice_session_id", "learning_module_block_id", "content_snapshot", "first_seen_at", "time_spent_milliseconds" from public.student_question_attempts;
revoke all on admin_reporting.student_question_attempts from public, anon, authenticated;
grant select on admin_reporting.student_question_attempts to admin_reporting_reader;
create view admin_reporting.student_question_set_attempts with (security_barrier=true) as select "id", "student_id", "question_set_id", "score_points", "total_points", "scaled_score", "time_taken_seconds", "student_ucat_mock_attempt_id", "attempted_at", "completed_at", "set_time_limit_seconds", "set_time_limit_at_exam_speed_seconds", "set_speed", "student_set_speed", "student_exam_speed", "was_timed", "engine_snapshot", "current_segment_ends_at", "content_snapshot", "last_activity_at", "discarded_at", "expired_at", "scoring_model_version", "effective_timing_mode", "effective_pace_multiplier", "timing_source", "study_plan_task_id" from public.student_question_set_attempts;
revoke all on admin_reporting.student_question_set_attempts from public, anon, authenticated;
grant select on admin_reporting.student_question_set_attempts to admin_reporting_reader;
create view admin_reporting.student_ucat_mock_attempts with (security_barrier=true) as select "id", "student_id", "ucat_mock_id", "attempted_at", "completed_at", "score_points", "total_points", "scaled_score", "time_taken", "mock_time_limit_seconds", "mock_time_limit_at_exam_speed_seconds", "student_mock_speed", "engine_snapshot", "current_segment_ends_at", "content_snapshot", "last_activity_at", "discarded_at", "expired_at", "was_timed", "scoring_model_version" from public.student_ucat_mock_attempts;
revoke all on admin_reporting.student_ucat_mock_attempts from public, anon, authenticated;
grant select on admin_reporting.student_ucat_mock_attempts to admin_reporting_reader;
create view admin_reporting.student_ucat_content_ratings with (security_barrier=true) as select "id", "student_id", "target_type", "target_key", "target_version", "context_key", "surface", "vote", "reason_code", "reason_text", "displayed_content", "created_at", "updated_at", "question_id", "resolved_at", "resolution_reason" from public.student_ucat_content_ratings;
revoke all on admin_reporting.student_ucat_content_ratings from public, anon, authenticated;
grant select on admin_reporting.student_ucat_content_ratings to admin_reporting_reader;
create view admin_reporting.ucat_student_learning_module_progress with (security_barrier=true) as select "id", "student_id", "learning_module_id", "started_at", "completion_percent", "completed_at", "study_plan_task_id" from public.ucat_student_learning_module_progress;
revoke all on admin_reporting.ucat_student_learning_module_progress from public, anon, authenticated;
grant select on admin_reporting.ucat_student_learning_module_progress to admin_reporting_reader;
create view admin_reporting.ucat_subscription_journey_events with (security_barrier=true) as select "id", "student_id", "event_type", "journey_context", "journey_variant", "plan_tier", "billing_interval", "trial_eligible", "stripe_checkout_session_id", "created_at" from public.ucat_subscription_journey_events;
revoke all on admin_reporting.ucat_subscription_journey_events from public, anon, authenticated;
grant select on admin_reporting.ucat_subscription_journey_events to admin_reporting_reader;
create view admin_reporting.issues with (security_barrier=true) as select "id", "name", "status", "description", "created_by", "created_at", "updated_at", "due_date", "resolved_at", "resolved_by" from public.issues;
revoke all on admin_reporting.issues from public, anon, authenticated;
grant select on admin_reporting.issues to admin_reporting_reader;
create view admin_reporting.tasks with (security_barrier=true) as select "id", "title", "description", "status", "priority", "assigned_to", "estimate", "due_date", "created_by", "created_at", "updated_at", "source_rule_id", "source_activity_id", "issue_id", "project_id", "completed_at", "completed_by", "source_domain_event_id" from public.tasks;
revoke all on admin_reporting.tasks from public, anon, authenticated;
grant select on admin_reporting.tasks to admin_reporting_reader;
create view admin_reporting.projects with (security_barrier=true) as select "id", "name", "description", "status", "priority", "project_lead_id", "start_date", "target_date", "created_by", "created_at", "updated_at", "completed_at" from public.projects;
revoke all on admin_reporting.projects from public, anon, authenticated;
grant select on admin_reporting.projects to admin_reporting_reader;
create view admin_reporting.project_members with (security_barrier=true) as select "project_id", "staff_id", "created_at" from public.project_members;
revoke all on admin_reporting.project_members from public, anon, authenticated;
grant select on admin_reporting.project_members to admin_reporting_reader;
create view admin_reporting.notes_documents with (security_barrier=true) as select "id", "title", "content", "folder_id", "created_by", "updated_by", "created_at", "updated_at", "project_id", "is_tutor_documentation" from public.notes_documents;
revoke all on admin_reporting.notes_documents from public, anon, authenticated;
grant select on admin_reporting.notes_documents to admin_reporting_reader;
create view admin_reporting.notes with (security_barrier=true) as select "id", "target_type", "target_id", "note", "created_at", "updated_at", "created_by" from public.notes;
revoke all on admin_reporting.notes from public, anon, authenticated;
grant select on admin_reporting.notes to admin_reporting_reader;
create view admin_reporting.notes_folders with (security_barrier=true) as select "id", "name", "parent_id", "created_by", "created_at", "updated_at" from public.notes_folders;
revoke all on admin_reporting.notes_folders from public, anon, authenticated;
grant select on admin_reporting.notes_folders to admin_reporting_reader;
create view admin_reporting.notes_daily with (security_barrier=true) as select "id", "date", "content", "updated_by", "updated_at" from public.notes_daily;
revoke all on admin_reporting.notes_daily from public, anon, authenticated;
grant select on admin_reporting.notes_daily to admin_reporting_reader;
create view admin_reporting.rich_text_templates with (security_barrier=true) as select "id", "name", "content", "created_by", "created_at", "updated_at" from public.rich_text_templates;
revoke all on admin_reporting.rich_text_templates from public, anon, authenticated;
grant select on admin_reporting.rich_text_templates to admin_reporting_reader;
create view admin_reporting.files with (security_barrier=true) as select "id", "mimetype", "filename", "size_bytes", "storage_provider", "bucket", "storage_path", "deleted_at", "created_at", "updated_at", "created_by" from public.files;
revoke all on admin_reporting.files from public, anon, authenticated;
grant select on admin_reporting.files to admin_reporting_reader;
create view admin_reporting.sessions_files with (security_barrier=true) as select "id", "session_id", "file_id", "display_order", "created_at", "updated_at", "created_by", "display_name" from public.sessions_files;
revoke all on admin_reporting.sessions_files from public, anon, authenticated;
grant select on admin_reporting.sessions_files to admin_reporting_reader;
create view admin_reporting.subjects_files with (security_barrier=true) as select "id", "subject_id", "file_id", "created_at", "updated_at", "created_by" from public.subjects_files;
revoke all on admin_reporting.subjects_files from public, anon, authenticated;
grant select on admin_reporting.subjects_files to admin_reporting_reader;
create view admin_reporting.staff_files with (security_barrier=true) as select "id", "staff_id", "file_id", "display_order", "created_at", "updated_at", "created_by", "display_name" from public.staff_files;
revoke all on admin_reporting.staff_files from public, anon, authenticated;
grant select on admin_reporting.staff_files to admin_reporting_reader;

alter role admin_reporting_reader connection limit 12;
create schema if not exists admin_operations;
revoke all on schema admin_operations from public, anon;
grant usage on schema admin_operations to authenticated;

create table public.admin_mcp_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  granted_at timestamptz not null default now(),
  primary key(user_id, client_id)
);
alter table public.admin_mcp_grants enable row level security;
revoke all on public.admin_mcp_grants from public, anon, authenticated;
grant select, insert, delete on public.admin_mcp_grants to authenticated;
create policy admin_mcp_grants_self on public.admin_mcp_grants to authenticated
using (user_id=(select auth.uid()) and (select public.is_adminstaff_active()))
with check (user_id=(select auth.uid()) and (select public.is_adminstaff_active()) and nullif((select auth.jwt())->>'client_id','') is null);

create function public.has_admin_mcp_access() returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and public.is_adminstaff_active() and exists (
    select 1 from public.admin_mcp_grants g where g.user_id=(select auth.uid()) and g.client_id=(select auth.jwt())->>'client_id'
  );
$$;
revoke all on function public.has_admin_mcp_access() from public, anon;
grant execute on function public.has_admin_mcp_access() to authenticated;

create table admin_operations.receipts (
  user_id uuid not null, client_id text not null, request_key text not null,
  fingerprint text not null, response jsonb not null, created_at timestamptz not null default now(),
  primary key(user_id,client_id,request_key)
);
revoke all on admin_operations.receipts from public, anon, authenticated;
create table admin_operations.changes (
  id uuid primary key default gen_random_uuid(), entity_kind text not null,
  entity_id uuid not null, actor_user_id uuid, client_id text,
  before_record jsonb, after_record jsonb, recorded_at timestamptz not null default now()
);
revoke all on admin_operations.changes from public, anon, authenticated;

create function admin_operations.assert_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid;
begin
  if (select auth.uid()) is null or not public.is_adminstaff_active() then raise exception 'Active administrator required' using errcode='42501'; end if;
  if nullif((select auth.jwt())->>'client_id','') is not null and not public.has_admin_mcp_access() then raise exception 'Admin MCP consent required' using errcode='42501'; end if;
  select id into actor from public.staff where user_id=(select auth.uid()) and role='ADMINSTAFF' and status='ACTIVE';
  return actor;
end $$;
revoke all on function admin_operations.assert_actor() from public, anon, authenticated;

create function admin_operations.table_for(kind text) returns text language plpgsql immutable set search_path='' as $$
begin
  return case kind when 'issue' then 'issues' when 'task' then 'tasks' when 'project' then 'projects'
    when 'document' then 'notes_documents' when 'note' then 'notes' when 'folder' then 'notes_folders'
    when 'daily_note' then 'notes_daily' when 'template' then 'rich_text_templates' else null end;
end $$;
revoke all on function admin_operations.table_for(text) from public, anon, authenticated;

create function admin_operations.revise() returns trigger language plpgsql set search_path='' as $$
begin new.admin_revision := old.admin_revision+1; return new; end $$;
revoke all on function admin_operations.revise() from public, anon, authenticated;
create function admin_operations.record_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into admin_operations.changes(entity_kind,entity_id,actor_user_id,client_id,before_record,after_record)
  values (tg_argv[0],coalesce(new.id,old.id),(select auth.uid()),(select auth.jwt())->>'client_id',
    case when tg_op='INSERT' then null else to_jsonb(old)-'search_vector' end,
    case when tg_op='DELETE' then null else to_jsonb(new)-'search_vector' end);
  return coalesce(new,old);
end $$;
revoke all on function admin_operations.record_change() from public, anon, authenticated;

do $$ declare pair record; begin
  for pair in select * from (values ('issue','issues'),('task','tasks'),('project','projects'),('document','notes_documents'),('note','notes'),('folder','notes_folders'),('daily_note','notes_daily'),('template','rich_text_templates')) as t(kind,tab) loop
    execute format('alter table public.%I add column admin_revision bigint not null default 1',pair.tab);
    execute format('create trigger admin_revision before update on public.%I for each row execute function admin_operations.revise()',pair.tab);
    execute format('create trigger admin_change_history after insert or update or delete on public.%I for each row execute function admin_operations.record_change(%L)',pair.tab,pair.kind);
  end loop;
end $$;

create function admin_operations.members_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into admin_operations.changes(entity_kind,entity_id,actor_user_id,client_id,before_record,after_record)
  values ('project',coalesce(new.project_id,old.project_id),(select auth.uid()),(select auth.jwt())->>'client_id',
    case when tg_op='DELETE' then jsonb_build_object('member',to_jsonb(old)) end,
    case when tg_op='INSERT' then jsonb_build_object('member',to_jsonb(new)) end);
  update public.projects set updated_at=now() where id=coalesce(new.project_id,old.project_id);
  return coalesce(new,old);
end $$;
revoke all on function admin_operations.members_changed() from public, anon, authenticated;
create trigger admin_project_members_revision after insert or delete on public.project_members
for each row execute function admin_operations.members_changed();

create function public.admin_work_item_read(p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare tab text; row_data jsonb;
begin
  perform admin_operations.assert_actor();
  tab := admin_operations.table_for(p_kind);
  if tab is null then raise exception 'Unsupported work item kind' using errcode='22023'; end if;
  execute format('select to_jsonb(t)-''search_vector'' from public.%I t where id=$1',tab) into row_data using p_id;
  if row_data is null then raise exception 'Work item not found' using errcode='P0002'; end if;
  if p_kind='project' then
    row_data := row_data || jsonb_build_object('member_ids',coalesce((select jsonb_agg(staff_id order by staff_id) from public.project_members where project_id=p_id),'[]'::jsonb));
  end if;
  return jsonb_build_object('record',row_data,'revision',row_data->>'admin_revision');
end $$;
revoke all on function public.admin_work_item_read(text,uuid) from public, anon;
grant execute on function public.admin_work_item_read(text,uuid) to authenticated;

create function admin_operations.validate_references(payload jsonb,previous jsonb,document_only boolean)
returns void language plpgsql security definer set search_path='' as $$
declare mention jsonb; tab text; target uuid; exists_target boolean;
begin
  for mention in select value from jsonb_path_query(payload,'$.** ? (@.type == "mention")') value loop
    -- Existing unresolved mentions may survive edits; newly introduced links must resolve.
    if previous is not null and exists(select 1 from jsonb_path_query(previous,'$.** ? (@.type == "mention")') old_mention where old_mention=mention) then continue; end if;
    if document_only and mention#>>'{attrs,type}'<>'note' then raise exception 'Documents support document references only' using errcode='22023'; end if;
    tab:=case mention#>>'{attrs,type}' when 'student' then 'students' when 'parent' then 'parents' when 'staff' then 'staff' when 'class' then 'classes' when 'session' then 'sessions' when 'invoice' then 'invoices' when 'subject' then 'subjects' when 'topic' then 'topics' when 'file' then 'topics_files' when 'note' then 'notes_documents' else admin_operations.table_for(mention#>>'{attrs,type}') end;
    if tab is null then raise exception 'Unknown reference type' using errcode='22023'; end if;
    target := (mention#>>'{attrs,id}')::uuid;
    execute format('select exists(select 1 from public.%I where id=$1)',tab) into exists_target using target;
    if not exists_target then raise exception 'Referenced entity not found' using errcode='22023'; end if;
  end loop;
end $$;
revoke all on function admin_operations.validate_references(jsonb,jsonb,boolean) from public,anon,authenticated;

create function admin_operations.lock_document_editor() returns trigger language plpgsql security definer set search_path='' as $$
begin perform 1 from public.notes_documents where id=new.note_id for update; return new; end $$;
revoke all on function admin_operations.lock_document_editor() from public,anon,authenticated;
create trigger admin_document_editor_lock before insert or update on public.note_document_edit_locks
for each row execute function admin_operations.lock_document_editor();

create function public.admin_work_item_change(p_kind text,p_id uuid default null,p_revision bigint default null,p_key text default null,p_changes jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid; tab text; allowed text[]; field text; payload jsonb := p_changes;
  old_data jsonb; result jsonb; fingerprint text; existing admin_operations.receipts;
  client text := coalesce((select auth.jwt())->>'client_id','admin-web'); new_id uuid := coalesce(p_id,gen_random_uuid());
  columns_sql text; values_sql text; set_sql text; lead uuid; parent uuid; depth integer;
begin
  actor := admin_operations.assert_actor();
  tab := admin_operations.table_for(p_kind);
  if tab is null then raise exception 'Unsupported work item kind' using errcode='22023'; end if;
  if p_key is null or length(p_key) not between 1 and 200 or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>1000000 then raise exception 'Invalid operation input' using errcode='22023'; end if;
  fingerprint := md5(jsonb_build_array(p_kind,p_id,p_revision,p_changes)::text);
  perform pg_advisory_xact_lock(hashtextextended((select auth.uid())::text||client||p_key,0));
  select * into existing from admin_operations.receipts where user_id=(select auth.uid()) and client_id=client and request_key=p_key;
  if found then
    if existing.fingerprint<>fingerprint then raise exception 'Idempotency key reused with different input' using errcode='22023'; end if;
    return existing.response;
  end if;
  allowed := case p_kind
    when 'issue' then array['name','description','status','due_date']
    when 'task' then array['title','description','status','priority','assigned_to','issue_id','project_id','estimate','due_date']
    when 'project' then array['name','description','status','priority','project_lead_id','start_date','target_date','member_ids']
    when 'document' then array['title','content','folder_id','project_id','is_tutor_documentation']
    when 'note' then case when p_id is null then array['note','target_type','target_id'] else array['note'] end
    when 'folder' then array['name','parent_id']
    when 'daily_note' then case when p_id is null then array['date','content'] else array['content'] end
    when 'template' then array['name','content'] end;
  for field in select jsonb_object_keys(payload) loop
    if not field=any(allowed) then raise exception 'Property % is not editable for %',field,p_kind using errcode='22023'; end if;
  end loop;
  -- Serialise hierarchy changes so concurrent reparenting cannot introduce a cycle.
  if p_kind='folder' then perform pg_advisory_xact_lock(731451); end if;
  if p_id is not null then
    execute format('select to_jsonb(t) from public.%I t where id=$1 for update',tab) into old_data using p_id;
    if old_data is null then raise exception 'Work item not found' using errcode='P0002'; end if;
    if p_revision is null or p_revision<>(old_data->>'admin_revision')::bigint then raise exception 'Work item changed; latest revision is %. Reopen or read the work item before retrying.',old_data->>'admin_revision' using errcode='40001'; end if;
    if p_kind='document' and exists(select from public.note_document_edit_locks where note_id=p_id and updated_at>now()-interval '45 seconds' and (client<>'admin-web' or locked_by<>actor)) then
      raise exception 'Document is being edited; retry after its editor releases it' using errcode='55P03';
    end if;
  elsif p_revision is not null then raise exception 'New work items have no base revision' using errcode='22023'; end if;
  if p_kind='folder' and payload ? 'parent_id' then
    parent := (payload->>'parent_id')::uuid; depth := 0;
    while parent is not null loop
      if parent=new_id or depth>100 then raise exception 'Folder hierarchy would contain a cycle' using errcode='22023'; end if;
      select parent_id into parent from public.notes_folders where id=parent; depth:=depth+1;
    end loop;
  end if;
  if p_kind='note' and p_id is null then
    tab := case payload->>'target_type' when 'student' then 'students' when 'students' then 'students' when 'staff' then 'staff' when 'parent' then 'parents' when 'parents' then 'parents' when 'class' then 'classes' when 'classes' then 'classes' when 'session' then 'sessions' when 'sessions' then 'sessions' when 'invoice' then 'invoices' when 'invoices' then 'invoices' when 'subject' then 'subjects' when 'subjects' then 'subjects' when 'tasks' then 'tasks' when 'issues' then 'issues' when 'projects' then 'projects' when 'admin_shift' then 'admin_shifts' else admin_operations.table_for(payload->>'target_type') end;
    if tab is null then raise exception 'Unsupported note target' using errcode='22023'; end if;
    execute format('select to_jsonb(t) from public.%I t where id=$1',tab) into result using (payload->>'target_id')::uuid;
    if result is null then raise exception 'Note target not found' using errcode='22023'; end if;
    if payload->>'target_type' in ('task','issue','project') then payload := jsonb_set(payload,'{target_type}',to_jsonb(tab)); end if;
    tab := 'notes';
  end if;
  perform admin_operations.validate_references(payload,old_data,p_kind='document');
  payload := payload-'member_ids';
  if p_id is null then
    payload := payload||jsonb_build_object('id',new_id);
    if p_kind<>'daily_note' then payload:=payload||jsonb_build_object('created_by',actor); end if;
  end if;
  if p_kind in ('daily_note','document') then payload:=payload||jsonb_build_object('updated_by',actor); end if;
  if p_kind='issue' and payload ? 'status' then payload:=payload||jsonb_build_object('resolved_by',case when payload->>'status'='resolved' then actor end); end if;
  if p_kind='task' and payload ? 'status' then payload:=payload||jsonb_build_object('completed_by',case when payload->>'status'='done' then actor end); end if;
  if p_id is null then
    select string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') into columns_sql,values_sql from jsonb_object_keys(payload) k;
    execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) r',tab,columns_sql,values_sql,tab) using payload;
  else
    if payload='{}'::jsonb then payload:=jsonb_build_object('updated_at',now()); end if;
    select string_agg(format('%I=r.%I',k,k),',') into set_sql from jsonb_object_keys(payload) k;
    execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) r where t.id=$2',tab,set_sql,tab) using payload,new_id;
  end if;
  if p_kind='project' and p_changes ? 'member_ids' then
    if jsonb_typeof(p_changes->'member_ids')<>'array' then raise exception 'member_ids must be an array' using errcode='22023'; end if;
    select project_lead_id into lead from public.projects where id=new_id;
    delete from public.project_members where project_id=new_id and staff_id is distinct from lead and staff_id not in (select value::uuid from jsonb_array_elements_text(p_changes->'member_ids'));
    insert into public.project_members(project_id,staff_id) select new_id,value::uuid from jsonb_array_elements_text(p_changes->'member_ids') on conflict do nothing;
  end if;
  result := public.admin_work_item_read(p_kind,new_id);
  insert into admin_operations.receipts(user_id,client_id,request_key,fingerprint,response) values((select auth.uid()),client,p_key,fingerprint,result);
  return result;
end $$;
revoke all on function public.admin_work_item_change(text,uuid,bigint,text,jsonb) from public, anon;
grant execute on function public.admin_work_item_change(text,uuid,bigint,text,jsonb) to authenticated;

create function public.admin_work_item_history(p_kind text,p_id uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform admin_operations.assert_actor();
  if admin_operations.table_for(p_kind) is null or p_offset<0 then raise exception 'Invalid history request' using errcode='22023'; end if;
  return coalesce((select jsonb_agg(to_jsonb(t)) from (
    select * from admin_operations.changes where entity_kind=p_kind and entity_id=p_id
    order by recorded_at desc,id desc offset p_offset limit 50
  ) t),'[]'::jsonb);
end $$;
revoke all on function public.admin_work_item_history(text,uuid,integer) from public,anon;
grant execute on function public.admin_work_item_history(text,uuid,integer) to authenticated;

create table admin_operations.reporting_queries (
  id uuid primary key default gen_random_uuid(), actor_user_id uuid not null,
  client_id text, query_fingerprint text not null, returned_rows integer not null,
  truncated boolean not null, recorded_at timestamptz not null default now()
);
revoke all on admin_operations.reporting_queries from public,anon,authenticated;
create function public.admin_record_reporting_query(p_fingerprint text,p_rows integer,p_truncated boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform admin_operations.assert_actor();
  if length(p_fingerprint)<>64 or p_rows not between 0 and 1000 then raise exception 'Invalid query receipt' using errcode='22023'; end if;
  insert into admin_operations.reporting_queries(actor_user_id,client_id,query_fingerprint,returned_rows,truncated)
  values ((select auth.uid()),(select auth.jwt())->>'client_id',p_fingerprint,p_rows,p_truncated);
end $$;
revoke all on function public.admin_record_reporting_query(text,integer,boolean) from public,anon;
grant execute on function public.admin_record_reporting_query(text,integer,boolean) to authenticated;
