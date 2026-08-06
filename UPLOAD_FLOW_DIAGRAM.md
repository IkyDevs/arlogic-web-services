# Upload Flow Diagram

## 1. HIGH-LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                     PENGELUARAN FORM (UI)                       │
│  - Photo selection via file input                               │
│  - Photo preview with remove button                             │
│  - Form data (item, handler, method, nominal)                  │
│  - Draft auto-save (text + photos)                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│              useCentralUpload Hook (React State)                 │
│  - pendingFiles[] state                                         │
│  - sessionId, uploadSession state                               │
│  - uploading, progress state                                    │
│  - Error handling                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│            UploadService (Client-Side Logic)                    │
│  - addFiles() → Validate → Compress → IndexedDB                │
│  - submit() → Create Session via API                           │
│  - uploadToSupabase() → PUT signed URLs                        │
│  - completeSession() → Finalize                                │
└────────────┬─────────────────────────────────┬──────────────────┘
             │                                 │
             ↓                                 ↓
      ┌─────────────────┐            ┌──────────────────┐
      │ IndexedDB       │            │ API Routes       │
      │ (Browser)       │            │ (Vercel/Node)    │
      │ - files store   │            │                  │
      │ - metadata      │            │ POST /session    │
      │ - draft cache   │            │ PUT signed URL   │
      └─────────────────┘            │ POST /complete   │
                                     └──────────────────┘
```

## 2. DETAILED USER JOURNEY

```
START: User opens Pengeluaran Form
  │
  ├─ Has Draft?
  │  ├─ YES → Restore from IndexedDB (photos + form data)
  │  └─ NO → Empty form
  │
  ├─ User selects 1+ photos
  │  │
  │  ├─ handlePhotoSelect() triggered
  │  ├─ Filter to image/* only
  │  └─ Call upload.addFiles(files)
  │      │
  │      ├─ Validate:
  │      │  ├─ Max 20 files
  │      │  ├─ Max 15MB per file
  │      │  ├─ Max 100MB total
  │      │  ├─ MIME type check
  │      │  └─ Corrupt image check
  │      │
  │      ├─ Compress (if > 1MB):
  │      │  ├─ HEIC → JPEG (if needed)
  │      │  ├─ Resize to 1920px
  │      │  └─ Quality 80% (turun sampai ≤ target)
  │      │
  │      ├─ Save to IndexedDB:
  │      │  ├─ File blob (key: ${sessionKey}_${id})
  │      │  └─ Metadata (key: meta_${sessionKey})
  │      │
  │      └─ Return: { files[], errors[] }
  │
  ├─ Show previews + remove buttons
  ├─ User fills form (item name, handler, etc)
  │  │
  │  └─ Auto-save every change:
  │     ├─ Text → immediate save (sync)
  │     └─ Photos → debounce 2s (async to IndexedDB)
  │
  ├─ User clicks Submit
  │  │
  │  ├─ Validate form (required fields)
  │  ├─ Show confirmation dialog
  │  │
  │  └─ User confirms
  │      │
  │      ├─ POST /api/upload/session
  │      │  ├─ Request body: transaction_type, transaction_id, files[], caption, created_by
  │      │  ├─ Server: Create DB records (session + files)
  │      │  ├─ Server: Generate signed URLs (Supabase)
  │      │  └─ Response: { session_id, signed_urls[], ... }
  │      │
  │      ├─ Update layanan table:
  │      │  ├─ INSERT or UPDATE
  │      │  ├─ Set: photo_url, photo_urls, upload_session_key
  │      │  └─ Get back: transaction ID
  │      │
  │      ├─ Upload files to Supabase:
  │      │  ├─ Loop signed_urls
  │      │  ├─ PUT each file
  │      │  ├─ Track progress
  │      │  └─ Handle errors per file
  │      │
  │      ├─ POST /api/upload/complete
  │      │  └─ Trigger background queue (Inngest)
  │      │
  │      ├─ Clear draft
  │      ├─ Show success toast
  │      └─ Close form / refresh list
  │
END
```

## 3. PHOTO VALIDATION & COMPRESSION FLOW

```
Input: Raw File from input[type=file]
  │
  ├─ TYPE CHECK
  │  ├─ file.type === 'image/jpeg' ? ✓
  │  ├─ file.type === 'image/png' ? ✓
  │  ├─ file.type === 'image/heic' ? 🔄 (needs conversion)
  │  └─ else → ✗ REJECT
  │
  ├─ SIZE CHECK
  │  ├─ file.size > 15MB ? ✗ REJECT
  │  ├─ file.size ≤ 15MB ? ✓ CONTINUE
  │  └─ Total pending + new > 100MB ? ✗ REJECT
  │
  ├─ DUPLICATE CHECK
  │  ├─ name + size already in pending ? ✗ REJECT
  │  └─ else ? ✓ CONTINUE
  │
  ├─ CORRUPT CHECK
  │  ├─ Create Image object
  │  ├─ Set src to blob URL
  │  ├─ onload → ✓ VALID (image can be rendered)
  │  ├─ onerror → ✗ REJECT
  │  └─ timeout 10s → ✗ REJECT
  │
  ├─ COMPRESSION (if size > 1MB)
  │  │
  │  ├─ HEIC CONVERSION (if HEIC/HEIF)
  │  │  ├─ Try: Canvas API (Safari/iOS)
  │  │  ├─ Fallback: heic2any WASM (Chrome/Android)
  │  │  └─ Result: JPEG
  │  │
  │  ├─ COMPRESSION LOOP
  │  │  ├─ Attempt 1: quality 92%, resize 1920px
  │  │  ├─ Check: if size ≤ target → DONE
  │  │  ├─ Attempt 2: quality 88%
  │  │  ├─ Attempt 3: quality 84%
  │  │  ├─ Attempt 4: quality 78%
  │  │  ├─ Attempt 5: quality 72%
  │  │  └─ Result: Best size ≤ target
  │  │
  │  └─ Result: Compressed File object
  │
  └─ OUTPUT: File (original or compressed)
```

## 4. SERVER-SIDE SESSION FLOW

```
CLIENT                                      SERVER
  │                                           │
  ├─ POST /api/upload/session                 │
  │  ├─ {transaction_type, transaction_id,    │
  │  │   files[], caption, created_by}        │
  │  │                                        │
  │  └────────────────────────────────────────┤─ Route Handler
  │                                           │  ├─ CSRF check
  │                                           │  ├─ Rate limit check
  │                                           │  └─ JSON parse
  │                                           │
  │                                           ├─ createSession()
  │                                           │  └─ INSERT DB: upload_sessions
  │                                           │     (id, transaction_type, status='WAITING')
  │                                           │
  │                                           ├─ createUploadFiles()
  │                                           │  └─ INSERT DB: upload_files (per file)
  │                                           │     (session_id, filename, status='PENDING')
  │                                           │
  │                                           ├─ generateSignedUploadUrls()
  │                                           │  └─ Supabase S3 API
  │                                           │     (Pre-signed PUT URLs, expiry 1hr)
  │                                           │
  │  ┌────────────────────────────────────────┤
  │  │ Response: {session_id, signed_urls[]}  │
  │  │ (200 OK)                               │
  │  │                                        │
  │  ├─ Store response in state               │
  │  │
  │  ├─ Loop signed_urls:                     │
  │  │  ├─ fetch(url, {                       │
  │  │  │    method: 'PUT',                   │
  │  │  │    body: file.blob,                 │
  │  │  │    headers: {                       │
  │  │  │      'Content-Type': 'image/jpeg',  │
  │  │  │      'x-upsert': 'true'             │
  │  │  │    }                                │
  │  │  │  })                                 │
  │  │  │                                     │
  │  │  └────────────────────────────────────┤ Supabase S3
  │  │                                        │ (Direct upload, no server)
  │  │                                        │ 200 OK → file stored
  │  │  (progress update per file)             │
  │  │
  │  ├─ All files uploaded? YES              │
  │  │                                        │
  │  ├─ POST /api/upload/complete            │
  │  │  └──────────────────────────────────────┤ Route Handler
  │  │                                        │  ├─ Update session status
  │  │                                        │  └─ Enqueue Inngest worker
  │  │                                        │
  │  │ ✓ Success toast                        │
  │  │ ✓ Clear draft                          │
  │  │ ✓ Close form                           │
  │
END
```

## 5. DATABASE SCHEMA RELATIONSHIPS

```
┌─────────────────────────┐
│ profiles                │
│ ───────────────────────│
│ id (UUID) ◄─┐          │
│ full_name   │          │
│ branch_id   │          │
└─────────────┼──────────┘
              │
              │ created_by
              │
┌─────────────┴──────────────────────┐
│ upload_sessions                    │
│ ──────────────────────────────────│
│ id (UUID) ◄─┐                      │
│ transaction_type                   │
│ transaction_id                     │
│ status (WAITING → QUEUED → ...)    │
│ created_by ─────┐                  │
│ total_files     │                  │
│ created_at      │                  │
└─────────────┬───┴──────────────────┘
              │ session_id
              │
┌─────────────┴──────────────────────┐
│ upload_files                       │
│ ──────────────────────────────────│
│ id (UUID)                          │
│ session_id ──────┐                 │
│ filename         │                 │
│ file_size        │                 │
│ mime_type        │                 │
│ status           │                 │
│ supabase_path    │                 │
│ telegram_file_id │                 │
│ created_at       │                 │
└──────────────────┴──────────────────┘

┌──────────────────────────────┐
│ layanan                      │
│ ──────────────────────────   │
│ id (UUID)                    │
│ jenis_layanan = 'pengeluaran'│
│ customer_name                │
│ handled_by (FK profiles)     │
│ photo_url (string)           │
│ photo_urls (array)           │
│ upload_session_key (string)  │
│ created_by (FK profiles)     │
│ created_at                   │
└──────────────────────────────┘
```

## 6. INDEXEDDB STRUCTURE

```
Database: arlogic-uploads (v1)

┌─────────────────────────────────────────────────────────┐
│ Object Store: "files"                                   │
│ ─────────────────────────────────────────────────────  │
│ Key: "${sessionKey}_${fileId}"                         │
│      Eg: "pengeluaran_user123_1234567890_abc123"      │
│ Value: File blob object                                │
│                                                         │
│ Examples:                                               │
│ • "pengeluaran_user123_1234567890_abc123" → File       │
│ • "pengeluaran_user123_1234567890_def456" → File       │
│ • "pengeluaran_user123_1234567890_ghi789" → File       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Object Store: "metadata"                                │
│ ─────────────────────────────────────────────────────  │
│ Key: "meta_${sessionKey}"                              │
│      Eg: "meta_pengeluaran_user123_1234567890"        │
│ Value: {                                                │
│   files: [                                              │
│     {                                                   │
│       id: "abc123",                                     │
│       name: "photo.jpg",                               │
│       size: 1048576,                                    │
│       type: "image/jpeg",                              │
│       status: "ready",                                 │
│       indexedDBKey: "pengeluaran_user123_..._abc123"   │
│     }                                                   │
│   ],                                                    │
│   timestamp: 1691000000000                             │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
```

## 7. ERROR PATHS

```
USER ACTION: Select & Upload Photo

├─ VALIDATION ERRORS
│  ├─ No file selected
│  │  └─ No action (skip)
│  │
│  ├─ Not image MIME type
│  │  └─ Toast: "File bukan gambar"
│  │
│  ├─ File corrupted
│  │  └─ Toast: "File corrupt atau tidak dapat dibaca"
│  │
│  ├─ File > 15MB
│  │  └─ Toast: "Terlalu besar (max 15MB)"
│  │
│  ├─ Total > 100MB
│  │  └─ Toast: "Total ukuran terlalu besar"
│  │
│  ├─ Already added (duplicate)
│  │  └─ Toast: "Sudah ditambahkan"
│  │
│  └─ Already 20 files
│     └─ Toast: "Maksimal 20 foto per upload"
│
├─ COMPRESSION ERRORS
│  ├─ HEIC conversion fails
│  │  └─ Use original file
│  │
│  └─ Sharp compression fails
│     └─ Use original file
│
├─ INDEXEDDB ERRORS
│  ├─ Quote exceeded
│  │  └─ Toast: "Storage penuh"
│  │
│  └─ Transaction fails
│     └─ Toast: "Gagal menyimpan"
│
├─ SUBMIT/SESSION ERRORS
│  ├─ CSRF validation fails
│  │  └─ 403 Forbidden → Toast: Generic error
│  │
│  ├─ Rate limited
│  │  └─ 429 Too Many → Toast: "Terlalu banyak request"
│  │
│  ├─ Invalid JSON
│  │  └─ 400 Bad Request → Toast: Generic error
│  │
│  ├─ Session creation fails
│  │  └─ 500 Internal → Toast: "Gagal membuat session"
│  │
│  └─ Network error
│     └─ Toast: "Gagal terhubung"
│
├─ UPLOAD ERRORS
│  ├─ File not found at index
│  │  └─ Error logged, skip file
│  │
│  ├─ Signed URL upload fails
│  │  └─ Add to errors[], continue
│  │
│  ├─ Timeout (> 120s)
│  │  └─ Toast: "Koneksi tidak stabil"
│  │
│  └─ Network disconnect
│     └─ Toast: "Gagal upload"
│
└─ COMPLETION ERRORS
   ├─ Complete endpoint fails
   │  └─ Toast: "Gagal menyelesaikan upload"
   │
   └─ Inngest queue full
      └─ Retry automatic (configurable)
```

## 8. STATE FLOW (useCentralUpload)

```
INITIAL STATE
  pendingFiles: []
  sessionId: null
  uploading: false
  progress: 0
  errors: []
  success: false
  ↓

USER SELECTS FILES
  addFiles() called
  → validateFiles()
  → validateCorrupted()
  → compress()
  → saveToIndexedDB()
  → setPendingFiles([...new files])
  ↓

PENDING STATE
  pendingFiles: [file1, file2, ...]  (status='ready')
  uploading: false
  ↓

USER SUBMITS FORM
  submit() called
  → setUploading(true)
  → POST /api/upload/session
  ↓

SESSION CREATED
  setSessionId(session.id)
  setUploadSession(session)
  setPendingFiles([...] status='pending')
  ↓

UPLOADING TO SUPABASE
  uploadToSupabase() called
  → setProgress updates per file (0 → 100)
  ↓

ALL UPLOADED
  completeSession() called
  → setSessionId(complete.session_id)
  setSuccess(true)
  ↓

FINAL STATE
  success: true
  errors: []
  pendingFiles: [...] (status='pending')
  → clear() called
  ↓

CLEARED STATE
  pendingFiles: []
  sessionId: null
  uploading: false
  progress: 0
  errors: []
  success: false
```

## 9. TIMELINE: Complete Workflow

```
T+0s     User opens Pengeluaran Form
         └─ Has draft? Recover from IndexedDB

T+1s     User selects 3 photos (5MB total)
         └─ Validate + Compress → 2MB
         └─ Save to IndexedDB (3 files)

T+2s     User fills form + submits
         └─ Validation + Confirmation dialog

T+3s     POST /api/upload/session
         └─ Server: Create session + files records
         └─ Response: signed_urls[]

T+4s     PUT file 1 to Supabase (via signed URL)
         └─ progress: 1/3

T+5s     PUT file 2 to Supabase
         └─ progress: 2/3

T+6s     PUT file 3 to Supabase
         └─ progress: 3/3

T+7s     POST /api/upload/complete
         └─ Enqueue Inngest worker

T+8s     Background worker processes
         └─ Download from Supabase
         └─ Send to Telegram
         └─ Update DB status

T+15s    Worker complete
         └─ Update session status: QUEUED → SUCCESS
         └─ UI shows success

Total: ~15 seconds (including background processing)
```
