const DB_NAME = "arlogic-drafts";
const DB_VERSION = 1;
const STORE_NAME = "photos";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePhotoToIndexedDB(key: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(base64, key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function getPhotoFromIndexedDB(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => { db.close(); resolve(req.result || null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch { return null; }
}

async function removePhotoFromIndexedDB(key: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => db.close();
  } catch { /* ignore */ }
}

export async function clearAllPhotos(draftKey: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        if (String(cursor.key).startsWith(draftKey)) store.delete(cursor.key);
        cursor.continue();
      }
    };
    tx.oncomplete = () => db.close();
  } catch { /* ignore */ }
}

function getDraftKey(formType: string, userId: string): string {
  return `draft_${formType}_${userId}`;
}

// ── File → base64 (sync reader) ─────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function base64ToFile(base64: string, name: string, mime: string): File {
  const parts = base64.split(",");
  const bytes = atob(parts[1]);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], name, { type: mime });
}

// ── Core API ────────────────────────────────────────────────────────────────

// Simpan text data doang (sync) — buat cleanup unmount
export function saveDraftTextSync(
  formType: string,
  userId: string,
  data: Record<string, any>,
) {
  const key = getDraftKey(formType, userId);
  const payload = { data, timestamp: Date.now(), userId, photos: [] as string[], extraPhoto: null };
  localStorage.setItem(key, JSON.stringify(payload));
}

export async function saveDraft(
  formType: string,
  userId: string,
  data: Record<string, any>,
  photos?: File[],
  extraPhotoKeys?: File[],
) {
  const key = getDraftKey(formType, userId);

  // Simpan text data + foto sebagai base64 di localStorage (sync)
  const photoBase64s: string[] = [];
  if (photos) {
    for (const f of photos) {
      try { photoBase64s.push(await fileToBase64(f)); }
      catch { /* skip */ }
    }
  }
  let extraBase64: string | null = null;
  if (extraPhotoKeys && extraPhotoKeys.length > 0 && extraPhotoKeys[0] instanceof File) {
    try { extraBase64 = await fileToBase64(extraPhotoKeys[0]); }
    catch { /* skip */ }
  }
  const payload = { data, timestamp: Date.now(), userId, photos: photoBase64s, extraPhoto: extraBase64 };
  localStorage.setItem(key, JSON.stringify(payload));

  // Backup ke IndexedDB (untuk recovery jika localStorage penuh)
  if (photos) {
    for (let i = 0; i < photos.length; i++) {
      savePhotoToIndexedDB(getPhotoKey(key, i), photos[i]);
    }
  }
  if (extraPhotoKeys) {
    for (let i = 0; i < extraPhotoKeys.length; i++) {
      const file = extraPhotoKeys[i];
      if (file instanceof File) {
        savePhotoToIndexedDB(getPhotoKey(key, `extra_${i}`), file);
      }
    }
  }
}

export async function loadDraft(formType: string, userId: string, extraPhotoCount = 0) {
  const key = getDraftKey(formType, userId);
  const raw = localStorage.getItem(key);
  if (!raw) return { data: null, photoFiles: null, extraPhotoFiles: null };

  try {
    const parsed = JSON.parse(raw);
    if (parsed.userId !== userId) {
      clearDraft(formType, userId);
      return { data: null, photoFiles: null, extraPhotoFiles: null };
    }

    // Restore foto dari base64 di localStorage
    const photoFiles: File[] = (parsed.photos || []).map((b64: string, i: number) =>
      base64ToFile(b64, `photo_${i}.jpg`, "image/jpeg")
    );

    let extraPhotoFiles: File[] = [];
    if (parsed.extraPhoto) {
      extraPhotoFiles = [base64ToFile(parsed.extraPhoto, "qris.jpg", "image/jpeg")];
    }

    // Jika ada foto dari localStorage, return
    if (photoFiles.length > 0) {
      return { data: parsed.data, photoFiles, extraPhotoFiles: extraPhotoFiles.length > 0 ? extraPhotoFiles : null };
    }

    // Fallback: coba ambil dari IndexedDB
    const idbPhotos: File[] = [];
    for (let i = 0; ; i++) {
      const b64 = await getPhotoFromIndexedDB(getPhotoKey(key, i));
      if (!b64) break;
      idbPhotos.push(base64ToFile(b64, `photo_${i}.jpg`, "image/jpeg"));
    }
    const idbExtra: File[] = [];
    for (let i = 0; i < extraPhotoCount; i++) {
      const b64 = await getPhotoFromIndexedDB(getPhotoKey(key, `extra_${i}`));
      if (b64) idbExtra.push(base64ToFile(b64, `extra_${i}.jpg`, "image/jpeg"));
    }

    return { data: parsed.data, photoFiles: idbPhotos.length > 0 ? idbPhotos : null, extraPhotoFiles: idbExtra.length > 0 ? idbExtra : null };
  } catch {
    return { data: null, photoFiles: null, extraPhotoFiles: null };
  }
}

export function clearDraft(formType: string, userId: string) {
  const key = getDraftKey(formType, userId);
  localStorage.removeItem(key);
  clearAllPhotos(key);
}

export function hasDraft(formType: string, userId: string): boolean {
  return localStorage.getItem(getDraftKey(formType, userId)) !== null;
}

function getPhotoKey(draftKey: string, photoIndex: number | string): string {
  return `${draftKey}_photo_${photoIndex}`;
}