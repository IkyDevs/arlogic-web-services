# Migration Instructions - Token Fix & Feedback Notification

## Date: 2026-07-11

## Overview
This migration fixes two critical issues:
1. **Token validation error** in tracking page
2. **Customer feedback notifications** now sent to owner dashboard

---

## Changes Made

### 1. Token Generation Improvements (`components/admin/ServiceInput.tsx`)

**Before:**
- Generated variable-length tokens (8-13 characters)
- No collision detection
- No error handling for duplicate tokens

**After:**
- Generates fixed 12-character alphanumeric tokens
- Checks for existing tokens before using
- Retries up to 5 times if collision detected
- Fallback to timestamp-based token if still colliding
- Added error handling for token conflicts (code 23505)

### 2. Database Schema Updates (`db/supabase-schema.sql`)

**Changed:**
```sql
-- BEFORE
token TEXT NOT NULL,
CREATE INDEX IF NOT EXISTS idx_service_orders_token ON service_orders(token);

-- AFTER  
token TEXT UNIQUE NOT NULL,
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_token ON service_orders(token);
```

### 3. Feedback Notifications (`app/tracking/[[...slug]]/page.tsx` & `app/feedback/[id]/page.tsx`)

**Before:**
- Sent notification without `user_id` (not visible to anyone)

**After:**
- Queries all users with role 'owner' or 'admin'
- Sends notification to each owner/admin user
- Notifications now appear in owner dashboard

---

## Database Migration Steps

### Step 1: Check for Duplicate Tokens

```sql
-- Run this query to check for duplicates
SELECT token, COUNT(*) as count
FROM service_orders
GROUP BY token
HAVING COUNT(*) > 1;
```

If duplicates exist, run the fix query in Step 2. If no duplicates, skip to Step 3.

### Step 2: Fix Duplicate Tokens (if any exist)

```sql
-- Update duplicate tokens with new unique values
UPDATE service_orders 
SET token = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 12))
WHERE id IN (
  SELECT id FROM (
    SELECT id, token, ROW_NUMBER() OVER (PARTITION BY token ORDER BY created_at) as rn
    FROM service_orders
  ) sub WHERE rn > 1
);
```

### Step 3: Apply Migration

Run the migration file in Supabase SQL Editor:

```bash
# File location: db/migration-add-token-unique.sql
```

Or manually run:

```sql
-- Drop old index
DROP INDEX IF EXISTS idx_service_orders_token;

-- Add UNIQUE constraint
ALTER TABLE service_orders 
  DROP CONSTRAINT IF EXISTS service_orders_token_key,
  ADD CONSTRAINT service_orders_token_key UNIQUE (token);

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_token_unique ON service_orders(token);
```

### Step 4: Verify Migration

```sql
-- Check constraint was added
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'service_orders'::regclass 
AND conname = 'service_orders_token_key';

-- Should return: service_orders_token_key | u
```

---

## Testing

### Test 1: Token Generation
1. Go to admin panel
2. Create a new service order
3. Verify token is exactly 12 characters
4. Check token appears in tracking URL

### Test 2: Token Validation
1. Open tracking page: `/tracking/{TOKEN}`
2. Enter the token from Step 1
3. Verify service details load correctly
4. Verify no "Token tidak valid" error

### Test 3: Feedback Notification
1. Complete a service order
2. Go to tracking page with token
3. Submit feedback with rating
4. Login as owner
5. Check owner dashboard → should see notification
6. Check Feedback tab → should see new feedback

### Test 4: Duplicate Token Prevention
1. Try to manually insert duplicate token in database
2. Should fail with unique constraint violation

---

## Rollback (if needed)

If issues occur, rollback with:

```sql
-- Remove unique constraint
ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_token_key;

-- Restore regular index
CREATE INDEX IF NOT EXISTS idx_service_orders_token ON service_orders(token);
```

Then revert code changes via git:
```bash
git revert HEAD
```

---

## Files Modified

1. ✅ `components/admin/ServiceInput.tsx` - Token generation & error handling
2. ✅ `app/tracking/[[...slug]]/page.tsx` - Feedback notifications to owners
3. ✅ `app/feedback/[id]/page.tsx` - Feedback notifications to owners
4. ✅ `db/supabase-schema.sql` - Added UNIQUE constraint on token
5. ✅ `db/migration-add-token-unique.sql` - Migration script (new file)

---

## Notes

- Build completed successfully ✓
- No TypeScript errors
- Token collision probability is extremely low (~1% at 51M orders)
- Fallback mechanism ensures service creation never fails due to token collision
- Owner dashboard will now receive all customer feedback notifications

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs for database errors
3. Verify migration was applied successfully
4. Check that owner role users exist in profiles table
