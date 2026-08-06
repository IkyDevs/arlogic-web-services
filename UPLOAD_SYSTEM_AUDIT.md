# Audit: Proses Upload Foto di Fitur Add Transaksi (Pengeluaran)

**Date**: August 5, 2026
**Status**: Complete End-to-End Analysis
**Scope**: Foto upload dalam fitur Pengeluaran Form

---

## 1. OVERVIEW ARSITEKTUR

Sistem upload foto menggunakan **centralized upload service** dengan flow dua-fase:
- **Fase 1 (Client)**: User memilih foto → validasi → kompresi → simpan ke IndexedDB
- **Fase 2 (Server)**: Submit form → buat session → signed URLs → upload ke Supabase → proses background via queue

### Key Components:
```
UI: PengeluaranForm.tsx
  ↓
Hook: useCentralUpload.ts
  ↓
Service: UploadService (upload-service.ts)
  ├── Validator (upload-validator.ts)
  ├── Compressor (upload-compressor.ts)
  ├── IndexedDB Storage (indexeddb-storage.ts)
  └── Legacy Upload (untuk legacy endpoint)
  ↓
API Routes:
  ├── /api/upload (legacy multipart - deprecated)
  ├── /api/upload/session (create session)
  ├── /api/upload/complete (finalize)
  └── /api/photos/[id] (retrieval & proxy)
```

---

## 2. FLOW DETAIL PENGGUNA

### 2.1 User Interaction (UI Layer)

**File**: `components/layanan/PengeluaranForm.tsx`

**Proses**:
1. User klik "Add Photo" → file input dialog
2. User pilih 1 atau lebih foto
3. Handler: `handlePhotoSelect()` dipicu
4. Foto divalidasi sebagai `image/*` type
5. Panggil `upload.addFiles(rawFiles)` via hook
6. Foto preview ditampilkan (`photoPreviews` state)
7. User bisa remove foto individual sebelum submit

**State Management**:
- `formData`: item name, handler, payment method, nominal, notes
- `photoPreviews`: array of blob URLs untuk preview
- `uploadKey`: stabil key untuk session recovery (digunakan saat edit juga)
- `loading`: indikator submit sedang proses

**Draft Auto-Save**:
- Text fields → `saveDraftTextSync()` immediately
- Foto → `saveDraft()` with debounce 2s (ke IndexedDB)
- Draft recovery saat form mount jika ada draft sebelumnya

---

## 3. CLIENT-SIDE PROCESSING

### 3.1 useCentralUpload Hook

**File**: `hooks/useCentralUpload.ts`

**Tanggung Jawab**:
- Manage state untuk pending files, session, progress
- Orchestrate upload lifecycle
- Handle IndexedDB recovery saat page reload
- Provide API untuk UI components

**State Variables**:
- `pendingFiles[]`: Array foto pending (ready/pending/error)
- `sessionId`: ID dari upload session setelah submit
- `uploadSession`: Response dari session creation
- `uploading`: Flag upload sedang berlangsung
- `progress`: % progress 0-100
- `errors[]`: Koleksi error messages
- `success`: Upload berhasil
- `mountedRef`: Prevent state update saat unmounted

**Methods**:
- `addFiles()`: Tambah foto, validasi, kompresi, simpan IndexedDB
- `removeFile()`: Hapus foto individual dari pending
- `clear()`: Clear session (IndexedDB + memory)
- `submit()`: Submit form + buat upload session
- `uploadToSupabase()`: Upload ke Supabase via signed URLs
- `completeSession()`: Finalize upload session
- `legacyUpload()`: Direct upload (temp fallback)

**Mount/Unmount Handling**:
```typescript
useEffect(() => {
  mountedRef.current = true
  return () => { mountedRef.current = false }
}, [])

// All state updates gated by: if (mountedRef.current) setState(...)
// Prevents: "Can't perform a React state update on an unmounted component"
```

### 3.2 UploadService (Central Logic)

**File**: `lib/upload/upload-service.ts`

**Single Responsibility**: Orkestrasi upload dari addFiles sampai complete

**Tahap 1: addFiles()**
```
Input: File[], sessionKey
├─ Cek duplikat dengan existing pending files
├─ Validate:
│  ├ Max files check (default 20)
│  ├ MIME type check
│  ├ File size check (15MB per file default)
│  ├ Total size check (100MB default)
│  └─ Corrupt image check (load image di memory)
├─ Compress each file:
│  ├─ Target 1MB per file (via compressToTarget())
│  ├─ Smart quality degradation (80% → 72%)
│  └─ Auto-downscale 1920px max
├─ Save to IndexedDB:
│  ├─ Files storage (key: ${sessionKey}_${fileId})
│  └─ Metadata storage (key: meta_${sessionKey})
└─ Return: { files[], errors[] }
```

**Tahap 2: submit()**
```
Input: sessionKey, formData
├─ Get pending files dari Map
├─ Final compression pass (via generator)
├─ POST /api/upload/session with metadata
│  ├─ transaction_type
│  ├─ transaction_id
│  ├─ files[] (filename, size, mime)
│  └─ created_by (userId)
├─ Receive: { session_id, signed_urls[], upload_file_ids[] }
└─ Return: CreateSessionResponse
```

**Tahap 3: uploadToSupabase()**
```
Input: session, files[]
├─ Loop signed URLs
├─ PUT each file to signed URL (Supabase)
│  ├─ Header: Content-Type
│  ├─ Header: x-upsert=true
│  └─ Body: file blob
├─ Track progress (completed/total)
└─ Return: { success, errors[] }
```

**Tahap 4: completeSession()**
```
POST /api/upload/complete
├─ Trigger background queue worker
├─ Finalize metadata
└─ Return: { session_id, status }
```

### 3.3 Validation & Compression

**Files**: `upload-validator.ts`, `upload-compressor.ts`

**Validation**:
- File count vs max (20)
- MIME type: image/jpeg, image/png, image/webp, image/heic, image/heif
- Individual file size: 15MB
- Total size: 100MB (20 files × 5MB rata-rata)
- Duplicate detection (by name + size)
- Corrupt check: try load image in memory, timeout 10s

**Compression Strategy**:
1. **HEIC/HEIF Conversion**: Canvas API or heic2any WASM
2. **Smart Quality Degradation**:
   - Tahap 1: 92% quality, resize 1920px max
   - Tahap 2: turun 88% → 84% → 78% → 72% (sampai ≤ target)
3. **Result**: ~1MB per file (quality tetap bagus)

### 3.4 IndexedDB Storage

**File**: `lib/upload/indexeddb-storage.ts`

**Database**: `arlogic-uploads`

**Object Stores**:
1. **files**: Key=`${sessionKey}_${fileId}`, Value=File blob
   - Persist files across page reload
   - Auto-expire via cleanup job
2. **metadata**: Key=`meta_${sessionKey}`, Value=metadata object
   - Menyimpan: file IDs, names, sizes, types, status

**Why IndexedDB?**:
- Browser memory limited (~50MB per tab)
- Local storage max ~10MB
- IndexedDB unlimited (praktis gigabytes)
- Survive page reload
- Async API (tidak block main thread)

**Draft Recovery Flow**:
```
User refresh page
  ↓ (PengeluaranForm mount)
  ↓ useCentralUpload.recover(sessionKey)
    ├─ Get metadata from IndexedDB (meta_${key})
    ├─ Loop files: getFileFromIndexedDB(${key}_${id})
    ├─ Recreate blob URLs
    └─ Restore pendingFiles state
  ↓ User dapat lanjut dari sebelumnya (fotnya sudah ada)
```

---

## 4. SERVER-SIDE PROCESSING


### 4.1 Session Creation API

**File**: `app/api/upload/session/route.ts`

**Request Format**:
```json
{
  "transaction_type": "layanan",
  "transaction_id": "uuid or temp_id",
  "files": [
    {
      "filename": "photo.jpg",
      "file_size": 1048576,
      "mime_type": "image/jpeg"
    }
  ],
  "caption": "optional caption",
  "created_by": "user_id"
}
```

**Processing**:
1. CSRF validation via `validateOrigin()`
2. Rate limit check via `rateLimitIP()`
3. Validate transaction_type (enum)
4. Call `createSession()` → DB insert:
   - `id` (uuid)
   - `transaction_type`
   - `transaction_id`
   - `status` = 'WAITING'
   - `total_files`
   - `created_by`
5. Call `createUploadFiles()` → DB insert per file:
   - Per-file record untuk tracking
   - `status` = 'PENDING'
6. Call `generateSignedUploadUrls()` → Supabase signed URLs:
   - S3-compatible signed URLs (valid 1 hour)
   - Pre-signed untuk PUT requests
   - Path: `uploads/${session_id}/${file_id}`
7. Optional: `savePhotoCaption()` jika ada caption

**Response**:
```json
{
  "session_id": "uuid",
  "transaction_id": "id_yang_dikirim_client",
  "transaction_type": "layanan",
  "signed_urls": [
    {
      "file_id": "uuid",
      "signed_url": "https://supabase.../uploads/...",
      "filename": "photo.jpg",
      "public_url": "https://photos.arlogic.com/..."
    }
  ],
  "upload_file_ids": ["uuid1", "uuid2"],
  "duration_ms": 150
}
```

### 4.2 File Upload to Supabase

**Flow** (dari hook `uploadToSupabase()`):
```typescript
for each signedUrl:
  ├─ fetch(signedUrl, {
  │    method: 'PUT',
  │    body: file.blob,
  │    headers: {
  │      'Content-Type': 'image/jpeg',
  │      'x-upsert': 'true'
  │    }
  │  })
  ├─ Handle response (200 = success, else error)
  └─ Track progress: completed/total
```

**Why x-upsert=true**?
- Jika file sudah ada (race condition), replace
- Atomic operation (tidak partial overwrite)

### 4.3 Legacy API Route (Deprecated)

**File**: `app/api/upload/route.ts`

**⚠️ DEPRECATED**: Being phased out in favor of session-based flow

**What it does** (still in use):
1. Accept multipart FormData dengan files[]
2. Compress files > 2MB via sharp (1920px, quality 80)
3. Upload ke Telegram via `uploadMultipleToTelegram()`
4. Return URLs (Telegram CDN + Worker proxy)

**Issues dengan legacy flow**:
- ❌ Files tidak tersimpan ke Supabase database
- ❌ Tidak ada retry mechanism
- ❌ Chat masalah jika Telegram down
- ❌ Bandwidth sia-sia: Vercel → Telegram → Worker proxy
- ✅ Masih digunakan untuk backward compatibility

---

## 5. DATABASE INTEGRATION

### 5.1 Upload Session Tables

**Tables** (Supabase PostgreSQL):
- `upload_sessions`: Track session lifecycle
- `upload_files`: Per-file metadata + status
- `upload_audit_logs`: Event logging
- `photo_captions`: Optional captions per photo

**Sample Schema** (inferred dari code):
```sql
CREATE TABLE upload_sessions (
  id UUID PRIMARY KEY,
  transaction_type VARCHAR(50),
  transaction_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'WAITING',
  created_by UUID,
  total_files INT,
  completed_files INT DEFAULT 0,
  metadata JSONB,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE upload_files (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES upload_sessions,
  filename VARCHAR(255),
  file_size BIGINT,
  mime_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'PENDING',
  supabase_path VARCHAR(500),
  telegram_file_id VARCHAR(255),
  telegram_chat_id VARCHAR(50),
  telegram_message_id BIGINT,
  error_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 5.2 Pengeluaran/Layanan Table

**File Reference** (dalam PengeluaranForm):
```typescript
const result = await supabase
  .from("layanan")
  .insert([{
    customer_name: formData.item_name,
    jenis_layanan: "pengeluaran",
    handled_by: formData.handled_by,
    metode_pembayaran: formData.metode_pembayaran,
    nominal: parseInt(formData.nominal),
    photo_url: photoUrls[0] || null,           // PRIMARY PHOTO
    photo_urls: photoUrls,                     // ALL PHOTOS ARRAY
    upload_session_key: uploadKey,             // SESSION KEY FOR RECOVERY
    created_by: user?.id,
    created_at: now
  }])
```

**Key Fields**:
- `photo_url`: String (single URL, backward compat)
- `photo_urls`: Array (multiple URLs)
- `upload_session_key`: String (untuk recovery data dari IndexedDB)

---

## 6. PHOTO RETRIEVAL & PROXY

### 6.1 Photo API Endpoint

**File**: `app/api/photos/[id]/route.ts`

**Kode ID**: Bisa langsung photo ID atau transaction ID

**Retrieval Order**:
1. Try query `photos` table (jika ada cached)
2. Fallback: query `service_documentation` table
3. Try Telegram CDN (via file_id):
   - `GET /api/telegram/getFile?file_id=...`
   - Redirect ke Telegram CDN
4. Fallback: base64 dari database (photo_data column)

**Caching**:
- Telegram CDN: 1 hour cache
- Base64 fallback: 1 day cache

---

## 7. SECURITY & VALIDATION

### 7.1 Client-Side Validation
✅ MIME type check (image/jpeg, image/png, image/webp, image/heic, image/heif)
✅ File size limit (15MB individual, 100MB total)
✅ Corrupt image check (load in memory)
✅ Duplicate detection (name + size)

### 7.2 Server-Side Validation
✅ CSRF token validation (`validateOrigin()`)
✅ Rate limiting per IP (`rateLimitIP()`)
✅ Transaction type enum validation
✅ Content-Length header check
✅ Multipart form data size limit (4× max file size)

### 7.3 Signed URL Security
✅ Signed URLs dari Supabase (pre-signed PUT requests)
✅ Expiry: 1 hour (tidak bisa digunakan selamanya)
✅ S3-compatible: standard AWS Signature V4
✅ Browser PUT tidak butuh server intermediary

### 7.4 Potential Issues

🔴 **ISSUE 1: Race Condition pada Transaction ID**
- Pengeluaran di-insert SEBELUM foto selesai upload
- Jika upload gagal di tengah, data pengeluaran sudah ada di DB tapi foto incomplete
- **Risk**: Orphaned transactions tanpa foto

🔴 **ISSUE 2: IndexedDB Size Limit**
- Browser IndexedDB bisa sampai gigabytes, tapi tidak dijamin
- Tidak ada cleanup job untuk old drafts
- **Risk**: Local storage bisa penuh jika draft banyak

🔴 **ISSUE 3: Session Key Tidak Tervalidasi**
- Upload session key disimpan di DB tapi tidak ada validation
- Bisa di-exploit untuk recovery session orang lain
- **Risk**: Privacy issue jika session key guessable

🔴 **ISSUE 4: Legacy API Still Active**
- `/api/upload` (legacy) masih endpoint public
- Bisa digunakan langsung, bypass session flow
- **Risk**: Inconsistent state jika ada fallback code

---

## 8. PERFORMANCE & OPTIMIZATION

### 8.1 Compression Strategy
- **2-Phase Compression**:
  - Phase 1: saat addFiles (target 1MB)
  - Phase 2: final sebelum submit (generic)
- **Benefits**: Reduce bandwidth, faster upload, smaller storage

### 8.2 Parallel Processing
- Multiple files processed in parallel (Promise.all)
- IndexedDB write tidak blocking
- File download (fetch) concurrent

### 8.3 Progress Tracking
- Per-file progress via onProgress callback
- Client dikasih: completed/total count
- UI update setiap file done

---

## 9. ERROR HANDLING

### 9.1 Client-Side Errors
```typescript
if (!rawFiles.length) → skip (no-op)
if (duplicate found) → error toast "sudah ditambahkan"
if (validation failed) → error toast per reason
if (corrupted) → error toast "file corrupt"
if (compress failed) → use original (graceful)
```

### 9.2 Server-Side Errors
```
400 No files → "Tidak ada file yang diupload"
413 Too large → "Request terlalu besar"
429 Rate limit → "Too many requests"
403 CSRF fail → "Forbidden"
500 Session fail → "Gagal membuat session"
502 Telegram fail → "Foto gagal dikirim"
504 Timeout → "Koneksi timeout, coba lagi"
```

### 9.3 Recovery Mechanisms
- ✅ Draft recovery via IndexedDB
- ✅ Auto-retry via retry() method
- ⚠️ No automatic retry for failed uploads (manual only)
- ⚠️ No dead letter queue untuk failed batches

---

## 10. RECOMMENDATIONS & IMPROVEMENTS

### HIGH PRIORITY

**1. Fix Race Condition (Transaction Before Photos)**
```
Current: Insert layanan → upload fotos
Should: Upload fotos → Insert layanan dengan photo URLs
Or: Insert layanan in draft state, update setelah upload complete
```

**2. Validate Session Key**
```
Add session key validation:
- Check format (UUID or approved pattern)
- Check ownership (user_id match)
- Check expiry (TTL)
```

**3. Deprecate Legacy API**
```
- Remove /api/upload legacy endpoint
- Force all uploads through /api/upload/session
- Add feature flag if needed for transition
```

**4. Add Retry Queue**
```
- Failed uploads → automatically retry (exponential backoff)
- Dead letter queue untuk persistent failures
- Admin dashboard untuk monitoring
```

### MEDIUM PRIORITY

**5. Clean Up IndexedDB**
```
- Add TTL tracking per session
- Auto-cleanup old sessions (> 7 days)
- User-triggered cleanup button
```

**6. Enhanced Progress Reporting**
```
- Per-file % progress
- Estimated time remaining
- Network speed indicator
```

**7. Batch Upload Optimization**
```
- Chunked upload untuk large files (> 50MB)
- Resume capability jika interrupted
```

### LOW PRIORITY

**8. Analytics**
```
- Track: avg upload size, duration, success rate
- Identify bottlenecks (compression? network? server?)
- Dashboard untuk insights
```

**9. Webhook Notifications**
```
- Notify when upload complete
- For integrations (Telegram, Slack, etc)
```

---

## 11. TESTING CHECKLIST

- [ ] Add photo → preview muncul
- [ ] Remove photo → preview hilang
- [ ] Page refresh → draft restored
- [ ] Submit → transaction di DB dengan photo URLs
- [ ] Photo click → proxy endpoint bekerja
- [ ] Upload > 2MB → compressed tanpa error
- [ ] Upload HEIC → converted to JPEG
- [ ] Duplicate photo → error "sudah ditambahkan"
- [ ] Max 20 files → error jika > 20
- [ ] Network offline → graceful error
- [ ] Large file → upload timeout handling
- [ ] Concurrent uploads → tidak race condition

---

## 12. KEY FILES SUMMARY

| File | Lines | Purpose |
|------|-------|---------|
| PengeluaranForm.tsx | ~850 | UI form + draft save |
| useCentralUpload.ts | ~380 | React hook + state |
| upload-service.ts | ~550 | Core upload logic |
| upload-validator.ts | ~100 | File validation |
| upload-compressor.ts | ~220 | HEIC + compression |
| indexeddb-storage.ts | ~150 | Browser storage |
| /api/upload/session | ~200 | Session creation |
| /api/photos/[id] | ~100 | Photo retrieval |

**Total LOC**: ~2,500 lines spread across 20+ files

---

## 13. CONCLUSION

**Sistem Upload Summary**:
✅ Centralized architecture (good separation of concerns)
✅ Two-phase flow (client validation + server processing)
✅ IndexedDB persistence (draft recovery)
✅ Compression optimization (bandwidth efficient)
✅ Validation at multiple layers (security)

**Gaps**:
❌ Race condition: transaction created before photos uploaded
❌ No automatic retry for failed uploads
❌ Session key validation missing
❌ Legacy API not deprecated
❌ IndexedDB cleanup not automated

**Next Steps**:
1. Fix race condition (HIGH)
2. Add session key validation (HIGH)
3. Deprecate legacy API (MEDIUM)
4. Implement auto-retry (MEDIUM)
5. Add IndexedDB cleanup (MEDIUM)
