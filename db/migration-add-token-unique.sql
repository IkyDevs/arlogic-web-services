-- =====================================================
-- MIGRATION: Add UNIQUE constraint to service_orders.token
-- Date: 2026-07-11
-- Purpose: Prevent duplicate tokens and fix tracking validation
-- =====================================================

-- Step 1: Check for existing duplicate tokens
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT token, COUNT(*) as cnt
    FROM service_orders
    GROUP BY token
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE NOTICE 'WARNING: Found % duplicate tokens. These need to be fixed before adding UNIQUE constraint.', duplicate_count;
    
    -- List duplicate tokens
    RAISE NOTICE 'Duplicate tokens:';
    FOR token_rec IN 
      SELECT token, COUNT(*) as cnt
      FROM service_orders
      GROUP BY token
      HAVING COUNT(*) > 1
    LOOP
      RAISE NOTICE '  Token: %, Count: %', token_rec.token, token_rec.cnt;
    END LOOP;
  ELSE
    RAISE NOTICE 'No duplicate tokens found. Safe to proceed.';
  END IF;
END $$;

-- Step 2: Drop old non-unique index
DROP INDEX IF EXISTS idx_service_orders_token;

-- Step 3: Add UNIQUE constraint to token column
ALTER TABLE service_orders 
  DROP CONSTRAINT IF EXISTS service_orders_token_key,
  ADD CONSTRAINT service_orders_token_key UNIQUE (token);

-- Step 4: Create unique index for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_token_unique ON service_orders(token);

-- Step 5: Verify the constraint was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'service_orders_token_key' 
    AND contype = 'u'
  ) THEN
    RAISE NOTICE 'SUCCESS: UNIQUE constraint added to service_orders.token';
  ELSE
    RAISE EXCEPTION 'FAILED: UNIQUE constraint was not added';
  END IF;
END $$;

-- =====================================================
-- NOTES:
-- If duplicate tokens exist, you need to update them first:
-- 
-- UPDATE service_orders 
-- SET token = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 12))
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT id, token, ROW_NUMBER() OVER (PARTITION BY token ORDER BY created_at) as rn
--     FROM service_orders
--   ) sub WHERE rn > 1
-- );
-- =====================================================
