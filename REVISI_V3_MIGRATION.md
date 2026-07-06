# Revisi v3 - Database Migration Guide

## Overview
Revisi v3 menambahkan beberapa fitur baru yang memerlukan perubahan schema database minimal. Mayoritas fitur baru berjalan dengan schema yang sudah ada.

## Required Database Changes

### 1. Add `photo_urls` Column to `layanan` Table ⚠️ REQUIRED

**Purpose:** Support multiple photos per transaction (Task #1, #9, #10)

**Steps:**

1. **Option A: Using Supabase Dashboard (Recommended for beginners)**
   - Masuk ke [Supabase Dashboard](https://app.supabase.com)
   - Pilih project Anda
   - Buka SQL Editor
   - Copy & paste konten dari file `migrations/add_photo_urls_to_layanan.sql`
   - Klik "Run"

2. **Option B: Using Supabase CLI**
   ```bash
   supabase db push
   ```

3. **Option C: Manual SQL Execution**
   ```sql
   ALTER TABLE public.layanan
   ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb;
   
   CREATE INDEX IF NOT EXISTS idx_layanan_status ON public.layanan(status);
   CREATE INDEX IF NOT EXISTS idx_layanan_created_at ON public.layanan(created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_layanan_handled_by ON public.layanan(handled_by);
   ```

**Verification:**
```sql
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'layanan';
```

Should show: `photo_urls | jsonb`

---

## Schema Changes Summary

### Modified Tables

#### `layanan` Table
- ✅ **Added:** `photo_urls` (JSONB array) - stores array of photo URLs
- ✅ **Added:** Indexes for performance optimization
- ✅ **Compatible:** Existing `photo_url` (TEXT) column kept for backward compatibility
- ✅ **New Values:** `jenis_layanan` now accepts 'analog_digital' (no migration needed - it's enum value)

### No Changes Required For

- `profiles` - Already has `role` column with admin/teknisi/supervisor/owner values
- `service_orders` - No changes needed for Revisi v3
- `attendances` - No changes needed
- `inventory` - Theme changes are UI only
- `categories` - No changes
- `warranties` - No changes
- `feedbacks` - No changes
- `notifications` - No changes

---

## Feature Impact Analysis

### ✅ No Database Migration Needed For:

1. **Task #2 (Background Photo Upload)** 
   - Handled by updated upload hook & API
   - DB schema unchanged

2. **Task #3 (ANALOG-DIGITAL Type)**
   - Added to enum via TypeScript types
   - No migration needed (JSONB stores any string value)

3. **Task #4 (Role-Based Access)**
   - Uses existing `profiles.role` column
   - No migration needed

4. **Task #5 (Staff Filter)**
   - Uses existing `profiles` table
   - No migration needed

5. **Task #6 (Inventory Theme)**
   - UI changes only
   - No migration needed

6. **Task #7 (Revenue Display)**
   - Fixed query to use `layanan` table
   - No migration needed

7. **Task #8 (Telegram Integration)**
   - API integration only
   - No migration needed

8. **Task #9 (Confirmation Modal)**
   - UI changes only
   - No migration needed

9. **Task #10 (Consolidated Photos)**
   - Uses new `photo_urls` column (see above)
   - Requires Task #1 migration

10. **Task #11 (Upload Performance)**
    - Hook optimization only
    - No migration needed

---

## Migration Rollback (If Needed)

If you need to revert changes:

```sql
ALTER TABLE public.layanan 
DROP COLUMN IF EXISTS photo_urls;

DROP INDEX IF EXISTS idx_layanan_status;
DROP INDEX IF EXISTS idx_layanan_created_at;
DROP INDEX IF EXISTS idx_layanan_handled_by;
```

---

## Post-Migration Verification

Run this query to confirm everything is working:

```sql
-- Check schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'layanan'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'layanan';

-- Sample query (should return results)
SELECT id, customer_name, photo_urls 
FROM public.layanan 
WHERE status = 'completed' 
LIMIT 5;
```

---

## Troubleshooting

### Error: "column already exists"
- This is normal if migration was already run
- The `IF NOT EXISTS` clause prevents errors on re-run

### Photos not displaying in UI
- Verify `photo_urls` column exists with query above
- Check browser console for errors
- Ensure photos array is populated in database

### Performance issues
- Verify indexes were created (check post-migration query above)
- Consider analyzing table: `ANALYZE public.layanan;`

---

## Timeline

- **Duration:** 1-2 minutes for migration
- **Downtime:** None (all schema changes backward compatible)
- **Testing Required:** Yes (verify photo upload/view works)

---

## Next Steps

1. Run migration using Option A, B, or C above
2. Verify with post-migration query
3. Test photo upload in LayananForm
4. Test photo viewing in LayananList
5. Confirm no errors in browser console

---

**Questions?** Check schema.md for complete database structure documentation.
