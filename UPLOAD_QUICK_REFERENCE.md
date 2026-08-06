# Upload System Quick Reference

## Architecture Quick Summary

```
UI Form → useCentralUpload Hook → UploadService → API Routes → Database
   ↓                  ↓                  ↓
PengeluaranForm    React State      Client Logic      /api/upload/*
                    (pending,        (compress,       Supabase
                    progress)        validation)      Telegram
                                     IndexedDB
```

---

## File Locations & Responsibilities

| Layer | File | What It Does |
|-------|------|-------------|
| **UI** | `components/layanan/PengeluaranForm.tsx` | Photo selection, form fields, submission |
| **State** | `hooks/useCentralUpload.ts` | React state + lifecycle management |
| **Logic** | `lib/upload/upload-service.ts` | Core: validate, compress, session, upload |
| **Storage** | `lib/upload/indexeddb-storage.ts` | Browser file persistence |
| **Validation** | `lib/upload/upload-validator.ts` | File type, size, corruption checks |
| **Compression** | `lib/upload/upload-compressor.ts` | HEIC→JPEG, smart quality reduction |
| **Config** | `lib/upload/upload-config.ts` | All tuneable parameters (max files, sizes, etc) |
| **API (Session)** | `app/api/upload/session/route.ts` | Create session, generate signed URLs |
| **API (Legacy)** | `app/api/upload/route.ts` | ⚠️ Old endpoint (deprecated) |
| **API (Photos)** | `app/api/photos/[id]/route.ts` | Photo retrieval + proxy logic |

---

## Key Flows

### Adding Photos
```
File Input
  ↓
upload.addFiles(files)
  ├─ Validate (type, size, duplicate, corrupt)
  ├─ Compress (1MB target via sharp)
  ├─ Save to IndexedDB (file blob + metadata)
  └─ Return files[], errors[]
  ↓
Show previews + allow remove
```

### Submitting
```
Form Submit Button
  ↓
upload.submit()
  ├─ POST /api/upload/session
  │  └─ Server: Create DB records + signed URLs
  ├─ Store sessionId + URLs in state
  └─ Return session
  ↓
upload.uploadToSupabase(session)
  ├─ Loop signed URLs
  ├─ PUT each file to Supabase
  └─ Track progress
  ↓
upload.completeSession()
  ├─ POST /api/upload/complete
  └─ Trigger background worker
  ↓
Show success → Clear form → Close
```

### Draft Recovery
```
Page Reload
  ↓
useCentralUpload.recover(sessionKey)
  ├─ Query IndexedDB metadata
  ├─ Load file blobs from IndexedDB
  ├─ Create blob URLs for preview
  └─ Restore pendingFiles state
  ↓
User can continue from where they left off
```

---

## Configuration

**File**: `lib/upload/upload-config.ts`

```typescript
export const uploadServiceConfig = {
  maxFiles: 20,                    // UPLOAD_MAX_FILES
  maxSizeMB: 15,                   // UPLOAD_MAX_SIZE_MB
  maxTotalSizeMB: 100,             // UPLOAD_MAX_TOTAL_SIZE_MB
  compressTargetKB: 1024,          // UPLOAD_COMPRESS_TARGET_KB
  compressQuality: 80,             // UPLOAD_COMPRESS_QUALITY (%)
  compressMaxDimension: 1920,      // UPLOAD_COMPRESS_MAX_DIM
  allowedTypes: [                  // UPLOAD_ALLOWED_TYPES
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ],
  supabaseBucket: 'uploads',       // UPLOAD_SUPABASE_BUCKET
  telegramRetryCount: 3,           // UPLOAD_TELEGRAM_RETRY
  cleanupTTLHours: 24,             // UPLOAD_CLEANUP_TTL_HOURS
}
```

**Override via ENV vars** (on server):
```bash
UPLOAD_MAX_FILES=50
UPLOAD_MAX_SIZE_MB=20
UPLOAD_COMPRESS_QUALITY=85
```

---

## State Structure (useCentralUpload)

```typescript
interface UseCentralUploadReturn {
  // Input/Output
  pendingFiles: PendingFile[]        // files selected, ready to upload
  sessionId: string | null           // after submit
  uploadSession: CreateSessionResponse | null
  
  // UI State
  uploading: boolean                 // during upload
  progress: number                   // 0-100
  errors: string[]                   // error messages
  success: boolean                   // upload complete
  
  // Methods
  addFiles(files: File[])             // add photos + validate + compress
  removeFile(id: string)              // remove single photo
  clear()                             // clear all photos
  recover(sessionKey)                 // recover from IndexedDB
  submit(options)                     // create session
  uploadToSupabase(session, files)    // upload to Supabase
  completeSession(sessionId)          // finalize
  legacyUpload(files, type)           // ⚠️ fallback only
}
```

---

## Database Schema (Key Tables)

### upload_sessions
```sql
id, transaction_type, transaction_id, status, created_by,
total_files, completed_files, error_message, retry_count,
created_at, updated_at
```

### upload_files
```sql
id, session_id, filename, file_size, mime_type, status,
supabase_path, telegram_file_id, telegram_chat_id,
telegram_message_id, error_message, created_at, updated_at
```

### layanan (Expenses)
```sql
id, customer_name, jenis_layanan ('pengeluaran'),
handled_by, metode_pembayaran, nominal,
photo_url (single), photo_urls (array),
upload_session_key (for recovery),
created_by, created_at
```

---

## Error Codes & Messages

| Scenario | Message | Action |
|----------|---------|--------|
| No file selected | (silent skip) | - |
| Wrong MIME type | "bukan format gambar yang didukung" | Reject file |
| File > 15MB | "terlalu besar (max 15MB)" | Reject file |
| Total > 100MB | "Total ukuran terlalu besar" | Reject batch |
| Duplicate found | "sudah ditambahkan (duplicate)" | Reject |
| Corrupted image | "file corrupt atau tidak dapat dibaca" | Reject |
| > 20 files | "Maksimal 20 foto per upload" | Reject |
| CSRF failed | `403 Forbidden` | Generic error |
| Rate limited | `429 Too Many Requests` | Retry after 60s |
| Session failed | `500 Internal Server Error` | Generic error |
| Network timeout | "Koneksi tidak stabil. Coba lagi." | Retry or manual |

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| File size after compression | ~1MB per photo | Varies by original |
| Session creation | < 200ms | DB + API roundtrip |
| Supabase upload | 2-5 Mbps | Depends on network |
| Total upload time (3 × 1MB) | 5-10s | Parallel upload |
| IndexedDB save | < 100ms | Per file |
| Draft recovery | < 500ms | IndexedDB query + blob URLs |

---

## Common Issues & Fixes

### Issue 1: "Foto tidak muncul di preview"
**Cause**: File validation failed silently
**Fix**: Check browser console for errors, verify MIME type

### Issue 2: "Upload stuck at 50%"
**Cause**: Network timeout or Supabase down
**Fix**: Manual retry, or check Supabase status

### Issue 3: "Form data hilang saat reload"
**Cause**: Draft not saved or expired (> 24h)
**Fix**: Restart form, re-enter data

### Issue 4: "IndexedDB quota exceeded"
**Cause**: Too many old drafts accumulated
**Fix**: Clear browser storage, or implement cleanup

### Issue 5: "Transaction created but no photos"
**Cause**: Race condition (DB insert before upload complete)
**Fix**: Check photo URLs in DB, re-upload if missing

---

## Testing Checklist

```
[ ] Add single photo → preview appears
[ ] Add multiple photos (3) → all previews show
[ ] Remove photo → preview disappears
[ ] Photo > 15MB → error message
[ ] Total > 100MB → error message
[ ] HEIC file → auto-converts to JPEG
[ ] Page refresh → draft restored
[ ] Submit form → transaction created in DB
[ ] Verify photo_urls in DB have correct count
[ ] Photo retrieval endpoint works (click preview)
[ ] Network offline → graceful error
[ ] Concurrent submissions → no race condition
[ ] Legacy /api/upload still works
```

---

## Debugging Tips

### Enable Upload Logs
```typescript
// In upload-config.ts or environment
NODE_ENV=development  // Enables isDev mode

// Logs printed in:
// - UploadService (console)
// - useCentralUpload (console)
// - /api/upload/session (console)
// - IndexedDB operations (console)
```

### Check IndexedDB
```javascript
// In browser DevTools > Application > IndexedDB

// View stored files:
db = await new Promise(r => indexedDB.open('arlogic-uploads').onsuccess = (e) => r(e.target.result))
files_store = db.transaction('files').objectStore('files')
files_store.getAll().onsuccess = (e) => console.log(e.target.result)

// View metadata:
meta_store = db.transaction('metadata').objectStore('metadata')
meta_store.getAll().onsuccess = (e) => console.log(e.target.result)
```

### Check API Response
```javascript
// POST /api/upload/session
fetch('/api/upload/session', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    transaction_type: 'layanan',
    transaction_id: 'test123',
    files: [{filename: 'test.jpg', file_size: 100000, mime_type: 'image/jpeg'}],
    created_by: 'user123'
  })
}).then(r => r.json()).then(console.log)
```

---

## Future Improvements (Priority Order)

### HIGH
1. **Fix race condition** - Foto harus selesai upload sebelum DB transaction selesai
2. **Add retry queue** - Auto-retry failed uploads dengan exponential backoff
3. **Session key validation** - Prevent unauthorized session recovery

### MEDIUM
4. **IndexedDB cleanup** - Auto-delete drafts > 7 days old
5. **Chunked upload** - Support > 100MB files via chunked transfer
6. **Upload analytics** - Track failures, avg time, bottlenecks

### LOW
7. **Webhook notifications** - Alert on upload complete
8. **Pause/Resume** - Stop upload mid-way and resume later
9. **Drag-and-drop** - Alternative to file input
