# E2E Testing Guide: Invite & Registration Flow

This guide provides step-by-step instructions for testing the email and SMS sending functionality for student invites and registration links.

## Prerequisites

### 1. Environment Setup

**Required Environment Variables:**
- `RESEND_API_KEY` - Must be set in your environment (Vercel/development)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` - For SMS (already configured)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

**Verify Setup:**
```bash
# Check if Resend API key is configured
echo $RESEND_API_KEY

# For local development, ensure .env.local has:
# RESEND_API_KEY=re_xxxxx
```

### 2. Test Data Requirements

You'll need:
- A student record with:
  - `status` = `TRIAL` (for registration link testing)
  - `status` = `ACTIVE` but no `user_id` (for invite link testing)
  - `status` = `ACTIVE` with `user_id` (for password reset testing)
- At least one parent linked to the student with:
  - Email address (for email testing)
  - Phone number in E.164 format (for SMS testing)
- Or student with direct email/phone (fallback)

### 3. Resend Domain Setup

**Important:** Before testing emails in production:
1. Go to [Resend Dashboard](https://resend.com/domains)
2. Add and verify your domain (`altitutor.com`)
3. Or use the test domain provided by Resend for development

**For Development Testing:**
- Resend provides a test domain: `onboarding@resend.dev`
- You can send to any email address, but emails will be logged in Resend dashboard
- Check Resend dashboard → Emails to see sent emails

---

## Test Scenarios

### Scenario 1: Send Invite Email (Student with ACTIVE status, no account)

**Setup:**
1. Create or find a student with:
   - `status` = `ACTIVE`
   - `user_id` = `NULL`
   - Has email address OR has parent(s) with email

**Steps:**
1. Navigate to Admin Web → Students → [Select Student] → Details Tab
2. Scroll to "Account" section
3. Verify you see: "This student has completed registration but does not have an associated user account yet"
4. Click "Send Invite" button
5. In the dialog:
   - Wait for invite link to generate
   - Click "Send Email" button
   - Select recipient (parent or student email)
6. **Expected Result:**
   - Success toast: "Invite email sent"
   - Email received at recipient's inbox
   - Email contains invite link to `/invite/{token}`
   - Link works and redirects to account creation form

**Verify Email:**
- Check Resend dashboard → Emails (if using test domain)
- Check recipient's inbox (including spam folder)
- Verify email template renders correctly
- Verify invite link is clickable and works

---

### Scenario 2: Send Registration Link Email (Student with TRIAL status)

**Setup:**
1. Create or find a student with:
   - `status` = `TRIAL` (or `INACTIVE`)
   - `user_id` = `NULL` OR has `user_id` (both cases should work)
   - Has email address OR has parent(s) with email

**Steps:**
1. Navigate to Admin Web → Students → [Select Student] → Details Tab
2. Scroll to "Account" section
3. Verify you see: "This student has not completed registration..."
4. Click "Send Registration Link" button
5. In the dialog:
   - Wait for registration link to generate
   - Click "Send Email" button
   - Select recipient (parent or student email)
6. **Expected Result:**
   - Success toast: "Registration email sent"
   - Email received at recipient's inbox
   - Email contains registration link to `/register/{token}`
   - Link works and redirects to registration form

**Verify Email:**
- Check Resend dashboard → Emails
- Check recipient's inbox
- Verify email mentions student's name
- Verify registration link works

---

### Scenario 3: Send Invite SMS (Student with ACTIVE status, no account)

**Setup:**
1. Create or find a student with:
   - `status` = `ACTIVE`
   - `user_id` = `NULL`
   - Has phone number OR has parent(s) with phone number

**Steps:**
1. Navigate to Admin Web → Students → [Select Student] → Details Tab
2. Scroll to "Account" section
3. Click "Send Invite" button
4. In the dialog:
   - Wait for invite link to generate
   - Click "Send SMS" button
   - Select recipient (parent or student phone)
5. **Expected Result:**
   - Success toast: "Invite SMS sent"
   - SMS received on recipient's phone
   - SMS contains invite link
   - Link works when clicked

**Verify SMS:**
- Check phone for SMS message
- Verify link is shortened/clickable
- Verify message format is readable
- Click link and verify it works

---

### Scenario 4: Send Registration Link SMS (Student with TRIAL status)

**Setup:**
1. Create or find a student with:
   - `status` = `TRIAL`
   - Has phone number OR has parent(s) with phone number

**Steps:**
1. Navigate to Admin Web → Students → [Select Student] → Details Tab
2. Scroll to "Account" section
3. Click "Send Registration Link" button
4. In the dialog:
   - Wait for registration link to generate
   - Click "Send SMS" button
   - Select recipient (parent or student phone)
5. **Expected Result:**
   - Success toast: "Registration SMS sent"
   - SMS received on recipient's phone
   - SMS contains registration link
   - Link works when clicked

**Verify SMS:**
- Check phone for SMS message
- Verify message mentions student name
- Verify registration link works

---

### Scenario 5: Multiple Recipients (Parents)

**Setup:**
1. Create or find a student with:
   - Multiple parents linked
   - Each parent has email AND phone

**Steps:**
1. Navigate to Admin Web → Students → [Select Student] → Details Tab
2. Click either "Send Invite" or "Send Registration Link"
3. In the dialog:
   - Verify multiple recipients are shown
   - Send email to one parent
   - Send SMS to another parent
4. **Expected Result:**
   - Both parents receive their respective messages
   - Each message contains the correct link
   - Links work independently

---

### Scenario 6: Fallback to Student Contact Info

**Setup:**
1. Create or find a student with:
   - No parents linked
   - Student has email OR phone directly

**Steps:**
1. Navigate to Admin Web → Students → [Select Student] → Details Tab
2. Click either "Send Invite" or "Send Registration Link"
3. In the dialog:
   - Verify student's contact info is shown (not parents)
   - Send email/SMS to student
4. **Expected Result:**
   - Student receives message
   - Message contains correct link
   - Link works

---

### Scenario 7: Error Handling

**Test Cases:**

1. **No Email/Phone:**
   - Student with no email/phone and no parents
   - Expected: Warning message in dialog, send buttons disabled

2. **Invalid Resend API Key:**
   - Temporarily set wrong `RESEND_API_KEY`
   - Expected: Error toast, email not sent

3. **Invalid Twilio Credentials:**
   - SMS should fail gracefully
   - Expected: Error logged, other recipients still processed

4. **Network Issues:**
   - Disconnect internet temporarily
   - Expected: Error toast, clear error message

---

## Testing Checklist

### Email Testing
- [ ] Invite email sends successfully
- [ ] Registration email sends successfully
- [ ] Email template renders correctly (HTML)
- [ ] Email contains correct link
- [ ] Link works when clicked
- [ ] Email sent to correct recipient
- [ ] Multiple recipients work
- [ ] Error handling works (no email, invalid API key)

### SMS Testing
- [ ] Invite SMS sends successfully
- [ ] Registration SMS sends successfully
- [ ] SMS contains correct link
- [ ] Link works when clicked
- [ ] SMS sent to correct recipient
- [ ] Multiple recipients work
- [ ] Error handling works (no phone, invalid credentials)

### Integration Testing
- [ ] Student modal → Details tab → Account section works
- [ ] Dialog opens and closes correctly
- [ ] Link generation works
- [ ] Copy link button works
- [ ] Success toasts appear
- [ ] Loading states work
- [ ] Error states display correctly

---

## Debugging Tips

### Email Not Received?

1. **Check Resend Dashboard:**
   - Go to https://resend.com/emails
   - Look for recent sends
   - Check status (delivered, bounced, etc.)

2. **Check Spam Folder:**
   - Emails might be filtered
   - Check spam/junk folder

3. **Verify API Key:**
   ```bash
   # Test Resend API key
   curl -X POST 'https://api.resend.com/emails' \
     -H "Authorization: Bearer $RESEND_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"from":"noreply@altitutor.com","to":"test@example.com","subject":"Test","html":"<p>Test</p>"}'
   ```

4. **Check Server Logs:**
   - Look for Resend API errors
   - Check Vercel function logs
   - Verify environment variables are set

### SMS Not Received?

1. **Check Twilio Dashboard:**
   - Go to https://console.twilio.com/
   - Check Messages → Logs
   - Verify message was sent

2. **Check Phone Number Format:**
   - Must be E.164 format: `+1234567890`
   - No spaces or dashes

3. **Check Edge Function Logs:**
   - Look in Supabase dashboard → Edge Functions → send-sms
   - Check for errors

4. **Verify Contacts/Conversations:**
   - Check `contacts` table in Supabase
   - Check `conversations` table
   - Verify `messages` table has record

---

## Production Checklist

Before deploying to production:

- [ ] Resend domain verified (`altitutor.com`)
- [ ] `RESEND_API_KEY` added to Vercel environment variables
- [ ] Twilio credentials verified
- [ ] Test emails sent successfully
- [ ] Test SMS sent successfully
- [ ] Email templates reviewed and approved
- [ ] SMS message format reviewed
- [ ] Error handling tested
- [ ] Rate limits understood (Resend: 100/day free, then paid)
- [ ] Monitoring set up (Resend dashboard, Twilio dashboard)

---

## Quick Test Script

For quick manual testing, you can use the browser console:

```javascript
// Test email sending (replace with actual student ID and token)
fetch('/api/students/send-registration-invite', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    studentId: 'YOUR_STUDENT_ID',
    sendEmail: true,
  }),
})
.then(r => r.json())
.then(console.log);

// Test SMS sending
fetch('/api/students/send-registration-invite', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    studentId: 'YOUR_STUDENT_ID',
    sendSms: true,
  }),
})
.then(r => r.json())
.then(console.log);
```

---

## Support

If you encounter issues:
1. Check server logs (Vercel/Supabase)
2. Check Resend/Twilio dashboards
3. Verify environment variables
4. Test with a simple email/SMS first
5. Check network connectivity

