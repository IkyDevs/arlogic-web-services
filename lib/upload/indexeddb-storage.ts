const DB_NAME = 'arlogic-uploads'
const DB_VERSION = 1
const FILE_STORE = 'files'
const META_STORE = 'metadata'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE)
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveFileToIndexedDB(key: string, file: File): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite')
    tx.objectStore(FILE_STORE).put(file, key)
    tx.oncomplete = () => {
      console.log('[DEBUG:IndexedDB] saveFile SUCCESS', { key, fileName: file.name, fileSize: file.size })
      db.close()
      resolve()
    }
    tx.onerror = () => {
      console.error('[DEBUG:IndexedDB] saveFile FAILED', { key, error: tx.error })
      db.close()
      reject(tx.error)
    }
  })
}

export async function getFileFromIndexedDB(key: string): Promise<File | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readonly')
    const req = tx.objectStore(FILE_STORE).get(key)
    req.onsuccess = () => {
      const hasFile = !!req.result
      console.log('[DEBUG:IndexedDB] getFile', { key, found: hasFile, fileSize: hasFile ? req.result.size : null })
      db.close()
      resolve(req.result || null)
    }
    req.onerror = () => {
      console.error('[DEBUG:IndexedDB] getFile FAILED', { key, error: req.error })
      db.close()
      reject(req.error)
    }
  })
}

export async function removeFileFromIndexedDB(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite')
    tx.objectStore(FILE_STORE).delete(key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function clearSessionFiles(sessionId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite')
    const store = tx.objectStore(FILE_STORE)
    const req = store.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        if (String(cursor.key).startsWith(sessionId)) {
          store.delete(cursor.key)
        }
        cursor.continue()
      }
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function saveMetadataToIndexedDB(key: string, data: unknown): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite')
    tx.objectStore(META_STORE).put(data, key)
    tx.oncomplete = () => {
      console.log('[DEBUG:IndexedDB] saveMetadata SUCCESS', { key })
      db.close()
      resolve()
    }
    tx.onerror = () => {
      console.error('[DEBUG:IndexedDB] saveMetadata FAILED', { key, error: tx.error })
      db.close()
      reject(tx.error)
    }
  })
}

export async function getMetadataFromIndexedDB<T>(key: string): Promise<T | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly')
    const req = tx.objectStore(META_STORE).get(key)
    req.onsuccess = () => { db.close(); resolve(req.result || null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function removeMetadataFromIndexedDB(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite')
    tx.objectStore(META_STORE).delete(key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
