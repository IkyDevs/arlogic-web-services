# Cron Job Setup Guide: Reconcile Photo Uploads

## Overview

The reconciliation cron job finds transactions stuck in 'pending' photo upload status (browser closed during upload) and marks them as 'failed' after 30 minutes so users can retry.

**Endpoint**: `GET /api/cron/reconcile-photo-uploads`

---

## Setup Options

### Option 1: Vercel Cron (Recommended - Easiest)

Vercel automatically handles cron scheduling. Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reconcile-photo-uploads",
      "schedule": "0 */15 * * * *"
    }
  ]
}
```

**Schedule Explanation**:
- `0 */15 * * * *` = Run every 15 minutes (adjust as needed)
- `0 */30 * * * *` = Run every 30 minutes
- `0 9 * * *` = Run once daily at 9 AM UTC

**How it works**:
- Vercel adds `X-Vercel-Cron: 1` header automatically
- No secret token needed (Vercel infrastructure secured)
- Logs available in Vercel dashboard

**Verify Setup**:
```bash
# Deploy to Vercel
vercel deploy

# Check cron logs in Vercel dashboard
# Settings → Crons
```

---

### Option 2: External Cron Service (Upstash, AWS, GCP)

If not using Vercel, use an external cron service.

#### Using Upstash (Recommended for external)

1. **Create account**: https://upstash.com/
2. **Create QStash receiver**:
   ```
   Name: photo-upload-reconcile
   URL: https://your-app.vercel.app/api/cron/reconcile-photo-uploads
   Schedule: 0 */15 * * * *
   ```
3. **Add CRON_SECRET to .env**:
   ```env
   CRON_SECRET=your-secret-token-here
   ```
4. **Deploy**: `vercel deploy`
5. **Test**: Upstash dashboard will show execution history

#### Using AWS EventBridge

1. **Create IAM role** with Lambda invoke permissions
2. **Create Lambda function**:
   ```javascript
   exports.handler = async (event) => {
     const response = await fetch('https://your-app.vercel.app/api/cron/reconcile-photo-uploads', {
       method: 'GET',
       headers: {
         'Authorization': `Bearer ${process.env.CRON_SECRET}`
       }
     });
     return response.json();
   };
   ```
3. **Create EventBridge rule**:
   - Rate: 15 minutes
   - Target: Above Lambda function
4. **Set environment variable**:
   ```
   CRON_SECRET = your-secret-token
   ```

#### Using Google Cloud Scheduler

1. **Create Cloud Scheduler job**:
   ```bash
   gcloud scheduler jobs create http photo-upload-reconcile \
     --schedule="*/15 * * * *" \
     --uri="https://your-app.vercel.app/api/cron/reconcile-photo-uploads" \
     --http-method=GET \
     --headers="Authorization=Bearer YOUR_CRON_SECRET"
   ```
2. **Add CRON_SECRET to environment**

---

## Environment Variables

Add to `.env.production` or deployment environment:

```env
# Cron secret for external services (not needed for Vercel)
CRON_SECRET=your-very-secure-random-token-here

# Supabase auth (already configured)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**Generate secure token**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Manual Testing

### Test via curl (local or production)

```bash
# Using Vercel (no auth needed, but requires X-Vercel-Cron header simulation)
curl -X GET \
  -H "X-Vercel-Cron: 1" \
  https://your-app.vercel.app/api/cron/reconcile-photo-uploads

# Using secret token
curl -X GET \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/reconcile-photo-uploads

# Or via query param
curl -X GET \
  "https://your-app.vercel.app/api/cron/reconcile-photo-uploads?secret=YOUR_CRON_SECRET"
```

### Test via script (Node.js)

```javascript
// test-cron.js
const CRON_URL = process.env.CRON_URL || 'http://localhost:3000/api/cron/reconcile-photo-uploads';
const CRON_SECRET = process.env.CRON_SECRET;

async function runCron() {
  const res = await fetch(CRON_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CRON_SECRET}`,
    },
  });
  const data = await res.json();
  console.log('Response:', data);
}

runCron().catch(console.error);
```

```bash
# Run test
CRON_SECRET=test-secret node test-cron.js
```

---

## Response Format

### Success (200)

```json
{
  "success": true,
  "reconciled": 3,
  "stuck_uploads": ["id1", "id2", "id3"],
  "timeout_minutes": 30,
  "duration_ms": 245,
  "message": "Reconciled 3 stuck uploads"
}
```

### No stuck uploads (200)

```json
{
  "success": true,
  "reconciled": 0,
  "duration_ms": 89,
  "message": "No stuck uploads found"
}
```

### Error (500)

```json
{
  "success": false,
  "error": "Failed to query stuck uploads: ...",
  "duration_ms": 150
}
```

### Unauthorized (401)

```json
{
  "error": "Unauthorized"
}
```

---

## Monitoring & Logging

### View logs in Vercel

1. Go to **Vercel Dashboard**
2. Select your project
3. Go to **Settings → Functions**
4. Click **Logs**
5. Filter by `/api/cron/reconcile-photo-uploads`

### View logs in application

All cron logs are prefixed with `[Reconcile-Upload-Cron]`:

```
[Reconcile-Upload-Cron] Starting reconciliation...
[Reconcile-Upload-Cron] Looking for uploads pending since before: 2026-08-05T10:00:00Z
[Reconcile-Upload-Cron] Found 5 stuck uploads
[Reconcile-Upload-Cron] Successfully marked 5 uploads as failed
[Reconcile-Upload-Cron] Reconciled: uuid-123 (John Doe), pending since 2026-08-05T10:15:00Z
```

### Database query to check results

```sql
-- Find uploads marked as failed by reconciliation (last 24 hours)
SELECT id, customer_name, photo_status, created_at, updated_at
FROM layanan
WHERE photo_status = 'failed'
  AND jenis_layanan = 'pengeluaran'
  AND updated_at > now() - interval '24 hours'
ORDER BY updated_at DESC;

-- Check for pending uploads still stuck
SELECT id, customer_name, photo_status, created_at, 
       now() - created_at AS stuck_for
FROM layanan
WHERE photo_status = 'pending'
  AND jenis_layanan = 'pengeluaran'
  AND created_at < now() - interval '30 minutes'
ORDER BY created_at ASC;
```

---

## Troubleshooting

### Cron not running on Vercel

**Check**:
1. Is `vercel.json` deployed? Check git push was successful
2. Are cron logs visible? Go to **Settings → Crons** in Vercel dashboard
3. Is the endpoint returning 200? Check response in logs

**Fix**:
- Redeploy: `vercel deploy --prod`
- Check endpoint manually: Visit URL in browser (will return 401 without header, but proves endpoint exists)

### Cron not calling external service

**Check**:
1. Is `CRON_SECRET` set in environment?
2. Is the URL correct and reachable?
3. Are you sending the correct Authorization header?

**Test**:
```bash
# Manual test
curl -X GET \
  -H "Authorization: Bearer <YOUR_SECRET>" \
  https://your-app.vercel.app/api/cron/reconcile-photo-uploads
```

### Uploads not being marked as failed

**Check database**:
```sql
-- See all pending uploads
SELECT id, customer_name, photo_status, created_at 
FROM layanan 
WHERE photo_status = 'pending';

-- Check if there are any stuck > 30 minutes
SELECT id, customer_name, 
       now() - created_at AS stuck_duration
FROM layanan
WHERE photo_status = 'pending'
  AND created_at < now() - interval '30 minutes';
```

**Fix**:
- Verify cron is running (check logs)
- Check Supabase connection (test manually in SQL editor)
- Increase timeout if needed (change `PENDING_TIMEOUT_MINUTES` in code)

---

## Adjusting Timeout

To change from 30 minutes to a different value:

**In code** (`app/api/cron/reconcile-photo-uploads/route.ts`):
```typescript
const PENDING_TIMEOUT_MINUTES = 60  // Change from 30 to 60
```

**Then redeploy**:
```bash
vercel deploy --prod
```

---

## Cost Estimates

### Vercel Cron
- **Cost**: FREE (included in Vercel plan)
- **Limit**: 25 cron invocations per month in Hobby plan, unlimited in Pro/Enterprise

### Upstash
- **Cost**: Free tier includes 100 requests/day (~3000/month)
- **Pro**: $5/month for more

### AWS Lambda + EventBridge
- **Cost**: ~$0.20/month for 2 invocations/hour (very cheap)
- **Setup complexity**: High

### Google Cloud Scheduler
- **Cost**: FREE (3 jobs limit), $0.60/month per job after
- **Setup complexity**: Medium

---

## Next Steps

1. **Choose deployment method** (Vercel recommended)
2. **Set CRON_SECRET** in environment variables
3. **Test manually** using curl or script above
4. **Monitor logs** for first few runs
5. **Verify database** shows uploads being marked as failed
6. **Configure alerts** (optional - Sentry, Datadog, etc.)

---

## Related Code

- **Endpoint**: `/app/api/cron/reconcile-photo-uploads/route.ts`
- **Migration**: `supabase/migrations/add_photo_status_to_layanan.sql`
- **Frontend**: `components/layanan/PengeluaranForm.tsx` (uses photo_status)
- **Hook**: `hooks/useCentralUpload.ts` (retryPhotoUpload method)
