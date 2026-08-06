# Database Migration Instructions

## How to Apply the Photo Status Migration

### Using Supabase CLI (Recommended)

```bash
# Navigate to project directory
cd /Users/arlogic/DEVELOPER/arlogic-web-services

# Push the migration to Supabase
npx supabase db push
```

This will execute all pending migrations in the `supabase/migrations/` folder.

### Manual Execution via Supabase Dashboard

If using Supabase dashboard:

1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy the SQL from `supabase/migrations/add_photo_status_to_layanan.sql`
4. Execute the query

### Checking Migration Status

```bash
# View migration history
npx supabase migration list

# Show details of a specific migration
npx supabase migration list --details
```

---

## What the Migration Does

### Adds `photo_status` Column to `layanan` Table

The new column tracks photo upload lifecycle with these values:

| Status | Meaning |
|--------|---------|
| `no_photo` | No photos to upload |
| `pending` | Photos are currently uploading |
| `completed` | Photos uploaded successfully |
| `failed` | Photo upload failed (can retry) |

### Creates Performance Indexes

1. **`idx_layanan_photo_status`** - For general queries filtering by status
2. **`idx_layanan_photo_status_created_at`** - For finding stuck pending uploads (used by reconciliation cron)

---

## Rollback (If Needed)

To rollback this migration:

```sql
DROP INDEX IF EXISTS public.idx_layanan_photo_status_created_at;
DROP INDEX IF EXISTS public.idx_layanan_photo_status;
ALTER TABLE public.layanan DROP COLUMN IF EXISTS photo_status;
```

---

## Related Changes

- **PengeluaranForm.tsx** - Now uses `photo_status` instead of `upload_status`
- **useCentralUpload.ts** - Added `retryPhotoUpload()` method for failed uploads
- **Reconciliation Cron** - Will query by `photo_status = 'pending'` to find stuck uploads

---

## Testing the Migration

After applying the migration:

```sql
-- Check if column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'layanan' AND column_name = 'photo_status';

-- Verify indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'layanan' AND indexname LIKE 'idx_layanan_photo%';
```

---

## Notes

- The `photo_status` field is nullable for backward compatibility
- Default value is `'no_photo'` for existing records without photos
- This is a non-breaking change - existing code continues to work
- The reconciliation cron job will use this field to find uploads stuck > 30 minutes
