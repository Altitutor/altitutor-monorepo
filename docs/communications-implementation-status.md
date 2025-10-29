# Communications Feature Implementation Status

## Current Issues & Root Causes

### 1. Send-SMS 500 Error with CORS Block
**Symptom:** Browser shows "No 'Access-Control-Allow-Origin' header" and 500 error  
**Root Cause:** The deployed send-sms function (v30) is using OLD CODE from your repo that:
- Missing CORS headers in error responses (catch block)
- Missing proper CORS preflight with Access-Control-Request-Headers
- Missing logging to debug issues

**Fix:** Commit and push the updated `supabase/functions/send-sms/index.ts` to develop branch. CI/CD will redeploy.

### 2. Twilio Inbound 401 Errors
**Symptom:** Twilio webhooks return 401 when sending inbound messages  
**Root Cause:** twilio-inbound function has `verify_jwt` enabled via Supabase Dashboard  
**Fix:** After CI/CD deploys updated functions, manually toggle "Verify JWT" OFF for `twilio-inbound` in Supabase Dashboard → Edge Functions

### 3. Twilio Status Callback Not Updating Message Status
**Symptom:** Messages stay in QUEUED status even though SMS delivers  
**Root Cause:** Same as #2 - twilio-status had verify_jwt enabled, blocking Twilio's callbacks  
**Fix:** After CI/CD deploys updated functions, manually toggle "Verify JWT" OFF for `twilio-status` in Supabase Dashboard → Edge Functions

### 4. Inbound Messages Don't Show in UI Until Refresh
**Symptom:** New messages appear in database but not in MessageThread until page refresh  
**Root Cause:**  
- Supabase browser client wasn't instantiated (FIXED ✅)
- Realtime subscription used invalidation instead of cache patching (FIXED ✅)

**Fixes Applied:**
- ✅ Fixed `apps/admin-web/src/shared/lib/supabase/client/index.ts` to properly create browser client
- ✅ Updated `MessageThread.tsx` to patch cache on INSERT/UPDATE instead of just invalidating

## Files Modified (Ready to Commit)

### Edge Functions (CORS & Logging Fixes)
- `supabase/functions/send-sms/index.ts` - Added CORS headers to all responses, logging, error handling
- `supabase/functions/twilio-status/index.ts` - Added signature verification, logging, CORS
- `supabase/functions/twilio-inbound/index.ts` - Added signature verification, CORS, logging

### Migrations (Database Schema)
- `supabase/migrations/20251023000020_add_updated_at_to_messages.sql` - Adds messages.updated_at column
- `supabase/migrations/20251023000021_enable_realtime_tables.sql` - Ensures messages/conversations/contacts in realtime publication
- `supabase/migrations/20251023000022_add_conversations_last_message_trigger.sql` - Auto-updates conversations.last_message_at

### Frontend (Realtime & Optimistic UI)
- `apps/admin-web/src/shared/lib/supabase/client/index.ts` - Fixed browser client instantiation
- `apps/admin-web/src/features/messages/api/mutations.ts` - Fire-and-forget send (non-blocking)
- `apps/admin-web/src/features/messages/components/MessageThread.tsx` - Realtime cache patching for instant updates

## Next Steps

### Immediate (To Fix Current Issues)
1. **Commit and push to develop:**
   ```bash
   git add supabase/functions/ supabase/migrations/ apps/admin-web/src/
   git commit -m "fix(communications): Add CORS headers, realtime cache patching, and DB triggers"
   git push origin develop
   ```

2. **After CI/CD completes (~2-3 min):**
   - Go to Supabase Dashboard → Edge Functions
   - For `twilio-inbound`: Click "..." → Settings → Toggle "Verify JWT" OFF → Save
   - For `twilio-status`: Click "..." → Settings → Toggle "Verify JWT" OFF → Save

3. **Test the flow:**
   - Send a message from UI → should appear instantly with status QUEUED → update to SENDING → DELIVERED
   - Send inbound SMS → should appear in UI immediately without refresh

### Feature Enhancements (Remaining TODOs)
- [ ] Show per-message status badges (SENDING/SENT/DELIVERED/FAILED) with icons
- [ ] Implement deep links (?conversationId, ?contactId) to open specific threads
- [ ] Harden ChatDock inbound behavior (no duplicates, respect page focus, unread badges)
- [ ] Improve read tracking (mark read on focus and scroll-to-bottom)
- [ ] Add retry logic for failed messages
- [ ] Add message search/filtering
- [ ] Add conversation archiving
- [ ] Add bulk message operations

## Architecture Notes

### Message Send Flow
1. User types message → Composer calls `sendMessage` mutation
2. Mutation inserts `messages` row with status=QUEUED
3. Mutation fires send-sms Edge Function (non-blocking, fire-and-forget)
4. UI instantly shows message via Realtime INSERT event (cache patch)
5. Edge Function:
   - Loads conversation/contact/owned_number
   - Calls Twilio API with StatusCallback URL
   - Updates message: status=SENDING, message_sid, sent_at
6. Twilio delivers SMS and POSTs to twilio-status webhook
7. twilio-status validates signature, updates message: status=DELIVERED, delivered_at
8. UI instantly updates status via Realtime UPDATE event (cache patch)

### Realtime Subscriptions
- **MessageThread:** Subscribes to messages (INSERT/UPDATE) filtered by conversation_id + conversations UPDATE
- **ConversationList:** Subscribes to conversations (all events)
- **ChatDock:** Subscribes to messages INSERT (direction=INBOUND) for notifications

### Security
- send-sms: verify_jwt=ON (requires authenticated user)
- twilio-inbound: verify_jwt=OFF (validates Twilio signature instead)
- twilio-status: verify_jwt=OFF (validates Twilio signature instead)


