'use client'

// Lightweight IndexedDB helper for caching lists when offline
// Avoids external dependencies; stores JSON-serializable arrays by key.

type StoreKey = 'projects' | 'chambers'
const DB_NAME = 'offline-cache'
const DB_VERSION = 1
const STORE_NAME = 'collections'

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => resolve(null)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
}

export async function cacheList<T>(key: StoreKey, data: T[]): Promise<void> {
  const db = await openDb()
  if (!db) return
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.onerror = () => resolve() // swallow errors
    const store = tx.objectStore(STORE_NAME)
    const payload = { data, timestamp: Date.now() }
    store.put(payload, key)
    tx.oncomplete = () => resolve()
    tx.onabort = () => resolve()
    tx.onerror = () => resolve()
  })
}

export async function getCachedList<T>(key: StoreKey): Promise<{ data: T[]; timestamp: number } | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    tx.onerror = () => resolve(null)
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => {
      const value = req.result as { data: T[]; timestamp: number } | undefined
      resolve(value ?? null)
    }
    req.onerror = () => resolve(null)
  })
}
